import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHARED_DATA_DIR = path.join(ROOT, "shared", "pinball", "data");
const ADMIN_DB_PATH = path.join(SHARED_DATA_DIR, "pinprof_admin_v1.sqlite");
const SEED_DB_PATH = path.join(SHARED_DATA_DIR, "pinball_library_seed_v1.sqlite");

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

    const run = seedDb.transaction((items) => {
      for (const row of items) {
        upsert.run(row);
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
