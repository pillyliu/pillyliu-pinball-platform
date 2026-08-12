import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_ADMIN_PUBLISHED_DIR = path.resolve(ROOT, "../PinProf Admin/workspace/data/published");
const V2_REQUIRED_FIELDS = [
  "tipId",
  "opdbId",
  "category",
  "voteTotal",
  "text",
  "createdAt",
  "updatedAt",
];

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sourceProjection(row) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => key !== "game"));
}

function validateRows(rows, { requireGame, label }) {
  const errors = [];
  const seenTipIds = new Map();
  if (!Array.isArray(rows)) {
    return [`${label} must be a JSON array.`];
  }
  rows.forEach((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      errors.push(`${label} row ${index} must be an object.`);
      return;
    }
    const missing = V2_REQUIRED_FIELDS.filter((field) => !Object.hasOwn(row, field));
    if (missing.length) errors.push(`${label} row ${index} is missing ${missing.join(", ")}.`);
    if (!cleanString(row.opdbId)) errors.push(`${label} row ${index} has an empty opdbId.`);
    if (!cleanString(row.text)) errors.push(`${label} row ${index} has empty text.`);
    if (requireGame && !cleanString(row.game)) errors.push(`${label} row ${index} has an empty game.`);
    const tipKey = `${typeof row.tipId}:${String(row.tipId)}`;
    if (seenTipIds.has(tipKey)) {
      errors.push(`${label} has duplicate tipId ${JSON.stringify(row.tipId)} at rows ${seenTipIds.get(tipKey)} and ${index}.`);
    } else {
      seenTipIds.set(tipKey, index);
    }
  });
  return errors;
}

export function validatePinTipsContract(v2Rows, legacyRows, labels = {}) {
  const v2Label = labels.v2 ?? "PinTips V2";
  const legacyLabel = labels.legacy ?? "PinTips legacy";
  const errors = [
    ...validateRows(v2Rows, { requireGame: false, label: v2Label }),
    ...validateRows(legacyRows, { requireGame: true, label: legacyLabel }),
  ];
  if (!Array.isArray(v2Rows) || !Array.isArray(legacyRows)) return errors;
  if (v2Rows.length !== legacyRows.length) {
    errors.push(`${v2Label}/${legacyLabel} row-count mismatch: ${v2Rows.length} versus ${legacyRows.length}.`);
    return errors;
  }
  v2Rows.forEach((v2Row, index) => {
    if (!isDeepStrictEqual(sourceProjection(v2Row), sourceProjection(legacyRows[index]))) {
      errors.push(
        `${v2Label}/${legacyLabel} parity mismatch at row ${index} `
        + `(tipId ${JSON.stringify(v2Row?.tipId)} versus ${JSON.stringify(legacyRows[index]?.tipId)}).`
      );
    }
  });
  return errors;
}

async function readJsonBytes(filePath) {
  const bytes = await fs.readFile(filePath);
  return { bytes, rows: JSON.parse(bytes.toString("utf8")) };
}

export async function validatePinTipsContractFiles({ v2Path, legacyPath }) {
  const [v2, legacy] = await Promise.all([readJsonBytes(v2Path), readJsonBytes(legacyPath)]);
  const errors = validatePinTipsContract(v2.rows, legacy.rows, { v2: v2Path, legacy: legacyPath });
  return {
    errors,
    rowCount: Array.isArray(v2.rows) ? v2.rows.length : null,
    hashes: { v2: sha256(v2.bytes), legacy: sha256(legacy.bytes) },
  };
}

async function fetchJsonBytes(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, rows: JSON.parse(bytes.toString("utf8")) };
}

async function validateRemoteBase(baseURL) {
  const root = String(baseURL).replace(/\/+$/, "");
  const v2URL = `${root}/pinball/data/pintips_v2.json`;
  const legacyURL = `${root}/pinball/data/pintips.json`;
  const [v2, legacy] = await Promise.all([fetchJsonBytes(v2URL), fetchJsonBytes(legacyURL)]);
  return {
    baseURL: root,
    errors: validatePinTipsContract(v2.rows, legacy.rows, { v2: v2URL, legacy: legacyURL }),
    rowCount: Array.isArray(v2.rows) ? v2.rows.length : null,
    hashes: { v2: sha256(v2.bytes), legacy: sha256(legacy.bytes) },
  };
}

function parseArgs(argv) {
  const options = {
    legacyPath: path.join(DEFAULT_ADMIN_PUBLISHED_DIR, "pintips.json"),
    v2Path: path.join(DEFAULT_ADMIN_PUBLISHED_DIR, "pintips_v2.json"),
    baseURLs: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--legacy") options.legacyPath = path.resolve(argv[++index]);
    else if (arg === "--v2") options.v2Path = path.resolve(argv[++index]);
    else if (arg === "--base-url") options.baseURLs.push(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.baseURLs.length) {
    const result = await validatePinTipsContractFiles(options);
    if (result.errors.length) throw new Error(result.errors.join("\n"));
    console.log(JSON.stringify({ status: "ok", ...result, errors: undefined }, null, 2));
    return;
  }

  const results = [];
  for (const baseURL of options.baseURLs) results.push(await validateRemoteBase(baseURL));
  const errors = results.flatMap((result) => result.errors);
  if (results.length > 1) {
    const expected = results[0];
    for (const result of results.slice(1)) {
      if (result.hashes.v2 !== expected.hashes.v2) {
        errors.push(`V2 hash mismatch between ${expected.baseURL} and ${result.baseURL}.`);
      }
      if (result.hashes.legacy !== expected.hashes.legacy) {
        errors.push(`Legacy hash mismatch between ${expected.baseURL} and ${result.baseURL}.`);
      }
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(JSON.stringify({ status: "ok", remotes: results.map(({ errors: _, ...result }) => result) }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
}
