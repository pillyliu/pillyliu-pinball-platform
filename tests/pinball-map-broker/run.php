<?php
declare(strict_types=1);

use PinProf\PinballMap\BrokerProblem;
use PinProf\PinballMap\BrokerService;
use PinProf\PinballMap\CatalogCache;
use PinProf\PinballMap\FileRateLimiter;
use PinProf\PinballMap\ProviderClient;

require_once dirname(__DIR__, 2) . '/shared/pinball-api/_lib/PinballMapBroker.php';

final class FakeProvider implements ProviderClient
{
    /** @var list<array{path: string, query: array<string, mixed>}> */
    public array $calls = [];

    public function __construct(private readonly Closure $responder)
    {
    }

    public function get(string $path, array $query, int $maxBytes = 6_000_000, int $timeoutSeconds = 10): array
    {
        $this->calls[] = ['path' => $path, 'query' => $query];
        return ($this->responder)($path, $query);
    }
}

/** @return array{root: string, cache: string, locks: string, rate: string} */
function make_test_directories(): array
{
    $root = sys_get_temp_dir() . '/pinprof-pbm-test-' . bin2hex(random_bytes(8));
    $paths = [
        'root' => $root,
        'cache' => $root . '/cache',
        'locks' => $root . '/locks',
        'rate' => $root . '/rate',
    ];
    foreach (array_slice($paths, 1) as $path) {
        if (!mkdir($path, 0750, true) && !is_dir($path)) {
            throw new RuntimeException('Unable to create test directory.');
        }
    }
    return $paths;
}

function remove_test_directory(string $root): void
{
    if (!str_starts_with($root, sys_get_temp_dir() . '/pinprof-pbm-test-') || !is_dir($root)) {
        return;
    }
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST,
    );
    foreach ($iterator as $entry) {
        $entry->isDir() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
    }
    rmdir($root);
}

/** @return list<array<string, mixed>> */
function machine_catalog(int $count = 1_000): array
{
    $machines = [];
    for ($id = 1; $id <= $count; $id++) {
        $machines[] = [
            'id' => $id,
            'name' => $id === 1 ? 'Example (Pro)' : ($id === 2 ? 'Example (Premium)' : 'Machine ' . $id),
            'manufacturer' => 'Example Manufacturer',
            'year' => 2020,
            'opdb_id' => $id === 2 ? null : 'OPDB-' . $id,
        ];
    }
    return $machines;
}

function assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assert_same(mixed $expected, mixed $actual, string $message): void
{
    if ($expected !== $actual) {
        throw new RuntimeException($message . '\nExpected: ' . var_export($expected, true) . '\nActual: ' . var_export($actual, true));
    }
}

/** @param class-string<Throwable> $class */
function assert_throws(string $class, Closure $operation, ?string $errorCode = null): void
{
    try {
        $operation();
    } catch (Throwable $error) {
        assert_true($error instanceof $class, 'Unexpected exception: ' . get_class($error));
        if ($errorCode !== null) {
            assert_true($error instanceof BrokerProblem, 'Expected BrokerProblem.');
            assert_same($errorCode, $error->errorCode, 'Unexpected broker error code.');
        }
        return;
    }
    throw new RuntimeException('Expected exception was not thrown.');
}

/** @return BrokerService */
function service_with(FakeProvider $provider, array $directories, int $clock = 1_800_000_000): BrokerService
{
    $catalog = new CatalogCache($provider, $directories['cache'], $directories['locks'], 86_400, static fn (): int => $clock);
    return new BrokerService($provider, $catalog, static fn (): int => $clock);
}

$tests = [];

