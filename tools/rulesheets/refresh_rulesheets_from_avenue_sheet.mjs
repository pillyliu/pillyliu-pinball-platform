import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(THIS_DIR, "../..");

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

async function main() {
  console.log("1) Migrate Avenue sheet layout and export local Avenue CSV");
  await run("node", ["migrate_pinball_sheet_layout.mjs"], THIS_DIR);

  console.log("\n2) Sync Tilt Forums URL list from Avenue Google Sheet");
  await run("node", ["sync_tiltforums_urls_from_sheet.mjs"], THIS_DIR);

  console.log("\n3) Export latest rulesheets from Tilt Forums to shared/pinball/rulesheets");
  await run("node", ["export_rulesheets.mjs"], THIS_DIR);

  console.log("\n4) Sync shared pinball data to web apps + iOS/Android starter packs");
  await run("node", ["tools/sync-pinball-data.mjs", "--all-targets"], ROOT);

  console.log("\nRulesheet refresh workflow complete.");
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
