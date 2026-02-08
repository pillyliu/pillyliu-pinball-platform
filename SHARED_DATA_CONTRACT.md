# Shared Pinball Data Contract

## Goal

Use one canonical dataset for all pinball pages so updates are made once and deployed once.

## Canonical Source

- Source-of-truth directory:
  - `shared/pinball`

## Distribution Model

- App bundles do not include their own `pinball` payload anymore.
- Production serves canonical shared data at:
  - `/pinball/...`
- Apps consume absolute `/pinball/...` URLs at runtime.

## Sync Rules

- Do not manually edit app-local `public/pinball` content.
- Edit files only in `shared/pinball`.
- Generate manifest/update log from root:
  - `npm run sync:pinball`
- Optional legacy command to copy canonical data into each app `public/pinball`:
  - `npm run sync:pinball:apps`
- Manifest and update log are generated in:
  - `shared/pinball/cache-manifest.json`
  - `shared/pinball/cache-update-log.json`

## Why This Exists

- Prevents drift and duplicate static payload across app builds.
- Reduces app `dist` size and noisy git churn.
- Keeps deploy flow simple: upload `shared/pinball` once, upload app bundles separately.
