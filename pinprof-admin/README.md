# PinProf Admin

Local admin workspace for managing OPDB-backed machine overrides for PinProf.

## What it does

- Browses the generated OPDB catalog from `shared/pinball/data/pinball_library_seed_v1.sqlite`
- Stores editable override metadata in `shared/pinball/data/pinprof_admin_v1.sqlite`
- Imports playfield images into `shared/pinball/images/playfields`
- Saves supplemental rulesheet markdown into `shared/pinball/rulesheets`
- Reapplies admin overrides into the generated seed DB after every save/import

## Run locally

From the repo root:

```bash
npm run dev:pinprof-admin
```

Or from this folder:

```bash
npm install
npm run dev
```

The backend listens on `http://localhost:8787` and the Vite frontend on `http://localhost:5177`.

## Environment

- `PINPROF_ADMIN_PASSWORD`: required before exposing outside localhost
- `PINPROF_SESSION_SECRET`: cookie signing secret
- `PINPROF_ADMIN_PORT`: optional backend port override

If `PINPROF_ADMIN_PASSWORD` is unset, the local fallback password is `change-me`.

## Sync integration

`tools/sync-pinball-data.mjs` now runs `tools/pinprof/apply-admin-overrides.mjs` after regenerating `pinball_library_seed_v1.sqlite`, so admin edits persist through the normal sync workflow.
