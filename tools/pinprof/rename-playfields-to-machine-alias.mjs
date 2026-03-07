import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { applyAdminOverrides } from "./apply-admin-overrides.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHARED_PINBALL_DIR = path.join(ROOT, "shared", "pinball");
const PLAYFIELDS_DIR = path.join(SHARED_PINBALL_DIR, "images", "playfields");
const SHARED_DATA_DIR = path.join(SHARED_PINBALL_DIR, "data");
const SEED_DB_PATH = path.join(SHARED_DATA_DIR, "pinball_library_seed_v1.sqlite");
const ADMIN_DB_PATH = path.join(SHARED_DATA_DIR, "pinprof_admin_v1.sqlite");

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
  };
}

function webPlayfieldPath(baseName, ext) {
  return `/pinball/images/playfields/${baseName}${ext}`;
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

async function renameFamily(practiceIdentity, aliasId, dryRun) {
  const currentBase = `${practiceIdentity}-playfield`;
  const nextBase = `${aliasId}-playfield`;
  if (currentBase === nextBase) {
    return { status: "already-matching", renamed: 0, currentBase, nextBase };
  }

  const entries = await fsp.readdir(PLAYFIELDS_DIR, { withFileTypes: true }).catch(() => []);
  const family = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(currentBase))
    .map((entry) => entry.name);

  if (!family.length) {
    return { status: "missing-source", renamed: 0, currentBase, nextBase };
  }

  const conflicts = family.filter((name) => fs.existsSync(path.join(PLAYFIELDS_DIR, name.replace(currentBase, nextBase))));
  if (conflicts.length) {
    return { status: "conflict", renamed: 0, currentBase, nextBase, conflicts };
  }

  if (!dryRun) {
    for (const filename of family) {
      const nextFilename = filename.replace(currentBase, nextBase);
      await fsp.rename(path.join(PLAYFIELDS_DIR, filename), path.join(PLAYFIELDS_DIR, nextFilename));
    }
  }

  return { status: "renamed", renamed: family.length, currentBase, nextBase, family };
}

function migrateAdminOverride(adminDb, practiceIdentity, currentBase, nextBase, aliasId, dryRun) {
  if (!adminDb) return false;

  const row = adminDb
    .prepare("SELECT playfield_local_path AS playfieldLocalPath FROM machine_overrides WHERE practice_identity = ?")
    .get(practiceIdentity);
  const currentPath = String(row?.playfieldLocalPath ?? "").trim();
  if (!currentPath.startsWith(`/pinball/images/playfields/${currentBase}`)) {
    return false;
  }

  const ext = path.extname(currentPath);
  const nextPath = webPlayfieldPath(nextBase, ext);
  if (!dryRun) {
    adminDb.prepare(`
      UPDATE machine_overrides
      SET opdb_machine_id = ?, playfield_local_path = ?, updated_at = CURRENT_TIMESTAMP
      WHERE practice_identity = ?
    `).run(aliasId, nextPath, practiceIdentity);
  }
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(SEED_DB_PATH)) {
    throw new Error(`Seed DB not found: ${path.relative(ROOT, SEED_DB_PATH)}`);
  }

  const seedDb = new Database(SEED_DB_PATH, { readonly: true });
  const adminDb = fs.existsSync(ADMIN_DB_PATH) ? new Database(ADMIN_DB_PATH) : null;

  try {
    const preferredAliases = loadPreferredAliasMap(seedDb);
    const summary = {
      renamedFamilies: 0,
      renamedFiles: 0,
      missingSource: 0,
      conflicts: 0,
      adminRowsUpdated: 0,
    };

    for (const [practiceIdentity, aliasId] of preferredAliases.entries()) {
      const result = await renameFamily(practiceIdentity, aliasId, args.dryRun);
      if (result.status === "missing-source" || result.status === "already-matching") {
        if (result.status === "missing-source") summary.missingSource += 1;
        continue;
      }
      if (result.status === "conflict") {
        summary.conflicts += 1;
        console.log(`Conflict: ${result.currentBase} -> ${result.nextBase}`);
        continue;
      }

      summary.renamedFamilies += 1;
      summary.renamedFiles += result.renamed;
      const updatedAdmin = migrateAdminOverride(adminDb, practiceIdentity, result.currentBase, result.nextBase, aliasId, args.dryRun);
      if (updatedAdmin) summary.adminRowsUpdated += 1;
    }

    if (!args.dryRun && adminDb && summary.adminRowsUpdated > 0) {
      applyAdminOverrides();
    }

    console.log(`Mode: ${args.dryRun ? "dry-run" : "write"}`);
    console.log(`Renamed families: ${summary.renamedFamilies}`);
    console.log(`Renamed files: ${summary.renamedFiles}`);
    console.log(`Admin rows updated: ${summary.adminRowsUpdated}`);
    console.log(`Missing source families: ${summary.missingSource}`);
    console.log(`Conflicts: ${summary.conflicts}`);
  } finally {
    seedDb.close();
    adminDb?.close();
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
