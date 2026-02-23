import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(THIS_DIR, "../..");
const DEFAULT_CREDENTIALS_FALLBACK = path.resolve(
  THIS_DIR,
  "../../../Pinball Scraper/.secrets/google-service-account.json"
);
const DEFAULT_CSV_DIR = path.join(ROOT, "shared", "pinball", "data");
const REQUIRED_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const PINSIDE_GROUP_NONE_MARKER = "~";

const SHEETS = {
  avenue: {
    name: "Avenue",
    spreadsheetId: "1nVey1RP36KiHiR2qefsjm6cd8UfRE9RwtsTdCwkJGSA",
    gid: "2051576512",
    csvFilename: "Avenue Pinball - Current.csv",
  },
  rlm: {
    name: "RLM",
    spreadsheetId: "1CZXzpzvhX4uv12hOO-8MT1RVkirBRhDXFMSk02tC24Q",
    gid: "807778067",
    csvFilename: "RLM Amusements - Current.csv",
  },
  codex: {
    name: "Codex",
    spreadsheetId: "1ZzHHFvIsfIZv5ghd4vDXi7G99ILhbgPHk3Lg6SbJFMQ",
    gid: "719219923",
    csvFilename: "Codex Pinball Library - Current.csv",
  },
};

function parseArgs(argv) {
  const out = {
    credentialsPath:
      process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_CREDENTIALS_FALLBACK,
    csvDir: DEFAULT_CSV_DIR,
    sheetKeys: Object.keys(SHEETS),
    writeSheet: false,
    exportCsv: true,
    pinsideGroupMapPath: null,
    pinsideRowOverrideMapPath: null,
    overwritePinsideGroup: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--credentials" && argv[i + 1]) out.credentialsPath = path.resolve(argv[i + 1]);
    if (token === "--csv-dir" && argv[i + 1]) out.csvDir = path.resolve(argv[i + 1]);
    if (token === "--sheets" && argv[i + 1]) {
      out.sheetKeys = argv[i + 1]
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);
    }
    if (token === "--write") out.writeSheet = true;
    if (token === "--no-export-csv") out.exportCsv = false;
    if (token === "--pinside-group-map" && argv[i + 1]) {
      out.pinsideGroupMapPath = path.resolve(argv[i + 1]);
    }
    if (token === "--pinside-row-override-map" && argv[i + 1]) {
      out.pinsideRowOverrideMapPath = path.resolve(argv[i + 1]);
    }
    if (token === "--overwrite-pinside-group") out.overwritePinsideGroup = true;
  }

  return out;
}

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function slugifyKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || [];
    if (row.some((v) => norm(v) === "game")) return i;
  }
  return -1;
}

function resolveSheetTitle(meta, gid) {
  const wanted = Number(gid);
  const match = (meta.data.sheets || []).find((s) => s?.properties?.sheetId === wanted);
  if (!match?.properties?.title) {
    throw new Error(`Could not find gid ${gid} in spreadsheet ${meta.data.spreadsheetId}`);
  }
  return match.properties.title;
}

function headerIndexMap(headers) {
  const out = new Map();
  headers.forEach((h, idx) => {
    const key = norm(h);
    if (!key) return;
    if (!out.has(key)) out.set(key, idx);
  });
  return out;
}

function buildTargetHeaders(headers) {
  const values = headers.map((h) => String(h ?? "").trim());
  const keep = values.filter(Boolean);
  const filtered = keep.filter((h) => {
    const n = norm(h);
    return n !== "library_entry_id" && n !== "practice_identity" && n !== "pinside_group";
  });

  const next = ["library_entry_id", "practice_identity", ...filtered];
  const slugIdx = next.findIndex((h) => norm(h) === "pinside_slug");
  if (slugIdx >= 0) next.splice(slugIdx + 1, 0, "pinside_group");
  else next.push("pinside_group");
  return next;
}

function getCell(row, idx) {
  if (idx == null || idx < 0) return "";
  return String((row || [])[idx] ?? "");
}

function rowIsEmpty(row) {
  return (row || []).every((v) => String(v ?? "").trim() === "");
}

function isDataRow(row, srcHeaderMap) {
  const game = getCell(row, srcHeaderMap.get("game")).trim();
  if (!game) return false;
  if (norm(game) === "game") return false;
  return true;
}

function pick(row, srcHeaderMap, key) {
  return getCell(row, srcHeaderMap.get(norm(key))).trim();
}

function computeLibraryEntryId(values) {
  const pinsideId = values.pinsideId;
  if (!pinsideId) return "";

  if (values.pmLocationId) {
    return `v--${values.pmLocationId}--${pinsideId}`;
  }

  const manufacturerSlug = slugifyKey(values.manufacturer);
  if (manufacturerSlug) {
    return `m--${manufacturerSlug}--${pinsideId}`;
  }

  return "";
}

