# Pinball Data Workflow (Current + Next)

## Purpose

This document captures how pinball data/assets are currently sourced and maintained for `pillyliu.com`, plus recommended workflow improvements.

## Canonical Sources Today

- Main machine catalog source is a published Google Sheet CSV:
  - `https://docs.google.com/spreadsheets/d/e/2PACX-1vTlFuhuOFWj3Wbki2wOaHTUCUojPQ_5DsPJ8ta4P0zlQNLijHFHwbSQ7gJhosdlWVn-todC_t9AWmkq/pub?gid=2051576512&single=true&output=csv`
- Local canonical shared app data is kept in:
  - `shared/pinball`
- `pinball_library.json` is generated from CSV via:
  - `lpl-library/scripts/build_pinball_library.ts`
- `LPL_Standings.csv` and `LPL_Stats.csv` are maintained from season data (Season 14 through current Season 24) and updated manually every ~2 weeks.
- League calculations are produced externally by Joseph (league director's husband). This repo ingests already-calculated data.

## Current Process by Data Type

### 1) Library CSV -> JSON

- Update Avenue game data in Google Sheets.
- Consume published CSV export.
- Generate `pinball_library.json` using `build_pinball_library.ts`.
- Regenerate canonical manifest/update log before build/deploy.

### 2) Standings + Stats CSVs

- Every 2 weeks, update bank data in:
  - `shared/pinball/data/LPL_Standings.csv`
  - `shared/pinball/data/LPL_Stats.csv`
- Data has been cleaned over time for:
  - Naming consistency across seasons (players/machines).
  - Removing problematic zero-point entries that distorted statistics.
- No calculations are performed in-app; the CSVs are treated as final source values.

### 3) Playfield Images

- Images were manually sourced for quality:
  - Stern Pinball image URLs (often by trimming small-size suffixes to locate larger originals).
  - Pinside and archived sales listings for high-quality top-down playfield shots.
- A helper script was used to batch-generate optimized images:
  - `1400px` wide WebP (or converted original if source width < 1400).
  - `700px` wide WebP.

### 4) Rulesheets

- Tilt Forums rulesheets were exported to HTML with script support.
- Links came from the same Avenue Google Sheet dataset.
- Rulesheets were then converted to Markdown.
- For non-TiltForums sources, text was manually brought in and formatted.
- Table-of-contents sections with anchors were added, while preserving original rules text as closely as possible.
- Current one-command flow:
  - `npm run rulesheets:refresh`
  - This runs: Google Sheet -> `tools/rulesheets/tiltforums_urls.txt` sync -> markdown export to `shared/pinball/rulesheets/<gameslug>.md` -> sync to web app public folders and iOS/Android starter-pack bundles.

### 5) Game Info Markdown (`gameinfo/*.md`)

- Initial files included:
  - `godzilla.md` created from rulesheet-derived content.
  - `foo-fighters.md` as a joke entry.
- Remaining gameinfo files were generated later in a separate Codex pinball app project:
  - Basic info pulled from rulesheets.
  - Placeholder "Peter's Notes" section added for each game.

## Ongoing Responsibilities

- Update standings and stats bank data every 2 weeks.
- Publish updates to `pillyliu.com`.
- Keep Avenue machine list current:
  - Add/remove games.
  - Keep physical location (`group`/`pos`) accurate for The Avenue (Lansing).
  - Keep `bank` assignments accurate each season.
- Keep `lpl-targets` bank mapping accurate too.

## Known Gaps / Pain Points

- Multi-step manual workflow across Sheets, CSV, JSON, images, rulesheets, and gameinfo.
- Repetitive biweekly update tasks.
- Inconsistent tooling history between projects.
- `lpl-targets` is still static HTML, which makes shared-data integration harder.

## Recommended Workflow (Pragmatic Next Version)

### Phase 1: Standardize updates (no architecture rewrite)

1. Create a single update checklist for biweekly ops:
   - Pull latest standings/stats source.
   - Normalize names via a shared alias map.
   - Validate required columns and non-empty season/bank fields.
   - Regenerate/sync shared pinball data.
   - Build + quick visual smoke test.
   - Deploy.
2. Add lightweight validation scripts:
   - Duplicate player/machine name detector.
   - Unknown bank/group/pos checks.
   - Missing `rulesheetLocal`, `playfieldLocal`, `gameinfo` file checks.
3. Add one command for "full refresh":
   - Example intent: fetch/update -> validate -> sync -> build.

### Phase 2: Improve authoring flow for new games

1. Define "new game intake" template fields:
   - Name, manufacturer, year, rulesheet URL, playfield URL, tutorial/gameplay URLs, group, pos, bank.
2. Auto-generate starter files for a new slug:
   - `rulesheets/<slug>.md` placeholder if missing.
   - `gameinfo/<slug>.md` with standardized sections.
3. Keep image pipeline scripted:
   - Input original image path.
   - Output canonical jpg/png + 1400/700 webp variants.

### Phase 3: Expand data model for multiple venues

1. Add a `venue` dimension (starting with `avenue_lansing`, `rlm_grand_rapids`).
2. Extend library schema to include venue-specific fields:
   - Active/inactive status per venue.
   - Group/pos/bank per venue.
3. UI behavior:
   - Venue switch in library and related views.
   - Persist last-selected venue in local storage.
4. Keep shared core metadata once, attach venue overlays instead of duplicating full game records.

### Phase 4: Migrate `lpl-targets` to Vite

1. Replace static `index.html` with a Vite app.
2. Read from same `/pinball/...` shared data contract.
3. Reuse the same cache-manifest and sync flow.
4. Remove duplicated bank mapping logic from isolated HTML.

## Suggested Operating Rhythm

- Biweekly (league cycle): standings/stats refresh + deploy.
- As-needed (venue changes): machine adds/removes, group/pos updates, bank updates.
- Monthly: run consistency audit and dead-link scan.
- Season rollover: confirm bank reset rules, venue roster changes, naming normalization review.

## Decision Record (Why Sheets still exists)

- Google Sheets was originally used as cloud-hosted link/data source and is still useful for remote editing.
- Even though web/app views now provide better browsing UX, Sheets remains practical as shared cloud authoring input.

## Future Automation Candidates

- Scheduled biweekly "data refresh" task with a generated report.
- Link checker for rulesheets/playfields/videos.
- Drift report between Avenue sheet and local `shared/pinball` data.
- Auto-create gameinfo placeholder when a new slug appears.

## Notes

- This document reflects the process described by project owner (Peter) as of 2026-02-07.

## Operational Runbook

- For exact repeatable steps, use: `PINBALL_SOP.md`
