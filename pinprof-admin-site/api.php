<?php
declare(strict_types=1);

require __DIR__ . '/lib/app.php';

session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax',
    'use_strict_mode' => true,
]);

function api_json(mixed $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function api_text_error(string $message, int $status = 400): never
{
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    echo $message;
    exit;
}

function api_route(): string
{
    return trim((string) ($_GET['route'] ?? ''), '/');
}

function api_json_body(): array
{
    $raw = (string) file_get_contents('php://input');
    if ($raw === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function api_require_auth(): void
{
    if (!($_SESSION['pinprof_authenticated'] ?? false)) {
        api_text_error('Authentication required.', 401);
    }
}

try {
    $route = api_route();
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

    if ($route === 'session' && $method === 'GET') {
        $config = pinprof_config();
        api_json([
            'authenticated' => (bool) ($_SESSION['pinprof_authenticated'] ?? false),
            'passwordConfigured' => !empty($config['admin_password_hash']) && $config['admin_password_hash'] !== 'REPLACE_WITH_PASSWORD_HASH',
        ]);
    }

    if ($route === 'login' && $method === 'POST') {
        $body = api_json_body();
        $password = (string) ($body['password'] ?? '');
        $hash = (string) (pinprof_config()['admin_password_hash'] ?? '');
        if ($hash === '' || $hash === 'REPLACE_WITH_PASSWORD_HASH' || !password_verify($password, $hash)) {
            api_text_error('Invalid password.', 401);
        }
        $_SESSION['pinprof_authenticated'] = true;
        api_json(['authenticated' => true, 'passwordConfigured' => true]);
    }

    if ($route === 'logout' && $method === 'POST') {
        $_SESSION = [];
        session_destroy();
        api_json(['ok' => true], 204);
    }

    if (preg_match('#^public/playfield-status/([^/]+)$#', $route, $matches) && $method === 'GET') {
        header('Cache-Control: no-store, max-age=0');
        api_json(pinprof_public_playfield_status(urldecode($matches[1])));
    }

    api_require_auth();

    if ($route === 'summary' && $method === 'GET') {
        api_json(pinprof_summary());
    }

    if ($route === 'filters' && $method === 'GET') {
        api_json(pinprof_manufacturer_filters());
    }

    if ($route === 'machines' && $method === 'GET') {
        $query = pinprof_clean_string($_GET['query'] ?? null);
        $manufacturer = pinprof_clean_string($_GET['manufacturer'] ?? null);
        $sort = pinprof_clean_string($_GET['sort'] ?? null) ?? 'name';
        $page = max(1, pinprof_clean_int($_GET['page'] ?? null) ?? 1);
        $pageSize = min(100, max(1, pinprof_clean_int($_GET['pageSize'] ?? null) ?? 20));
        api_json(pinprof_list_machines($query, $manufacturer, $sort, $page, $pageSize));
    }

    if (preg_match('#^machines/([^/]+)$#', $route, $matches) && $method === 'GET') {
        api_json(pinprof_machine_detail(urldecode($matches[1])));
    }

    if (preg_match('#^machines/([^/]+)/override$#', $route, $matches) && in_array($method, ['PUT', 'POST'], true)) {
        $practiceIdentity = urldecode($matches[1]);
        $body = api_json_body();
        $patch = [
            'name_override' => pinprof_clean_string($body['nameOverride'] ?? null),
            'variant_override' => pinprof_clean_string($body['variantOverride'] ?? null),
            'manufacturer_override' => pinprof_clean_string($body['manufacturerOverride'] ?? null),
            'year_override' => pinprof_clean_int($body['yearOverride'] ?? null),
            'backglass_source_url' => pinprof_clean_string($body['backglassSourceUrl'] ?? null),
            'backglass_source_note' => pinprof_clean_string($body['backglassSourceNote'] ?? null),
            'rulesheet_source_url' => pinprof_clean_string($body['rulesheetSourceUrl'] ?? null),
            'rulesheet_source_note' => pinprof_clean_string($body['rulesheetSourceNote'] ?? null),
            'notes' => pinprof_clean_string($body['notes'] ?? null),
        ];
        pinprof_upsert_override($practiceIdentity, $patch);
        api_json(['ok' => true]);
    }

    if (preg_match('#^machines/([^/]+)/rulesheet/save$#', $route, $matches) && $method === 'POST') {
        $practiceIdentity = urldecode($matches[1]);
        $body = api_json_body();
        pinprof_save_rulesheet_markdown(
            $practiceIdentity,
            (string) ($body['markdown'] ?? ''),
            pinprof_clean_string($body['sourceUrl'] ?? null),
            pinprof_clean_string($body['sourceNote'] ?? null),
        );
        api_json(['ok' => true]);
    }

    if (preg_match('#^machines/([^/]+)/rulesheet/upload$#', $route, $matches) && $method === 'POST') {
        $practiceIdentity = urldecode($matches[1]);
        $file = $_FILES['rulesheet'] ?? null;
        if (!is_array($file) || !isset($file['tmp_name']) || !is_uploaded_file((string) $file['tmp_name'])) {
            api_text_error('No rulesheet file uploaded.');
        }
        $markdown = (string) file_get_contents((string) $file['tmp_name']);
        pinprof_save_rulesheet_markdown(
            $practiceIdentity,
            $markdown,
            pinprof_clean_string($_POST['sourceUrl'] ?? null),
            pinprof_clean_string($_POST['sourceNote'] ?? null) ?? pinprof_clean_string($file['name'] ?? null),
        );
        api_json(['ok' => true]);
    }

    if (preg_match('#^machines/([^/]+)/(playfield|backglass)/import-url$#', $route, $matches) && $method === 'POST') {
        $practiceIdentity = urldecode($matches[1]);
        $kind = $matches[2];
        $body = api_json_body();
        $sourceUrl = pinprof_clean_string($body['sourceUrl'] ?? null);
        if ($sourceUrl === null) {
            api_text_error('Remote image URL is required.');
        }
        $download = pinprof_download_url($sourceUrl);
        pinprof_store_binary_asset(
            $practiceIdentity,
            $kind,
            (string) $download['body'],
            $sourceUrl,
            (string) ($download['contentType'] ?? ''),
            $sourceUrl,
            pinprof_clean_string($body['sourceNote'] ?? null) ?? $sourceUrl,
            $kind === 'playfield' ? pinprof_clean_string($body['machineAliasId'] ?? $body['playfieldAliasId'] ?? null) : null,
        );
        api_json(['ok' => true]);
    }

    if (preg_match('#^machines/([^/]+)/(playfield|backglass)/upload$#', $route, $matches) && $method === 'POST') {
        $practiceIdentity = urldecode($matches[1]);
        $kind = $matches[2];
        $file = $_FILES['image'] ?? null;
        if (!is_array($file) || !isset($file['tmp_name']) || !is_uploaded_file((string) $file['tmp_name'])) {
            api_text_error('No image uploaded.');
        }
        $contents = (string) file_get_contents((string) $file['tmp_name']);
        pinprof_store_binary_asset(
            $practiceIdentity,
            $kind,
            $contents,
            pinprof_clean_string($file['name'] ?? null),
            pinprof_clean_string($file['type'] ?? null),
            pinprof_clean_string($_POST['sourceUrl'] ?? null),
            pinprof_clean_string($_POST['sourceNote'] ?? null) ?? pinprof_clean_string($file['name'] ?? null),
            $kind === 'playfield' ? pinprof_clean_string($_POST['machineAliasId'] ?? $_POST['playfieldAliasId'] ?? null) : null,
        );
        api_json(['ok' => true]);
    }

    if (preg_match('#^machines/([^/]+)/playfield/coverage$#', $route, $matches) && in_array($method, ['PUT', 'POST'], true)) {
        $practiceIdentity = urldecode($matches[1]);
        $body = api_json_body();
        $sourceAliasId = pinprof_clean_string($body['machineAliasId'] ?? $body['playfieldAliasId'] ?? null);
        if ($sourceAliasId === null) {
            api_text_error('A source alias is required.');
        }
        pinprof_save_playfield_coverage(
            $practiceIdentity,
            $sourceAliasId,
            pinprof_clean_string($body['sourceUrl'] ?? null),
            pinprof_clean_string($body['sourceNote'] ?? null),
        );
        api_json(['ok' => true]);
    }

    api_text_error('Not found.', 404);
} catch (Throwable $exception) {
    api_text_error($exception->getMessage(), 500);
}
