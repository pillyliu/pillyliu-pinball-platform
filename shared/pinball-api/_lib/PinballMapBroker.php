<?php
declare(strict_types=1);

namespace PinProf\PinballMap;

use Closure;
use JsonException;
use RuntimeException;
use Throwable;

final class BrokerProblem extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        public readonly int $httpStatus,
        string $publicMessage,
        public readonly bool $retryable = false,
        public readonly ?int $retryAfterSeconds = null,
        ?Throwable $previous = null,
    ) {
        parent::__construct($publicMessage, 0, $previous);
    }
}

interface ProviderClient
{
    /** @return array<string, mixed> */
    public function get(string $path, array $query, int $maxBytes = 6_000_000, int $timeoutSeconds = 10): array;
}

final class FileRateLimiter
{
    public function __construct(
        private readonly string $directory,
        private readonly string $hmacKey,
    ) {
        if ($this->hmacKey === '') {
            throw new BrokerProblem('CONFIGURATION_ERROR', 503, 'Pinball Map service is not configured.', false);
        }
        ensure_private_directory($this->directory);
    }

    public function enforce(string $scope, string $identity, int $limit, int $windowSeconds): void
    {
        $now = time();
        $key = hash_hmac('sha256', $scope . '|' . $identity, $this->hmacKey);
        $path = $this->directory . '/' . safe_filename($scope) . '-' . $key . '.json';
        $handle = @fopen($path, 'c+');
        if ($handle === false) {
            throw new BrokerProblem('RATE_LIMIT_UNAVAILABLE', 503, 'Pinball Map service is temporarily unavailable.', true);
        }
        @chmod($path, 0640);

        try {
            if (!flock($handle, LOCK_EX)) {
                throw new BrokerProblem('RATE_LIMIT_UNAVAILABLE', 503, 'Pinball Map service is temporarily unavailable.', true);
            }

            $raw = stream_get_contents($handle);
            $state = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
            $startedAt = is_array($state) && isset($state['started_at']) ? (int) $state['started_at'] : $now;
            $count = is_array($state) && isset($state['count']) ? (int) $state['count'] : 0;

            if ($startedAt <= 0 || $now - $startedAt >= $windowSeconds) {
                $startedAt = $now;
                $count = 0;
            }

            if ($count >= $limit) {
                $retryAfter = max(1, $windowSeconds - ($now - $startedAt));
                throw new BrokerProblem('RATE_LIMITED', 429, 'Too many Pinball Map requests. Please try again shortly.', true, $retryAfter);
            }

            $encoded = json_encode([
                'started_at' => $startedAt,
                'count' => $count + 1,
            ], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            rewind($handle);
            ftruncate($handle, 0);
            fwrite($handle, $encoded);
            fflush($handle);
        } catch (JsonException $error) {
            throw new BrokerProblem('RATE_LIMIT_UNAVAILABLE', 503, 'Pinball Map service is temporarily unavailable.', true, null, $error);
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }
}

final class CurlProviderClient implements ProviderClient
{
    public function __construct(
        private readonly string $apiToken,
        private readonly ?FileRateLimiter $rateLimiter = null,
        private readonly string $baseUrl = 'https://pinballmap.com/api/v1/',
    ) {
        if ($this->apiToken === '') {
            throw new BrokerProblem('CONFIGURATION_ERROR', 503, 'Pinball Map service is not configured.', false);
        }
    }

    public function get(string $path, array $query, int $maxBytes = 6_000_000, int $timeoutSeconds = 10): array
    {
        if (!preg_match('#^(?:locations/closest_by_(?:address|lat_lon)|locations/[1-9][0-9]*|machines)\.json$#', $path)) {
            throw new BrokerProblem('INTERNAL_ERROR', 500, 'Pinball Map service configuration is invalid.', false);
        }

        $query['api_token'] = $this->apiToken;
        $url = rtrim($this->baseUrl, '/') . '/' . ltrim($path, '/') . '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
        $lastProblem = null;

        for ($attempt = 0; $attempt < 2; $attempt++) {
            try {
                $this->rateLimiter?->enforce('provider-global', 'shared-token', 90, 60);
                return $this->perform($url, $maxBytes, $timeoutSeconds);
            } catch (BrokerProblem $problem) {
                $lastProblem = $problem;
                if (!$problem->retryable || $problem->httpStatus === 429 || $attempt > 0) {
                    throw $problem;
                }
                usleep(100_000);
            }
        }

        throw $lastProblem ?? new BrokerProblem('UPSTREAM_UNAVAILABLE', 502, 'Pinball Map is temporarily unavailable.', true);
    }

    /** @return array<string, mixed> */
    private function perform(string $url, int $maxBytes, int $timeoutSeconds): array
    {
        if (!function_exists('curl_init')) {
            throw new BrokerProblem('CONFIGURATION_ERROR', 503, 'Pinball Map service is not configured.', false);
        }

        $body = '';
        $tooLarge = false;
        $retryAfter = null;
        $handle = curl_init($url);
        if ($handle === false) {
            throw new BrokerProblem('UPSTREAM_UNAVAILABLE', 502, 'Pinball Map is temporarily unavailable.', true);
        }

        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => $timeoutSeconds,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_USERAGENT => 'PinProfPinballMapBroker/1.0 (+https://pinprof.com)',
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use (&$body, &$tooLarge, $maxBytes): int {
                if (strlen($body) + strlen($chunk) > $maxBytes) {
                    $tooLarge = true;
                    return 0;
                }
                $body .= $chunk;
                return strlen($chunk);
            },
            CURLOPT_HEADERFUNCTION => static function ($curl, string $header) use (&$retryAfter): int {
                if (stripos($header, 'Retry-After:') === 0) {
                    $value = trim(substr($header, strlen('Retry-After:')));
                    if (ctype_digit($value)) {
                        $retryAfter = max(1, (int) $value);
                    }
                }
                return strlen($header);
            },
        ]);

        $result = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $errorNumber = curl_errno($handle);
        curl_close($handle);

        if ($tooLarge) {
            throw new BrokerProblem('UPSTREAM_RESPONSE_TOO_LARGE', 502, 'Pinball Map returned an unexpected response.', true);
        }
        if ($result === false || $errorNumber !== CURLE_OK) {
            $isTimeout = $errorNumber === CURLE_OPERATION_TIMEDOUT;
            throw new BrokerProblem(
                $isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
                $isTimeout ? 504 : 502,
                $isTimeout ? 'Pinball Map timed out.' : 'Pinball Map is temporarily unavailable.',
                true,
            );
        }

        if ($status < 200 || $status >= 300) {
            if ($status === 404) {
                throw new BrokerProblem('NOT_FOUND', 404, 'The requested Pinball Map location was not found.', false);
            }
            if ($status === 401 || $status === 403) {
                throw new BrokerProblem('UPSTREAM_AUTH_FAILED', 502, 'Pinball Map authentication failed.', false);
            }
            if ($status === 422 || $status === 400) {
                throw new BrokerProblem('UPSTREAM_REJECTED', 422, 'Pinball Map rejected the request.', false);
            }
            if ($status === 429) {
                throw new BrokerProblem('UPSTREAM_RATE_LIMITED', 429, 'Pinball Map is temporarily rate limited.', true, $retryAfter);
            }
            if (in_array($status, [502, 503, 504], true)) {
                throw new BrokerProblem('UPSTREAM_UNAVAILABLE', 502, 'Pinball Map is temporarily unavailable.', true);
            }
            throw new BrokerProblem('UPSTREAM_ERROR', 502, 'Pinball Map returned an unexpected response.', false);
        }

        try {
            $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            throw new BrokerProblem('UPSTREAM_INVALID_RESPONSE', 502, 'Pinball Map returned an unexpected response.', true, null, $error);
        }
        if (!is_array($decoded)) {
            throw new BrokerProblem('UPSTREAM_INVALID_RESPONSE', 502, 'Pinball Map returned an unexpected response.', true);
        }
        return $decoded;
    }
}

