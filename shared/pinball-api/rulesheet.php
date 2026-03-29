<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

function json_error(int $status, string $message): never
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function normalize_string(mixed $value): ?string
{
    if (!is_string($value)) {
        return null;
    }
    $trimmed = trim($value);
    return $trimmed === '' ? null : $trimmed;
}

function escape_html(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function normalize_provider(?string $value): ?string
{
    $provider = strtolower(trim((string) $value));
    return in_array($provider, ['tf', 'pp', 'papa', 'bob'], true) ? $provider : null;
}

function validate_provider_url(string $provider, string $rawUrl): ?string
{
    if (!filter_var($rawUrl, FILTER_VALIDATE_URL)) {
        return null;
    }
    $host = strtolower((string) parse_url($rawUrl, PHP_URL_HOST));
    if ($host === '') {
        return null;
    }

    $allowed = match ($provider) {
        'tf' => ['tiltforums.com', 'www.tiltforums.com'],
        'pp' => ['pinballprimer.github.io', 'pinballprimer.com', 'www.pinballprimer.com'],
        'papa' => ['pinball.org', 'www.pinball.org'],
        'bob' => ['rules.silverballmania.com', 'silverballmania.com', 'www.silverballmania.com', 'flippers.be', 'www.flippers.be'],
        default => [],
    };

    foreach ($allowed as $suffix) {
        if ($host === $suffix || str_ends_with($host, '.' . $suffix)) {
            return $rawUrl;
        }
    }

    return null;
}

function http_fetch(string $url): array
{
    if (!function_exists('curl_init')) {
        json_error(500, 'cURL is not available on the server');
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_USERAGENT => 'Mozilla/5.0 PinballLibraryRulesheetProxy/1.0',
        CURLOPT_HTTPHEADER => [
            'Accept: text/html,application/json;q=0.9,*/*;q=0.8',
        ],
    ]);

    $body = curl_exec($ch);
    if ($body === false) {
        $message = curl_error($ch);
        curl_close($ch);
        json_error(502, 'Remote fetch failed: ' . $message);
    }

    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $finalUrl = (string) curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    $mimeType = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);

    if ($status < 200 || $status >= 300) {
        json_error(502, 'Remote fetch failed with status ' . $status);
    }

    return [
        'text' => (string) $body,
        'final_url' => $finalUrl !== '' ? $finalUrl : $url,
        'mime_type' => $mimeType,
    ];
}

function tilt_forums_api_url(string $rawUrl): string
{
    if (str_contains($rawUrl, '/posts/') && str_ends_with(strtolower($rawUrl), '.json')) {
        return $rawUrl;
    }
    $normalized = preg_replace('/\?.*$/', '', $rawUrl) ?? $rawUrl;
    return str_ends_with(strtolower($normalized), '.json') ? $normalized : $normalized . '.json';
}

function canonical_topic_url(string $rawUrl): string
{
    $withoutQuery = preg_replace('/\?.*$/', '', $rawUrl) ?? $rawUrl;
    return preg_replace('/\.json$/i', '', $withoutQuery) ?? $withoutQuery;
}

function legacy_fetch_url(string $provider, string $rawUrl): string
{
    if ($provider !== 'bob' || !str_contains($rawUrl, 'silverballmania.com')) {
        return $rawUrl;
    }
    $path = (string) parse_url($rawUrl, PHP_URL_PATH);
    $parts = array_values(array_filter(explode('/', $path)));
    $slug = $parts[count($parts) - 1] ?? null;
    return $slug ? 'https://rules.silverballmania.com/print/' . $slug : $rawUrl;
}

function extract_tag_html(string $html, string $tag): ?string
{
    $pattern = sprintf('/<%1$s\b[^>]*>([\s\S]*?)<\/%1$s>/i', preg_quote($tag, '/'));
    if (preg_match($pattern, $html, $matches) === 1) {
        return $matches[1];
    }
    return null;
}

function strip_html_patterns(string $html, array $patterns): string
{
    return (string) preg_replace($patterns, '', $html);
}

function should_treat_as_plain_text(string $text, string $mimeType): bool
{
    if (str_contains(strtolower($mimeType), 'text/plain')) {
        return true;
    }
    return preg_match('/<[a-zA-Z!\/][^>]*>/', $text) !== 1;
}

