# Pillyliu Pinball Platform

Monorepo for `pillyliu.com` and the public pinball website apps.

## Apps

- `pillyliu-landing` -> `/`
- `lpl-library` -> `/lpl-library/`
- `lpl-standings` -> `/lpl-standings/`
- `lpl-stats` -> `/lpl-stats/`
- `lpl-targets` -> `/lpl-targets/`
- remote `pinprof-admin/` deploy -> staged from `../PinProf Admin/apps/admin-ui` and `../PinProf Admin/apps/admin-site-runtime`

## Canonical Data Model

- Source of truth lives in `../PinProf Admin/workspace`, not in this repo.
- Canonical machine/catalog data is built from raw `opdb_export.json`, canonical asset layers, Pinball Map venue imports, and venue layout overlays inside `PinProf Admin`.
- This repo consumes those published outputs during smoke/build/deploy.
- Production still serves the shared public payload at `/pinball/...`.
- App preload bundles are also built from `PinProf Admin/workspace` and synced during deploy.
- App-only shared support files such as `pinside_group_map.json`, shake-warning art, and intro overlay sources now live in the `Pinball App` repo, not here or in `PinProf Admin`.
- The old local `shared/pinball` tree has been retired and archived for local reference only.

## Common Commands

```bash
npm run build:all
npm run build:pinprof-admin
npm run check:smoke
./deploy.sh
```

## Further Docs

- `PINBALL_SOP.md` - current operational runbook
- `DEPLOY_READINESS_CHECKLIST.md` - pre/post deploy checklist
- `SHARED_DATA_CONTRACT.md` - current data ownership and publish contract
- `PINBALL_DATA_WORKFLOW.md` - workflow overview by workspace
- `BRAND_STYLE.md` - cross-site header/brand style rules
