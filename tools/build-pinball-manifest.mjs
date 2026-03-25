import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXCLUDED_FILES = new Set(["cache-manifest.json", "cache-update-log.json"]);
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

function toPosix(p) {
  return p.split(path.sep).join("/");
}

async function walkFiles(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(full, out);
      continue;
    }
    out.push(full);
  }
  return out;
}

function contentTypeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

async function hashFile(filePath) {
  const buf = await fs.readFile(filePath);
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  return { hash, size: buf.byteLength };
}

async function readJsonOrNull(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function diffManifest(prevFiles, nextFiles) {
  const added = [];
  const changed = [];
  const removed = [];

  for (const [file, next] of Object.entries(nextFiles)) {
    const prev = prevFiles[file];
    if (!prev) {
      added.push(file);
      continue;
    }
    if (prev.hash !== next.hash) changed.push(file);
  }

  for (const file of Object.keys(prevFiles)) {
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

  const allFiles = await walkFiles(pinballDir);
  const files = {};

  for (const filePath of allFiles) {
    const rel = toPosix(path.relative(pinballDir, filePath));
    if (!rel || EXCLUDED_FILES.has(rel)) continue;
    if (EXCLUDED_BASENAMES.has(path.basename(filePath))) continue;

    const stat = await fs.stat(filePath);
    const { hash, size } = await hashFile(filePath);
    const webPath = `/pinball/${rel}`;

    files[webPath] = {
      hash,
      size,
      mtimeMs: Math.round(stat.mtimeMs),
      contentType: contentTypeFromPath(filePath),
    };
  }

  const previousManifest = await readJsonOrNull(manifestPath);
  const previousFiles = previousManifest?.files ?? {};
  const { added, changed, removed } = diffManifest(previousFiles, files);

  const generatedAt = new Date().toISOString();
  const manifest = {
    schemaVersion: 1,
    generatedAt,
    source: toPosix(path.relative(ROOT, pinballDir) || "pinball"),
    totalFiles: Object.keys(files).length,
    files,
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const previousLog = (await readJsonOrNull(updateLogPath)) ?? {
    schemaVersion: 1,
    events: [],
  };

  const summary = {
    generatedAt,
    addedCount: added.length,
    changedCount: changed.length,
    removedCount: removed.length,
    totalFiles: manifest.totalFiles,
  };

  const event = { ...summary, added, changed, removed };
  const events = [event, ...(Array.isArray(previousLog.events) ? previousLog.events : [])].slice(0, 100);

  const logPayload = {
    schemaVersion: 1,
    events,
    latest: summary,
  };

  await fs.writeFile(updateLogPath, `${JSON.stringify(logPayload, null, 2)}\n`, "utf8");

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
      console.error(error.message || error);
      process.exit(1);
    });
}
