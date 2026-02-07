import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARED_PINBALL = path.join(ROOT, "shared", "pinball");
const DATA_DIR = path.join(SHARED_PINBALL, "data");
const PLAYFIELDS_DIR = path.join(SHARED_PINBALL, "images", "playfields");
const RULESHEETS_DIR = path.join(SHARED_PINBALL, "rulesheets");
const GAMEINFO_DIR = path.join(SHARED_PINBALL, "gameinfo");

const STANDINGS_CSV = path.join(DATA_DIR, "LPL_Standings.csv");
const STATS_CSV = path.join(DATA_DIR, "LPL_Stats.csv");
const LIBRARY_JSON = path.join(DATA_DIR, "pinball_library.json");

const REQUIRED_STANDINGS_HEADERS = [
  "season",
  "player",
  "total",
  "rank",
  "eligible",
  "nights",
  "bank_1",
  "bank_2",
  "bank_3",
  "bank_4",
  "bank_5",
  "bank_6",
  "bank_7",
  "bank_8",
];

const REQUIRED_STATS_HEADERS = [
  "Season",
  "BankNumber",
  "Bank",
  "Player",
  "Machine",
  "RawScore",
  "Points",
];

const errors = [];
const warnings = [];

function error(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  const body = rows.slice(1).filter((r) => r.some((c) => String(c).trim().length > 0));
  const records = body.map((r) => {
    const out = {};
    for (let i = 0; i < headers.length; i += 1) {
      out[headers[i]] = r[i] ?? "";
    }
    return out;
  });
  return { headers, records };
}

function normalizeLooseName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function hasNearDuplicateNames(values) {
  const map = new Map();
  for (const value of values) {
    const raw = String(value ?? "").trim();
    if (!raw) continue;
    const key = normalizeLooseName(raw);
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(raw);
  }
  return [...map.entries()]
    .map(([_, names]) => [...names])
    .filter((names) => names.length > 1);
}

