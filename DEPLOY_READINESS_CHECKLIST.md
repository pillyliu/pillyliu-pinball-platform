# Deploy Readiness Checklist

Use this before every production deploy to `pillyliu.com`.

## 1) Update Canonical Data

Make edits in `../PinProf Admin/workspace` or through the local PinProf Admin app.

Typical sources:

- `workspace/data/source/*.csv`
- `workspace/assets/*`
- canonical admin DB entries managed by PinProf Admin

## 2) Rebuild Canonical Publish Outputs

From `PinProf Admin`:

```bash
bash '/Users/pillyliu/Documents/Codex/PinProf Admin/scripts/publish/rebuild-shared-pinball-payload.sh'
```

This refreshes the published `/pinball` payload inputs and the app preload bundle from the same workspace.

## 3) Build Site Apps

From this repo:

```bash
npm run build:all
npm run build:pinprof-admin
```

## 4) Run Smoke Check

From this repo:

```bash
npm run check:smoke
```

This verifies the expected PinProf Admin inputs and website build outputs before deploy.

## 5) Deploy

From this repo:

```bash
./deploy.sh
```

`deploy.sh` stages `/pinball` from `PinProf Admin/workspace`, syncs the app preload bundle, and uploads the website payloads.

## 6) Post-Deploy Smoke

Verify in browser:

- `https://pillyliu.com/`
- `https://pillyliu.com/lpl-library/`
- `https://pillyliu.com/lpl-standings/`
- `https://pillyliu.com/lpl-stats/`
- `https://pillyliu.com/lpl-targets/`

Check:

- pages render without broken assets
- current data appears
- `/pinball/...` assets resolve normally
- app-facing data files are live
