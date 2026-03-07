import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHARED_DATA_DIR = path.join(ROOT, "shared", "pinball", "data");
const ADMIN_DB_PATH = path.join(SHARED_DATA_DIR, "pinprof_admin_v1.sqlite");
const SEED_DB_PATH = path.join(SHARED_DATA_DIR, "pinball_library_seed_v1.sqlite");

function parseCoveredAliasIds(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return Array.from(new Set(parsed.map((value) => String(value ?? "").trim()).filter(Boolean)));
    }
  } catch {
    return trimmed.split(",").map((value) => value.trim()).filter(Boolean);
  }
  return [];
}

function stringifyCoveredAliasIds(aliasIds) {
  return JSON.stringify(Array.from(new Set(aliasIds.map((value) => String(value ?? "").trim()).filter(Boolean))));
}

function loadPreferredAliasMap(seedDb) {
  const rows = seedDb.prepare(`
    SELECT practice_identity AS practiceIdentity, opdb_machine_id AS opdbMachineId
    FROM (
      SELECT
        practice_identity,
        opdb_machine_id,
        ROW_NUMBER() OVER (
          PARTITION BY practice_identity
          ORDER BY
            CASE WHEN variant IS NULL OR trim(variant) = '' THEN 0 ELSE 1 END,
            lower(coalesce(variant, '')),
            lower(opdb_machine_id)
        ) AS rank_index
      FROM machines
    )
    WHERE rank_index = 1
  `).all();

  return new Map(rows.map((row) => [row.practiceIdentity, row.opdbMachineId]));
}

export function applyAdminOverrides() {
  if (!fs.existsSync(ADMIN_DB_PATH)) {
    console.log(`No admin override DB found at ${path.relative(ROOT, ADMIN_DB_PATH)}; skipping.`);
    return;
  }
  if (!fs.existsSync(SEED_DB_PATH)) {
    throw new Error(`Seed DB not found: ${SEED_DB_PATH}`);
  }

  const adminDb = new Database(ADMIN_DB_PATH, { readonly: true });
  const seedDb = new Database(SEED_DB_PATH);
  try {
    seedDb.exec(`
      CREATE TABLE IF NOT EXISTS playfield_assets (
        playfield_asset_id INTEGER PRIMARY KEY AUTOINCREMENT,
        practice_identity TEXT NOT NULL,
        source_opdb_machine_id TEXT NOT NULL,
        covered_alias_ids_json TEXT NOT NULL,
        playfield_local_path TEXT,
        playfield_source_url TEXT,
        playfield_source_note TEXT,
        updated_at TEXT,
        UNIQUE(practice_identity, source_opdb_machine_id)
      );
      CREATE INDEX IF NOT EXISTS idx_playfield_assets_practice ON playfield_assets(practice_identity);
    `);

    const preferredAliasMap = loadPreferredAliasMap(seedDb);
    const rows = adminDb
      .prepare(`
        SELECT
          practice_identity,
          name_override,
          variant_override,
          manufacturer_override,
          year_override,
          playfield_local_path,
          playfield_source_url,
          gameinfo_local_path,
          rulesheet_local_path
        FROM machine_overrides
      `)
      .all();

    const hasPlayfieldAssetTable = adminDb
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = 'playfield_assets'
      `)
      .get();
    const playfieldAssetRows = hasPlayfieldAssetTable
      ? adminDb
          .prepare(`
            SELECT
              practice_identity,
              source_opdb_machine_id,
              covered_alias_ids_json,
              playfield_local_path,
              playfield_source_url,
              playfield_source_note,
              updated_at
            FROM playfield_assets
          `)
          .all()
      : [];

    const playfieldAssetsByPractice = new Map();
    for (const row of playfieldAssetRows) {
      const items = playfieldAssetsByPractice.get(row.practice_identity) ?? [];
      items.push(row);
      playfieldAssetsByPractice.set(row.practice_identity, items);
    }

    const upsert = seedDb.prepare(`
      INSERT INTO overrides (
        practice_identity,
        name_override,
        variant_override,
        manufacturer_override,
        year_override,
        playfield_local_path,
        playfield_source_url,
        gameinfo_local_path,
        rulesheet_local_path
      ) VALUES (
        @practice_identity,
        @name_override,
        @variant_override,
        @manufacturer_override,
        @year_override,
        @playfield_local_path,
        @playfield_source_url,
        @gameinfo_local_path,
        @rulesheet_local_path
      )
      ON CONFLICT(practice_identity) DO UPDATE SET
        name_override=excluded.name_override,
        variant_override=excluded.variant_override,
        manufacturer_override=excluded.manufacturer_override,
        year_override=excluded.year_override,
        playfield_local_path=excluded.playfield_local_path,
        playfield_source_url=excluded.playfield_source_url,
        gameinfo_local_path=excluded.gameinfo_local_path,
        rulesheet_local_path=excluded.rulesheet_local_path
    `);

    const replacePlayfieldAsset = seedDb.prepare(`
      INSERT INTO playfield_assets (
        practice_identity,
        source_opdb_machine_id,
        covered_alias_ids_json,
        playfield_local_path,
        playfield_source_url,
        playfield_source_note,
        updated_at
      ) VALUES (
        @practice_identity,
        @source_opdb_machine_id,
        @covered_alias_ids_json,
        @playfield_local_path,
        @playfield_source_url,
        @playfield_source_note,
        @updated_at
      )
      ON CONFLICT(practice_identity, source_opdb_machine_id) DO UPDATE SET
        covered_alias_ids_json=excluded.covered_alias_ids_json,
        playfield_local_path=excluded.playfield_local_path,
        playfield_source_url=excluded.playfield_source_url,
        playfield_source_note=excluded.playfield_source_note,
        updated_at=excluded.updated_at
    `);

    const run = seedDb.transaction((items) => {
      seedDb.prepare("DELETE FROM playfield_assets").run();
      for (const row of items) {
        const assetRows = playfieldAssetsByPractice.get(row.practice_identity) ?? [];
        const primaryAliasId = preferredAliasMap.get(row.practice_identity) ?? null;
        const primaryAsset =
          assetRows.find((asset) => parseCoveredAliasIds(asset.covered_alias_ids_json).includes(primaryAliasId)) ??
          assetRows.find((asset) => parseCoveredAliasIds(asset.covered_alias_ids_json).length > 0) ??
          null;

        upsert.run(row);
        if (primaryAsset) {
          upsert.run({
            ...row,
            playfield_local_path: primaryAsset.playfield_local_path,
            playfield_source_url: primaryAsset.playfield_source_url,
          });
        }
        for (const asset of assetRows) {
          replacePlayfieldAsset.run({
            practice_identity: asset.practice_identity,
            source_opdb_machine_id: asset.source_opdb_machine_id,
            covered_alias_ids_json: stringifyCoveredAliasIds(parseCoveredAliasIds(asset.covered_alias_ids_json)),
            playfield_local_path: asset.playfield_local_path,
            playfield_source_url: asset.playfield_source_url,
            playfield_source_note: asset.playfield_source_note,
            updated_at: asset.updated_at,
          });
        }
      }
    });

    run(rows);
    console.log(`Applied ${rows.length} admin override row(s) into ${path.relative(ROOT, SEED_DB_PATH)}.`);
  } finally {
    seedDb.close();
    adminDb.close();
  }
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  applyAdminOverrides();
}
