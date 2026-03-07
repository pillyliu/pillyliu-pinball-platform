# Pillyliu Pinball Platform

Monorepo for `pillyliu.com` and related pinball apps.

## Apps

- `pillyliu-landing` -> `/`
- `lpl-library` -> `/lpl-library/`
- `lpl-standings` -> `/lpl-standings/`
- `lpl-stats` -> `/lpl-stats/`
- `lpl-targets` -> `/lpl-targets/`
- `pinprof-admin` -> static frontend for hosted/private admin UI
- `pinprof-admin-site` -> PHP/MariaDB backend runtime for shared hosting deployment

## Canonical Data Model

- Shared source of truth: `shared/pinball`
- Production canonical route: `/pinball/...`
- App bundles do not ship their own `dist/pinball` payload.

## Common Commands (repo root)

```bash
npm run sync:pinball        # regenerate shared/pinball manifest + update log
npm run league:update-check # validate core CSV/JSON integrity
npm run build:all           # build all apps
npm run build:pinprof-admin # build the hosted admin frontend
npm run check:smoke         # smoke check builds + shared/pinball contract
./deploy.sh                 # build + smoke + deploy
```

## Further Docs

- `PILLYLIU_WEB_DESIGN_SYSTEM.md` - shared UI/design contract (required before UI/layout changes)
- `PINBALL_SOP.md` - operational runbook
- `DEPLOY_READINESS_CHECKLIST.md` - pre/post deploy checklist
- `SHARED_DATA_CONTRACT.md` - shared pinball contract
- `BRAND_STYLE.md` - cross-site header/brand style rules
