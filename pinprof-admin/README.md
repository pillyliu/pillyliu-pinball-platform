# PinProf Admin

Local admin UI for managing OPDB-backed machine overrides for PinProf.

## What it does

- Browses the generated OPDB catalog from the current PinProf Admin workspace by default
- Stores editable override metadata in the current PinProf Admin workspace by default
- Imports playfield images into the current PinProf Admin workspace by default
- Saves supplemental rulesheet markdown into the current PinProf Admin workspace by default
- Reapplies admin overrides into the generated seed DB after every save/import
- Lets you target a specific OPDB machine alias before saving a playfield, so the file is named like `<opdb_machine_id>-playfield.*`

## Current transition state

When you run this copy from `PinProf Admin`, it defaults to the split workspace layout:

- `/Users/pillyliu/Documents/Codex/PinProf Admin/workspace/db`
- `/Users/pillyliu/Documents/Codex/PinProf Admin/workspace/assets`
- `/Users/pillyliu/Documents/Codex/PinProf Admin/workspace/data`

The legacy website deploy still works because you mirror this workspace back into `Pillyliu Pinball Website` with the legacy sync bridge.

If this same admin source tree is mirrored back into the legacy website repo, it automatically falls back to the legacy `shared/pinball` layout unless you override it with environment variables.

## Run locally

From this folder:

```bash
npm install
npm run dev
```

The backend listens on `http://localhost:8787` and the Vite frontend on `http://localhost:5177`.

## Environment

- `PINPROF_ADMIN_PASSWORD`: required before exposing outside localhost
- `PINPROF_SESSION_SECRET`: cookie signing secret
- `PINPROF_ADMIN_PORT`: optional backend port override
- `PINPROF_ADMIN_WORKSPACE_ROOT`: override the detected PinProf Admin root
- `PINPROF_ADMIN_LEGACY_WEBSITE_ROOT`: override the current legacy website repo root
- `PINPROF_ADMIN_SHARED_PINBALL_DIR`: force a legacy single-tree `shared/pinball` source instead of the split workspace layout
- `PINPROF_ADMIN_APPLY_OVERRIDES_SCRIPT`: override the current admin-override apply script path

If `PINPROF_ADMIN_PASSWORD` is unset, the local fallback password is `change-me`.

## Canonical workflow

During the migration:

1. Run `npm run dev`.
2. Open the app locally and choose the machine.
3. In `Replace playfield image`, choose the exact OPDB alias that image belongs to.
4. Import the URL or upload the better image.
5. Save any rulesheet markdown override you want in the same machine record.
6. Mirror forward into the legacy website layout from `PinProf Admin` if needed.
7. Keep using the existing website deploy flow until the deploy contract is intentionally switched.

## One-time migration

Older curated playfields may still use `practice_identity-playfield.*`. To rename those families to the preferred machine alias naming:

```bash
npm run pinprof-admin:rename-playfields-to-machine-alias
```

Use `-- --dry-run` first if you want to inspect the planned renames:

```bash
npm run pinprof-admin:rename-playfields-to-machine-alias -- --dry-run
```
