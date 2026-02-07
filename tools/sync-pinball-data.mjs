import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildPinballManifest } from "./build-pinball-manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARED_PINBALL_DIR = path.join(ROOT, "shared", "pinball");

const APP_TARGETS = {
  "lpl-library": path.join(ROOT, "lpl-library", "public", "pinball"),
  "lpl-standings": path.join(ROOT, "lpl-standings", "public", "pinball"),
  "lpl-stats": path.join(ROOT, "lpl-stats", "public", "pinball"),
};

function parseArgs(argv) {
  const out = { app: null, all: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--all") out.all = true;
    if (token === "--app") out.app = argv[i + 1] ?? null;
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

async function syncOne(appName) {
  const target = APP_TARGETS[appName];
  if (!target) {
    throw new Error(
      `Unknown app "${appName}". Expected one of: ${Object.keys(APP_TARGETS).join(", ")}`
    );
  }

  const sharedExists = await pathExists(SHARED_PINBALL_DIR);
  if (!sharedExists) {
    throw new Error(`Shared source missing: ${SHARED_PINBALL_DIR}`);
  }

  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(SHARED_PINBALL_DIR, target, { recursive: true });

  console.log(`Synced shared/pinball -> ${path.relative(ROOT, target)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await buildPinballManifest();

  if (args.all) {
    for (const appName of Object.keys(APP_TARGETS)) {
      await syncOne(appName);
    }
    return;
  }

  if (args.app) {
    await syncOne(args.app);
    return;
  }

  const cwdName = path.basename(process.cwd());
  if (APP_TARGETS[cwdName]) {
    await syncOne(cwdName);
    return;
  }

  throw new Error(
    "No target specified. Use --all or --app <name>, or run from an app directory."
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
