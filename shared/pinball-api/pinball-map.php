<?php
declare(strict_types=1);

use PinProf\PinballMap\BrokerProblem;
use PinProf\PinballMap\BrokerService;
use PinProf\PinballMap\CatalogCache;
use PinProf\PinballMap\CurlProviderClient;
use PinProf\PinballMap\FileRateLimiter;

require_once __DIR__ . '/_lib/PinballMapBroker.php';

const PINPROF_ALLOWED_HOSTS = ['pinprof.com', 'www.pinprof.com'];
const PINPROF_ALLOWED_ORIGINS = [
    'https://pinprof.com',
    'https://www.pinprof.com',
    'https://pillyliu.com',
    'https://www.pillyliu.com',
];
const PINPROF_BROKER_ACTIONS = ['search_address', 'search_coordinates', 'location_roster', 'nearest_location_roster', 'vision_nearby'];
const PINPROF_CLIENT_SURFACES = [
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
const PINPROF_CLOUDFLARE_CIDRS = [
    '173.245.48.0/20',
    '103.21.244.0/22',
    '103.22.200.0/22',
    '103.31.4.0/22',
    '141.101.64.0/18',
    '108.162.192.0/18',
    '190.93.240.0/20',
    '188.114.96.0/20',
    '197.234.240.0/22',
    '198.41.128.0/17',
    '162.158.0.0/15',
    '104.16.0.0/13',
    '104.24.0.0/14',
    '172.64.0.0/13',
    '131.0.72.0/22',
    '2400:cb00::/32',
    '2606:4700::/32',
    '2803:f800::/32',
    '2405:b500::/32',
    '2405:8100::/32',
    '2a06:98c0::/29',
    '2c0f:f248::/32',
];

$startedAt = microtime(true);
$requestId = bin2hex(random_bytes(12));
$action = null;
$surface = null;
$responseStatus = 500;
$errorCode = null;
$config = null;

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Request-ID: ' . $requestId);
header('Vary: Origin');

try {
    enforce_canonical_host();
    $origin = normalized_header($_SERVER['HTTP_ORIGIN'] ?? null);
    if ($origin !== null) {
        if (!in_array($origin, PINPROF_ALLOWED_ORIGINS, true)) {
            throw new BrokerProblem('ORIGIN_NOT_ALLOWED', 403, 'This origin is not allowed.', false);
        }
        header('Access-Control-Allow-Origin: ' . $origin);
    }

    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($method === 'OPTIONS') {
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Max-Age: 600');
        http_response_code(204);
        exit;
    }
    if ($method !== 'POST') {
        header('Allow: POST, OPTIONS');
        throw new BrokerProblem('METHOD_NOT_ALLOWED', 405, 'Use POST for Pinball Map broker requests.', false);
    }

    $contentType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
    if ($contentType !== 'application/json') {
        throw new BrokerProblem('UNSUPPORTED_MEDIA_TYPE', 415, 'Use application/json.', false);
    }
    $contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : null;
    if ($contentLength !== null && $contentLength > 8_192) {
        throw new BrokerProblem('REQUEST_TOO_LARGE', 413, 'Pinball Map request is too large.', false);
    }
    $body = file_get_contents('php://input', false, null, 0, 8_193);
    if (!is_string($body) || $body === '') {
        throw new BrokerProblem('INVALID_JSON', 400, 'A JSON request body is required.', false);
    }
    if (strlen($body) > 8_192) {
        throw new BrokerProblem('REQUEST_TOO_LARGE', 413, 'Pinball Map request is too large.', false);
    }
    try {
        $payload = json_decode($body, true, 64, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        throw new BrokerProblem('INVALID_JSON', 400, 'The request body is not valid JSON.', false, null, $error);
    }
    if (!is_array($payload)) {
        throw new BrokerProblem('INVALID_JSON', 400, 'The request body must be a JSON object.', false);
    }
    $actionCandidate = normalized_header($payload['action'] ?? null);
    $action = in_array($actionCandidate, PINPROF_BROKER_ACTIONS, true) ? $actionCandidate : null;
    $surfaceCandidate = is_array($payload['client'] ?? null) ? normalized_header($payload['client']['surface'] ?? null) : null;
    $surface = in_array($surfaceCandidate, PINPROF_CLIENT_SURFACES, true) ? $surfaceCandidate : null;

    $config = load_broker_config();
    $rateLimiter = new FileRateLimiter((string) $config['rate_dir'], (string) $config['rate_hmac_key']);
    $identity = resolve_client_ip($config['trusted_proxy_cidrs'] ?? PINPROF_CLOUDFLARE_CIDRS);
    $rateLimiter->enforce('client-aggregate', $identity, 40, 60);
    $perActionLimit = match ($action) {
        'search_address', 'search_coordinates' => 12,
        'location_roster' => 30,
        'nearest_location_roster', 'vision_nearby' => 20,
        default => 12,
    };
    $rateLimiter->enforce('client-' . ($action ?? 'invalid'), $identity, $perActionLimit, 60);

    $provider = new CurlProviderClient((string) $config['api_token'], $rateLimiter);
    $catalog = new CatalogCache(
        $provider,
        (string) $config['cache_dir'],
        (string) $config['lock_dir'],
        isset($config['catalog_ttl_seconds']) ? (int) $config['catalog_ttl_seconds'] : 86_400,
    );
    $service = new BrokerService($provider, $catalog);
    $result = $service->handle($payload);
    $responseStatus = 200;
    respond_json(200, [
        'schemaVersion' => BrokerService::SCHEMA_VERSION,
        'requestId' => $requestId,
        'action' => $action,
        ...$result,
    ]);
} catch (BrokerProblem $problem) {
    $responseStatus = $problem->httpStatus;
    $errorCode = $problem->errorCode;
    if ($problem->retryAfterSeconds !== null) {
        header('Retry-After: ' . $problem->retryAfterSeconds);
    }
    respond_json($problem->httpStatus, [
        'schemaVersion' => BrokerService::SCHEMA_VERSION,
        'requestId' => $requestId,
        'action' => $action,
        'error' => [
            'code' => $problem->errorCode,
            'message' => $problem->getMessage(),
            'retryable' => $problem->retryable,
            'retryAfterSeconds' => $problem->retryAfterSeconds,
        ],
    ]);
} catch (Throwable) {
    $responseStatus = 500;
    $errorCode = 'INTERNAL_ERROR';
    respond_json(500, [
        'schemaVersion' => BrokerService::SCHEMA_VERSION,
        'requestId' => $requestId,
        'action' => $action,
        'error' => [
            'code' => 'INTERNAL_ERROR',
            'message' => 'Pinball Map service encountered an unexpected error.',
            'retryable' => false,
            'retryAfterSeconds' => null,
        ],
    ]);
} finally {
    if (is_array($config)) {
        write_sanitized_log($config, [
            'timestamp' => gmdate('c'),
            'requestId' => $requestId,
            'action' => $action,
            'surface' => $surface,
            'status' => $responseStatus,
            'errorCode' => $errorCode,
            'durationMs' => (int) round((microtime(true) - $startedAt) * 1_000),
        ]);
    }
}

function enforce_canonical_host(): void
{
    $host = strtolower(trim((string) ($_SERVER['HTTP_HOST'] ?? '')));
    if (str_contains($host, ':')) {
        $host = explode(':', $host, 2)[0];
    }
    if (!in_array($host, PINPROF_ALLOWED_HOSTS, true)) {
        throw new BrokerProblem('NOT_FOUND', 404, 'Not found.', false);
    }
}

/** @return array<string, mixed> */
function load_broker_config(): array
{
    $configPath = getenv('PINPROF_PINBALL_MAP_CONFIG');
    if (!is_string($configPath) || trim($configPath) === '') {
        $configPath = '/home/pillyliu/pinprof-private/pinball-map/config.php';
    }
    if (!is_file($configPath) || !is_readable($configPath)) {
        throw new BrokerProblem('CONFIGURATION_ERROR', 503, 'Pinball Map service is not configured.', false);
    }
    $config = require $configPath;
    if (!is_array($config)) {
        throw new BrokerProblem('CONFIGURATION_ERROR', 503, 'Pinball Map service is not configured.', false);
    }
    foreach (['api_token', 'cache_dir', 'lock_dir', 'rate_dir', 'rate_hmac_key'] as $required) {
        if (!isset($config[$required]) || !is_string($config[$required]) || trim($config[$required]) === '') {
            throw new BrokerProblem('CONFIGURATION_ERROR', 503, 'Pinball Map service is not configured.', false);
        }
    }
    return $config;
}

function respond_json(int $status, array $payload): void
{
    http_response_code($status);
    try {
        echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        http_response_code(500);
        echo '{"schemaVersion":1,"error":{"code":"INTERNAL_ERROR","message":"Unable to encode response.","retryable":false,"retryAfterSeconds":null}}';
    }
}

function normalized_header(mixed $value): ?string
{
    if (!is_string($value)) {
        return null;
    }
    $trimmed = trim($value);
    return $trimmed === '' ? null : $trimmed;
}

function resolve_client_ip(mixed $trustedProxyCidrs): string
{
    $remote = normalized_header($_SERVER['REMOTE_ADDR'] ?? null) ?? 'unknown';
    $cloudflare = normalized_header($_SERVER['HTTP_CF_CONNECTING_IP'] ?? null);
    $cidrs = is_array($trustedProxyCidrs) ? $trustedProxyCidrs : PINPROF_CLOUDFLARE_CIDRS;
    if ($cloudflare !== null && filter_var($cloudflare, FILTER_VALIDATE_IP) && ip_in_any_cidr($remote, $cidrs)) {
        return $cloudflare;
    }
    return filter_var($remote, FILTER_VALIDATE_IP) ? $remote : 'unknown';
}

function ip_in_any_cidr(string $ip, array $cidrs): bool
{
    foreach ($cidrs as $cidr) {
        if (is_string($cidr) && ip_in_cidr($ip, $cidr)) {
            return true;
        }
    }
    return false;
}

function ip_in_cidr(string $ip, string $cidr): bool
{
    [$network, $prefixText] = array_pad(explode('/', $cidr, 2), 2, null);
    if ($prefixText === null || !ctype_digit($prefixText)) {
        return false;
    }
    $ipBytes = @inet_pton($ip);
    $networkBytes = @inet_pton($network);
    if ($ipBytes === false || $networkBytes === false || strlen($ipBytes) !== strlen($networkBytes)) {
        return false;
    }
    $prefix = (int) $prefixText;
    $maximum = strlen($ipBytes) * 8;
    if ($prefix < 0 || $prefix > $maximum) {
        return false;
    }
    $wholeBytes = intdiv($prefix, 8);
    $remainingBits = $prefix % 8;
    if ($wholeBytes > 0 && substr($ipBytes, 0, $wholeBytes) !== substr($networkBytes, 0, $wholeBytes)) {
        return false;
    }
    if ($remainingBits === 0) {
        return true;
    }
    $mask = (0xFF << (8 - $remainingBits)) & 0xFF;
    return (ord($ipBytes[$wholeBytes]) & $mask) === (ord($networkBytes[$wholeBytes]) & $mask);
}

function write_sanitized_log(array $config, array $record): void
{
    $path = $config['log_path'] ?? null;
    if (!is_string($path) || trim($path) === '') {
        return;
    }
    $directory = dirname($path);
    if (!is_dir($directory) && !@mkdir($directory, 0750, true) && !is_dir($directory)) {
        return;
    }
    @chmod($directory, 0750);
    try {
        $line = json_encode($record, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
    } catch (JsonException) {
        return;
    }
    @file_put_contents($path, $line, FILE_APPEND | LOCK_EX);
    @chmod($path, 0640);
}