function computePracticeIdentity(values) {
  const manufacturerSlug = slugifyKey(values.manufacturer);
  const year = String(values.year ?? "").trim();
  const pinsideGroup = String(values.pinsideGroup ?? "").trim();
  const hasRealPinsideGroup = pinsideGroup && pinsideGroup !== PINSIDE_GROUP_NONE_MARKER;
  const familySource = hasRealPinsideGroup ? pinsideGroup : values.pinsideSlug;
  const familySlug = slugifyKey(familySource);

  if (!manufacturerSlug || !familySlug || !year) return "";
  return `${manufacturerSlug}--${familySlug}--${year}`;
}

function isPinsideGroupNoneMarker(value) {
  return String(value ?? "").trim() === PINSIDE_GROUP_NONE_MARKER;
}

function getPinsideGroupFromMap(map, pinsideSlug) {
  if (!map || !pinsideSlug) return "";
  const direct = map[pinsideSlug];
  if (typeof direct === "string") return direct.trim();
  return "";
}

function mapRowToTargetHeaders({
  row,
  sourceHeaders,
  sourceHeaderMap,
  targetHeaders,
  pinsideGroupMap,
  rowOverride,
  overwritePinsideGroup,
}) {
  const target = targetHeaders.map((h) => {
    const sourceIdx = sourceHeaderMap.get(norm(h));
    return sourceIdx == null ? "" : getCell(row, sourceIdx);
  });

  if (!isDataRow(row, sourceHeaderMap)) return target;

  const venue = pick(row, sourceHeaderMap, "Venue");
  const pmLocationId = pick(row, sourceHeaderMap, "PM_location_id");
  const manufacturer = pick(row, sourceHeaderMap, "Manufacturer");
  const year = pick(row, sourceHeaderMap, "Year");
  const overridePinsideId =
    rowOverride && rowOverride.pinside_id != null ? String(rowOverride.pinside_id).trim() : "";
  const overridePinsideSlug =
    rowOverride && rowOverride.pinside_slug != null ? String(rowOverride.pinside_slug).trim() : "";
  const hasOverrideGroup = rowOverride && rowOverride.pinside_group != null;
  const overridePinsideGroup = hasOverrideGroup ? String(rowOverride.pinside_group).trim() : "";

  const pinsideId = overridePinsideId || pick(row, sourceHeaderMap, "pinside_id");
  const pinsideSlug = overridePinsideSlug || pick(row, sourceHeaderMap, "pinside_slug");
  const existingPinsideGroup = hasOverrideGroup ? overridePinsideGroup : pick(row, sourceHeaderMap, "pinside_group");
  const mappedPinsideGroup = getPinsideGroupFromMap(pinsideGroupMap, pinsideSlug);
  const pinsideGroup = overwritePinsideGroup
    ? (mappedPinsideGroup || "")
    : (existingPinsideGroup || mappedPinsideGroup);

  const derived = {
    venue,
    pmLocationId,
    manufacturer,
    year,
    pinsideId,
    pinsideSlug,
    pinsideGroup,
  };

  const libraryEntryId = computeLibraryEntryId(derived);
  const practiceIdentity = computePracticeIdentity(derived);

  const targetHeaderMap = headerIndexMap(targetHeaders);
  const setByHeader = (header, value) => {
    const idx = targetHeaderMap.get(norm(header));
    if (idx == null) return;
    target[idx] = value;
  };

  setByHeader("library_entry_id", libraryEntryId);
  setByHeader("practice_identity", practiceIdentity);
  setByHeader("pinside_id", pinsideId);
  setByHeader("pinside_slug", pinsideSlug);
  setByHeader("pinside_group", pinsideGroup);

  return target;
}

function toA1Column(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function escapeCsvField(value) {
  const str = String(value ?? "");
  if (!/[",\r\n]/.test(str)) return str;
  return `"${str.replace(/"/g, "\"\"")}"`;
}

function toCsv(rows) {
  return `${rows.map((row) => row.map(escapeCsvField).join(",")).join("\n")}\n`;
}

async function loadPinsideGroupMap(filePath) {
  if (!filePath) return null;
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid pinside group map JSON at ${filePath}`);
  }
  return parsed;
}

async function loadPinsideRowOverrideMap(filePath) {
  if (!filePath) return null;
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid pinside row override map JSON at ${filePath}`);
  }
  return parsed;
}

async function loadSheet(sheetsApi, cfg) {
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId: cfg.spreadsheetId,
    fields: "spreadsheetId,sheets(properties(sheetId,title))",
  });
  const title = resolveSheetTitle(meta, cfg.gid);
  const escapedTitle = title.replace(/'/g, "''");
  const valuesRes = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: cfg.spreadsheetId,
    range: `'${escapedTitle}'!A:ZZ`,
    majorDimension: "ROWS",
  });

  const rows = valuesRes.data.values || [];
  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex < 0) {
    throw new Error(`${cfg.name}: Could not find header row containing "Game"`);
  }

  return { ...cfg, title, escapedTitle, rows, headerRowIndex };
}

