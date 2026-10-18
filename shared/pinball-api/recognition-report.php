<?php
declare(strict_types=1);
use PinProf\RecognitionReports\ReportProblem;
use PinProf\RecognitionReports\ReportStore;
require_once __DIR__ . '/_lib/RecognitionReports.php';
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
try {
    $host = strtolower(explode(':', $_SERVER['HTTP_HOST'] ?? '')[0]);
    if (!in_array($host, ['pinprof.com', 'www.pinprof.com'], true)) throw new ReportProblem('HOST_NOT_ALLOWED', 403);
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { header('Allow: POST'); throw new ReportProblem('METHOD_NOT_ALLOWED', 405); }
    if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') throw new ReportProblem('INVALID_CONTENT_TYPE', 415);
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > ReportStore::MAX_REQUEST_BYTES) throw new ReportProblem('REQUEST_TOO_LARGE', 413);
    $config = require '/home/pillyliu/pinprof-private/recognition-reports/config.php';
    $store = new ReportStore($config['storage_root'], $config['rate_hmac_key']);
    $store->rateLimit(\PinProf\RecognitionReports\report_client_address($_SERVER));
    $bytes = file_get_contents('php://input', false, null, 0, ReportStore::MAX_REQUEST_BYTES + 1);
    if (strlen($bytes) > ReportStore::MAX_REQUEST_BYTES) throw new ReportProblem('REQUEST_TOO_LARGE', 413);
    try { $request = json_decode($bytes, false, 64, JSON_THROW_ON_ERROR); }
    catch (JsonException) { throw new ReportProblem('INVALID_JSON', 400); }
    if (!is_object($request)) throw new ReportProblem('INVALID_JSON', 400);
    $store->expire();
    $receipt = $store->submit($request);
    http_response_code(201);
    echo json_encode($receipt, JSON_THROW_ON_ERROR);
} catch (ReportProblem $error) {
    http_response_code($error->status);
    if ($error->status === 429) header('Retry-After: 60');
    echo json_encode(['schema_version' => 1, 'error' => $error->errorCode]);
} catch (Throwable) {
    http_response_code(503);
    echo '{"schema_version":1,"error":"SERVICE_UNAVAILABLE"}';
}