$tests['address search uses the allowlisted compact upstream request'] = static function (): void {
    $directories = make_test_directories();
    try {
        $provider = new FakeProvider(static fn (string $path, array $query): array => [
            'locations' => [[
                'id' => 42,
                'name' => 'Example Arcade',
                'city' => 'Detroit',
                'state' => 'MI',
                'distance' => 1.25,
                'machine_count' => 9,
                'machine_ids' => [1, 2],
                'location_machine_xrefs' => [['machine_id' => 1]],
            ]],
        ]);
        $result = service_with($provider, $directories)->handle([
            'schemaVersion' => 1,
            'action' => 'search_address',
            'input' => ['address' => 'Detroit, MI', 'radiusMiles' => 25],
            'client' => ['surface' => 'pillyliu-library', 'version' => 'test'],
        ]);
        assert_same('locations/closest_by_address.json', $provider->calls[0]['path'], 'Unexpected endpoint.');
        assert_same(1, $provider->calls[0]['query']['no_details'], 'no_details is required.');
        assert_same('true', $provider->calls[0]['query']['send_all_within_distance'], 'All in-radius results are required.');
        assert_same(42, $result['data']['locations'][0]['id'], 'Location ID was not preserved.');
        assert_true(!array_key_exists('machine_ids', $result['data']['locations'][0]), 'Search response leaked roster data.');
        assert_true(!array_key_exists('location_machine_xrefs', $result['data']['locations'][0]), 'Search response leaked LMX data.');
    } finally {
        remove_test_directory($directories['root']);
    }
};

$tests['location roster maps exact OPDB IDs and preserves null states'] = static function (): void {
    $directories = make_test_directories();
    try {
        $provider = new FakeProvider(static function (string $path, array $query): array {
            if ($path === 'locations/874.json') {
                return [
                    'id' => 874,
                    'name' => 'Ground Kontrol Classic Arcade',
                    'date_last_updated' => '2026-07-27T12:00:00Z',
                    'location_machine_xrefs' => [
                        ['machine_id' => 1],
                        ['machine_id' => 2],
                        ['machine_id' => 5_001],
                    ],
                ];
            }
            if ($path === 'machines.json' && !isset($query['id'])) {
                return ['machines' => machine_catalog()];
            }
            if ($path === 'machines.json' && ($query['id'] ?? null) === 5_001) {
                return ['machines' => []];
            }
            throw new RuntimeException('Unexpected provider call.');
        });
        $result = service_with($provider, $directories)->handle([
            'schemaVersion' => 1,
            'action' => 'location_roster',
            'input' => ['locationId' => 874],
        ]);
        assert_same(['mapped_exact', 'missing_opdb_id', 'catalog_record_missing'], array_column($result['data']['machines'], 'mappingStatus'), 'Mapping states changed.');
        assert_same(['OPDB-1'], $result['data']['mappedOpdbIds'], 'Only exact IDs should be imported.');
        assert_same(2, $result['data']['unmappedCount'], 'Unmapped count changed.');
        assert_same('2026-07-27T12:00:00Z', $result['data']['location']['updatedAt'], 'Normalized update time changed.');
        assert_true(!in_array('locations/874/machine_details.json', array_column($provider->calls, 'path'), true), 'machine_details must not be called.');
    } finally {
        remove_test_directory($directories['root']);
    }
};

$tests['vision accuracy gate avoids any upstream request'] = static function (): void {
    $directories = make_test_directories();
    try {
        $provider = new FakeProvider(static fn (): array => throw new RuntimeException('Provider should not be called.'));
        $result = service_with($provider, $directories)->handle([
            'schemaVersion' => 1,
            'action' => 'vision_nearby',
            'input' => ['latitude' => 42.0, 'longitude' => -83.0, 'horizontalAccuracyMeters' => 151.0],
        ]);
        assert_same('location_accuracy_insufficient', $result['data']['status'], 'Accuracy gate changed.');
        assert_same([], $provider->calls, 'Poor-accuracy requests must not reach Pinball Map.');
    } finally {
        remove_test_directory($directories['root']);
    }
};

$tests['vision applies its fractional distance gate locally'] = static function (): void {
    $directories = make_test_directories();
    try {
        $provider = new FakeProvider(static fn (): array => [
            'location' => ['id' => 1, 'name' => 'Too Far', 'distance' => 0.11, 'machine_ids' => [1]],
        ]);
        $result = service_with($provider, $directories)->handle([
            'schemaVersion' => 1,
            'action' => 'vision_nearby',
            'input' => ['latitude' => 42.0, 'longitude' => -83.0, 'horizontalAccuracyMeters' => null],
        ]);
        assert_same('no_nearby_location', $result['data']['status'], 'Vision distance gate changed.');
        assert_same(1, $provider->calls[0]['query']['max_distance'], 'Upstream distance must remain an integer.');
        assert_same(1, count($provider->calls), 'Too-far location must not trigger a catalog request.');
    } finally {
        remove_test_directory($directories['root']);
    }
};