function cleanup_primer_html(string $html): string
{
    $cleaned = strip_html_patterns(extract_tag_html($html, 'body') ?? $html, [
        '/<iframe\b[^>]*>[\s\S]*?<\/iframe>/i',
        '/<script\b[^>]*>[\s\S]*?<\/script>/i',
        '/<style\b[^>]*>[\s\S]*?<\/style>/i',
        '/<!--[\s\S]*?-->/',
    ]);

    if (preg_match('/<h1\b[^>]*>/i', $cleaned, $matches, PREG_OFFSET_CAPTURE) === 1) {
        $cleaned = substr($cleaned, $matches[0][1]);
    }

    return trim($cleaned);
}

function cleanup_legacy_html(string $html, string $mimeType, string $provider): string
{
    if (should_treat_as_plain_text($html, $mimeType)) {
        return '<pre class="rulesheet-preformatted">' . escape_html(trim($html)) . '</pre>';
    }

    if ($provider === 'bob') {
        $main = extract_tag_html($html, 'main');
        if ($main !== null) {
            return trim(strip_html_patterns($main, [
                '/<script\b[^>]*>[\s\S]*?<\/script>/i',
                '/<!--[\s\S]*?-->/',
                '/<a\b[^>]*title="Print"[^>]*>[\s\S]*?<\/a>/i',
            ]));
        }
    }

    return trim(strip_html_patterns(extract_tag_html($html, 'body') ?? $html, [
        '/<\?[\s\S]*?\?>/',
        '/<script\b[^>]*>[\s\S]*?<\/script>/i',
        '/<style\b[^>]*>[\s\S]*?<\/style>/i',
        '/<iframe\b[^>]*>[\s\S]*?<\/iframe>/i',
        '/<!--[\s\S]*?-->/',
        '/<\/?(html|head|body|meta|link)\b[^>]*>/i',
    ]));
}

function rebase_relative_url(string $value, string $baseUrl): string
{
    $trimmed = trim($value);
    if ($trimmed === '' || str_starts_with($trimmed, '#')) {
        return $trimmed;
    }
    if (preg_match('/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i', $trimmed) === 1) {
        return $trimmed;
    }
    $parts = parse_url($baseUrl);
    if ($parts === false || empty($parts['scheme']) || empty($parts['host'])) {
        return $trimmed;
    }
    $basePath = $parts['path'] ?? '/';
    $dir = preg_replace('#/[^/]*$#', '/', $basePath) ?? '/';
    $path = str_starts_with($trimmed, '/') ? $trimmed : $dir . $trimmed;

    $segments = [];
    foreach (explode('/', $path) as $segment) {
        if ($segment === '' || $segment === '.') {
            continue;
        }
        if ($segment === '..') {
            array_pop($segments);
            continue;
        }
        $segments[] = $segment;
    }

    return ($parts['scheme'] ?? 'https') . '://' . $parts['host'] . '/' . implode('/', $segments);
}

function rebase_relative_html_urls(string $html, string $baseUrl): string
{
    $html = preg_replace_callback('/(\s(?:src|href)=["\'])([^"\']+)(["\'])/i', static function (array $matches) use ($baseUrl): string {
        return $matches[1] . escape_html(rebase_relative_url($matches[2], $baseUrl)) . $matches[3];
    }, $html) ?? $html;

    return preg_replace_callback('/(\ssrcset=["\'])([^"\']+)(["\'])/i', static function (array $matches) use ($baseUrl): string {
        $entries = array_filter(array_map('trim', explode(',', $matches[2])));
        $rebased = array_map(static function (string $entry) use ($baseUrl): string {
            $parts = preg_split('/\s+/', $entry, 2);
            $url = rebase_relative_url($parts[0] ?? '', $baseUrl);
            $descriptor = $parts[1] ?? null;
            return $descriptor ? $url . ' ' . $descriptor : $url;
        }, $entries);
        return $matches[1] . escape_html(implode(', ', $rebased)) . $matches[3];
    }, $html) ?? $html;
}

