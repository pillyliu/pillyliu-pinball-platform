# PinProf Admin

Local admin workspace for managing OPDB-backed machine overrides for PinProf.

## What it does

- Browses the generated OPDB catalog from `shared/pinball/data/pinball_library_seed_v1.sqlite`
- Stores editable override metadata in `shared/pinball/data/pinprof_admin_v1.sqlite`
- Imports playfield images into `shared/pinball/images/playfields`
- Saves supplemental rulesheet markdown into `shared/pinball/rulesheets`
- Reapplies admin overrides into the generated seed DB after every save/import
- Lets you target a specific OPDB machine alias before saving a playfield, so the file is named like `<opdb_machine_id>-playfield.*`

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

## Canonical workflow

If you want the local repo to stay the source of truth for starter bundles and deploys:

1. Run `npm run dev:pinprof-admin`.
2. Open the app locally and choose the machine.
3. In `Replace playfield image`, choose the exact OPDB alias that image belongs to.
4. Import the URL or upload the better image. The file will be saved into `shared/pinball/images/playfields/<opdb_machine_id>-playfield.*`.
5. Save any rulesheet markdown override you want in the same machine record.
6. Rebuild the shared data and starter bundles with `npm run sync:pinball:all-targets`.
7. Deploy the website copy with `./deploy.sh`.

## One-time migration

Older curated playfields may still use `practice_identity-playfield.*`. To rename those families to the preferred machine alias naming:

```bash
npm run pinprof-admin:rename-playfields-to-machine-alias
```

Use `-- --dry-run` first if you want to inspect the planned renames:

```bash
npm run pinprof-admin:rename-playfields-to-machine-alias -- --dry-run
```
