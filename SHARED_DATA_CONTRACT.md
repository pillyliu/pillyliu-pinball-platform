# Shared Pinball Data Contract

## Goal

Use one canonical dataset for all pinball pages so updates are made once and distributed consistently.

## Canonical Source

- Shared source-of-truth directory:
  - `shared/pinball`

## App Targets

The following app public folders are generated from `shared/pinball`:

- `lpl-library/public/pinball`
- `lpl-standings/public/pinball`
- `lpl-stats/public/pinball`

## Sync Rules

- Do not manually edit `public/pinball` inside those apps.
- Edit files only in `shared/pinball`.
- Run sync before builds:
  - all apps: `npm run sync:pinball` (repo root)
  - single app: `npm run sync:pinball` inside app folder
- Manifest and update log are generated automatically during sync:
  - `shared/pinball/cache-manifest.json`
  - `shared/pinball/cache-update-log.json`

## Why This Exists

- Keeps `/pinball/...` URLs stable for current website/app behavior.
- Prevents data drift between page projects.
- Sets up a clean foundation for hash manifests, selective refresh, and offline caching.
