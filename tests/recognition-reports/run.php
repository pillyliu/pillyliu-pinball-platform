<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/shared/pinball-api/_lib/RecognitionReports.php';
use PinProf\RecognitionReports\ReportStore;
use PinProf\RecognitionReports\ReportPrivacy;
use PinProf\RecognitionReports\ReportProblem;
$root = sys_get_temp_dir() . '/pinprof-reports-test-' . bin2hex(random_bytes(8));
$store = new ReportStore($root, str_repeat('test-only', 5));
$tests = 0;
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
function expectProblem(string $code, callable $operation): void {
    try { $operation(); } catch (ReportProblem $e) { check($e->errorCode === $code, 'Wrong error: ' . $e->errorCode); return; }
    throw new RuntimeException('Expected ' . $code);
}
function request(string $id = '12345678-abcd-4abc-8abc-123456789012'): object {
    return (object)['schema_version' => 1, 'submission_id' => $id, 'platform' => 'android',
        'description' => 'The crop was missing', 'email' => '',
        'diagnostics' => json_decode('{"capture":{"location":{"latitude":42.123,"longitude":-83.456},"capture_id":"private-id","original_width":2142},"field_photo_selections":{"venue_name":"private-venue","selected_game_title":"Fireball"},"recognition_result":{"crop_status":"no_valid_backglass","runtime_diagnostics":{"operations":{"rfdetr.setup.gpu":{"failed_count":1,"last_error":{"type":"OutOfMemoryError","message":"allocation failed /data/private/photo.jpg"}}}}},"unknown":{"name":"private-name"}}')];
}
try {
    $raw = request(); $before = json_encode($raw);
    $first = $store->submit($raw, 1000); $stored = file_get_contents($root . '/reports/' . $first['report_id'] . '/report.json');
    check(!str_contains($stored, 'private-') && !str_contains($stored, 'latitude') && !str_contains($stored, '/data/'), 'Private fields leaked');
    check(str_contains($stored, 'Fireball') && str_contains($stored, 'category:memory'), 'Useful diagnostics missing');
    check(json_encode($raw) === $before, 'Local evidence mutated');
    check(strtotime($first['expires_at']) === 1000 + 90 * 86400, 'Wrong retention'); $tests++;
    check($store->submit($raw, 1100) === $first, 'Retry created new receipt');
    $changed = request(); $changed->description = 'Edited'; expectProblem('SUBMISSION_CONFLICT', fn() => $store->submit($changed)); $tests++;
    $bad = request('../escape'); expectProblem('INVALID_REQUEST', fn() => $store->submit($bad));
    $bad = request(); $bad->email = "x\r\nBcc:y@bad.test"; expectProblem('INVALID_FORM', fn() => $store->submit($bad));
    $bad = request(); $bad->description = str_repeat('a', 4001); expectProblem('INVALID_FORM', fn() => $store->submit($bad)); $tests++;
    $photoRequest = request('22345678-abcd-4abc-8abc-123456789012');
    $image = imagecreatetruecolor(20, 30); ob_start(); imagejpeg($image); $jpeg = ob_get_clean(); unset($image);
    $metadata = 'Exif' . "\0\0" . 'GPS_PRIVATE_SENTINEL';
    $jpeg = substr($jpeg, 0, 2) . "\xff\xe1" . pack('n', strlen($metadata) + 2) . $metadata . substr($jpeg, 2);
    $photoRequest->photo_jpeg_base64 = base64_encode($jpeg);
    $receipt = $store->submit($photoRequest, 2000);
    $clean = file_get_contents($root . '/reports/' . $receipt['report_id'] . '/photo.jpg');
    check(!str_contains($clean, 'GPS_PRIVATE_SENTINEL'), 'Photo metadata survived');
    check(getimagesizefromstring($clean)[0] === 20 && $receipt['photo_included'], 'Photo missing'); $tests++;
    $bad = request('32345678-abcd-4abc-8abc-123456789012'); $bad->photo_jpeg_base64 = base64_encode('not-an-image');
    expectProblem('INVALID_PHOTO', fn() => $store->submit($bad));
    check(!is_dir($root . '/reports/' . $bad->submission_id), 'Failed photo left accepted report'); $tests++;
    for ($n = 0; $n < 12; $n++) $store->rateLimit('test-client', 1000);
    expectProblem('RATE_LIMITED', fn() => $store->rateLimit('test-client', 1000));
    foreach (glob($root . '/rate/*') as $file) check(!str_contains(file_get_contents($file), 'test-client'), 'Raw client address saved'); $tests++;
    check($store->expire(1000 + ReportStore::RETENTION_SECONDS) === 1, 'First report did not expire');
    check(!is_dir($root . '/reports/' . $first['report_id']), 'Expired report survives');
    check($store->expire(2000 + ReportStore::RETENTION_SECONDS) === 1, 'Photo report did not expire');
    check(!file_exists($root . '/reports/' . $receipt['report_id'] . '/photo.jpg'), 'Expired photo survives'); $tests++;
    $privacy = new ReportPrivacy(); $data = request()->diagnostics;
    check(json_encode($privacy->filter($data)) === json_encode($privacy->filter($privacy->filter($data))), 'Filter is not idempotent'); $tests++;
    check(\PinProf\RecognitionReports\report_client_address(['REMOTE_ADDR' => '1.2.3.4', 'HTTP_CF_CONNECTING_IP' => '5.6.7.8']) === '1.2.3.4', 'Untrusted forwarded address accepted');
    check(\PinProf\RecognitionReports\report_client_address(['REMOTE_ADDR' => '173.245.48.1', 'HTTP_CF_CONNECTING_IP' => '5.6.7.8']) === '5.6.7.8', 'Trusted proxy not resolved'); $tests++;
    echo "$tests recognition report tests passed.\n";
} finally {
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($iterator as $file) $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
    rmdir($root);
}
