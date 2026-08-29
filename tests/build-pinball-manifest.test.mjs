import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildPinballManifest } from "../tools/build-pinball-manifest.mjs";

const coreNames = [
  "latest-opdb.json",
  "practice_identity_curations_v1.json",
  "catalog_facets_v1.json",
  "rulesheet_assets.json",
  "video_assets.json",
  "playfield_assets.json",
  "gameinfo_assets.json",
  "backglass_assets.json",
  "pinside_game_credits_v1.json",
  "pinside_credit_people_v1.json",
  "pintips.json",
  "pintips_v2.json",
];

async function writeRequiredCatalog(sourceDir) {
  await fs.mkdir(path.join(sourceDir, "data"), { recursive: true });
  for (const name of coreNames) {
    await fs.writeFile(path.join(sourceDir, "data", name), `${name}\n`);
  }
}

test("builds the atomic catalog/content cohort and excludes private API files", async (context) => {
  const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "pinprof-manifest-test-"));
  context.after(() => fs.rm(sourceDir, { recursive: true, force: true }));
  await writeRequiredCatalog(sourceDir);
  await fs.mkdir(path.join(sourceDir, "api", "_lib"), { recursive: true });
  await fs.mkdir(path.join(sourceDir, "images", "playfields"), { recursive: true });
  await fs.writeFile(path.join(sourceDir, "api", "rulesheet.php"), "<?php\n");
  await fs.writeFile(path.join(sourceDir, "api", "_lib", "broker.php"), "<?php\n");
  await fs.writeFile(path.join(sourceDir, "images", "playfields", "example.webp"), "image");

  const summary = await buildPinballManifest({ sourceDir });
  const manifest = JSON.parse(
    await fs.readFile(path.join(sourceDir, "cache-manifest.json"), "utf8")
  );
  const cohort = manifest.cohorts.catalogContent;

  assert.equal(summary.totalFiles, coreNames.length + 1);
  assert.equal(cohort.atomic, true);
  assert.equal(cohort.files.length, coreNames.length);
  assert.match(cohort.revision, /^[a-f0-9]{64}$/);
  assert.deepEqual(manifest.mirrors, ["https://data.pinprof.com", "https://pillyliu.com"]);
  assert.equal(Object.keys(manifest.files).some((key) => key.startsWith("/pinball/api/")), false);

  for (const file of cohort.files) {
    assert.match(file.contentPath, /^\/pinball\/objects\/sha256\/[a-f0-9]{64}\//);
    const localObject = path.join(sourceDir, file.contentPath.replace("/pinball/", ""));
    assert.equal(await fs.readFile(localObject, "utf8"), `${path.basename(file.path)}\n`);
  }
  assert.equal(manifest.files["/pinball/images/playfields/example.webp"].contentPath, undefined);
});

test("rejects an incomplete catalog/content publication", async (context) => {
  const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "pinprof-manifest-test-"));
  context.after(() => fs.rm(sourceDir, { recursive: true, force: true }));
  await fs.mkdir(path.join(sourceDir, "data"), { recursive: true });
  await fs.writeFile(path.join(sourceDir, "data", "latest-opdb.json"), "{}\n");

  await assert.rejects(
    buildPinballManifest({ sourceDir }),
    /catalogContent cohort is missing required file/
  );
});
