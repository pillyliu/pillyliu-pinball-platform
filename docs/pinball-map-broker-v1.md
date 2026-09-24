# PinProf Pinball Map broker v1

The canonical endpoint is:

```text
POST https://pinprof.com/pinball/api/pinball-map.php
Content-Type: application/json
```

This is a narrow server-side broker, not a general proxy. It accepts only the allowlisted actions below and never accepts a provider URL, provider token, arbitrary query parameters, or write operation.

## Security boundary

- The approved Pinball Map `api_token` exists only in `/home/pillyliu/pinprof-private/pinball-map/config.php` on KnownHost.
- The browser, Swift, Kotlin, Python, source repositories, logs, and broker responses never receive the token.
- Provider authentication uses the currently documented `api_token` query parameter on server-to-server requests.
- Client metadata is informational and is not authentication. Do not add a native or browser secret.
- Requests use POST JSON so address and coordinates do not appear in access-log URLs.
- Responses use `Cache-Control: no-store`.
- Browser origins are restricted to the PinProf and pillyliu apex/`www` HTTPS origins. CORS does not protect native traffic, so abuse controls are enforced independently.
- PinProf.com is the only accepted Host. The deployment mirror on pillyliu.com returns 404.

## Common request

```json
{
  "schemaVersion": 1,
  "action": "location_roster",
  "input": {
    "locationId": 874
  },
  "client": {
    "surface": "pinprof-ios",
    "version": "3.6.4"
  }
}
```

`client` is optional. Allowed surfaces are `pinprof-ios`, `pinprof-android`, `pinprof-web`, `pillyliu-library`, `pinprof-vision-ios`, `pinprof-vision-android`, `pinprof-vision-python`, `pinprof-admin`, and `test`.

Unknown fields and unsupported schema versions are rejected.

## Actions

### `search_address`

```json
{"address":"Detroit, MI","radiusMiles":25}
```

- `address`: trimmed text, 2-200 characters.
- `radiusMiles`: integer, 1-100.
- Upstream: `closest_by_address.json` with `no_details=1` and `send_all_within_distance=true`.
- The broker returns venue summaries only. Search-result roster fields are intentionally discarded.

### `search_coordinates`

```json
{"latitude":42.3314,"longitude":-83.0458,"radiusMiles":25}
```

- Latitude and longitude must be numeric JSON values in their geographic ranges.
- `radiusMiles`: integer, 1-100.
- Upstream: `closest_by_lat_lon.json` with `no_details=1` and `send_all_within_distance=true`.
- The broker returns venue summaries only.

### `location_roster`

```json
{"locationId":874}
```

- Upstream: `locations/:id.json?no_details=1`.
- The current roster is extracted from `location_machine_xrefs[].machine_id` on every request.
- The venue roster is never persisted or served from a broker cache.
- Machine IDs join to the private stable machine catalog.

### `nearest_location_roster`

```json
{"latitude":42.3314,"longitude":-83.0458,"maxDistanceMiles":0.25}
```

- Returns the nearest live venue roster and stable machine mappings without applying a product-specific trust gate.
- Omits Pinball Map's `max_distance` parameter, matching the pre-broker clients and preserving the provider's nearest-location default range; `maxDistanceMiles` is validated as client policy but applied only by the client.
- The client retains its existing GPS accuracy, distance, status, title/variant, and offline-fallback behavior.
- Parallel `machine_names` are preserved as `providerDisplayName`, so a catalog miss can still yield name-only evidence.
- `rosterComplete=false` means the catalog join was incomplete. Library clients must not overwrite a saved lineup; Vision may retain explicitly untrusted name-only evidence.

### `vision_nearby` (compatibility)

```json
{"latitude":42.3314,"longitude":-83.0458,"horizontalAccuracyMeters":24.0}
```

- Accuracy over 150 m returns `location_accuracy_insufficient` without contacting Pinball Map.
- Missing accuracy uses a 0.10-mile trust gate.
- Otherwise the trust gate is `accuracyMiles + 0.05`, clamped to 0.10-0.25 mile.
- Pinball Map parses `max_distance` as an integer. The broker requests the nearest venue within one mile and applies the fractional trust gate locally.
- A matched result joins the returned `machine_ids` to the private catalog in the same broker action.

## Success response

