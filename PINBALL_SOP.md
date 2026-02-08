# Pinball SOP (Step-by-Step Runbook)

Use this when you need to update data and deploy without remembering details.

## Scope

Covers:
- Biweekly standings/stats refresh.
- Avenue machine/library changes.
- Rulesheet and gameinfo updates.
- Shared sync/build/deploy flow.

Does not cover:
- League calculations (provided externally by Joseph).

## Canonical Data Rule

Always edit canonical files in:
- `shared/pinball/...`

Do not rely on app-local `public/pinball` copies for deploys.
Deploy uses canonical `shared/pinball` directly.

## One-Time Setup (new machine or after environment reset)

From repo root:

```bash
npm install
npm --prefix lpl-library install
npm --prefix lpl-standings install
npm --prefix lpl-stats install
npm --prefix pillyliu-landing install
```

Optional but recommended if `tsx` is missing:

```bash
npm --prefix lpl-library install -D tsx
```

## Quick Command Index

From repo root:

```bash
# regenerate manifest from shared/pinball
npm run manifest:pinball

# run sanity checks (errors fail, warnings are informational)
npm run league:update-check

# generate canonical manifest/update log from shared/pinball
npm run sync:pinball

# full build (all apps)
npm run build:all
```

Per app:

```bash
npm --prefix lpl-library run build
npm --prefix lpl-standings run build
npm --prefix lpl-stats run build
```

## Biweekly Update SOP (Standings + Stats)

### 1) Update CSV data

Edit:
- `shared/pinball/data/LPL_Standings.csv`
- `shared/pinball/data/LPL_Stats.csv`

Apply your normalization rules before save:
- Keep player names consistent with existing seasons.
- Keep machine names consistent with library naming.
- Remove rows that are known invalid/problematic for stats (for example bad zero-point artifacts).

### 2) Fast sanity checks

- Ensure `LPL_Standings.csv` header still contains:
  - `season,player,total,rank,eligible,nights,bank_1,...,bank_8`
- Ensure `LPL_Stats.csv` header still contains:
  - `Season,BankNumber,Bank,Player,Machine,RawScore,Points`

### 3) Regenerate canonical manifest/update log

```bash
npm run league:update-check
npm run sync:pinball
```

### 4) Build and smoke test

```bash
npm run build:lpl-standings
npm run build:lpl-stats
```

Check locally:
- Standings loads latest season and table renders.
- Stats filters still work (Season -> Player -> Bank -> Machine).
- No obvious name regressions.

### 5) Deploy

Deploy using your existing hosting flow for `pillyliu.com`.

### 6) Post-deploy verification

Open production pages and confirm:
- Latest bank appears.
- New rows are visible.
- No blank/broken table states.

## How To Run The Sanity Check

From repo root:

```bash
cd /Users/pillyliu/Documents/Codex/Pillyliu\ Pinball\ Website
npm run league:update-check
```

Behavior:
- Exit `0`: pass (safe to continue).
- Exit non-zero: at least one blocking error.
- Warnings do not fail the command, but should be reviewed.

What it checks:
- Required CSV/JSON files exist in `shared/pinball/data`.
- `LPL_Standings.csv` has required standings headers.
- `LPL_Stats.csv` has required stats headers.
- `pinball_library.json` is valid and has unique slugs.
- Referenced local rulesheets/playfields exist.
- Missing `_700.webp`/`_1400.webp` and missing `gameinfo/*.md` are flagged as warnings.
- Possible naming variants in player/machine values are flagged as warnings.

## Ask Codex To Run It

When you want me to run it in this repo, say:

```text
run the league update check
```

or:

```text
run npm run league:update-check and tell me what failed
```

I will run the command, summarize errors/warnings, and suggest the next fixes.

## Avenue Library Change SOP (add/remove/reposition games)

Use this whenever machines change at The Avenue.

### 1) Update source sheet

Update Google Sheet rows for each changed game:
- Game, Manufacturer, Year
- Rulesheet URL
- Playfield Image URL
- Tutorial/Gameplays URLs
- Group, Pos, Bank

Published CSV source:
- `https://docs.google.com/spreadsheets/d/e/2PACX-1vTlFuhuOFWj3Wbki2wOaHTUCUojPQ_5DsPJ8ta4P0zlQNLijHFHwbSQ7gJhosdlWVn-todC_t9AWmkq/pub?gid=2051576512&single=true&output=csv`

