# Pinball Data Workflow

## Current Ownership

### `PinProf Admin`

Owns the canonical pinball data and assets:

- raw OPDB export
- venue and league CSV inputs
- rulesheet, gameinfo, playfield, and backglass assets
- published CAF JSON layers
- app preload bundle inputs

### `Pillyliu Pinball Website`

Owns public web apps and deploy orchestration:

- website builds
- smoke checks
- production deploy

### `Pinball App`

Owns iOS/Android code and consumes:

- bundled preload data built from `PinProf Admin`
- hosted `/pinball/...` data for runtime refresh and hosted assets
- app-owned shared support files such as `pinside_group_map.json`, intro overlay source images, and shake-warning art

### `Pinball Scraper`

Legacy tooling/reference area. It is no longer the intended source of truth.

## Common Update Flows

### League data refresh

1. Update the canonical CSVs in `../PinProf Admin/workspace/data/source`.
2. Run the PinProf Admin rebuild script.
3. Run website smoke/build checks.
4. Deploy from this repo.

## Retired Model

The old website-local `shared/pinball` workflow is retired.
Its last local copy is archived for reference only.

The old Google Sheets and venue-CSV workflow for Avenue, RLM, and Codex is also retired.

That means this repo should no longer be used to:

- regenerate legacy merged library or catalog bridge files
- rebuild legacy seed databases or flattened bridge payloads
- sync app preload or hosted payloads from a website-local mirror
- sync Avenue/RLM/Codex Google Sheets or derive canonical pinball data from their CSV exports
