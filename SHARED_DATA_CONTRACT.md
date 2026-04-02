# Shared Pinball Data Contract

## Goal

Use one canonical pinball dataset across website, deploy, and app preload without maintaining a second website-local source tree.

## Canonical Source

The source of truth is `../PinProf Admin/workspace`:

- `workspace/data/source` for venue and league CSV inputs
- `workspace/data/raw/opdb_export.json` for raw OPDB machine/group data
- `workspace/assets/*` for playfields, backglasses, rulesheets, and gameinfo assets
- `workspace/data/published/*` for generated CAF publish layers
- app-owned shared support files live in `../Pinball App/Pinball App 2/Pinball App 2/SharedAppSupport`

## Website Repo Role

This repo is a consumer of the canonical data, not the editing home.

- `deploy.sh` stages `/pinball` from `PinProf Admin/workspace`
- `npm run check:smoke` validates the expected PinProf Admin inputs/outputs
- website apps read the deployed `/pinball/...` payload at runtime
- Playfield assets now publish a single hosted `/pinball/images/playfields/*.webp` path; retired `_700` and `_1400` derivatives are not part of the shared contract.

## App Distribution Model

- App preload bundles are built from the same `PinProf Admin/workspace` data.
- Production still serves the shared public payload at `/pinball/...`.
- The app uses bundled preload for core data, then refreshes from hosted `/pinball/...` where appropriate.

## Local Legacy Paths

- Do not edit `shared/pinball` as a source of truth.
- The last local `shared/pinball` copy is archived for local reference only.
- Do not recreate legacy merged-payload, flattened-library, or seed-database workflows here.
