# Archived Website Files

Archived local-only files that are no longer part of the supported CAF workflow live under this folder.

Guidelines:

- keep archived files for local reference only
- do not treat archive contents as active build, deploy, or runtime dependencies
- archive contents are gitignored so they do not keep re-entering the architecture by accident

## Archived on 2026-03-24

Folder:

- `archive/2026-03-24-caf-retired/`

Archived today:

- `tools/pinprof/rename-playfields-to-machine-alias.mjs`

Why this was archived:

- playfields should now be named correctly when imported through PinProf Admin
- the canonical local admin runtime is `/Users/pillyliu/Documents/Codex/PinProf Admin/apps/admin-ui`
- keeping a website-local manual rename helper made it look like the old cleanup path was still supported

## Archived on 2026-03-25

Folder:

- `archive/2026-03-25-shared-pinball-retired/`

Archived today:

- `tools/league-update-check.mjs`
- `tools/sync-pinball-data.mjs`
- `tools/build_lpl_targets_resolved.py`
- `tools/pinprof/apply-admin-overrides.mjs`
- `tools/pinprof/export_library_seed_overrides.py`
- `tools/rulesheets/export_remote_opdb_rulesheets.mjs`
- `tools/rulesheets/fetch_pinside_groups_with_playwright.mjs`
- `lpl-library/scripts/build_pinball_library_v3.ts`

Why these were archived:

- each script existed to maintain or consume the retired `shared/pinball` bridge model
- the canonical local source of truth is now `PinProf Admin/workspace`, and deploy builds `/pinball` from there
- the remaining supported website-side sheet workflows are being rewritten to write into `PinProf Admin/workspace` instead of rebuilding legacy merged files

## Archived on 2026-03-25 (Google Sheets + Venue CSV retirement)

Folder:

- `archive/2026-03-25-google-sheets-retired/`

Archived today:

- `tools/rulesheets/apply_codex_manufacturer_manual_pinside_overrides.mjs`
- `tools/rulesheets/audit_codex_missing_data.mjs`
- `tools/rulesheets/audit_codex_row_integrity.mjs`
- `tools/rulesheets/audit_pinside_links_with_playwright.mjs`
- `tools/rulesheets/audit_sheet_hyperlinks.mjs`
- `tools/rulesheets/build_codex_missing_group_fetch_targets.mjs`
- `tools/rulesheets/build_pinside_group_map_from_csv.mjs`
- `tools/rulesheets/enrich_pinball_library_sheets.mjs`
- `tools/rulesheets/export_rulesheets.mjs`
- `tools/rulesheets/fill_codex_manufacturer_tabs_from_sources.mjs`
- `tools/rulesheets/fill_codex_venue_tabs_derived_fields.mjs`
- `tools/rulesheets/format_codex_library_tabs.mjs`
- `tools/rulesheets/migrate_pinball_sheet_layout.mjs`
- `tools/rulesheets/package.json`
- `tools/rulesheets/package-lock.json`
- `tools/rulesheets/refresh_rulesheets_from_avenue_sheet.mjs`
- `tools/rulesheets/repair_sheet_hyperlinks_from_text.mjs`
- `tools/rulesheets/resolve_codex_manufacturer_missing_with_playwright.mjs`
- `tools/rulesheets/sync_codex_tabs_from_source_sheets.mjs`
- `tools/rulesheets/sync_library_links_between_sheets.mjs`
- `tools/rulesheets/sync_sheet_formatting_by_row_type.mjs`
- `tools/rulesheets/sync_tiltforums_urls_from_sheet.mjs`
- `tools/rulesheets/tiltforums_urls.txt`

Why these were archived:

- Avenue, RLM, and Codex Google Sheets are no longer part of the supported canonical workflow
- their CSV exports are no longer the intended source of truth for venue layout, rulesheet URLs, or curated videos
- canonical editing now belongs in PinProf Admin data tables and workspace assets instead of spreadsheet helpers
- `pinside_group_map.json` remains a separate support file for app Pinside import, but it is no longer rebuilt from the retired Codex sheet flow

## Removed on 2026-04-12 (Retired shared payload snapshot)

Removed folder:

- `archive/2026-03-25-shared-pinball-payload/`

Why this was removed:

- the website no longer reads local `shared/pinball` as a source of truth
- everything still needed from that tree now lives in `PinProf Admin/workspace` or, for app-only support assets, in `Pinball App/Pinball App 2/Pinball App 2/SharedAppSupport`
- the snapshot was consuming substantial disk space while no longer serving as an active build, deploy, or runtime dependency

## Removed on 2026-04-12 (Retired website-local admin copies)

Removed folder:

- `archive/2026-03-25-website-local-admin-retired/`

Why this was removed:

- your real local runtime is `/Users/pillyliu/Desktop/PinProf Admin.command`, which launches `PinProf Admin/apps/admin-ui`
- deploy already stages the canonical admin frontend/runtime from the `PinProf Admin` repo, not those website-local copies
- the live `PinProf Admin` frontend/runtime had moved ahead of the archived mirror, so keeping both only added confusion and disk usage
