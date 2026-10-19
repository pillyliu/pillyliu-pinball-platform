#!/usr/bin/env bash
# Narrow deploy: does not publish unrelated website or catalog changes.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/tools/pinprof-hosting-config.sh"
SSH=(ssh -p "$SSH_PORT" -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=15 -o WarnWeakCrypto=no "$SSH_USER_HOST")
REMOTE_STAGE="/home/pillyliu/pinprof-private/recognition-reports/deploy-$(date -u +%Y%m%dT%H%M%SZ)"
"${SSH[@]}" "umask 077; mkdir -p '$REMOTE_STAGE/shared/pinball-api/_lib' '$REMOTE_STAGE/tests/recognition-reports' '$REMOTE_STAGE/tools'"
for name in RecognitionReports.php recognition-report-fields-v1.json recognition-report-privacy-v2.json; do
  scp -q -P "$SSH_PORT" -i "$SSH_KEY" -o BatchMode=yes -o WarnWeakCrypto=no "$ROOT/shared/pinball-api/_lib/$name" "$SSH_USER_HOST:$REMOTE_STAGE/shared/pinball-api/_lib/$name"
done
scp -q -P "$SSH_PORT" -i "$SSH_KEY" -o BatchMode=yes -o WarnWeakCrypto=no "$ROOT/shared/pinball-api/recognition-report.php" "$SSH_USER_HOST:$REMOTE_STAGE/shared/pinball-api/recognition-report.php"
scp -q -P "$SSH_PORT" -i "$SSH_KEY" -o BatchMode=yes -o WarnWeakCrypto=no "$ROOT/tests/recognition-reports/run.php" "$SSH_USER_HOST:$REMOTE_STAGE/tests/recognition-reports/run.php"
scp -q -P "$SSH_PORT" -i "$SSH_KEY" -o BatchMode=yes -o WarnWeakCrypto=no "$ROOT/tools/recognition-reports.php" "$SSH_USER_HOST:$REMOTE_STAGE/tools/recognition-reports.php"
"${SSH[@]}" "php -l '$REMOTE_STAGE/shared/pinball-api/recognition-report.php' && php '$REMOTE_STAGE/tests/recognition-reports/run.php'"
"${SSH[@]}" "php -- '$REMOTE_STAGE'" <<'PHP'
<?php
$stage = $argv[1];
$private = '/home/pillyliu/pinprof-private/recognition-reports';
$public = '/home/pillyliu/pinprof.com/pinball/api';
umask(0077);
foreach ([$private, "$private/data", "$private/tools"] as $path) { if (!is_dir($path)) mkdir($path, 0700, true); chmod($path, 0700); }
if (!is_file("$private/config.php")) {
    $config = ['storage_root' => "$private/data", 'rate_hmac_key' => bin2hex(random_bytes(32))];
    file_put_contents("$private/config.php", "<?php\nreturn " . var_export($config, true) . ";\n", LOCK_EX);
    chmod("$private/config.php", 0600);
}
foreach (['_lib/recognition-report-fields-v1.json', '_lib/recognition-report-privacy-v2.json', '_lib/RecognitionReports.php', 'recognition-report.php'] as $file) {
    if (!copy("$stage/shared/pinball-api/$file", "$public/$file.pending")) throw new RuntimeException('Upload copy failed');
    chmod("$public/$file.pending", 0644);
    if (!rename("$public/$file.pending", "$public/$file")) throw new RuntimeException('Publish rename failed');
}
copy("$stage/tools/recognition-reports.php", "$private/tools/recognition-reports.php");
chmod("$private/tools/recognition-reports.php", 0700);
$cron = shell_exec('crontab -l 2>/dev/null') ?? '';
$lines = array_filter(explode("\n", $cron), fn($line) => trim($line) !== '' && !str_contains($line, '# pinprof-recognition-report-retention'));
$lines[] = '17 * * * * ' . PHP_BINARY . ' ' . $private . '/tools/recognition-reports.php expire >/dev/null 2>&1 # pinprof-recognition-report-retention';
$temp = tempnam($private, 'cron-'); file_put_contents($temp, implode("\n", $lines) . "\n");
exec('crontab ' . escapeshellarg($temp), $output, $code); unlink($temp);
if ($code !== 0) throw new RuntimeException('Retention cron installation failed');
echo "Endpoint and hourly 90-day retention deployed.\n";
PHP
"${SSH[@]}" "php '/home/pillyliu/pinprof-private/recognition-reports/tools/recognition-reports.php' expire"
printf '%s\n' "$REMOTE_STAGE"