function summarizeChanges(sourceRows, sourceHeaders, targetRows, targetHeaders) {
  const sourceMap = headerIndexMap(sourceHeaders);
  const targetMap = headerIndexMap(targetHeaders);

  let dataRows = 0;
  let libraryEntryPopulated = 0;
  let practiceIdentityPopulated = 0;
  let pinsideGroupPopulated = 0;
  let pinsideGroupAddedFromMap = 0;

  for (let i = 1; i < targetRows.length; i += 1) {
    const targetRow = targetRows[i] || [];
    const sourceRow = sourceRows[i] || [];
    if (!isDataRow(targetRow, targetMap)) continue;
    dataRows += 1;

    const lid = getCell(targetRow, targetMap.get("library_entry_id")).trim();
    const pid = getCell(targetRow, targetMap.get("practice_identity")).trim();
    const pg = getCell(targetRow, targetMap.get("pinside_group")).trim();
    if (lid) libraryEntryPopulated += 1;
    if (pid) practiceIdentityPopulated += 1;
    if (pg && !isPinsideGroupNoneMarker(pg)) pinsideGroupPopulated += 1;

    const sourcePg = getCell(sourceRow, sourceMap.get("pinside_group")).trim();
    if (!sourcePg && pg) pinsideGroupAddedFromMap += 1;
  }

  return {
    dataRows,
    libraryEntryPopulated,
    practiceIdentityPopulated,
    pinsideGroupPopulated,
    pinsideGroupAddedFromMap,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const invalid = args.sheetKeys.filter((key) => !(key in SHEETS));
  if (invalid.length) {
    throw new Error(`Unknown sheet key(s): ${invalid.join(", ")}. Valid: ${Object.keys(SHEETS).join(", ")}`);
  }

  const pinsideGroupMap = await loadPinsideGroupMap(args.pinsideGroupMapPath);
  const pinsideRowOverrideMap = await loadPinsideRowOverrideMap(args.pinsideRowOverrideMapPath);

  const auth = new google.auth.GoogleAuth({
    keyFile: args.credentialsPath,
    scopes: REQUIRED_SCOPES,
  });
  const sheetsApi = google.sheets({ version: "v4", auth });

  for (const key of args.sheetKeys) {
    const cfg = SHEETS[key];
    const sheet = await loadSheet(sheetsApi, cfg);
    const sourceRows = sheet.rows;
    const headerRow = sourceRows[sheet.headerRowIndex] || [];
    const sourceHeaderMap = headerIndexMap(headerRow);
    const targetHeaders = buildTargetHeaders(headerRow);

    const prefixRows = sourceRows.slice(0, sheet.headerRowIndex);
    const sourceDataRows = sourceRows.slice(sheet.headerRowIndex + 1);
    const targetDataRows = sourceDataRows.map((row, idx) =>
      mapRowToTargetHeaders({
        row,
        sourceHeaders: headerRow,
        sourceHeaderMap,
        targetHeaders,
        pinsideGroupMap,
        rowOverride: pinsideRowOverrideMap?.[`${cfg.csvFilename}#${idx + 2}`] || null,
        overwritePinsideGroup: args.overwritePinsideGroup,
      })
    );

    while (targetDataRows.length && rowIsEmpty(targetDataRows[targetDataRows.length - 1])) {
      targetDataRows.pop();
    }

    const outputRows = [...prefixRows, targetHeaders, ...targetDataRows];
    const summary = summarizeChanges(
      [headerRow, ...sourceDataRows],
      headerRow,
      [targetHeaders, ...targetDataRows],
      targetHeaders
    );

    if (args.writeSheet) {
      const endCol = toA1Column(Math.max(targetHeaders.length - 1, 0));
      await sheetsApi.spreadsheets.values.clear({
        spreadsheetId: sheet.spreadsheetId,
        range: `'${sheet.escapedTitle}'!A:ZZ`,
      });
      await sheetsApi.spreadsheets.values.update({
        spreadsheetId: sheet.spreadsheetId,
        range: `'${sheet.escapedTitle}'!A1:${endCol}${outputRows.length}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: outputRows },
      });
    }

    if (args.exportCsv) {
      await fs.mkdir(args.csvDir, { recursive: true });
      const csvPath = path.join(args.csvDir, cfg.csvFilename);
      await fs.writeFile(csvPath, toCsv([targetHeaders, ...targetDataRows]), "utf8");
      console.log(`CSV: ${csvPath}`);
    }

    console.log(
      [
        `${cfg.name}: ${args.writeSheet ? "updated" : "dry-run"}`,
        `rows=${summary.dataRows}`,
        `library_entry_id=${summary.libraryEntryPopulated}`,
        `practice_identity=${summary.practiceIdentityPopulated}`,
        `pinside_group=${summary.pinsideGroupPopulated}`,
        `pinside_group_added=${summary.pinsideGroupAddedFromMap}`,
      ].join(" | ")
    );
    console.log(`Header: ${targetHeaders.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
