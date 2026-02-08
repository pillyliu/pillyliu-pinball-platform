import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const APPS = new Set([
  "lpl-library",
  "lpl-standings",
  "lpl-stats",
  "lpl-targets",
]);

function parseArgs(argv) {
  const out = { app: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--app") out.app = argv[i + 1] ?? null;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const appName = args.app ?? path.basename(process.cwd());

  if (!APPS.has(appName)) {
    throw new Error(
      `Unknown app "${appName}". Expected one of: ${Array.from(APPS).join(", ")}`
    );
  }

  const distPinball = path.join(ROOT, appName, "dist", "pinball");
  await fs.rm(distPinball, { recursive: true, force: true });
  console.log(`Removed dist pinball payload: ${path.relative(ROOT, distPinball)}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