```json
{
  "schemaVersion": 1,
  "requestId": "opaque-id",
  "action": "location_roster",
  "data": {
    "location": {
      "id": 874,
      "name": "Ground Kontrol Classic Arcade",
      "street": "...",
      "city": "Portland",
      "state": "OR",
      "zip": "...",
      "latitude": 45.52,
      "longitude": -122.67,
      "distanceMiles": null,
      "machineCount": 45,
      "dateLastUpdated": "...",
      "updatedAt": "..."
    },
    "machines": [
      {
        "pinballMapId": 3415,
        "opdbId": "GweeP-MW95j",
        "name": "Godzilla (Pro)",
        "manufacturer": "Stern",
        "year": 2021,
        "mappingStatus": "mapped_exact"
      }
    ],
    "mappedOpdbIds": ["GweeP-MW95j"],
    "unmappedCount": 0
  },
  "provenance": {
    "provider": "pinball_map",
    "providerName": "Pinball Map",
    "providerUrl": "https://pinballmap.com",
    "attribution": "Venue data provided by Pinball Map.",
    "retrievedAt": "2026-07-27T00:00:00+00:00",
    "rosterFreshness": "live",
    "contractVersion": 1,
    "catalog": {
      "status": "fresh",
      "fetchedAt": "2026-07-27T00:00:00+00:00",
      "machineCount": 2276
    }
  }
}
```

Machine mapping is exact and has three states:

- `mapped_exact`: a non-empty OPDB ID came from the Pinball Map catalog record.
- `missing_opdb_id`: the catalog record exists but its OPDB ID is null/blank.
- `catalog_record_missing`: the roster referenced a machine absent from the current catalog.

Clients may persist only `mapped_exact` OPDB IDs for exact Library or recognition identity. They must not derive an exact edition identity from `name`. Clients may still parse parenthetical text such as `Premium` as descriptive title/variant metadata; doing so never creates or upgrades an OPDB identity.

## Error response

```json
{
  "schemaVersion": 1,
  "requestId": "opaque-id",
  "action": "location_roster",
  "error": {
    "code": "UPSTREAM_RATE_LIMITED",
    "message": "Pinball Map is temporarily rate limited.",
    "retryable": true,
    "retryAfterSeconds": 30
  }
}
```

Stable codes include `INVALID_JSON`, `INVALID_REQUEST`, `INVALID_ACTION`, `UNSUPPORTED_SCHEMA_VERSION`, `REQUEST_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `METHOD_NOT_ALLOWED`, `NOT_FOUND`, `RATE_LIMITED`, `UPSTREAM_RATE_LIMITED`, `UPSTREAM_TIMEOUT`, `UPSTREAM_UNAVAILABLE`, `UPSTREAM_INVALID_RESPONSE`, `CATALOG_INVALID`, `CATALOG_UNAVAILABLE`, `CONFIGURATION_ERROR`, and `INTERNAL_ERROR`.

Provider response bodies, URLs containing the token, and raw cURL errors are never returned.

## Cache ownership

The private catalog cache is `machines-v2.json`, outside both document roots:

- Lazy 24-hour full refresh from `machines.json`. The compatibility cache retains IPDB metadata previously carried by Vision while remaining one infrequent bulk request.
- File lock prevents parallel refreshes.
- A same-directory temporary file is flushed and atomically renamed only after validating a plausible full catalog.
- Valid stale data is used when refresh fails.
- At most three missing IDs use filtered `machines.json?id=...` refreshes; more than three trigger one full refresh.
- Missing/null OPDB IDs stay unresolved.

Venue/search responses are persisted separately in `responses-v1/` for 48 hours. Nearest-venue searches with the same upstream parameters share an original coordinate anchor within 50 metres. Radius searches retain exact coordinates and radius to avoid dropping venues at a moved circle boundary. Address searches retain their address and radius; rosters are keyed by venue ID. Raw responses retain the games returned by Pinball Map. This is incomplete, demand-driven coverage, not an authoritative venue directory.

A short registry lock selects an anchor, then a per-entry lock owns the refresh. Unrelated entries do not wait on network work. Cold duplicates wait up to eight seconds; each upstream call has a six-second timeout and no automatic duplicate retry. During refresh, other callers may receive saved stale evidence immediately. Refresh failure retains the last successful response and starts a shared cooldown of at least 30 seconds (or the provider Retry-After). Successful empty responses replace the current answer. No scheduled bulk refresh occurs, and expiry never deletes saved responses.

`provenance.cache` includes `status`, `fetchedAt`, `expiresAt`, `stale`, `reuseDistanceMeters`, and original anchor coordinates when applicable. Venue distance is recalculated for each caller. `retrievedAt` preserves the upstream fetch time. Existing response fields remain compatible; `rosterFreshness` may now be `cached` or `stale`.

Sanitized request logs include cache status, original fetch/expiry, reuse distance, app surface/action, and actual upstream request count (including catalog fetches). Tokens, raw addresses, and coordinates are excluded from logs; private response storage contains query anchors for cache matching. The two apps persist broker responses and preserve broker expiry/anchors, coalesce matching requests, and retain stale offline fallback.

## Validation

Run on a PHP 8.2 environment:

```sh
php -l shared/pinball-api/_lib/PinballMapBroker.php
php -l shared/pinball-api/pinball-map.php
php tests/pinball-map-broker/run.php
```

Deployment must canary all allowlisted actions, verify `_lib` is not web-readable, inspect sanitized logs, and scan client artifacts for the provider token and direct `/api/v1/` calls.
