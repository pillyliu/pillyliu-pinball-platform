import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildPinballManifest } from "./build-pinball-manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARED_PINBALL_DIR = path.join(ROOT, "shared", "pinball");
const SHARED_PINBALL_DATA_DIR = path.join(SHARED_PINBALL_DIR, "data");
const PINBALL_APP_ROOT = path.resolve(ROOT, "../Pinball App");
const PINBALL_APP_SCRIPTS_DIR = path.join(PINBALL_APP_ROOT, "scripts");
const FETCH_OPDB_SNAPSHOT_SCRIPT = path.join(PINBALL_APP_SCRIPTS_DIR, "fetch_opdb_snapshot.py");
const BUILD_LIBRARY_SEED_DB_SCRIPT = path.join(PINBALL_APP_SCRIPTS_DIR, "build_library_seed_db.py");
const AUDIT_RULESHEET_LINKS_SCRIPT = path.join(PINBALL_APP_SCRIPTS_DIR, "audit_rulesheet_links.py");
const APPLY_PINPROF_ADMIN_OVERRIDES_SCRIPT = path.join(ROOT, "tools", "pinprof", "apply-admin-overrides.mjs");
const IOS_STARTER_PACK_DATA_DIR = path.join(
  PINBALL_APP_ROOT,
  "Pinball App 2",
  "Pinball App 2",
  "PinballStarter.bundle",
  "pinball",
  "data"
);
const ANDROID_STARTER_PACK_DATA_DIR = path.join(
  PINBALL_APP_ROOT,
  "Pinball App Android",
  "app",
  "src",
  "main",
  "assets",
  "starter-pack",
  "pinball",
  "data"
);
const SHARED_OPDB_CATALOG_PATH = path.join(SHARED_PINBALL_DATA_DIR, "opdb_catalog_v1.json");
const SHARED_LIBRARY_V3_PATH = path.join(SHARED_PINBALL_DATA_DIR, "pinball_library_v3.json");
const SHARED_LIBRARY_SEED_DB_PATH = path.join(SHARED_PINBALL_DATA_DIR, "pinball_library_seed_v1.sqlite");
const SHARED_RULESHEET_AUDIT_PATH = path.join(SHARED_PINBALL_DATA_DIR, "rulesheet_link_audit.json");
const IOS_OPDB_CATALOG_PATH = path.join(IOS_STARTER_PACK_DATA_DIR, "opdb_catalog_v1.json");
const IOS_LIBRARY_V3_PATH = path.join(IOS_STARTER_PACK_DATA_DIR, "pinball_library_v3.json");
const IOS_LIBRARY_SEED_DB_PATH = path.join(IOS_STARTER_PACK_DATA_DIR, "pinball_library_seed_v1.sqlite");
const ANDROID_OPDB_CATALOG_PATH = path.join(ANDROID_STARTER_PACK_DATA_DIR, "opdb_catalog_v1.json");
const ANDROID_LIBRARY_V3_PATH = path.join(ANDROID_STARTER_PACK_DATA_DIR, "pinball_library_v3.json");
const ANDROID_LIBRARY_SEED_DB_PATH = path.join(ANDROID_STARTER_PACK_DATA_DIR, "pinball_library_seed_v1.sqlite");

const WEB_APP_TARGETS = {
  "lpl-library": path.join(ROOT, "lpl-library", "public", "pinball"),
  "lpl-standings": path.join(ROOT, "lpl-standings", "public", "pinball"),
  "lpl-stats": path.join(ROOT, "lpl-stats", "public", "pinball"),
  "lpl-targets": path.join(ROOT, "lpl-targets", "public", "pinball"),
};

function parseExtraTargetsFromEnv(envKey) {
  const raw = process.env[envKey];
  if (!raw) return [];
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => path.resolve(ROOT, p));
}

function buildStarterPackTargets() {
  const defaults = [
    [
      "ios-starter-pack",
      path.resolve(
        ROOT,
        "../Pinball App/Pinball App 2/Pinball App 2/PinballStarter.bundle/pinball"
      ),
    ],
    [
      "android-starter-pack",
      path.resolve(
        ROOT,
        "../Pinball App/Pinball App Android/app/src/main/assets/starter-pack/pinball"
      ),
    ],
  ];

  const extraIos = parseExtraTargetsFromEnv("PINBALL_IOS_STARTER_PACK_TARGETS");
  const extraAndroid = parseExtraTargetsFromEnv("PINBALL_ANDROID_STARTER_PACK_TARGETS");
  const seen = new Set(defaults.map(([, target]) => target));
  const out = [...defaults];

  for (const [idx, target] of extraIos.entries()) {
    if (seen.has(target)) continue;
    seen.add(target);
    out.push([`ios-starter-pack-extra-${idx + 1}`, target]);
  }
  for (const [idx, target] of extraAndroid.entries()) {
    if (seen.has(target)) continue;
    seen.add(target);
    out.push([`android-starter-pack-extra-${idx + 1}`, target]);
  }

  return Object.fromEntries(out);
}

