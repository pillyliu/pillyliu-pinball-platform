import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SPREADSHEET_ID = "1nVey1RP36KiHiR2qefsjm6cd8UfRE9RwtsTdCwkJGSA";
const DEFAULT_GID = "2051576512";
const DEFAULT_CREDENTIALS_FALLBACK = path.resolve(
  THIS_DIR,
  "../../../Pinball Scraper/.secrets/google-service-account.json"
);
const DEFAULT_CSV_OUT = path.resolve(
  THIS_DIR,
  "../../shared/pinball/data/Avenue Pinball - Current.csv"
);
const REQUIRED_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function parseArgs(argv) {
  const out = {
    spreadsheetId: process.env.AVENUE_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID,
    gid: process.env.AVENUE_SPREADSHEET_GID || DEFAULT_GID,
    credentialsPath:
      process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_CREDENTIALS_FALLBACK,
    csvOut: DEFAULT_CSV_OUT,
    writeSheet: true,
    backfillAvenueLocation: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--spreadsheet-id" && argv[i + 1]) out.spreadsheetId = argv[i + 1];
    if (token === "--gid" && argv[i + 1]) out.gid = argv[i + 1];
    if (token === "--credentials" && argv[i + 1]) out.credentialsPath = path.resolve(argv[i + 1]);
    if (token === "--csv-out" && argv[i + 1]) out.csvOut = path.resolve(argv[i + 1]);
    if (token === "--no-write-sheet") out.writeSheet = false;
    if (token === "--no-backfill-location") out.backfillAvenueLocation = false;
  }

  return out;
}

function toNormalizedHeader(value) {
  return String(value || "").trim().toLowerCase();
}

function getHeaderIndex(headers, name) {
  const needle = toNormalizedHeader(name);
  return headers.findIndex((h) => toNormalizedHeader(h) === needle);
}

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || [];
    if (getHeaderIndex(row, "Game") >= 0) return i;
  }
  return -1;
}

function resolveSheetTitle(meta, gid) {
  const wantedId = Number(gid);
  const sheet = (meta.data.sheets || []).find((s) => s?.properties?.sheetId === wantedId);
  if (!sheet?.properties?.title) {
    throw new Error(`Could not find sheet with gid ${gid} in spreadsheet ${meta.data.spreadsheetId}`);
  }
  return sheet.properties.title;
}

function headerNameMap(rawHeaders) {
  const map = new Map();
  for (const header of rawHeaders) {
    const normalized = toNormalizedHeader(header);
    if (!normalized) continue;
    if (!map.has(normalized)) map.set(normalized, String(header).trim());
  }
  return map;
}

function buildHeaderOrder(rawHeaders) {
  const map = headerNameMap(rawHeaders);
  const leading = ["Location", "Group", "Position", "Bank", "Game"];
  const result = [...leading];
  const skip = new Set(["location", "group", "position", "pos", "bank", "game"]);

  for (const raw of rawHeaders) {
    const normalized = toNormalizedHeader(raw);
    if (!normalized || skip.has(normalized)) continue;
    result.push(String(raw).trim());
  }

  if (!result.some((h) => toNormalizedHeader(h) === "manufacturer") && map.has("manufacturer")) {
    result.push(map.get("manufacturer"));
  }

  return result;
}

function byHeader(row, headerToIndex, key) {
  const index = headerToIndex.get(toNormalizedHeader(key));
  if (index == null || index < 0) return "";
  return String((row || [])[index] ?? "");
}

function deriveAvenueLocation(locationValue, groupValue, shouldBackfill) {
  const existing = String(locationValue || "").trim().toUpperCase();
  if (existing) return existing;
  if (!shouldBackfill) return "";

  const group = Number.parseInt(String(groupValue || "").trim(), 10);
  if (!Number.isFinite(group)) return "";
  if (group >= 1 && group <= 4) return "U";
  if (group >= 5) return "D";
  return "";
}

function isEmptyRow(row) {
  return row.every((v) => String(v ?? "").trim() === "");
}

function escapeCsvField(value) {
  const str = String(value ?? "");
  if (!/[",\r\n]/.test(str)) return str;
  return `"${str.replace(/"/g, "\"\"")}"`;
}

function toCsv(rows) {
  return `${rows.map((row) => row.map(escapeCsvField).join(",")).join("\n")}\n`;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const auth = new google.auth.GoogleAuth({
    keyFile: args.credentialsPath,
    scopes: REQUIRED_SCOPES,
  });
  const sheets = google.sheets({ version: "v4", auth });

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: args.spreadsheetId,
    fields: "spreadsheetId,sheets(properties(sheetId,title))",
  });
  const sheetTitle = resolveSheetTitle(meta, args.gid);
  const escapedTitle = sheetTitle.replace(/'/g, "''");

  const valuesRes = await sheets.spreadsheets.values.get({
    spreadsheetId: args.spreadsheetId,
    range: `'${escapedTitle}'!A:ZZ`,
    majorDimension: "ROWS",
  });

  const allRows = valuesRes.data.values || [];
  if (!allRows.length) throw new Error("No rows returned from sheet.");

  const headerRowIdx = findHeaderRow(allRows);
  if (headerRowIdx < 0) throw new Error('Could not find header row containing "Game".');

  const headerRow = allRows[headerRowIdx];
  const dataRows = allRows.slice(headerRowIdx + 1);
  const newHeaders = buildHeaderOrder(headerRow);

  const headerToIndex = new Map();
  headerRow.forEach((header, idx) => {
    const key = toNormalizedHeader(header);
    if (!key) return;
    if (!headerToIndex.has(key)) headerToIndex.set(key, idx);
  });

  const transformedRows = [];
  for (const rawRow of dataRows) {
    const normalizedRow = newHeaders.map((header) => {
      const key = toNormalizedHeader(header);
      if (key === "position") {
        return byHeader(rawRow, headerToIndex, "Position") || byHeader(rawRow, headerToIndex, "Pos");
      }
      if (key === "location") {
        const location = byHeader(rawRow, headerToIndex, "Location");
        const group = byHeader(rawRow, headerToIndex, "Group");
        return deriveAvenueLocation(location, group, args.backfillAvenueLocation);
      }
      return byHeader(rawRow, headerToIndex, header);
    });
    transformedRows.push(normalizedRow);
  }

  while (transformedRows.length && isEmptyRow(transformedRows[transformedRows.length - 1])) {
    transformedRows.pop();
  }

  const outputRows = [newHeaders, ...transformedRows];

  if (args.writeSheet) {
    const endCol = toA1Column(Math.max(newHeaders.length - 1, 0));
    await sheets.spreadsheets.values.clear({
      spreadsheetId: args.spreadsheetId,
      range: `'${escapedTitle}'!A:ZZ`,
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: args.spreadsheetId,
      range: `'${escapedTitle}'!A1:${endCol}${outputRows.length}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: outputRows },
    });
  }

  await fs.mkdir(path.dirname(args.csvOut), { recursive: true });
  await fs.writeFile(args.csvOut, toCsv(outputRows), "utf8");

  console.log(`Sheet: ${sheetTitle} (gid ${args.gid})`);
  console.log(`Header -> ${newHeaders.join(", ")}`);
  console.log(`${args.writeSheet ? "Updated" : "Prepared"} sheet rows: ${outputRows.length}`);
  console.log(`Wrote CSV -> ${args.csvOut}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

