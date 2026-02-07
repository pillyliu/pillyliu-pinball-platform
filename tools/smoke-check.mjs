import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

const APPS = [
  { name: "pillyliu-landing", requiresPinballDist: false },
  { name: "lpl-library", requiresPinballDist: true },
  { name: "lpl-standings", requiresPinballDist: true },
  { name: "lpl-stats", requiresPinballDist: true },
  { name: "lpl-targets", requiresPinballDist: true },
];

const REQUIRED_DATA_FILES = [
  "Avenue Pinball - Current.csv",
  "LPL_Standings.csv",
  "LPL_Stats.csv",
  "LPL_Targets.csv",
  "pinball_library.csv",
  "pinball_library.json",
];

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

  if (!app.requiresPinballDist) return errors;

  const pinballDist = path.join(distDir, "pinball");
  const manifestPath = path.join(pinballDist, "cache-manifest.json");
  const updateLogPath = path.join(pinballDist, "cache-update-log.json");
  const dataDir = path.join(pinballDist, "data");

  if (!(await exists(manifestPath))) {
    errors.push(`Missing pinball manifest: ${rel(manifestPath)}`);
    return errors;
  }
  if (!(await exists(updateLogPath))) {
    errors.push(`Missing pinball update log: ${rel(updateLogPath)}`);
  }

  let manifest = null;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch {
    errors.push(`Invalid JSON in manifest: ${rel(manifestPath)}`);
  }

  for (const filename of REQUIRED_DATA_FILES) {
    const fullPath = path.join(dataDir, filename);
    if (!(await exists(fullPath))) {
      errors.push(`Missing required data file: ${rel(fullPath)}`);
      continue;
    }

    if (manifest?.files) {
      const key = `/pinball/data/${filename}`;
      if (!manifest.files[key]) {
        errors.push(`Manifest missing file key: ${key} (${app.name})`);
      }
    }
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