### 2) Refresh local CSV

Update local canonical CSV:
- `shared/pinball/data/Avenue Pinball - Current.csv`
- Optionally keep `shared/pinball/data/pinball_library.csv` aligned if you still use it as backup.

### 3) Regenerate `pinball_library.json`

From `lpl-library`:

```bash
cd lpl-library
npx tsx scripts/build_pinball_library.ts ../shared/pinball/data/Avenue\ Pinball\ -\ Current.csv
```

Then copy the generated JSON into shared canonical location if needed:

```bash
cp public/pinball/data/pinball_library.json ../shared/pinball/data/pinball_library.json
```

### 4) Ensure playfield images exist

For each new slug, verify files exist in:
- `shared/pinball/images/playfields/`

Expected assets:
- Original image (`.jpg`/`.jpeg`/`.png`)
- `<slug>_1400.webp`
- `<slug>_700.webp`

If missing:
- Source high-quality image manually (Stern/Pinside/etc).
- Run your image conversion process to produce 1400/700 webp variants.
- Place results in `shared/pinball/images/playfields/`.

### 5) Rulesheet and gameinfo coverage

For each new game slug, verify:
- `shared/pinball/rulesheets/<slug>.md`
- `shared/pinball/gameinfo/<slug>.md`

If missing, create placeholders.

### 6) Refresh manifest + build + verify

From repo root:

```bash
npm run sync:pinball
npm run build:lpl-library
```

Verify in library app:
- Card appears.
- Group/Pos/Bank are accurate.
- Rulesheet link opens.
- Game info section loads.
- Images load with no broken fallbacks.

## Rulesheet Update SOP

### TiltForums-based rulesheets

1. Update links in:
- `tools/rulesheets/tiltforums_urls.txt`

2. Run exporter:

```bash
cd tools/rulesheets
node export_rulesheets.mjs
```

3. Copy resulting `.md` files into shared canonical folder (if generated elsewhere):
- `shared/pinball/rulesheets/`

### Non-TiltForums rulesheets

- Manually convert and preserve text as closely as possible.
- Add/keep TOC anchors for in-page navigation.
- Save to:
  - `shared/pinball/rulesheets/<slug>.md`

### Finalize

```bash
cd /Users/pillyliu/Documents/Codex/Pillyliu Pinball Website
npm run sync:pinball
npm run build:lpl-library
```

## Gameinfo SOP

For a new/updated game:
- Edit `shared/pinball/gameinfo/<slug>.md`.
- Keep format simple and consistent.
- Include "Peter's Notes" section (placeholder allowed).

Then:

```bash
npm run sync:pinball
npm run build:lpl-library
```

## Pre-Deploy Checklist (10 minutes)

- `shared/pinball/data/pinball_library.json` is valid JSON.
- `LPL_Standings.csv` and `LPL_Stats.csv` updated for latest bank cycle.
- New/changed games have:
  - playfield original + 1400/700 webp
  - rulesheet md
  - gameinfo md
- `npm run sync:pinball` completed.
- Relevant builds succeed.
- Production smoke check done on:
  - Library
  - Standings
  - Stats
  - Targets (if bank mappings changed)

## Suggested Workflow Improvements (incremental)

1. Add a single script `npm run refresh:league` to run:
   - validation -> manifest -> sync -> standings/stats build.
2. Add validation scripts for:
   - unknown player/machine aliases.
   - missing gameinfo/rulesheet/image assets for slugs in JSON.
3. Migrate `lpl-targets` from static HTML to Vite so bank info can reuse shared pinball data directly.
4. Add venue model for Avenue + RLM with a venue switch in UI.

## Recovery Notes

If something breaks:

1. Re-generate canonical manifest:

```bash
npm run sync:pinball
```

2. Build only failing app:

```bash
npm --prefix <app-folder> run build
```

3. Check for missing file paths referenced by:
- `shared/pinball/data/pinball_library.json`
- `playfieldLocal`
- `rulesheetLocal`
- `gameinfo/<slug>.md`

4. Fix canonical file in `shared/pinball`, then resync.

## Ownership Notes

- League scoring calculations are external.
- This repo is the presentation + aggregation layer.
- Keep changes deterministic and repeatable; avoid direct edits in generated app public folders.