function source_meta(string $provider): array
{
    return match ($provider) {
        'tf' => [
            'source_name' => 'Tilt Forums community rulesheet',
            'link_label' => 'Original thread',
            'details' => 'License/source terms remain with Tilt Forums and the original authors.',
        ],
        'pp' => [
            'source_name' => 'Pinball Primer',
            'link_label' => 'Original page',
            'details' => 'Preserve source attribution and any author/site rights notes from the original page.',
        ],
        'papa' => [
            'source_name' => 'PAPA / pinball.org rulesheet archive',
            'link_label' => 'Original page',
            'details' => 'Preserve source attribution and any author/site rights notes from the original page.',
        ],
        'bob' => [
            'source_name' => 'Silverball Rules (Bob Matthews source)',
            'link_label' => 'Original page',
            'details' => 'Preserve source attribution and any author/site rights notes from the original page.',
        ],
        default => [
            'source_name' => 'Rulesheet source',
            'link_label' => 'Original page',
            'details' => 'Preserve source attribution.',
        ],
    };
}

function attribution_html(string $provider, string $displayUrl, ?string $updatedAt): string
{
    $meta = source_meta($provider);
    $updatedText = $updatedAt ? ' | Updated: ' . escape_html($updatedAt) : '';
    return '<small class="rulesheet-attribution">Source: ' . escape_html($meta['source_name']) .
        ' | ' . escape_html($meta['link_label']) . ': <a href="' . escape_html($displayUrl) . '">link</a>' .
        $updatedText .
        ' | ' . escape_html($meta['details']) .
        ' | Reformatted for readability and mobile use.</small>';
}

function render_rulesheet(string $provider, string $rawUrl): array
{
    if ($provider === 'tf') {
        $fetched = http_fetch(tilt_forums_api_url($rawUrl));
        $payload = json_decode($fetched['text'], true);
        $post = $payload['post_stream']['posts'][0] ?? $payload;
        $cooked = normalize_string($post['cooked'] ?? null);
        if ($cooked === null) {
            json_error(502, 'Tilt Forums payload missing cooked HTML');
        }
        $topicSlug = normalize_string($post['topic_slug'] ?? null);
        $topicId = isset($post['topic_id']) ? (int) $post['topic_id'] : null;
        $canonicalUrl = ($topicSlug && $topicId)
            ? 'https://tiltforums.com/t/' . rawurlencode($topicSlug) . '/' . $topicId
            : canonical_topic_url($rawUrl);
        $updatedAt = normalize_string($post['updated_at'] ?? null);
        return [
            'body' => attribution_html($provider, $canonicalUrl, $updatedAt) .
                "\n\n" .
                '<div class="pinball-rulesheet remote-rulesheet tiltforums-rulesheet">' . "\n" .
                $cooked . "\n" .
                '</div>',
            'source_url' => $canonicalUrl,
        ];
    }

    $fetched = http_fetch($provider === 'bob' ? legacy_fetch_url($provider, $rawUrl) : $rawUrl);
    if ($provider === 'pp') {
        $body = rebase_relative_html_urls(cleanup_primer_html($fetched['text']), $fetched['final_url']);
        return [
            'body' => attribution_html($provider, $fetched['final_url'], null) .
                "\n\n" .
                '<div class="pinball-rulesheet remote-rulesheet primer-rulesheet">' . "\n" .
                $body . "\n" .
                '</div>',
            'source_url' => $fetched['final_url'],
        ];
    }

    $body = rebase_relative_html_urls(cleanup_legacy_html($fetched['text'], $fetched['mime_type'], $provider), $fetched['final_url']);
    return [
        'body' => attribution_html($provider, $fetched['final_url'], null) .
            "\n\n" .
            '<div class="pinball-rulesheet remote-rulesheet legacy-rulesheet">' . "\n" .
            $body . "\n" .
            '</div>',
        'source_url' => $fetched['final_url'],
    ];
}

$provider = normalize_provider($_GET['provider'] ?? null);
$rawUrl = normalize_string($_GET['url'] ?? null);

if ($provider === null || $rawUrl === null) {
    json_error(400, 'Missing provider or url');
}

$validatedUrl = validate_provider_url($provider, $rawUrl);
if ($validatedUrl === null) {
    json_error(400, 'URL is not allowed for provider');
}

$ttl = $provider === 'tf' ? 300 : 3600;
header('Cache-Control: public, max-age=' . $ttl);

$rendered = render_rulesheet($provider, $validatedUrl);
echo json_encode([
    'provider' => $provider,
    'url' => $validatedUrl,
    'sourceUrl' => $rendered['source_url'],
    'body' => $rendered['body'],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
