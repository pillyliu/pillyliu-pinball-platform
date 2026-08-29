# PinProf R2 pinball mirror

The canonical publish inputs remain in `../PinProf Admin/workspace`. `deploy.sh`
builds one sanitized static `/pinball` stage and publishes it independently to:

- KnownHost with `rsync`.
- Cloudflare R2 with `rclone`, served publicly at `https://data.pinprof.com/pinball/`.

Dynamic API files are never part of the static stage or R2 manifest:

- `pillyliu.com/pinball/api/` receives only `rulesheet.php` and its `.htaccess`.
- `pinprof.com/pinball/api/` receives only `pinball-map.php`, `_lib/`, and their `.htaccess` files.
- `data.pinprof.com/pinball/api/**` must return `404`.

## One-time rclone setup

Install rclone, then create an R2 API token with Object Read & Write access scoped
only to the `pinprof-media` bucket. Keep the secret outside Git and retain the
recovery copy in the password manager.

Configure an S3-compatible rclone remote named `pinprof-r2`:

- Storage type: `s3`
- Provider: `Cloudflare`
- Region: `auto`
- Endpoint: the account's `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` endpoint
- ACL: `private`
- Bucket: `pinprof-media`
- No bucket existence check: enabled for the bucket-scoped token

The deploy preflight refuses to continue when rclone, the named remote, or the
bucket credential is unavailable.

## Routine publishing

```bash
./deploy.sh --dry-run
./deploy.sh
```

The R2 step uses `rclone copy`, so ordinary deploys add or replace changed
objects without deleting older destination objects. This is intentional while
the mirror is new and R2 has no native bucket version history.

The publish order is:

1. Upload ordinary static objects with the normal four-hour cache policy.
2. Upload content-addressed `objects/sha256/**` with a one-year immutable policy.
3. Verify both object sets against the local stage.
4. Upload `cache-update-log.json` with a short revalidation policy.
5. Upload `cache-manifest.json` last with the same short revalidation policy.
6. Verify both manifests, an immutable cohort object, and public sample URLs.

If an object transfer or parity check fails, the new manifest is not published.
The deploy exits unsuccessfully instead of silently leaving the mirrors out of
sync.

## Browser CORS

The `pinprof-media` bucket allows read-only `GET` and `HEAD` requests from the
apex and `www` origins for `pinprof.com`, `pinprof.app`, and `pillyliu.com`.
Preflight responses are cached for one hour. Native clients and ordinary image
elements do not require CORS, but browser JavaScript `fetch()` does.

CORS is a browser interoperability rule, not access control. The public object
URLs remain directly downloadable; preventing unauthorized downloads would
require a Worker or signed URLs and a private bucket.

For an intentional emergency KnownHost-only deploy, use `--skip-r2`. This is an
explicit escape hatch and should not be the normal workflow.

## Configuration overrides

The defaults can be overridden without editing the script:

```text
R2_RCLONE_REMOTE=pinprof-r2
R2_BUCKET=pinprof-media
R2_PINBALL_PREFIX=pinball
R2_PUBLIC_BASE_URL=https://data.pinprof.com/pinball
R2_CACHE_CONTROL=public, max-age=14400
R2_IMMUTABLE_CACHE_CONTROL=public, max-age=31536000, immutable
R2_MANIFEST_CACHE_CONTROL=public, max-age=60, must-revalidate
R2_FORCE_UPLOAD=0
```

Set `R2_FORCE_UPLOAD=1` only for a one-time object rewrite when HTTP metadata,
such as `Cache-Control`, must be backfilled. Leave it unset for routine deploys.

Never place an R2 access key or secret in this repository or in deployment logs.
