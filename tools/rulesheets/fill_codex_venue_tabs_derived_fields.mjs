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
const REQUIRED_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const CODEX_SPREADSHEET_ID = "1ZzHHFvIsfIZv5ghd4vDXi7G99ILhbgPHk3Lg6SbJFMQ";
const TARGET_TABS = new Set([
  "Clubhouse Arcade",
  "Sparks Pinball Museum & Arcade",
  "Pinball Pete's East Lansing",
]);
const DEFAULT_PINSIDE_GROUP_MAP = path.join(ROOT, "shared", "pinball", "data", "pinside_group_map.json");
const PINSIDE_GROUP_NONE_MARKER = "~";

function parseArgs(argv) {
  const out = {
    credentialsPath:
      process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_CREDENTIALS_FALLBACK,
    pinsideGroupMapPath: DEFAULT_PINSIDE_GROUP_MAP,
    write: true,
    tabs: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === "--credentials" && argv[i + 1]) out.credentialsPath = path.resolve(argv[i + 1]);
    if (t === "--pinside-group-map" && argv[i + 1]) out.pinsideGroupMapPath = path.resolve(argv[i + 1]);
    if (t === "--dry-run" || t === "--no-write") out.write = false;
    if (t === "--tabs" && argv[i + 1]) {
      out.tabs = new Set(argv[i + 1].split(",").map((v) => v.trim()).filter(Boolean));
    }
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

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    if ((rows[i] || []).some((v) => norm(v) === "game")) return i;
  }
  return -1;
}

function headerIndexMap(headers) {
  const m = new Map();
  (headers || []).forEach((h, i) => {
    const k = norm(h);
    if (!k) return;
    if (!m.has(k)) m.set(k, i);
  });
  return m;
}

function rowIsBlank(row) {
  return !(row || []).some((v) => String(v ?? "").trim());
}

function getCell(row, idx) {
  if (idx == null || idx < 0) return "";
  return String((row || [])[idx] ?? "").trim();
}

function setCell(row, idx, value) {
  if (idx == null || idx < 0) return false;
  const next = String(value ?? "");
  const cur = String((row || [])[idx] ?? "");
  if (cur === next) return false;
  row[idx] = next;
  return true;
}

function computeLibraryEntryId({ pmLocationId, manufacturer, pinsideId }) {
  if (!pinsideId) return "";
  if (pmLocationId) return `v--${pmLocationId}--${pinsideId}`;
  const manufacturerSlug = slugifyKey(manufacturer);
  return manufacturerSlug ? `m--${manufacturerSlug}--${pinsideId}` : "";
}

function computePracticeIdentity({ manufacturer, year, pinsideGroup, pinsideSlug }) {
  const manufacturerSlug = slugifyKey(manufacturer);
  const hasRealGroup = pinsideGroup && pinsideGroup !== PINSIDE_GROUP_NONE_MARKER;
  const familySlug = slugifyKey(hasRealGroup ? pinsideGroup : pinsideSlug);
  const y = String(year ?? "").trim();
  if (!manufacturerSlug || !familySlug || !y) return "";
  return `${manufacturerSlug}--${familySlug}--${y}`;
}

async function loadPinsideGroupMap(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid pinside group map JSON: ${filePath}`);
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pinsideGroupMap = await loadPinsideGroupMap(args.pinsideGroupMapPath);

  const auth = new google.auth.GoogleAuth({
    keyFile: args.credentialsPath,
    scopes: REQUIRED_SCOPES,
  });
  const sheetsApi = google.sheets({ version: "v4", auth });

  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId: CODEX_SPREADSHEET_ID,
    fields: "sheets(properties(sheetId,title,index))",
  });
  const tabs = (meta.data.sheets || [])
    .map((s) => s.properties)
    .filter(Boolean)
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .filter((p) => TARGET_TABS.has(p.title))
    .filter((p) => (args.tabs ? args.tabs.has(p.title) : true));

  for (const tab of tabs) {
    const escapedTitle = String(tab.title).replace(/'/g, "''");
    const valuesRes = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: CODEX_SPREADSHEET_ID,
      range: `'${escapedTitle}'!A:ZZ`,
      majorDimension: "ROWS",
    });
    const rows = (valuesRes.data.values || []).map((r) => r.map((v) => String(v ?? "")));
    const hr = findHeaderRow(rows);
    if (hr < 0) {
      console.log(`${tab.title}: skipped (no header)`); // unexpected
      continue;
    }
    const headers = rows[hr] || [];
    const idx = headerIndexMap(headers);
    const getIdx = (name) => idx.get(norm(name));

    let changedRows = 0;
    let filledLibrary = 0;
    let filledPractice = 0;
    let filledGroup = 0;

    for (let r = hr + 1; r < rows.length; r += 1) {
      const row = rows[r] || [];
      if (rowIsBlank(row)) continue;
      const game = getCell(row, getIdx("game"));
      if (!game || norm(game) === "game") continue;

      const manufacturer = getCell(row, getIdx("manufacturer"));
      const year = getCell(row, getIdx("year"));
      const pmLocationId = getCell(row, getIdx("pm_location_id"));
      const pinsideId = getCell(row, getIdx("pinside_id"));
      const pinsideSlug = getCell(row, getIdx("pinside_slug"));
      const existingGroup = getCell(row, getIdx("pinside_group"));
      const mappedGroup = pinsideSlug ? String(pinsideGroupMap[pinsideSlug] ?? "").trim() : "";
      const pinsideGroup = existingGroup || mappedGroup;

      let changed = false;
      if (!existingGroup && pinsideGroup) {
        changed = setCell(row, getIdx("pinside_group"), pinsideGroup) || changed;
        filledGroup += 1;
      }

      const libraryEntryId = computeLibraryEntryId({ pmLocationId, manufacturer, pinsideId });
      if (libraryEntryId && !getCell(row, getIdx("library_entry_id"))) {
        changed = setCell(row, getIdx("library_entry_id"), libraryEntryId) || changed;
        filledLibrary += 1;
      }

      const practiceIdentity = computePracticeIdentity({
        manufacturer,
        year,
        pinsideGroup,
        pinsideSlug,
      });
      if (practiceIdentity && !getCell(row, getIdx("practice_identity"))) {
        changed = setCell(row, getIdx("practice_identity"), practiceIdentity) || changed;
        filledPractice += 1;
      }

      if (changed) changedRows += 1;
    }

    if (args.write) {
      const usedRows = rows.length;
      const usedCols = headers.length;
      const endCol = toA1Column(Math.max(usedCols - 1, 0));
      const endRow = Math.max(usedRows, 1);
      await sheetsApi.spreadsheets.values.clear({
        spreadsheetId: CODEX_SPREADSHEET_ID,
        range: `'${escapedTitle}'!A:ZZ`,
      });
      await sheetsApi.spreadsheets.values.update({
        spreadsheetId: CODEX_SPREADSHEET_ID,
        range: `'${escapedTitle}'!A1:${endCol}${endRow}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      });
    }

    console.log(
      `${args.write ? "Updated" : "Prepared"} ${tab.title} | changed=${changedRows} library_entry_id=${filledLibrary} practice_identity=${filledPractice} pinside_group=${filledGroup}`
    );
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});

