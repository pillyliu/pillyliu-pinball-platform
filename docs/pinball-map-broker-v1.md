# PinProf Pinball Map broker v1

The canonical endpoint is:

```text
POST https://pinprof.com/pinball/api/pinball-map.php
Content-Type: application/json
```

This is a narrow server-side broker, not a general proxy. It accepts only the four actions below and never accepts a provider URL, provider token, arbitrary query parameters, or write operation.

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

`client` is optional. Allowed surfaces are `pinprof-ios`, `pinprof-android`, `pinprof-web`, `pillyliu-library`, `pinprof-vision-ios`, `pinprof-vision-python`, `pinprof-admin`, and `test`.

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

### `vision_nearby`

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

Clients may persist only `mapped_exact` OPDB IDs for exact Library or recognition identity. They must not derive an edition from `name`.

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

The private catalog cache is `machines-v1.json`, outside both document roots:

- Lazy 24-hour full refresh from `machines.json?no_details=1`.
- File lock prevents parallel refreshes.
- A same-directory temporary file is flushed and atomically renamed only after validating a plausible full catalog.
- Valid stale data is used when refresh fails.
- At most three missing IDs use filtered `machines.json?no_details=1&id=...` refreshes; more than three trigger one full refresh.
- Missing/null OPDB IDs stay unresolved.

No search result or venue roster is written to this cache. Clients may keep their existing last-known offline Library lineup, but each user-triggered import/refresh must request a live roster first.

## Validation

Run on a PHP 8.2 environment:

```sh
php -l shared/pinball-api/_lib/PinballMapBroker.php
php -l shared/pinball-api/pinball-map.php
php tests/pinball-map-broker/run.php
```

Deployment must canary all four actions, verify `_lib` is not web-readable, inspect sanitized logs, and scan client artifacts for the provider token and direct `/api/v1/` calls.