$tests['stale catalog falls back when refresh fails'] = static function (): void {
    $directories = make_test_directories();
    try {
        $working = new FakeProvider(static fn (): array => ['machines' => machine_catalog()]);
        $first = new CatalogCache($working, $directories['cache'], $directories['locks'], 10, static fn (): int => 100);
        assert_same('fresh', $first->mapMachineIds([1])['metadata']['status'], 'Initial catalog should be fresh.');

        $failing = new FakeProvider(static fn (): array => throw new BrokerProblem('UPSTREAM_UNAVAILABLE', 502, 'Unavailable', true));
        $second = new CatalogCache($failing, $directories['cache'], $directories['locks'], 10, static fn (): int => 1_000);
        $fallback = $second->mapMachineIds([1]);
        assert_same('stale', $fallback['metadata']['status'], 'Valid stale catalog should remain available.');
        assert_same('OPDB-1', $fallback['machines'][0]['opdbId'], 'Stale exact mapping changed.');
    } finally {
        remove_test_directory($directories['root']);
    }
};

$tests['validation rejects fractional search radii and unsupported fields'] = static function (): void {
    $directories = make_test_directories();
    try {
        $provider = new FakeProvider(static fn (): array => []);
        $service = service_with($provider, $directories);
        assert_throws(BrokerProblem::class, static fn () => $service->handle([
            'schemaVersion' => 1,
            'action' => 'search_coordinates',
            'input' => ['latitude' => 42.0, 'longitude' => -83.0, 'radiusMiles' => 0.25],
        ]), 'INVALID_REQUEST');
        assert_throws(BrokerProblem::class, static fn () => $service->handle([
            'schemaVersion' => 1,
            'action' => 'location_roster',
            'input' => ['locationId' => 1, 'forwardUrl' => 'https://example.com'],
        ]), 'INVALID_REQUEST');
        assert_throws(BrokerProblem::class, static fn () => $service->handle([
            'schemaVersion' => 1,
            'action' => 'location_roster',
            'input' => ['locationId' => 1],
            'api_token' => 'must-not-be-accepted',
        ]), 'INVALID_REQUEST');
        assert_throws(BrokerProblem::class, static fn () => $service->handle([
            'schemaVersion' => 1,
            'action' => 'location_roster',
            'input' => ['locationId' => '1'],
        ]), 'INVALID_REQUEST');
        assert_same([], $provider->calls, 'Invalid requests must not reach the provider.');
    } finally {
        remove_test_directory($directories['root']);
    }
};

$tests['file rate limiter is shared and bounded'] = static function (): void {
    $directories = make_test_directories();
    try {
        $limiter = new FileRateLimiter($directories['rate'], 'test-hmac-key');
        $limiter->enforce('test', '198.51.100.1', 2, 60);
        $limiter->enforce('test', '198.51.100.1', 2, 60);
        assert_throws(BrokerProblem::class, static fn () => $limiter->enforce('test', '198.51.100.1', 2, 60), 'RATE_LIMITED');
        $files = glob($directories['rate'] . '/*.json') ?: [];
        assert_same(1, count($files), 'Unexpected rate-state file count.');
        assert_true(!str_contains(basename($files[0]), '198.51.100.1'), 'Raw IP address was stored in the filename.');
    } finally {
        remove_test_directory($directories['root']);
    }
};

$failures = 0;
foreach ($tests as $name => $test) {
    try {
        $test();
        fwrite(STDOUT, "[PASS] {$name}\n");
    } catch (Throwable $error) {
        $failures++;
        fwrite(STDERR, "[FAIL] {$name}\n{$error->getMessage()}\n");
    }
}

if ($failures > 0) {
    fwrite(STDERR, "\n{$failures} broker test(s) failed.\n");
    exit(1);
}

fwrite(STDOUT, "\nAll Pinball Map broker tests passed.\n");
