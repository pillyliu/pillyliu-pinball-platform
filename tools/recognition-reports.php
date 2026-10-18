#!/usr/bin/env php
<?php
// Run over authenticated SSH. Reports never have a public download route.
declare(strict_types=1);
$library = dirname(__DIR__) . '/shared/pinball-api/_lib/RecognitionReports.php';
require_once is_file($library) ? $library : '/home/pillyliu/pinprof.com/pinball/api/_lib/RecognitionReports.php';
$config = require '/home/pillyliu/pinprof-private/recognition-reports/config.php';
$store = new \PinProf\RecognitionReports\ReportStore($config['storage_root'], $config['rate_hmac_key']);
$store->expire();
$command = $argv[1] ?? 'list';
if ($command === 'expire') { echo "Retention cleanup complete.\n"; exit; }
if ($command === 'list') {
    foreach (glob($config['storage_root'] . '/reports/*/report.json') as $file) {
        $record = json_decode(file_get_contents($file), true, 64, JSON_THROW_ON_ERROR);
        echo json_encode(array_intersect_key($record, array_flip(['report_id', 'received_at', 'expires_at', 'platform', 'has_photo'])), JSON_UNESCAPED_SLASHES) . "\n";
    }
    exit;
}
$id = $argv[2] ?? '';
if (!preg_match('/^[a-f0-9-]{36}$/D', $id)) { fwrite(STDERR, "A report ID is required.\n"); exit(2); }
$file = $config['storage_root'] . '/reports/' . $id . ($command === 'photo' ? '/photo.jpg' : '/report.json');
if (!in_array($command, ['read', 'photo'], true) || !is_file($file)) { fwrite(STDERR, "Report not found.\n"); exit(2); }
readfile($file);
