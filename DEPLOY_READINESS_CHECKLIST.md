# Deploy Readiness Checklist

Use this checklist before every production upload/deploy to `pillyliu.com`.

## 1) Update Canonical Data

- Update only canonical data in `shared/pinball/...`.
- Do not hand-edit app copies in any `*/public/pinball/...` directory.

## 2) Run Validation + Sync

From repo root:

```bash
npm run league:update-check
npm run sync:pinball
```

## 3) Build All Pages

From repo root:

```bash
npm run build:all
```

Expected built route outputs:
- `pillyliu-landing/dist` for `/`
- `lpl-library/dist` for `/lpl_library`
- `lpl-standings/dist` for `/lpl_standings`
- `lpl-stats/dist` for `/lpl_stats`
- `lpl-targets/dist` for `/lpl_targets`

Note:
- Pinball app `dist` folders should not carry their own `dist/pinball` payload.
- Canonical pinball data is deployed once from `shared/pinball` to `/pinball`.

## 4) Run Smoke Check

From repo root:

```bash
npm run check:smoke
```

This checks:
- Each app has `dist/index.html` and built assets.
- Canonical shared pinball data exists and is valid:
  - `shared/pinball/cache-manifest.json`
  - `shared/pinball/cache-update-log.json`
  - required files in `shared/pinball/data`
  - required `/pinball/data/...` keys are present in manifest.

## 5) Deploy

- Deploy each app dist to its route target using your current hosting process.
- Keep canonical production shared data available at:
  - `https://pillyliu.com/pinball/...`

## 6) Post-Deploy Smoke

Verify in browser:
- `https://pillyliu.com/`
- `https://pillyliu.com/lpl_library/`
- `https://pillyliu.com/lpl_standings/`
- `https://pillyliu.com/lpl_stats/`
- `https://pillyliu.com/lpl_targets/`

Check:
- Pages render without broken assets.
- Current data appears.
- Navigation links and key table views work.

## 7) Rollback Plan

If production issue is detected:
- Roll back to previous known-good `dist` upload immediately.
- Revert offending commit locally if needed:

```bash
git revert <commit-sha>
```

- Rebuild and redeploy with checklist above.
