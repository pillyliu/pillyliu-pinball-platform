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
const DEFAULT_PINSIDE_GROUP_MAP = path.join(ROOT, "shared", "pinball", "data", "pinside_group_map.json");
const PINSIDE_GROUP_NONE_MARKER = "~";
const MANUFACTURER_TAB_TITLES = [
  "Modern Sterns",
  "JJP",
  "Spooky",
  "Barrels of Fun",
  "Turner",
  "American Pinball",
  "Multimorphic",
  "CGC",
  "Pinball Brothers",
  "Dutch Pinball",
];
const CODEX_VENUE_TAB_TITLES = [
  "Crazy Quarters Arcade",
  "Clubhouse Arcade",
  "Sparks Pinball Museum & Arcade",
  "Pinball Pete's East Lansing",
  "The Avenue Cafe",
  "RLM Amusements",
];

const SOURCE_CSVS = [
  path.join(ROOT, "shared", "pinball", "data", "Avenue Pinball - Current.csv"),
  path.join(ROOT, "shared", "pinball", "data", "RLM Amusements - Current.csv"),
  path.join(ROOT, "shared", "pinball", "data", "Codex Pinball Library - Current.csv"),
];

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
      out.tabs = new Set(
        argv[i + 1]
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      );
    }
  }
  return out;
}

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
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