function toFsPathFromWebPath(webPath) {
  const normalized = String(webPath ?? "").trim();
  if (!normalized.startsWith("/pinball/")) return null;
  return path.join(SHARED_PINBALL, normalized.replace(/^\/pinball\//, ""));
}

async function validateRequiredFiles() {
  for (const file of [STANDINGS_CSV, STATS_CSV, LIBRARY_JSON]) {
    if (!(await pathExists(file))) {
      error(`Missing required file: ${path.relative(ROOT, file)}`);
    }
  }
}

async function validateStandingsCsv() {
  const raw = await fs.readFile(STANDINGS_CSV, "utf8");
  const { headers, records } = parseCsv(raw);

  for (const header of REQUIRED_STANDINGS_HEADERS) {
    if (!headers.includes(header)) {
      error(`LPL_Standings.csv missing required column: ${header}`);
    }
  }

  if (!records.length) {
    error("LPL_Standings.csv has no data rows.");
    return;
  }

  for (const [idx, row] of records.entries()) {
    const season = String(row.season ?? "").trim();
    if (!season) {
      error(`LPL_Standings.csv row ${idx + 2} has empty season.`);
    }
    const player = String(row.player ?? "").trim();
    if (!player) {
      error(`LPL_Standings.csv row ${idx + 2} has empty player.`);
    }
  }

  const duplicatePlayerVariants = hasNearDuplicateNames(records.map((r) => r.player));
  for (const names of duplicatePlayerVariants) {
    warn(`Standings has possible player naming variants: ${names.join(" | ")}`);
  }
}

async function validateStatsCsv() {
  const raw = await fs.readFile(STATS_CSV, "utf8");
  const { headers, records } = parseCsv(raw);

  for (const header of REQUIRED_STATS_HEADERS) {
    if (!headers.includes(header)) {
      error(`LPL_Stats.csv missing required column: ${header}`);
    }
  }

  if (!records.length) {
    error("LPL_Stats.csv has no data rows.");
    return;
  }

  for (const [idx, row] of records.entries()) {
    const season = String(row.Season ?? "").trim();
    const player = String(row.Player ?? "").trim();
    const machine = String(row.Machine ?? "").trim();
    const bankNumber = Number(String(row.BankNumber ?? "").trim() || Number.NaN);
    if (!season) error(`LPL_Stats.csv row ${idx + 2} has empty Season.`);
    if (!player) error(`LPL_Stats.csv row ${idx + 2} has empty Player.`);
    if (!machine) error(`LPL_Stats.csv row ${idx + 2} has empty Machine.`);
    if (!Number.isFinite(bankNumber) || bankNumber <= 0) {
      warn(`LPL_Stats.csv row ${idx + 2} has non-positive/invalid BankNumber: "${row.BankNumber}"`);
    }
  }

  const duplicatePlayerVariants = hasNearDuplicateNames(records.map((r) => r.Player));
  for (const names of duplicatePlayerVariants) {
    warn(`Stats has possible player naming variants: ${names.join(" | ")}`);
  }

  const duplicateMachineVariants = hasNearDuplicateNames(records.map((r) => r.Machine));
  for (const names of duplicateMachineVariants) {
    warn(`Stats has possible machine naming variants: ${names.join(" | ")}`);
  }
}

async function validateLibraryJson() {
  const raw = await fs.readFile(LIBRARY_JSON, "utf8");
  let items;
  try {
    items = JSON.parse(raw);
  } catch (e) {
    error(`pinball_library.json is invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  if (!Array.isArray(items)) {
    error("pinball_library.json should be an array.");
    return;
  }

  const slugSet = new Set();

  for (const [index, item] of items.entries()) {
    const row = index + 1;
    const slug = String(item?.slug ?? "").trim();
    if (!slug) {
      error(`pinball_library.json item ${row} missing slug.`);
      continue;
    }
    if (slugSet.has(slug)) {
      error(`pinball_library.json duplicate slug: ${slug}`);
      continue;
    }
    slugSet.add(slug);

    const rulesheetLocal = String(item?.rulesheetLocal ?? "").trim();
    if (!rulesheetLocal) {
      error(`pinball_library.json item ${row} (${slug}) missing rulesheetLocal.`);
    } else {
      const p = toFsPathFromWebPath(rulesheetLocal);
      if (!p || !(await pathExists(p))) {
        error(`Missing rulesheet for slug "${slug}": ${rulesheetLocal}`);
      }
    }

    const playfieldLocal = String(item?.playfieldLocal ?? "").trim();
    if (!playfieldLocal) {
      warn(`pinball_library.json item ${row} (${slug}) missing playfieldLocal.`);
    } else {
      const p = toFsPathFromWebPath(playfieldLocal);
      if (!p || !(await pathExists(p))) {
        error(`Missing playfield for slug "${slug}": ${playfieldLocal}`);
      }
    }

    const webp700 = path.join(PLAYFIELDS_DIR, `${slug}_700.webp`);
    const webp1400 = path.join(PLAYFIELDS_DIR, `${slug}_1400.webp`);
    if (!(await pathExists(webp700))) warn(`Missing 700 webp for slug "${slug}"`);
    if (!(await pathExists(webp1400))) warn(`Missing 1400 webp for slug "${slug}"`);

    const gameinfoPath = path.join(GAMEINFO_DIR, `${slug}.md`);
    if (!(await pathExists(gameinfoPath))) {
      warn(`Missing gameinfo markdown for slug "${slug}": /pinball/gameinfo/${slug}.md`);
    }
  }
}

async function validateSharedDirs() {
  for (const dir of [DATA_DIR, PLAYFIELDS_DIR, RULESHEETS_DIR, GAMEINFO_DIR]) {
    if (!(await pathExists(dir))) {
      error(`Missing required directory: ${path.relative(ROOT, dir)}`);
    }
  }
}

async function main() {
  await validateSharedDirs();
  await validateRequiredFiles();
  if (errors.length) {
    report();
    process.exit(1);
  }

  await validateStandingsCsv();
  await validateStatsCsv();
  await validateLibraryJson();
  report();
  process.exit(errors.length ? 1 : 0);
}

function report() {
  console.log("Pinball data sanity check");
  console.log(`Root: ${ROOT}`);
  console.log("");

  if (errors.length) {
    console.log(`Errors (${errors.length})`);
    for (const item of errors) console.log(`- ${item}`);
    console.log("");
  } else {
    console.log("Errors (0)");
    console.log("");
  }

  if (warnings.length) {
    console.log(`Warnings (${warnings.length})`);
    for (const item of warnings) console.log(`- ${item}`);
    console.log("");
  } else {
    console.log("Warnings (0)");
    console.log("");
  }

  if (!errors.length) {
    console.log("Result: PASS");
  } else {
    console.log("Result: FAIL");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});
