import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildPinballManifest } from "./build-pinball-manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARED_PINBALL_DIR = path.join(ROOT, "shared", "pinball");

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

const AVENUE_CSV_PATH = path.join(
  ROOT,
  "shared",
  "pinball",
  "data",
  "Avenue Pinball - Current.csv"
);

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

async function pruneStarterPackPlayfieldImages(target) {
  const playfieldDir = path.join(target, "images", "playfields");
  const entries = await fs.readdir(playfieldDir, { withFileTypes: true }).catch(() => []);
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (name.endsWith("_700.webp")) continue;
    await fs.rm(path.join(playfieldDir, name), { force: true });
    removed += 1;
  }
  console.log(`Pruned starter-pack playfields in ${path.relative(ROOT, target)} (removed ${removed} non-_700.webp files)`);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function pickPreferredAssetPath(assets, practiceKey, legacyKey) {
  const practice = typeof assets?.[practiceKey] === "string" ? assets[practiceKey].trim() : "";
  if (practice) return practice;
  const legacy = typeof assets?.[legacyKey] === "string" ? assets[legacyKey].trim() : "";
  return legacy || null;
}

async function pruneStarterPackLegacyMarkdown(target) {
  const v3Path = path.join(target, "data", "pinball_library_v3.json");
  const v2Path = path.join(target, "data", "pinball_library_v2.json");
  const libraryPath = (await pathExists(v3Path)) ? v3Path : v2Path;
  const hasLibrary = await pathExists(libraryPath);
  if (!hasLibrary) {
    console.warn(`Skipping legacy markdown prune; missing ${path.relative(ROOT, v3Path)} or ${path.relative(ROOT, v2Path)}`);
    return;
  }

  const root = await readJson(libraryPath);
  const items = Array.isArray(root?.items) ? root.items : [];
  const keepMarkdownPaths = new Set();

  for (const item of items) {
    const assets = item && typeof item === "object" && item.assets && typeof item.assets === "object"
      ? item.assets
      : {};
    const gameinfoPath = pickPreferredAssetPath(assets, "gameinfo_local_practice", "gameinfo_local_legacy");
    const rulesheetPath = pickPreferredAssetPath(assets, "rulesheet_local_practice", "rulesheet_local_legacy");
    if (gameinfoPath?.startsWith("/pinball/")) keepMarkdownPaths.add(gameinfoPath);
    if (rulesheetPath?.startsWith("/pinball/")) keepMarkdownPaths.add(rulesheetPath);
  }

  let removed = 0;
  let skipped = 0;
  for (const subdir of ["gameinfo", "rulesheets"]) {
    const dir = path.join(target, subdir);
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const name = entry.name;
      if (!name.endsWith(".md")) continue;

      const isNewStyle =
        (subdir === "gameinfo" && name.endsWith("-gameinfo.md")) ||
        (subdir === "rulesheets" && name.endsWith("-rulesheet.md"));
      if (isNewStyle) continue;

      const webPath = `/pinball/${subdir}/${name}`;
      if (keepMarkdownPaths.has(webPath)) {
        skipped += 1;
        continue;
      }

      await fs.rm(path.join(dir, name), { force: true });
      removed += 1;
    }
  }

  console.log(
    `Pruned starter-pack legacy markdown in ${path.relative(ROOT, target)} (removed ${removed}, kept ${skipped} referenced old-style files)`
  );
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

async function pruneStarterPackLegacyLibraryJsons(target) {
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
    await pruneStarterPackPlayfieldImages(target);
    await pruneStarterPackLegacyMarkdown(target);
    await pruneStarterPackLegacyLibraryJsons(target);
    await pruneStarterPackJunkFiles(target);
  }
}

async function rebuildLibraryJsonFromAvenue() {
  const hasAvenueCsv = await pathExists(AVENUE_CSV_PATH);
  if (!hasAvenueCsv) {
    throw new Error(`Missing Avenue CSV source: ${AVENUE_CSV_PATH}`);
  }

  await run(
    "npm",
    ["exec", "tsx", "scripts/build_pinball_library.ts", AVENUE_CSV_PATH],
    path.join(ROOT, "lpl-library")
  );
}

async function rebuildLibraryJsonV2() {
  await run("npm", ["exec", "tsx", "scripts/build_pinball_library_v2.ts"], path.join(ROOT, "lpl-library"));
}

async function rebuildLibraryJsonV3() {
  await run("npm", ["exec", "tsx", "scripts/build_pinball_library_v3.ts"], path.join(ROOT, "lpl-library"));
}

async function generatePracticeIdentityAssetAliases() {
  await run("node", ["tools/create-practice-identity-asset-aliases.mjs"], ROOT);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await rebuildLibraryJsonFromAvenue();
  await rebuildLibraryJsonV2();
  await rebuildLibraryJsonV3();
  await generatePracticeIdentityAssetAliases();
  // Rebuild again so v2/v3 practice asset paths prefer the newly-created OPDB aliases.
  await rebuildLibraryJsonV2();
  await rebuildLibraryJsonV3();
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