function normLoose(value) {
  return norm(value)
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function normalizeManufacturer(value) {
  let s = normLoose(value);
  if (s === "jjp") return "jersey jack pinball";
  if (s === "cgc") return "chicago gaming";
  if (s === "pb") return "pinball brothers";
  s = s.replace(/\bpinball inc\b/g, "").replace(/\binc\b/g, "").trim();
  s = s.replace(/\bco\b/g, "").replace(/\bcompany\b/g, "").trim();
  if (s === "stern pinball") return "stern";
  if (s === "spooky pinball") return "spooky";
  if (s === "chicago gaming") return "chicago gaming";
  return s;
}

function variantRank(variant) {
  const v = normLoose(variant);
  if (!v) return 10;
  if (/\bpremium\b/.test(v)) return 100;
  if (/\ble\b|\blimited\b/.test(v)) return 95;
  if (/\bce\b|\bcollector/.test(v)) return 90;
  if (/\bse\b|\bspecial\b/.test(v)) return 85;
  if (/\bpro\b/.test(v)) return 80;
  return 50;
}

function tokenize(value) {
  return new Set(normLoose(value).split(" ").filter(Boolean));
}

function tokenOverlapCount(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  let count = 0;
  for (const t of A) if (B.has(t)) count += 1;
  return count;
}

function jaccard(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  if (!A.size || !B.size) return 0;
  let i = 0;
  for (const t of A) if (B.has(t)) i += 1;
  return i / new Set([...A, ...B]).size;
}

function csvParse(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\r" && next === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 2;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

function toCsvLikeRows(rows) {
  return rows.map((r) => r.map((v) => String(v ?? "")));
}

async function loadSourceRows() {
  const out = [];
  for (const csvPath of SOURCE_CSVS) {
    const raw = await fs.readFile(csvPath, "utf8");
    const rows = csvParse(raw);
    if (!rows.length) continue;
    const headers = rows[0];
    const idx = new Map(headers.map((h, i) => [norm(h), i]));
    for (let r = 1; r < rows.length; r += 1) {
      const row = rows[r];
      const get = (k) => String(row[idx.get(norm(k))] ?? "").trim();
      const game = get("Game");
      if (!game || norm(game) === "game") continue;
      const manufacturer = get("Manufacturer");
      const year = get("Year");
      const pinsideGroup = get("pinside_group");
      const pinsideSlug = get("pinside_slug");
      const pinsideId = get("pinside_id");
      if (!manufacturer || !year) continue;
      out.push({
        sourceCsv: path.basename(csvPath),
        game,
        variant: get("Variant"),
        manufacturer,
        manufacturerKey: normalizeManufacturer(manufacturer),
        year,
        pinside_id: pinsideId,
        pinside_slug: pinsideSlug,
        pinside_group: pinsideGroup,
        practice_identity: get("practice_identity"),
        links: {
          playfield: get("Playfield Image"),
          rulesheet: get("Rulesheet"),
          tutorial1: get("Tutorial 1"),
          tutorial2: get("Tutorial 2"),
          tutorial3: get("Tutorial 3"),
          tutorial4: get("Tutorial 4"),
          gameplay1: get("Gameplay 1"),
          gameplay2: get("Gameplay 2"),
          gameplay3: get("Gameplay 3"),
          gameplay4: get("Gameplay 4"),
          competition1: get("Competition 1"),
          competition2: get("Competition 2"),
          competition3: get("Competition 3"),
          competition4: get("Competition 4"),
        },
      });
    }
  }
  return out;
}

async function loadPinsideGroupMap(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid pinside group map JSON at ${filePath}`);
  }
  return parsed;
}

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    if ((rows[i] || []).some((v) => norm(v) === "game")) return i;
  }
  return -1;
}

function headerIndexMap(headers) {
  const m = new Map();
  headers.forEach((h, i) => {
    const k = norm(h);
    if (!k) return;
    if (!m.has(k)) m.set(k, i);
  });
  return m;
}

function computePracticeIdentityFromResolved({ manufacturer, year, pinside_group, pinside_slug }) {
  const manufacturerSlug = slugifyKey(manufacturer);
  const rawGroup = String(pinside_group || "").trim();
  const group = rawGroup && rawGroup !== PINSIDE_GROUP_NONE_MARKER ? rawGroup : "";
  const family = group || String(pinside_slug || "").trim();
  const familySlug = slugifyKey(family);
  const y = String(year || "").trim();
  if (!manufacturerSlug || !familySlug || !y) return "";
  return `${manufacturerSlug}--${familySlug}--${y}`;
}

function scoreCandidate(target, c) {
  let score = 0;
  if (normalizeManufacturer(target.manufacturer) === c.manufacturerKey) score += 10;
  if (String(target.year).trim() && String(target.year).trim() === String(c.year).trim()) score += 8;
  const groupOrGame = c.pinside_group || c.game;
  const sim = Math.max(jaccard(target.game, c.game), jaccard(target.game, groupOrGame));
  score += sim * 20;
  const overlap = Math.max(tokenOverlapCount(target.game, c.game), tokenOverlapCount(target.game, groupOrGame));
  if (overlap === 0) score -= 20;
  else score += Math.min(overlap, 4) * 2;
  const tg = normLoose(target.game);
  const cg = normLoose(c.game);
  const pg = normLoose(c.pinside_group);
  if (tg && (cg.includes(tg) || tg.includes(cg))) score += 5;
  if (tg && pg && (pg.includes(tg) || tg.includes(pg))) score += 7;
  if (c.pinside_group) score += 3;
  if (c.pinside_slug) score += 2;
  if (c.pinside_id) score += 2;
  score += variantRank(c.variant) / 10;
  return score;
}

function chooseBestCandidate(target, sourceRows) {
  const candidates = sourceRows
    .filter((r) => r.manufacturerKey && r.manufacturerKey === normalizeManufacturer(target.manufacturer))
    .filter((r) => String(r.year).trim() === String(target.year).trim());
  if (!candidates.length) return null;
  let best = null;
  for (const c of candidates) {
    const score = scoreCandidate(target, c);
    if (!best || score > best.score) best = { row: c, score };
  }
  if (!best) return null;
  const nameBasis = best.row.pinside_group || best.row.game;
  const overlap = Math.max(tokenOverlapCount(target.game, best.row.game), tokenOverlapCount(target.game, nameBasis));
  const sim = Math.max(jaccard(target.game, best.row.game), jaccard(target.game, nameBasis));
  if (overlap <= 0) return null;
  if (sim < 0.28 && overlap < 2) return null;
  return best.score >= 26 ? best : null;
}

async function resolveSheetTitle(sheetsApi, spreadsheetId, gid) {
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "spreadsheetId,sheets(properties(sheetId,title))",
  });
  const s = (meta.data.sheets || []).find((x) => x?.properties?.sheetId === Number(gid));
  if (!s?.properties?.title) throw new Error(`Could not find gid ${gid}`);
  return s.properties.title;
}

function escapeSheetTitle(title) {
  return String(title).replace(/'/g, "''");
}

async function loadCodexVenueSourceRows(sheetsApi) {
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId: CODEX_SPREADSHEET_ID,
    fields: "sheets(properties(sheetId,title,index))",
  });
  const tabs = (meta.data.sheets || [])
    .map((s) => s.properties)
    .filter(Boolean)
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .filter((p) => CODEX_VENUE_TAB_TITLES.includes(p.title));

  const out = [];
  for (const tab of tabs) {
    const title = await resolveSheetTitle(sheetsApi, CODEX_SPREADSHEET_ID, tab.sheetId);
    const escapedTitle = escapeSheetTitle(title);
    const valuesRes = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: CODEX_SPREADSHEET_ID,
      range: `'${escapedTitle}'!A:ZZ`,
      majorDimension: "ROWS",
    });
    const rows = valuesRes.data.values || [];
    const hr = findHeaderRow(rows);
    if (hr < 0) continue;
    const headers = rows[hr] || [];
    const idx = new Map(headers.map((h, i) => [norm(h), i]));
    for (let r = hr + 1; r < rows.length; r += 1) {
      const row = rows[r] || [];
      const get = (k) => String(row[idx.get(norm(k))] ?? "").trim();
      const game = get("Game");
      if (!game || norm(game) === "game") continue;
      const manufacturer = get("Manufacturer");
      const year = get("Year");
      if (!manufacturer || !year) continue;
      out.push({
        sourceCsv: `CodexTab:${title}`,
        game,
        variant: get("Variant"),
        manufacturer,
        manufacturerKey: normalizeManufacturer(manufacturer),
        year,
        pinside_id: get("pinside_id"),
        pinside_slug: get("pinside_slug"),
        pinside_group: get("pinside_group"),
        practice_identity: get("practice_identity"),
        links: {
          playfield: get("Playfield Image"),
          rulesheet: get("Rulesheet"),
          tutorial1: get("Tutorial 1"),
          tutorial2: get("Tutorial 2"),
          tutorial3: get("Tutorial 3"),
          tutorial4: get("Tutorial 4"),
          gameplay1: get("Gameplay 1"),
          gameplay2: get("Gameplay 2"),
          gameplay3: get("Gameplay 3"),
          gameplay4: get("Gameplay 4"),
          competition1: get("Competition 1"),
          competition2: get("Competition 2"),
          competition3: get("Competition 3"),
          competition4: get("Competition 4"),
        },
      });
    }
  }
  return out;
}

function rowIsCompletelyBlank(row) {
  return !(row || []).some((v) => String(v ?? "").trim());
}

function fillIfBlank(row, idx, value) {
  if (idx == null || idx < 0) return false;
  const cur = String(row[idx] ?? "").trim();
  if (cur) return false;
  row[idx] = String(value ?? "");
  return true;
}

function setValue(row, idx, value) {
  if (idx == null || idx < 0) return false;
  const next = String(value ?? "");
  const cur = String(row[idx] ?? "");
  if (cur === next) return false;
  row[idx] = next;
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const csvSourceRows = await loadSourceRows();
  const pinsideGroupMap = await loadPinsideGroupMap(args.pinsideGroupMapPath);

  const auth = new google.auth.GoogleAuth({
    keyFile: args.credentialsPath,
    scopes: REQUIRED_SCOPES,
  });
  const sheetsApi = google.sheets({ version: "v4", auth });
  const codexVenueSourceRows = await loadCodexVenueSourceRows(sheetsApi);
  const sourceRows = [...csvSourceRows, ...codexVenueSourceRows];

  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId: CODEX_SPREADSHEET_ID,
    fields: "sheets(properties(sheetId,title,index))",
  });
  const codexTabs = (meta.data.sheets || [])
    .map((s) => s.properties)
    .filter(Boolean)
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .filter((p) => MANUFACTURER_TAB_TITLES.includes(p.title))
    .filter((p) => (args.tabs ? args.tabs.has(p.title) : true));

  for (const tab of codexTabs) {
    const title = await resolveSheetTitle(sheetsApi, CODEX_SPREADSHEET_ID, tab.sheetId);
    const escapedTitle = escapeSheetTitle(title);
    const valuesRes = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: CODEX_SPREADSHEET_ID,
      range: `'${escapedTitle}'!A:ZZ`,
      majorDimension: "ROWS",
    });
    const rows = toCsvLikeRows(valuesRes.data.values || []);
    const hr = findHeaderRow(rows);
    if (hr < 0) {
      console.log(`${title}: skipped (no header row)`); // formatting should have added one
      continue;
    }
    const headers = rows[hr] || [];
    const idx = headerIndexMap(headers);
    const getIdx = (name) => idx.get(norm(name));

    let changedRows = 0;
    let matchedRows = 0;
    let unresolvedRows = 0;
    let directMapFilledGroup = 0;
    let directMapFilledPractice = 0;

    for (let r = hr + 1; r < rows.length; r += 1) {
      const row = rows[r] || [];
      if (rowIsCompletelyBlank(row)) continue;
      const game = String(row[getIdx("Game")] ?? "").trim();
      const manufacturer = String(row[getIdx("Manufacturer")] ?? "").trim();
      const year = String(row[getIdx("Year")] ?? "").trim();
      if (!game || !manufacturer || !year) continue;

      let changed = false;
      let pinsideIdCur = String(row[getIdx("pinside_id")] ?? "").trim();
      let pinsideSlugCur = String(row[getIdx("pinside_slug")] ?? "").trim();
      let pinsideGroupCur = String(row[getIdx("pinside_group")] ?? "").trim();
      let practiceCur = String(row[getIdx("practice_identity")] ?? "").trim();

      if (pinsideSlugCur && !pinsideGroupCur) {
        const mapped = String(pinsideGroupMap[pinsideSlugCur] ?? "").trim();
        if (mapped) {
          changed = setValue(row, getIdx("pinside_group"), mapped) || changed;
          pinsideGroupCur = mapped;
          directMapFilledGroup += 1;
        }
      }

      if (!practiceCur) {
        const derivedPractice = computePracticeIdentityFromResolved({
          manufacturer,
          year,
          pinside_group: pinsideGroupCur,
          pinside_slug: pinsideSlugCur,
        });
        if (derivedPractice) {
          changed = setValue(row, getIdx("practice_identity"), derivedPractice) || changed;
          practiceCur = derivedPractice;
          directMapFilledPractice += 1;
        }
      }

      const needsLookup = !pinsideIdCur || !pinsideSlugCur || !pinsideGroupCur || !practiceCur;
      if (!needsLookup) {
        if (changed) changedRows += 1;
        continue;
      }

      const target = { game, manufacturer, year };
      const best = chooseBestCandidate(target, sourceRows);
      if (!best) {
        if (changed) changedRows += 1;
        unresolvedRows += 1;
        continue;
      }
      matchedRows += 1;
      const s = best.row;

      changed = setValue(row, getIdx("pinside_id"), s.pinside_id) || changed;
      changed = setValue(row, getIdx("pinside_slug"), s.pinside_slug) || changed;
      changed = setValue(row, getIdx("pinside_group"), s.pinside_group) || changed;

      const practiceIdentity =
        s.practice_identity ||
        computePracticeIdentityFromResolved({
          manufacturer: s.manufacturer || manufacturer,
          year: s.year || year,
          pinside_group: s.pinside_group,
          pinside_slug: s.pinside_slug,
        });
      changed = setValue(row, getIdx("practice_identity"), practiceIdentity) || changed;

      // Jumpstart links from venue/library rows only when blank on manufacturer tabs.
      changed = fillIfBlank(row, getIdx("Playfield Image"), s.links.playfield) || changed;
      changed = fillIfBlank(row, getIdx("Rulesheet"), s.links.rulesheet) || changed;
      changed = fillIfBlank(row, getIdx("Tutorial 1"), s.links.tutorial1) || changed;
      changed = fillIfBlank(row, getIdx("Tutorial 2"), s.links.tutorial2) || changed;
      changed = fillIfBlank(row, getIdx("Tutorial 3"), s.links.tutorial3) || changed;
      changed = fillIfBlank(row, getIdx("Tutorial 4"), s.links.tutorial4) || changed;
      changed = fillIfBlank(row, getIdx("Gameplay 1"), s.links.gameplay1) || changed;
      changed = fillIfBlank(row, getIdx("Gameplay 2"), s.links.gameplay2) || changed;
      changed = fillIfBlank(row, getIdx("Gameplay 3"), s.links.gameplay3) || changed;
      changed = fillIfBlank(row, getIdx("Gameplay 4"), s.links.gameplay4) || changed;
      changed = fillIfBlank(row, getIdx("Competition 1"), s.links.competition1) || changed;
      changed = fillIfBlank(row, getIdx("Competition 2"), s.links.competition2) || changed;
      changed = fillIfBlank(row, getIdx("Competition 3"), s.links.competition3) || changed;
      changed = fillIfBlank(row, getIdx("Competition 4"), s.links.competition4) || changed;

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
      `${args.write ? "Updated" : "Prepared"} ${title} | sources=${sourceRows.length} matched=${matchedRows} changed=${changedRows} unresolved=${unresolvedRows} direct_group=${directMapFilledGroup} direct_practice=${directMapFilledPractice}`
    );
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
