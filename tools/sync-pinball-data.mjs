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

const STARTER_PACK_TARGETS = {
  "ios-starter-pack": path.resolve(
    ROOT,
    "../Pinball App/Pinball App 2/Pinball App 2/PinballStarter.bundle/pinball"
  ),
  "android-starter-pack": path.resolve(
    ROOT,
    "../Pinball App/Pinball App Android/app/src/main/assets/starter-pack/pinball"
  ),
};

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await rebuildLibraryJsonFromAvenue();
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
