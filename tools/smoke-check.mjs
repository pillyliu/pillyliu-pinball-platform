import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const PINPROF_ADMIN_SOURCE_ROOT = path.resolve(
  process.env.PINPROF_ADMIN_SOURCE_ROOT ?? path.join(ROOT, "../PinProf Admin")
);
const PINPROF_ADMIN_WORKSPACE_DIR = path.join(PINPROF_ADMIN_SOURCE_ROOT, "workspace");
const PINPROF_ADMIN_SOURCE_DATA_DIR = path.join(PINPROF_ADMIN_WORKSPACE_DIR, "data", "source");
const PINPROF_ADMIN_PUBLISHED_DATA_DIR = path.join(PINPROF_ADMIN_WORKSPACE_DIR, "data", "published");
const PINPROF_ADMIN_MANIFESTS_DIR = path.join(PINPROF_ADMIN_WORKSPACE_DIR, "manifests");
const PINPROF_ADMIN_PLAYFIELDS_DIR = path.join(PINPROF_ADMIN_WORKSPACE_DIR, "assets", "playfields");

const APPS = [
  { name: "pillyliu-landing" },
  { name: "lpl-library" },
  { name: "lpl-standings" },
  { name: "lpl-stats" },
  { name: "lpl-targets" },
];

const REQUIRED_PINBALL_FILES = [
  {
    filePath: path.join(PINPROF_ADMIN_SOURCE_DATA_DIR, "LPL_Standings.csv"),
    webPath: "/pinball/data/LPL_Standings.csv",
  },
  {
    filePath: path.join(PINPROF_ADMIN_SOURCE_DATA_DIR, "LPL_Stats.csv"),
    webPath: "/pinball/data/LPL_Stats.csv",
  },
  {
    filePath: path.join(PINPROF_ADMIN_SOURCE_DATA_DIR, "LPL_Targets.csv"),
    webPath: "/pinball/data/LPL_Targets.csv",
  },
  {
    filePath: path.join(PINPROF_ADMIN_SOURCE_DATA_DIR, "LPL_IFPA_Players.csv"),
    webPath: "/pinball/data/LPL_IFPA_Players.csv",
  },
  {
    filePath: path.join(PINPROF_ADMIN_SOURCE_DATA_DIR, "lpl_machine_mappings_v1.json"),
    webPath: "/pinball/data/lpl_machine_mappings_v1.json",
  },
  {
    filePath: path.join(PINPROF_ADMIN_PUBLISHED_DATA_DIR, "lpl_targets_resolved_v1.json"),
    webPath: "/pinball/data/lpl_targets_resolved_v1.json",
  },
  {
    filePath: path.join(PINPROF_ADMIN_SOURCE_DATA_DIR, "redacted_players.csv"),
    webPath: "/pinball/data/redacted_players.csv",
  },
  {
    filePath: path.join(PINPROF_ADMIN_PUBLISHED_DATA_DIR, "opdb_export.json"),
    webPath: "/pinball/data/opdb_export.json",
  },
  {
    filePath: path.join(PINPROF_ADMIN_PUBLISHED_DATA_DIR, "practice_identity_curations_v1.json"),
    webPath: "/pinball/data/practice_identity_curations_v1.json",
  },
  {
    filePath: path.join(PINPROF_ADMIN_PUBLISHED_DATA_DIR, "backglass_assets.json"),
    webPath: "/pinball/data/backglass_assets.json",
  },
  {
    filePath: path.join(PINPROF_ADMIN_PUBLISHED_DATA_DIR, "default_pm_venue_sources_v1.json"),
    webPath: "/pinball/data/default_pm_venue_sources_v1.json",
  },
  {
    filePath: path.join(PINPROF_ADMIN_PUBLISHED_DATA_DIR, "rulesheet_assets.json"),
    webPath: "/pinball/data/rulesheet_assets.json",
  },
  {
    filePath: path.join(PINPROF_ADMIN_PUBLISHED_DATA_DIR, "video_assets.json"),
    webPath: "/pinball/data/video_assets.json",
  },
  {
    filePath: path.join(PINPROF_ADMIN_PUBLISHED_DATA_DIR, "playfield_assets.json"),
    webPath: "/pinball/data/playfield_assets.json",
  },
  {
    filePath: path.join(PINPROF_ADMIN_PUBLISHED_DATA_DIR, "gameinfo_assets.json"),
    webPath: "/pinball/data/gameinfo_assets.json",
  },
  {
    filePath: path.join(PINPROF_ADMIN_PUBLISHED_DATA_DIR, "venue_layout_assets.json"),
    webPath: "/pinball/data/venue_layout_assets.json",
  },
];
const REQUIRED_IMAGE_FILES = [
  {
    filePath: path.join(PINPROF_ADMIN_PLAYFIELDS_DIR, "fallback-image-not-available_2048.webp"),
    webPath: "/pinball/images/playfields/fallback-image-not-available_2048.webp",
  },
];
const RETIRED_PLAYFIELD_VARIANT_PATTERN = /_(700|1400)\.webp$/i;