final class CatalogCache
{
    private readonly string $cachePath;
    private readonly string $lockPath;
    private readonly Closure $clock;

    public function __construct(
        private readonly ProviderClient $provider,
        string $cacheDirectory,
        string $lockDirectory,
        private readonly int $ttlSeconds = 86_400,
        ?callable $clock = null,
    ) {
        ensure_private_directory($cacheDirectory);
        ensure_private_directory($lockDirectory);
        $this->cachePath = rtrim($cacheDirectory, '/') . '/machines-v2.json';
        $this->lockPath = rtrim($lockDirectory, '/') . '/machines-v2.lock';
        $this->clock = Closure::fromCallable($clock ?? static fn (): int => time());
    }

    /**
     * @param list<int> $machineIds
     * @return array{machines: list<array<string, mixed>>, metadata: array<string, mixed>}
     */
    public function mapMachineIds(array $machineIds): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $machineIds), static fn (int $id): bool => $id > 0)));
        if ($ids === []) {
            return [
                'machines' => [],
                'metadata' => [
                    'status' => 'not_requested',
                    'fetchedAt' => null,
                    'machineCount' => 0,
                ],
            ];
        }
        $loaded = $this->loadOrRefresh();
        $catalog = $loaded['catalog'];
        $missing = array_values(array_filter($ids, static fn (int $id): bool => !isset($catalog['machines'][(string) $id])));

        if ($missing !== []) {
            try {
                $catalog = $this->refreshMissing($catalog, $missing);
                $loaded['catalog'] = $catalog;
                $loaded['status'] = $this->isFresh($catalog) ? 'fresh' : $loaded['status'];
            } catch (BrokerProblem) {
                // A valid catalog is still useful. Missing records remain explicit and are never guessed.
            }
        }

        $mapped = [];
        foreach ($ids as $id) {
            $record = $catalog['machines'][(string) $id] ?? null;
            if (!is_array($record)) {
                $mapped[] = [
                    'pinballMapId' => $id,
                    'opdbId' => null,
                    'ipdbId' => null,
                    'name' => null,
                    'manufacturer' => null,
                    'year' => null,
                    'mappingStatus' => 'catalog_record_missing',
                ];
                continue;
            }
            $opdbId = normalized_string($record['opdbId'] ?? null);
            $mapped[] = [
                'pinballMapId' => $id,
                'opdbId' => $opdbId,
                'ipdbId' => positive_int_or_null($record['ipdbId'] ?? null),
                'name' => normalized_string($record['name'] ?? null),
                'manufacturer' => normalized_string($record['manufacturer'] ?? null),
                'year' => positive_int_or_null($record['year'] ?? null),
                'mappingStatus' => $opdbId === null ? 'missing_opdb_id' : 'mapped_exact',
            ];
        }

        return [
            'machines' => $mapped,
            'metadata' => [
                'status' => $loaded['status'],
                'fetchedAt' => iso8601_from_epoch((int) ($catalog['fetched_at'] ?? 0)),
                'machineCount' => count($catalog['machines'] ?? []),
            ],
        ];
    }

    /** @return array{catalog: array<string, mixed>, status: string} */
    private function loadOrRefresh(): array
    {
        $catalog = $this->readCatalog();
        if ($catalog !== null && $this->isFresh($catalog)) {
            return ['catalog' => $catalog, 'status' => 'fresh'];
        }

        $handle = $this->acquireRefreshLock($catalog === null);
        if ($handle === null && $catalog !== null) {
            return ['catalog' => $catalog, 'status' => 'stale'];
        }
        if ($handle === null) {
            throw new BrokerProblem('CATALOG_UNAVAILABLE', 503, 'The Pinball Map machine catalog is temporarily unavailable.', true);
        }

        try {
            $current = $this->readCatalog();
            if ($current !== null && $this->isFresh($current)) {
                return ['catalog' => $current, 'status' => 'fresh'];
            }
            try {
                $refreshed = $this->fetchFullCatalog();
                $this->writeCatalog($refreshed);
                return ['catalog' => $refreshed, 'status' => 'fresh'];
            } catch (BrokerProblem $problem) {
                if ($current !== null) {
                    return ['catalog' => $current, 'status' => 'stale'];
                }
                throw $problem;
            }
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    /** @param list<int> $missing */
    private function refreshMissing(array $catalog, array $missing): array
    {
        $handle = $this->acquireRefreshLock(false);
        if ($handle === null) {
            return $catalog;
        }

        try {
            $current = $this->readCatalog() ?? $catalog;
            $stillMissing = array_values(array_filter($missing, static fn (int $id): bool => !isset($current['machines'][(string) $id])));
            if ($stillMissing === []) {
                return $current;
            }

            if (count($stillMissing) > 3) {
                $current = $this->fetchFullCatalog();
                $this->writeCatalog($current);
                return $current;
            }

            $changed = false;
            foreach ($stillMissing as $id) {
                $payload = $this->provider->get('machines.json', ['id' => $id], 500_000, 10);
                $records = isset($payload['machines']) && is_array($payload['machines']) ? $payload['machines'] : [];
                foreach ($records as $record) {
                    $normalized = $this->normalizeMachine($record);
                    if ($normalized !== null && $normalized['pinballMapId'] === $id) {
                        $current['machines'][(string) $id] = $normalized;
                        $changed = true;
                    }
                }
            }

            if ($changed) {
                $current['updated_at'] = ($this->clock)();
                $this->writeCatalog($current);
            }
            return $current;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    /** @return array<string, mixed> */
    private function fetchFullCatalog(): array
    {
        // The compatibility catalog deliberately retains IPDB metadata because the
        // pre-broker Vision evidence contract carried it. This remains one private,
        // infrequent bulk request rather than a per-location machine_details call.
        $payload = $this->provider->get('machines.json', [], 20_000_000, 15);
        $records = isset($payload['machines']) && is_array($payload['machines']) ? $payload['machines'] : [];
        $machines = [];
        foreach ($records as $record) {
            $normalized = $this->normalizeMachine($record);
            if ($normalized !== null) {
                $machines[(string) $normalized['pinballMapId']] = $normalized;
            }
        }
        if (count($machines) < 1_000 || count($machines) > 20_000) {
            throw new BrokerProblem('CATALOG_INVALID', 502, 'Pinball Map returned an invalid machine catalog.', true);
        }
        ksort($machines, SORT_NUMERIC);
        $now = ($this->clock)();
        return [
            'schema_version' => 2,
            'fetched_at' => $now,
            'updated_at' => $now,
            'machines' => $machines,
        ];
    }

    /** @return array<string, mixed>|null */
    private function normalizeMachine(mixed $record): ?array
    {
        if (!is_array($record)) {
            return null;
        }
        $id = positive_int_or_null($record['id'] ?? null);
        if ($id === null) {
            return null;
        }
        return [
            'pinballMapId' => $id,
            'opdbId' => normalized_string($record['opdb_id'] ?? null),
            'ipdbId' => positive_int_or_null($record['ipdb_id'] ?? null),
            'name' => normalized_string($record['name'] ?? null),
            'manufacturer' => normalized_string($record['manufacturer'] ?? null),
            'year' => positive_int_or_null($record['year'] ?? null),
        ];
    }

    /** @return array<string, mixed>|null */
    private function readCatalog(): ?array
    {
        if (!is_file($this->cachePath) || !is_readable($this->cachePath)) {
            return null;
        }
        $raw = @file_get_contents($this->cachePath);
        if (!is_string($raw) || $raw === '') {
            return null;
        }
        try {
            $catalog = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return null;
        }
        if (!is_array($catalog) || ($catalog['schema_version'] ?? null) !== 2 || !isset($catalog['machines']) || !is_array($catalog['machines'])) {
            return null;
        }
        $machineCount = count($catalog['machines']);
        if ($machineCount < 1_000 || $machineCount > 20_000) {
            return null;
        }
        return $catalog;
    }

    private function isFresh(array $catalog): bool
    {
        $fetchedAt = (int) ($catalog['fetched_at'] ?? 0);
        return $fetchedAt > 0 && (($this->clock)() - $fetchedAt) < $this->ttlSeconds;
    }

    /** @return resource|null */
    private function acquireRefreshLock(bool $waitForInitial): mixed
    {
        $handle = @fopen($this->lockPath, 'c+');
        if ($handle === false) {
            return null;
        }
        @chmod($this->lockPath, 0640);
        $deadline = microtime(true) + ($waitForInitial ? 3.0 : 0.0);
        do {
            if (flock($handle, LOCK_EX | LOCK_NB)) {
                return $handle;
            }
            if (!$waitForInitial) {
                break;
            }
            usleep(100_000);
        } while (microtime(true) < $deadline);
        fclose($handle);
        return null;
    }

    private function writeCatalog(array $catalog): void
    {
        try {
            $encoded = json_encode($catalog, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            throw new BrokerProblem('CATALOG_WRITE_FAILED', 503, 'The Pinball Map machine catalog is temporarily unavailable.', true, null, $error);
        }

        $tempPath = tempnam(dirname($this->cachePath), 'machines-v2.');
        if ($tempPath === false) {
            throw new BrokerProblem('CATALOG_WRITE_FAILED', 503, 'The Pinball Map machine catalog is temporarily unavailable.', true);
        }
        $handle = @fopen($tempPath, 'wb');
        try {
            if ($handle === false || fwrite($handle, $encoded) !== strlen($encoded)) {
                throw new BrokerProblem('CATALOG_WRITE_FAILED', 503, 'The Pinball Map machine catalog is temporarily unavailable.', true);
            }
            fflush($handle);
            if (function_exists('fsync')) {
                fsync($handle);
            }
            fclose($handle);
            $handle = null;
            @chmod($tempPath, 0640);
            if (!rename($tempPath, $this->cachePath)) {
                throw new BrokerProblem('CATALOG_WRITE_FAILED', 503, 'The Pinball Map machine catalog is temporarily unavailable.', true);
            }
        } finally {
            if (is_resource($handle)) {
                fclose($handle);
            }
            if (is_file($tempPath)) {
                @unlink($tempPath);
            }
        }
    }
}

final class BrokerService
{
    public const SCHEMA_VERSION = 1;
    private const ACTIONS = ['search_address', 'search_coordinates', 'location_roster', 'nearest_location_roster', 'vision_nearby'];
    private const CLIENT_SURFACES = [
        'pinprof-ios',
        'pinprof-android',
        'pinprof-web',
        'pillyliu-library',
        'pinprof-vision-ios',
        'pinprof-vision-android',
        'pinprof-vision-python',
        'pinprof-admin',
        'test',
    ];

    public function __construct(
        private readonly ProviderClient $provider,
        private readonly CatalogCache $catalog,
        private readonly ?Closure $clock = null,
    ) {
    }

    /** @return array<string, mixed> */
    public function handle(array $payload): array
    {
        assert_only_keys($payload, ['schemaVersion', 'action', 'input', 'client']);
        if (($payload['schemaVersion'] ?? null) !== self::SCHEMA_VERSION) {
            throw new BrokerProblem('UNSUPPORTED_SCHEMA_VERSION', 400, 'Unsupported Pinball Map request version.', false);
        }
        $action = normalized_string($payload['action'] ?? null);
        if ($action === null || !in_array($action, self::ACTIONS, true)) {
            throw new BrokerProblem('INVALID_ACTION', 400, 'Unsupported Pinball Map action.', false);
        }
        $input = $payload['input'] ?? null;
        if (!is_array($input)) {
            throw new BrokerProblem('INVALID_REQUEST', 400, 'Pinball Map request input is missing.', false);
        }
        $this->validateClient($payload['client'] ?? null);

        return match ($action) {
            'search_address' => $this->searchAddress($input),
            'search_coordinates' => $this->searchCoordinates($input),
            'location_roster' => $this->locationRoster($input),
            'nearest_location_roster' => $this->nearestLocationRoster($input),
            'vision_nearby' => $this->visionNearby($input),
        };
    }

    /** @return array<string, mixed> */
    private function searchAddress(array $input): array
    {
        assert_only_keys($input, ['address', 'radiusMiles']);
        $address = required_string($input['address'] ?? null, 'address', 2, 200);
        $radius = required_int_in_range($input['radiusMiles'] ?? null, 'radiusMiles', 1, 100);
        $root = $this->provider->get('locations/closest_by_address.json', [
            'address' => $address,
            'max_distance' => $radius,
            'send_all_within_distance' => 'true',
            'no_details' => 1,
        ]);
        return $this->success(['locations' => $this->locationsFromRoot($root)], 'not_included', null);
    }

    /** @return array<string, mixed> */
    private function searchCoordinates(array $input): array
    {
        assert_only_keys($input, ['latitude', 'longitude', 'radiusMiles']);
        $latitude = required_float_in_range($input['latitude'] ?? null, 'latitude', -90, 90);
        $longitude = required_float_in_range($input['longitude'] ?? null, 'longitude', -180, 180);
        $radius = required_int_in_range($input['radiusMiles'] ?? null, 'radiusMiles', 1, 100);
        $root = $this->provider->get('locations/closest_by_lat_lon.json', [
            'lat' => format_coordinate($latitude),
            'lon' => format_coordinate($longitude),
            'max_distance' => $radius,
            'send_all_within_distance' => 'true',
            'no_details' => 1,
        ]);
        return $this->success(['locations' => $this->locationsFromRoot($root)], 'not_included', null);
    }

    /** @return array<string, mixed> */
    private function locationRoster(array $input): array
    {
        assert_only_keys($input, ['locationId']);
        $locationId = required_int_in_range($input['locationId'] ?? null, 'locationId', 1, PHP_INT_MAX);
        $root = $this->provider->get('locations/' . $locationId . '.json', ['no_details' => 1]);
        $machineIds = [];
        $xrefs = isset($root['location_machine_xrefs']) && is_array($root['location_machine_xrefs']) ? $root['location_machine_xrefs'] : [];
        foreach ($xrefs as $xref) {
            if (!is_array($xref)) {
                continue;
            }
            $id = positive_int_or_null($xref['machine_id'] ?? null);
            if ($id !== null) {
                $machineIds[] = $id;
            }
        }
        $mapping = $this->catalog->mapMachineIds($machineIds);
        return $this->success([
            'location' => $this->normalizeLocation($root),
            'machines' => $mapping['machines'],
            'mappedOpdbIds' => mapped_opdb_ids($mapping['machines']),
            'unmappedCount' => count(array_filter($mapping['machines'], static fn (array $machine): bool => $machine['mappingStatus'] !== 'mapped_exact')),
            'rosterComplete' => $this->rosterIsComplete($mapping['machines']),
        ], 'live', $mapping['metadata']);
    }

    /**
     * Return provider-equivalent nearest-venue and machine data without applying
     * any client product policy. Swift and Python keep their pre-broker accuracy,
     * distance, status, cache, and candidate transformations.
     *
     * @return array<string, mixed>
     */
    private function nearestLocationRoster(array $input): array
    {
        assert_only_keys($input, ['latitude', 'longitude', 'maxDistanceMiles']);
        $latitude = required_float_in_range($input['latitude'] ?? null, 'latitude', -90, 90);
        $longitude = required_float_in_range($input['longitude'] ?? null, 'longitude', -180, 180);
        required_float_in_range($input['maxDistanceMiles'] ?? null, 'maxDistanceMiles', 0.01, 25);
        $root = $this->provider->get('locations/closest_by_lat_lon.json', [
            'lat' => format_coordinate($latitude),
            'lon' => format_coordinate($longitude),
            // Match the pre-broker clients: ask Pinball Map for its nearest venue
            // using the provider's default range, then leave the precise product
            // distance gate to the client.
            'no_details' => 1,
        ]);
        $rawLocation = isset($root['location']) && is_array($root['location']) ? $root['location'] : null;
        if ($rawLocation === null) {
            return $this->success([
                'location' => null,
                'machines' => [],
                'mappedOpdbIds' => [],
                'unmappedCount' => 0,
                'rosterComplete' => true,
            ], 'live', null);
        }

        $machineIds = array_values(array_filter(
            array_map('intval', is_array($rawLocation['machine_ids'] ?? null) ? $rawLocation['machine_ids'] : []),
            static fn (int $id): bool => $id > 0,
        ));
        $providerNames = is_array($rawLocation['machine_names'] ?? null) ? array_values($rawLocation['machine_names']) : [];
        try {
            $mapping = $this->catalog->mapMachineIds($machineIds);
        } catch (BrokerProblem $problem) {
            $machines = [];
            foreach ($machineIds as $index => $machineId) {
                $machines[] = [
                    'pinballMapId' => $machineId,
                    'opdbId' => null,
                    'ipdbId' => null,
                    'name' => null,
                    'providerDisplayName' => normalized_string($providerNames[$index] ?? null),
                    'manufacturer' => null,
                    'year' => null,
                    'mappingStatus' => 'catalog_record_missing',
                ];
            }
            return $this->success([
                'location' => $this->normalizeLocation($rawLocation),
                'machines' => $machines,
                'mappedOpdbIds' => [],
                'unmappedCount' => count($machines),
                'rosterComplete' => false,
            ], 'live', [
                'status' => 'unavailable',
                'fetchedAt' => null,
                'machineCount' => 0,
                'errorCode' => $problem->errorCode,
            ]);
        }

        $machines = $this->machinesWithProviderNames($mapping['machines'], $machineIds, $providerNames);
        return $this->success([
            'location' => $this->normalizeLocation($rawLocation),
            'machines' => $machines,
            'mappedOpdbIds' => mapped_opdb_ids($machines),
            'unmappedCount' => count(array_filter($machines, static fn (array $machine): bool => $machine['mappingStatus'] !== 'mapped_exact')),
            'rosterComplete' => $this->rosterIsComplete($machines),
        ], 'live', $mapping['metadata']);
    }

    /** @return array<string, mixed> */
    private function visionNearby(array $input): array
    {
        assert_only_keys($input, ['latitude', 'longitude', 'horizontalAccuracyMeters']);
        $latitude = required_float_in_range($input['latitude'] ?? null, 'latitude', -90, 90);
        $longitude = required_float_in_range($input['longitude'] ?? null, 'longitude', -180, 180);
        $accuracy = optional_float_in_range($input['horizontalAccuracyMeters'] ?? null, 'horizontalAccuracyMeters', 0, 10_000);
        if ($accuracy !== null && $accuracy > 150) {
            return $this->success([
                'status' => 'location_accuracy_insufficient',
                'location' => null,
                'machines' => [],
                'mappedOpdbIds' => [],
                'unmappedCount' => 0,
                'distanceGateMiles' => null,
            ], 'not_requested', null);
        }

        $distanceGate = $accuracy === null
            ? 0.10
            : min(0.25, max(0.10, ($accuracy / 1609.344) + 0.05));
        $root = $this->provider->get('locations/closest_by_lat_lon.json', [
            'lat' => format_coordinate($latitude),
            'lon' => format_coordinate($longitude),
            // Pinball Map parses max_distance with to_i, so use an integer and apply the precise gate locally.
            'max_distance' => 1,
            'no_details' => 1,
        ]);
        $rawLocation = isset($root['location']) && is_array($root['location']) ? $root['location'] : null;
        if ($rawLocation === null) {
            return $this->success([
                'status' => 'no_nearby_location',
                'location' => null,
                'machines' => [],
                'mappedOpdbIds' => [],
                'unmappedCount' => 0,
                'distanceGateMiles' => $distanceGate,
            ], 'live', null);
        }
        $location = $this->normalizeLocation($rawLocation);
        $distance = is_numeric($location['distanceMiles'] ?? null) ? (float) $location['distanceMiles'] : null;
        if ($distance === null || $distance > $distanceGate) {
            return $this->success([
                'status' => 'no_nearby_location',
                'location' => null,
                'machines' => [],
                'mappedOpdbIds' => [],
                'unmappedCount' => 0,
                'distanceGateMiles' => $distanceGate,
            ], 'live', null);
        }

        $machineIds = array_values(array_filter(array_map('intval', is_array($rawLocation['machine_ids'] ?? null) ? $rawLocation['machine_ids'] : []), static fn (int $id): bool => $id > 0));
        $mapping = $this->catalog->mapMachineIds($machineIds);
        $providerNames = is_array($rawLocation['machine_names'] ?? null) ? array_values($rawLocation['machine_names']) : [];
        $machines = $this->machinesWithProviderNames($mapping['machines'], $machineIds, $providerNames);
        return $this->success([
            'status' => 'matched',
            'location' => $location,
            'machines' => $machines,
            'mappedOpdbIds' => mapped_opdb_ids($machines),
            'unmappedCount' => count(array_filter($machines, static fn (array $machine): bool => $machine['mappingStatus'] !== 'mapped_exact')),
            'rosterComplete' => $this->rosterIsComplete($machines),
            'distanceGateMiles' => $distanceGate,
        ], 'live', $mapping['metadata']);
    }

    /**
     * @param list<array<string, mixed>> $machines
     * @param list<int> $machineIds
     * @param list<mixed> $providerNames
     * @return list<array<string, mixed>>
     */
    private function machinesWithProviderNames(array $machines, array $machineIds, array $providerNames): array
    {
        $namesById = [];
        foreach ($machineIds as $index => $machineId) {
            $namesById[$machineId] = normalized_string($providerNames[$index] ?? null);
        }
        return array_map(static function (array $machine) use ($namesById): array {
            $machineId = positive_int_or_null($machine['pinballMapId'] ?? null);
            $machine['providerDisplayName'] = $machineId === null ? null : ($namesById[$machineId] ?? null);
            return $machine;
        }, $machines);
    }

    /** @param list<array<string, mixed>> $machines */
    private function rosterIsComplete(array $machines): bool
    {
        return !in_array('catalog_record_missing', array_column($machines, 'mappingStatus'), true);
    }

    /** @return list<array<string, mixed>> */
    private function locationsFromRoot(array $root): array
    {
        $rows = [];
        if (isset($root['locations']) && is_array($root['locations'])) {
            $rows = $root['locations'];
        } elseif (isset($root['location']) && is_array($root['location'])) {
            $rows = [$root['location']];
        }
        $locations = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $location = $this->normalizeLocation($row);
            if ($location['id'] !== null) {
                $locations[] = $location;
            }
        }
        return $locations;
    }

    /** @return array<string, mixed> */
    private function normalizeLocation(array $raw): array
    {
        return [
            'id' => positive_int_or_null($raw['id'] ?? null),
            'name' => normalized_string($raw['name'] ?? null) ?? 'Pinball venue',
            'street' => normalized_string($raw['street'] ?? null),
            'city' => normalized_string($raw['city'] ?? null),
            'state' => normalized_string($raw['state'] ?? null),
            'zip' => normalized_string($raw['zip'] ?? null),
            'latitude' => numeric_or_null($raw['lat'] ?? null),
            'longitude' => numeric_or_null($raw['lon'] ?? null),
            'distanceMiles' => numeric_or_null($raw['distance'] ?? null),
            'machineCount' => positive_int_or_zero($raw['machine_count'] ?? $raw['num_machines'] ?? null),
            'dateLastUpdated' => normalized_string($raw['date_last_updated'] ?? null),
            'updatedAt' => normalized_string($raw['updated_at'] ?? $raw['date_last_updated'] ?? null),
        ];
    }

    /** @return array<string, mixed> */
    private function success(array $data, string $rosterFreshness, ?array $catalogMetadata): array
    {
        $now = $this->clock ? ($this->clock)() : time();
        $provenance = [
            'provider' => 'pinball_map',
            'providerName' => 'Pinball Map',
            'providerUrl' => 'https://pinballmap.com',
            'attribution' => 'Venue data provided by Pinball Map.',
            'retrievedAt' => gmdate('c', $now),
            'rosterFreshness' => $rosterFreshness,
            'contractVersion' => self::SCHEMA_VERSION,
        ];
        if ($catalogMetadata !== null) {
            $provenance['catalog'] = $catalogMetadata;
        }
        return ['data' => $data, 'provenance' => $provenance];
    }

    private function validateClient(mixed $client): void
    {
        if ($client === null) {
            return;
        }
        if (!is_array($client)) {
            throw new BrokerProblem('INVALID_REQUEST', 400, 'Invalid Pinball Map client metadata.', false);
        }
        assert_only_keys($client, ['surface', 'version']);
        if (isset($client['surface'])) {
            $surface = required_string($client['surface'], 'client.surface', 1, 64);
            if (!in_array($surface, self::CLIENT_SURFACES, true)) {
                throw new BrokerProblem('INVALID_REQUEST', 400, 'Invalid client.surface.', false);
            }
        }
        if (isset($client['version'])) {
            required_string($client['version'], 'client.version', 1, 64);
        }
    }
}

function ensure_private_directory(string $directory): void
{
    if (!is_dir($directory) && !@mkdir($directory, 0750, true) && !is_dir($directory)) {
        throw new BrokerProblem('CONFIGURATION_ERROR', 503, 'Pinball Map service is not configured.', false);
    }
    @chmod($directory, 0750);
}

function safe_filename(string $value): string
{
    return preg_replace('/[^a-z0-9_-]+/i', '-', $value) ?: 'scope';
}

function normalized_string(mixed $value): ?string
{
    if (!is_string($value)) {
        return null;
    }
    $trimmed = trim($value);
    return $trimmed === '' ? null : $trimmed;
}

function required_string(mixed $value, string $field, int $minLength, int $maxLength): string
{
    $normalized = normalized_string($value);
    $length = $normalized === null ? 0 : (function_exists('mb_strlen') ? mb_strlen($normalized) : strlen($normalized));
    if ($normalized === null || $length < $minLength || $length > $maxLength || preg_match('/[\x00-\x1F\x7F]/u', $normalized)) {
        throw new BrokerProblem('INVALID_REQUEST', 400, 'Invalid ' . $field . '.', false);
    }
    return $normalized;
}

function required_int_in_range(mixed $value, string $field, int $minimum, int $maximum): int
{
    if (!is_int($value) || $value < $minimum || $value > $maximum) {
        throw new BrokerProblem('INVALID_REQUEST', 400, 'Invalid ' . $field . '.', false);
    }
    return $value;
}

function required_float_in_range(mixed $value, string $field, float $minimum, float $maximum): float
{
    if (!is_int($value) && !is_float($value)) {
        throw new BrokerProblem('INVALID_REQUEST', 400, 'Invalid ' . $field . '.', false);
    }
    $number = (float) $value;
    if (!is_finite($number) || $number < $minimum || $number > $maximum) {
        throw new BrokerProblem('INVALID_REQUEST', 400, 'Invalid ' . $field . '.', false);
    }
    return $number;
}

function optional_float_in_range(mixed $value, string $field, float $minimum, float $maximum): ?float
{
    if ($value === null) {
        return null;
    }
    return required_float_in_range($value, $field, $minimum, $maximum);
}

function positive_int_or_null(mixed $value): ?int
{
    if (!is_int($value) && !(is_string($value) && ctype_digit($value))) {
        return null;
    }
    $integer = (int) $value;
    return $integer > 0 ? $integer : null;
}

function positive_int_or_zero(mixed $value): int
{
    if (!is_numeric($value)) {
        return 0;
    }
    return max(0, (int) $value);
}

function numeric_or_null(mixed $value): ?float
{
    if (!is_numeric($value)) {
        return null;
    }
    $number = (float) $value;
    return is_finite($number) ? $number : null;
}

function format_coordinate(float $value): string
{
    return rtrim(rtrim(number_format($value, 7, '.', ''), '0'), '.');
}

function iso8601_from_epoch(int $epoch): ?string
{
    return $epoch > 0 ? gmdate('c', $epoch) : null;
}

function assert_only_keys(array $value, array $allowed): void
{
    $unexpected = array_diff(array_keys($value), $allowed);
    if ($unexpected !== []) {
        throw new BrokerProblem('INVALID_REQUEST', 400, 'Pinball Map request contains unsupported fields.', false);
    }
}

/** @param list<array<string, mixed>> $machines @return list<string> */
function mapped_opdb_ids(array $machines): array
{
    $ids = [];
    foreach ($machines as $machine) {
        $id = normalized_string($machine['opdbId'] ?? null);
        if ($id !== null && !in_array($id, $ids, true)) {
            $ids[] = $id;
        }
    }
    return $ids;
}
