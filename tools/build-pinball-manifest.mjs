import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXCLUDED_FILES = new Set(["cache-manifest.json", "cache-update-log.json"]);
const EXCLUDED_PATH_PREFIXES = ["api/", "objects/"];
const EXCLUDED_BASENAMES = new Set([
  ".DS_Store",
  "local_asset_intake_report.json",
  "pinprof_admin_v1.sqlite",
  "pinprof_admin_v1.sqlite-shm",
  "pinprof_admin_v1.sqlite-wal",
  "pinball_library_seed_v1.sqlite-shm",
  "pinball_library_seed_v1.sqlite-wal",
]);

const CONTENT_TYPES = {
  ".json": "application/json",
  ".csv": "text/csv",
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const CATALOG_CONTENT_PATHS = [
  ["/pinball/data/latest-opdb.json", 0],
  ["/pinball/data/practice_identity_curations_v1.json", 0],
  ["/pinball/data/catalog_facets_v1.json", 0],
  ["/pinball/data/rulesheet_assets.json", 10],
  ["/pinball/data/video_assets.json", 10],
  ["/pinball/data/playfield_assets.json", 10],
  ["/pinball/data/gameinfo_assets.json", 10],
  ["/pinball/data/backglass_assets.json", 10],
  ["/pinball/data/pinside_game_credits_v1.json", 10],
  ["/pinball/data/pinside_credit_people_v1.json", 10],
  ["/pinball/data/pintips.json", 10],
  ["/pinball/data/pintips_v2.json", 10],
];
const OPTIONAL_CATALOG_CONTENT_PATHS = [
  ["/pinball/data/pinside_owner_threads_v1.json", 10],
];
const LEAGUE_COMMUNITY_PATHS = [
  "/pinball/data/LPL_Standings.csv",
  "/pinball/data/LPL_Stats.csv",
  "/pinball/data/LPL_Targets.csv",
  "/pinball/data/LPL_IFPA_Players.csv",
  "/pinball/data/lpl_machine_mappings_v1.json",
  "/pinball/data/redacted_players.csv",
  "/pinball/data/lpl_player_insights_v1.json",
  "/pinball/data/lpl_targets_resolved_v1.json",
  "/pinball/data/lpl_targets_resolved_v2.json",
];
const MATERIALIZED_PATHS = new Set([
  ...CATALOG_CONTENT_PATHS.map(([webPath]) => webPath),
  ...OPTIONAL_CATALOG_CONTENT_PATHS.map(([webPath]) => webPath),
  ...LEAGUE_COMMUNITY_PATHS,
]);

function usesImmutableObject(webPath) {
  return MATERIALIZED_PATHS.has(webPath) || webPath.startsWith("/pinball/field-guide/");
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

async function walkFiles(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkFiles(fullPath, out);
    else out.push(fullPath);
  }
  return out;
}

function contentTypeFromPath(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

async function hashFile(filePath) {
  const buffer = await fs.readFile(filePath);
  return {
    hash: crypto.createHash("sha256").update(buffer).digest("hex"),
    size: buffer.byteLength,
  };
}

function revisionFor(files) {
  const digest = crypto.createHash("sha256");
  for (const file of [...files].sort((left, right) => left.path.localeCompare(right.path))) {
    digest.update(`${file.path}:${file.hash}\n`);
  }
  return digest.digest("hex");
}

function immutablePath(hash, webPath) {
  return `/pinball/objects/sha256/${hash}/${path.posix.basename(webPath)}`;
}

async function materializeImmutableObject(pinballDir, sourcePath, contentPath, expectedHash) {
  const relative = contentPath.replace(/^\/pinball\//, "");
  const destination = path.join(pinballDir, ...relative.split("/"));
  try {
    const current = await hashFile(destination);
    if (current.hash === expectedHash) return;
  } catch {
    // Missing immutable objects are expected on first publication.
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(sourcePath, destination);
  const written = await hashFile(destination);
  if (written.hash !== expectedHash) {
    throw new Error(`Immutable object verification failed for ${contentPath}`);
  }
}

function cohortFile(webPath, record, priority) {
  return {
    path: webPath,
    contentPath: record.contentPath,
    hash: record.hash,
    size: record.size,
    contentType: record.contentType,
    priority,
  };
}

function buildCohort(name, entries, files, { required = true } = {}) {
  const cohortFiles = [];
  for (const [webPath, priority] of entries) {
    const record = files[webPath];
    if (!record) {
      if (required) throw new Error(`${name} cohort is missing required file ${webPath}`);
      continue;
    }
    cohortFiles.push(cohortFile(webPath, record, priority));
  }
  if (!cohortFiles.length) return null;
  return { revision: revisionFor(cohortFiles), atomic: true, files: cohortFiles };
}

async function readJsonOrNull(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function diffManifest(previousFiles, nextFiles) {
  const added = [];
  const changed = [];
  const removed = [];
  for (const [file, next] of Object.entries(nextFiles)) {
    const previous = previousFiles[file];
    if (!previous) added.push(file);
    else if (previous.hash !== next.hash) changed.push(file);
  }
  for (const file of Object.keys(previousFiles)) {
    if (!nextFiles[file]) removed.push(file);
  }
  return { added, changed, removed };
}

function resolvePinballDir(options = {}) {
  return path.resolve(
    options.sourceDir ??
      process.env.PINBALL_MANIFEST_SOURCE_DIR ??
      path.join(ROOT, "shared", "pinball")
  );
}

export async function buildPinballManifest(options = {}) {
  const pinballDir = resolvePinballDir(options);
  const manifestPath = path.join(pinballDir, "cache-manifest.json");
  const updateLogPath = path.join(pinballDir, "cache-update-log.json");
  await fs.mkdir(pinballDir, { recursive: true });

  const files = {};
  for (const filePath of await walkFiles(pinballDir)) {
    const rel = toPosix(path.relative(pinballDir, filePath));
    if (!rel || EXCLUDED_FILES.has(rel)) continue;
    if (EXCLUDED_PATH_PREFIXES.some((prefix) => rel.startsWith(prefix))) continue;
    if (EXCLUDED_BASENAMES.has(path.basename(filePath))) continue;

    const stat = await fs.stat(filePath);
    const { hash, size } = await hashFile(filePath);
    const webPath = `/pinball/${rel}`;
    const record = {
      hash,
      size,
      mtimeMs: Math.round(stat.mtimeMs),
      contentType: contentTypeFromPath(filePath),
    };
    if (usesImmutableObject(webPath)) {
      record.contentPath = immutablePath(hash, webPath);
      await materializeImmutableObject(pinballDir, filePath, record.contentPath, hash);
    }
    files[webPath] = record;
  }

  const catalogContent = buildCohort("catalogContent", CATALOG_CONTENT_PATHS, files);
  for (const [webPath, priority] of OPTIONAL_CATALOG_CONTENT_PATHS) {
    const record = files[webPath];
    if (record) catalogContent.files.push(cohortFile(webPath, record, priority));
  }
  catalogContent.revision = revisionFor(catalogContent.files);
  const leagueCommunity = buildCohort(
    "leagueCommunity",
    LEAGUE_COMMUNITY_PATHS.map((webPath) => [webPath, 50]),
    files,
    { required: false }
  );
  const visualEntries = Object.keys(files)
    .filter((webPath) => webPath.startsWith("/pinball/field-guide/"))
    .sort()
    .map((webPath) => {
      const priority = webPath.endsWith("visual-manifest-v1.json")
        ? 0
        : webPath.includes("/recognition/")
          ? 10
          : webPath.includes("/atlas/packed-") || webPath.includes("/atlas/reference-320/")
            ? 20
            : 30;
      return [webPath, priority];
    });
  const fieldGuideVisuals = buildCohort("fieldGuideVisuals", visualEntries, files, {
    required: false,
  });

  const previousManifest = await readJsonOrNull(manifestPath);
  const previousFiles = previousManifest?.files ?? {};
  const { added, changed, removed } = diffManifest(previousFiles, files);
  const generatedAt = new Date().toISOString();
  const manifest = {
    schemaVersion: 1,
    generatedAt,
    source: toPosix(path.relative(ROOT, pinballDir) || "pinball"),
    mirrors: ["https://data.pinprof.com", "https://pillyliu.com"],
    totalFiles: Object.keys(files).length,
    files,
    cohorts: {
      catalogContent,
      ...(fieldGuideVisuals ? { fieldGuideVisuals } : {}),
      ...(leagueCommunity ? { leagueCommunity } : {}),
    },
  };
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const previousLog = (await readJsonOrNull(updateLogPath)) ?? { schemaVersion: 1, events: [] };
  const summary = {
    generatedAt,
    addedCount: added.length,
    changedCount: changed.length,
    removedCount: removed.length,
    totalFiles: manifest.totalFiles,
  };
  const event = { ...summary, added, changed, removed };
  const events = [event, ...(Array.isArray(previousLog.events) ? previousLog.events : [])].slice(0, 100);
  await fs.writeFile(
    updateLogPath,
    `${JSON.stringify({ schemaVersion: 1, events, latest: summary }, null, 2)}\n`,
    "utf8"
  );
  return summary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildPinballManifest()
    .then((summary) => {
      console.log(
        `Manifest updated: +${summary.addedCount} ~${summary.changedCount} -${summary.removedCount} (${summary.totalFiles} files)`
      );
    })
    .catch((error) => {
      console.error(error?.message || error);
      process.exit(1);
    });
}
