# Pinball SOP

Use this runbook for normal pinball data updates and deploys.

## Canonical Rule

Edit pinball data in `../PinProf Admin/workspace` or through the local PinProf Admin app.

Do not use this repo's `shared/pinball` tree as the forward editing path. That tree is archived for local reference only.

## Normal Update Flow

1. Update canonical data in `PinProf Admin`.
2. Rebuild canonical publish outputs:

```bash
bash '/Users/pillyliu/Documents/Codex/PinProf Admin/scripts/publish/rebuild-shared-pinball-payload.sh'
```

3. From this repo, run:

```bash
npm install
npm run build:all
npm run build:pinprof-admin
npm run check:smoke
```

4. Deploy:

```bash
./deploy.sh
```

## League CSV Updates

Update:

- `../PinProf Admin/workspace/data/source/LPL_Standings.csv`
- `../PinProf Admin/workspace/data/source/LPL_Stats.csv`
- `../PinProf Admin/workspace/data/source/LPL_Targets.csv`
- `../PinProf Admin/workspace/data/source/redacted_players.csv`

Then run the normal update flow above.

## Verification

Before deploy, confirm:

- latest site builds succeed
- `npm run check:smoke` passes
- the intended `/pinball/...` data files are present after rebuild
- pages load locally or in production without broken assets
