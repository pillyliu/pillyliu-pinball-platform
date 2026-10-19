# Recognition reports

Native iOS and Android clients submit optional support reports to `https://pinprof.com/pinball/api/recognition-report.php`. This service accepts JSON POST requests; it has no public report-reading or photo-download route. The endpoint and privacy policy were deployed on October 18, 2026.

## Storage and access

Reports live outside the web root in `/home/pillyliu/pinprof-private/recognition-reports/data/reports/<report-id>/`. Directories are private; report JSON and optional photos have mode 0600. The opaque receipt ID is generated once per attempt and retained for retries. An exact duplicate receives the original receipt; a different body with the same ID is rejected.

Use the existing authenticated hosting SSH connection to read reports. Do not paste private report contents into public issues or commits.

```sh
ssh -i ~/.ssh/pillyliu_key pillyliu@67.222.24.219 \
  'php /home/pillyliu/pinprof-private/recognition-reports/tools/recognition-reports.php list'
ssh -i ~/.ssh/pillyliu_key pillyliu@67.222.24.219 \
  'php /home/pillyliu/pinprof-private/recognition-reports/tools/recognition-reports.php read REPORT_ID'
```

The same command with `photo REPORT_ID` writes JPEG bytes to stdout; redirect to a private local file when needed. Codex can use these commands when asked to investigate reports. No public listing, automatic notifications, or follow-up email delivery is enabled.

## Privacy and retention

The server repeats the clients' targeted removal policy from `_lib/recognition-report-privacy-v2.json`. Keep it identical to `shared/recognition-report/recognition-report-privacy-v2.json` in the vision repository. Diagnostic fields, including newly added fields, are preserved by default. Named GPS/location, saved venue, personal/device identifiers, credentials, local media paths, unrelated notes/history, and raw OCR text are removed. Runtime errors retain their diagnostic text with private paths, URLs, and email substrings redacted; errors are no longer reduced to broad categories. Typed descriptions and optional email addresses are separate form fields and intentionally preserved. The legacy v1 contract remains for deployment compatibility; clients that already discarded fields cannot recover them without an updated app and a new submission. Photos are reencoded again on the server to remove metadata. Visible content in a photo remains visible.

The full local payload is unaffected. Report-time device measurements are marked separately from saved scan-time diagnostics. Existing reports cannot recover instrumentation absent from older app builds.

An hourly cron invokes `expire` and deletes reports, photos, descriptions, and email addresses once 90 days old. Submissions also trigger expiry. Daily HMAC rate buckets expire after two days; raw IP addresses are not written into report JSON. Existing hosting/security logs are separate. Only verified Cloudflare peers can supply the client-IP header.

Limits: 7.5 MB request, 512 KB filtered diagnostics, 4.5 MB input JPEG, 4,000 description characters, 254 email bytes; 12 requests/minute and 100/day per daily network HMAC. The store stops accepting reports at its 5 GB quota or below 250 MB free disk. No embedded client secret is required. App-side photo processing caps the longest edge at 3,072 pixels.

## Deployment and validation

`tools/deploy-recognition-reports.sh` publishes only this API/library/contract and the private reader/retention tool, preserving the existing private configuration and unrelated cron entries. It runs PHP syntax and service tests before publishing. The regular deployment manifest also includes the endpoint.

```sh
php tests/recognition-reports/run.php
```

Eleven tests cover targeted redaction, diagnostic preservation, filtering, durable storage/idempotency, conflicts, malformed input, photo metadata removal, rate limits, expiry, and trusted proxy handling. Live synthetic uploads verified the endpoint, same-ID retry, private storage, and blocked public access. Synthetic reports were removed after verification. A native Android emulator upload also passed.

Before a public mobile release, update App Store privacy and Google Play Data safety disclosures for optional diagnostics/performance data, support descriptions, email, and photos. These account forms are separate from the shipped privacy manifest and website policy; this change does not publish a store release.