const STARTER_PACK_TARGETS = buildStarterPackTargets();

function run(cmd, args, cwd = ROOT) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "inherit" });
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${cmd} ${args.join(" ")} failed with exit code ${code}`));
    });
    child.on("error", reject);
  });
}

function parseArgs(argv) {
  const out = {
    app: null,
    all: false,
    starterPack: false,
    allTargets: false,
    includeWebPublicPinball: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--all") out.all = true;
    if (token === "--app") out.app = argv[i + 1] ?? null;
    if (token === "--starter-pack") out.starterPack = true;
    if (token === "--all-targets") out.allTargets = true;
    if (token === "--include-web-public-pinball") out.includeWebPublicPinball = true;
  }
  return out;
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function copyFileEnsuringParent(sourcePath, targetPath) {
  await ensureParentDir(targetPath);
  await fs.copyFile(sourcePath, targetPath);
}

async function syncPath(label, target) {
  const sharedExists = await pathExists(SHARED_PINBALL_DIR);
  if (!sharedExists) {
    throw new Error(`Shared source missing: ${SHARED_PINBALL_DIR}`);
  }

  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(SHARED_PINBALL_DIR, target, { recursive: true });

  console.log(`Synced shared/pinball -> ${path.relative(ROOT, target)} (${label})`);
}

function normalizePracticePlayfield700Path(rawPath) {
  if (typeof rawPath !== "string") return null;
  const trimmed = rawPath.trim();
  if (!trimmed.startsWith("/pinball/images/playfields/")) return null;

  const baseName = path.posix.basename(trimmed);
  const dot = baseName.lastIndexOf(".");
  const stem = dot >= 0 ? baseName.slice(0, dot) : baseName;
  const normalizedStem = stem
    .replace(/_1400$/i, "")
    .replace(/_700$/i, "");
  return `/pinball/images/playfields/${normalizedStem}_700.webp`;
}

async function readStarterPackV3PracticeAssetRefs(target) {
  const v3Path = path.join(target, "data", "pinball_library_v3.json");
  if (!(await pathExists(v3Path))) {
    console.warn(`Skipping v3 starter-pack asset prune; missing ${path.relative(ROOT, v3Path)}`);
    return null;
  }

  const root = await readJson(v3Path);
  const items = Array.isArray(root?.items) ? root.items : [];
  const markdownPaths = new Set();
  const playfield700Paths = new Set([
    "/pinball/images/playfields/fallback-whitewood-playfield_700.webp",
  ]);

  for (const item of items) {
    const assets = item && typeof item === "object" && item.assets && typeof item.assets === "object"
      ? item.assets
      : {};

    const gameinfoPractice = typeof assets.gameinfo_local_practice === "string" ? assets.gameinfo_local_practice.trim() : "";
    const rulesheetPractice = typeof assets.rulesheet_local_practice === "string" ? assets.rulesheet_local_practice.trim() : "";
    const playfieldPractice = typeof assets.playfield_local_practice === "string" ? assets.playfield_local_practice.trim() : "";

    if (gameinfoPractice.startsWith("/pinball/")) markdownPaths.add(gameinfoPractice);
    if (rulesheetPractice.startsWith("/pinball/")) markdownPaths.add(rulesheetPractice);

    const normalizedPlayfield700 = normalizePracticePlayfield700Path(playfieldPractice);
    if (normalizedPlayfield700) {
      playfield700Paths.add(normalizedPlayfield700);
    }
  }

  return { markdownPaths, playfield700Paths };
}

async function pruneStarterPackPlayfieldImages(target, keepPlayfield700Paths = null) {
  const playfieldDir = path.join(target, "images", "playfields");
  const entries = await fs.readdir(playfieldDir, { withFileTypes: true }).catch(() => []);
  let removed = 0;
  let keptByV3 = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    const webPath = `/pinball/images/playfields/${name}`;
    if (!name.endsWith("_700.webp")) {
      await fs.rm(path.join(playfieldDir, name), { force: true });
      removed += 1;
      continue;
    }
    if (keepPlayfield700Paths && !keepPlayfield700Paths.has(webPath)) {
      await fs.rm(path.join(playfieldDir, name), { force: true });
      removed += 1;
      continue;
    }
    if (keepPlayfield700Paths) keptByV3 += 1;
  }
  if (keepPlayfield700Paths) {
    console.log(
      `Pruned starter-pack playfields in ${path.relative(ROOT, target)} (removed ${removed}, kept ${keptByV3} v3 practice _700.webp files)`
    );
    return;
  }
  console.log(`Pruned starter-pack playfields in ${path.relative(ROOT, target)} (removed ${removed} non-_700.webp files)`);
}

async function pruneStarterPackMarkdownToV3PracticeAssets(target, keepMarkdownPaths = null) {
  if (!keepMarkdownPaths) {
    console.warn(`Skipping strict starter-pack markdown prune; no v3 practice asset refs for ${path.relative(ROOT, target)}`);
    return;
  }

  let removed = 0;
  let kept = 0;
  for (const subdir of ["gameinfo", "rulesheets"]) {
    const dir = path.join(target, subdir);
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const name = entry.name;
      if (!name.endsWith(".md")) continue;

      const webPath = `/pinball/${subdir}/${name}`;
      if (keepMarkdownPaths.has(webPath)) {
        kept += 1;
        continue;
      }

      await fs.rm(path.join(dir, name), { force: true });
      removed += 1;
    }
  }

  console.log(
    `Pruned starter-pack markdown to v3 practice assets in ${path.relative(ROOT, target)} (removed ${removed}, kept ${kept})`
  );
}

async function pruneStarterPackMarkdown(target) {
  const refs = await readStarterPackV3PracticeAssetRefs(target);
  if (!refs) return;
  await pruneStarterPackMarkdownToV3PracticeAssets(target, refs.markdownPaths);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function pruneStarterPackJunkFiles(target) {
  const candidates = [
    path.join(target, ".DS_Store"),
    path.join(target, "images", ".DS_Store"),
    path.join(target, "images", "playfields", ".DS_Store"),
  ];
  let removed = 0;
  for (const file of candidates) {
    if (await pathExists(file)) {
      await fs.rm(file, { force: true });
      removed += 1;
    }
  }
  if (removed > 0) {
    console.log(`Pruned starter-pack junk files in ${path.relative(ROOT, target)} (removed ${removed} .DS_Store file(s))`);
  }
}

async function pruneStarterPackNonV3LibraryJsons(target) {
  const dataDir = path.join(target, "data");
  const candidates = [
    path.join(dataDir, "pinball_library.json"),
    path.join(dataDir, "pinball_library_v2.json"),
  ];
  let removed = 0;
  for (const file of candidates) {
    if (await pathExists(file)) {
      await fs.rm(file, { force: true });
      removed += 1;
    }
  }
  if (removed > 0) {
    console.log(
      `Pruned starter-pack legacy library JSONs in ${path.relative(ROOT, target)} (removed ${removed})`
    );
  }
}

async function syncWebApp(appName) {
  const target = WEB_APP_TARGETS[appName];
  if (!target) {
    throw new Error(
      `Unknown app "${appName}". Expected one of: ${Object.keys(WEB_APP_TARGETS).join(", ")}`
    );
  }
  await syncPath(appName, target);
}

async function syncStarterPacks() {
  for (const [name, target] of Object.entries(STARTER_PACK_TARGETS)) {
    const targetRootExists = await pathExists(path.dirname(target));
    if (!targetRootExists) {
      console.warn(
        `Skipping ${name}; target folder not found: ${path.dirname(target)}`
      );
      continue;
    }
    await syncPath(name, target);
    const v3Refs = await readStarterPackV3PracticeAssetRefs(target);
    await pruneStarterPackPlayfieldImages(target, v3Refs?.playfield700Paths ?? null);
    await pruneStarterPackMarkdown(target);
    await pruneStarterPackNonV3LibraryJsons(target);
    await pruneStarterPackJunkFiles(target);
  }
}

async function rebuildLibraryJsonV3() {
  await run("npm", ["exec", "tsx", "scripts/build_pinball_library_v3.ts"], path.join(ROOT, "lpl-library"));
}

async function generateSharedOpdbCatalog() {
  await ensureParentDir(SHARED_OPDB_CATALOG_PATH);
  await run("python3", [
    FETCH_OPDB_SNAPSHOT_SCRIPT,
    "--ios-output",
    SHARED_OPDB_CATALOG_PATH,
    "--skip-android",
  ], ROOT);
}

async function mirrorSharedDataForSeedGeneration() {
  const requiredSharedFiles = [
    [SHARED_OPDB_CATALOG_PATH, IOS_OPDB_CATALOG_PATH],
    [SHARED_OPDB_CATALOG_PATH, ANDROID_OPDB_CATALOG_PATH],
    [SHARED_LIBRARY_V3_PATH, IOS_LIBRARY_V3_PATH],
    [SHARED_LIBRARY_V3_PATH, ANDROID_LIBRARY_V3_PATH],
  ];

  for (const [sourcePath, targetPath] of requiredSharedFiles) {
    if (!(await pathExists(sourcePath))) {
      throw new Error(`Missing shared generation input: ${sourcePath}`);
    }
    await copyFileEnsuringParent(sourcePath, targetPath);
  }
}

async function generateSharedLibrarySeedDb() {
  await run("python3", [BUILD_LIBRARY_SEED_DB_SCRIPT], ROOT);

  if (await pathExists(IOS_LIBRARY_SEED_DB_PATH)) {
    await copyFileEnsuringParent(IOS_LIBRARY_SEED_DB_PATH, SHARED_LIBRARY_SEED_DB_PATH);
    return;
  }
  if (await pathExists(ANDROID_LIBRARY_SEED_DB_PATH)) {
    await copyFileEnsuringParent(ANDROID_LIBRARY_SEED_DB_PATH, SHARED_LIBRARY_SEED_DB_PATH);
    return;
  }
  throw new Error("Library seed DB generation did not produce an output file.");
}

async function generateSharedRulesheetAudit() {
  await ensureParentDir(SHARED_RULESHEET_AUDIT_PATH);
  await run("python3", [
    AUDIT_RULESHEET_LINKS_SCRIPT,
    "--catalog",
    SHARED_OPDB_CATALOG_PATH,
    "--output",
    SHARED_RULESHEET_AUDIT_PATH,
    "--skip-android",
  ], ROOT);
}

async function applyPinprofAdminOverrides() {
  if (!(await pathExists(APPLY_PINPROF_ADMIN_OVERRIDES_SCRIPT))) {
    console.warn(`Skipping PinProf admin override apply; missing ${path.relative(ROOT, APPLY_PINPROF_ADMIN_OVERRIDES_SCRIPT)}`);
    return;
  }
  await run("node", [APPLY_PINPROF_ADMIN_OVERRIDES_SCRIPT], ROOT);
}

async function generateSharedAppSupportArtifacts() {
  await generateSharedOpdbCatalog();
  await mirrorSharedDataForSeedGeneration();
  await generateSharedLibrarySeedDb();
  await applyPinprofAdminOverrides();
  await generateSharedRulesheetAudit();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await rebuildLibraryJsonV3();
  await generateSharedAppSupportArtifacts();
  await buildPinballManifest();

  if (args.allTargets) {
    if (args.includeWebPublicPinball) {
      for (const appName of Object.keys(WEB_APP_TARGETS)) {
        await syncWebApp(appName);
      }
    } else {
      console.log(
        "Skipping web app public/pinball sync. Pass --include-web-public-pinball to force legacy copies."
      );
    }
    await syncStarterPacks();
    return;
  }

  if (args.all) {
    if (args.includeWebPublicPinball) {
      for (const appName of Object.keys(WEB_APP_TARGETS)) {
        await syncWebApp(appName);
      }
    } else {
      console.log(
        "Skipping web app public/pinball sync. Pass --include-web-public-pinball to force legacy copies."
      );
    }
    return;
  }

  if (args.starterPack) {
    await syncStarterPacks();
    return;
  }

  if (args.app) {
    if (!args.includeWebPublicPinball) {
      console.log(
        "Skipping --app sync without --include-web-public-pinball (legacy mode only)."
      );
      return;
    }
    await syncWebApp(args.app);
    return;
  }

  const cwdName = path.basename(process.cwd());
  if (WEB_APP_TARGETS[cwdName]) {
    if (!args.includeWebPublicPinball) {
      console.log(
        "Skipping cwd app sync without --include-web-public-pinball (legacy mode only)."
      );
      return;
    }
    await syncWebApp(cwdName);
    return;
  }

  throw new Error(
    "No target specified. Use --all, --all-targets, --starter-pack, --app <name>, or run from a web app directory. Use --include-web-public-pinball to force legacy app/public/pinball copies."
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