function rel(p) {
  return path.relative(ROOT, p);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readDirSafe(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

async function validateApp(app) {
  const errors = [];
  const appRoot = path.join(ROOT, app.name);
  const distDir = path.join(appRoot, "dist");
  const indexHtml = path.join(distDir, "index.html");
  const assetsDir = path.join(distDir, "assets");

  if (!(await exists(indexHtml))) {
    errors.push(`Missing dist index: ${rel(indexHtml)}`);
    return errors;
  }

  const assets = await readDirSafe(assetsDir);
  if (!assets.length) {
    errors.push(`Missing dist assets: ${rel(assetsDir)}`);
  }

  return errors;
}

async function validateCanonicalPinballSource() {
  const errors = [];
  const manifestPath = path.join(PINPROF_ADMIN_MANIFESTS_DIR, "cache-manifest.json");
  const updateLogPath = path.join(PINPROF_ADMIN_MANIFESTS_DIR, "cache-update-log.json");
  const playfieldAssetsPath = path.join(PINPROF_ADMIN_PUBLISHED_DATA_DIR, "playfield_assets.json");

  if (!(await exists(manifestPath))) {
    errors.push(`Missing canonical pinball manifest: ${rel(manifestPath)}`);
    return errors;
  }
  if (!(await exists(updateLogPath))) {
    errors.push(`Missing canonical pinball update log: ${rel(updateLogPath)}`);
  }

  let manifest = null;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch {
    errors.push(`Invalid JSON in manifest: ${rel(manifestPath)}`);
  }

  for (const { filePath } of REQUIRED_PINBALL_FILES) {
    if (!(await exists(filePath))) {
      errors.push(`Missing required pinball file: ${rel(filePath)}`);
      continue;
    }
  }

  for (const { filePath } of REQUIRED_IMAGE_FILES) {
    if (!(await exists(filePath))) {
      errors.push(`Missing required image file: ${rel(filePath)}`);
      continue;
    }
  }

  const playfieldFiles = await readDirSafe(PINPROF_ADMIN_PLAYFIELDS_DIR);
  const retiredPlayfieldFiles = playfieldFiles.filter((file) => RETIRED_PLAYFIELD_VARIANT_PATTERN.test(file));
  if (retiredPlayfieldFiles.length) {
    errors.push(
      `Retired playfield variants still present: ${retiredPlayfieldFiles.slice(0, 5).join(", ")}`
      + (retiredPlayfieldFiles.length > 5 ? ` (+${retiredPlayfieldFiles.length - 5} more)` : "")
    );
  }

  try {
    const playfieldAssets = JSON.parse(await fs.readFile(playfieldAssetsPath, "utf8"));
    const records = Array.isArray(playfieldAssets?.records) ? playfieldAssets.records : [];
    const staleFields = records.find((record) =>
      Object.hasOwn(record, "playfieldWebLocalPath700") || Object.hasOwn(record, "playfieldWebLocalPath1400")
    );
    if (staleFields) {
      errors.push(`Obsolete playfield variant fields found in published data: ${rel(playfieldAssetsPath)}`);
    }
    const stalePaths = records.find((record) =>
      RETIRED_PLAYFIELD_VARIANT_PATTERN.test(String(record?.playfieldLocalPath ?? ""))
    );
    if (stalePaths) {
      errors.push(`Retired playfield variant path found in published data: ${rel(playfieldAssetsPath)}`);
    }
  } catch {
    errors.push(`Invalid JSON in published playfield assets: ${rel(playfieldAssetsPath)}`);
  }

  return errors;
}

async function main() {
  const allErrors = [];

  for (const app of APPS) {
    const errors = await validateApp(app);
    if (errors.length) {
      allErrors.push(...errors);
      console.error(`\n[FAIL] ${app.name}`);
      for (const error of errors) console.error(`- ${error}`);
    } else {
      console.log(`[OK] ${app.name}`);
    }
  }

  const pinballErrors = await validateCanonicalPinballSource();
  if (pinballErrors.length) {
    allErrors.push(...pinballErrors);
    console.error("\n[FAIL] PinProf Admin Workspace");
    for (const error of pinballErrors) console.error(`- ${error}`);
  } else {
    console.log("[OK] PinProf Admin Workspace");
  }

  if (allErrors.length) {
    console.error(`\nSmoke check failed with ${allErrors.length} issue(s).`);
    process.exit(1);
  }

  console.log("\nSmoke check passed.");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
