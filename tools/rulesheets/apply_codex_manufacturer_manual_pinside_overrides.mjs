import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import fs from "node:fs/promises";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(THIS_DIR, "../..");
const DATA_DIR = path.join(ROOT, "shared", "pinball", "data");
const DEFAULT_CREDENTIALS_FALLBACK = path.resolve(
  THIS_DIR,
  "../../../Pinball Scraper/.secrets/google-service-account.json"
);
const CODEX_SPREADSHEET_ID = "1ZzHHFvIsfIZv5ghd4vDXi7G99ILhbgPHk3Lg6SbJFMQ";
const REQUIRED_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const PINSIDE_GROUP_NONE_MARKER = "~";
const GROUP_MAP_PATH = path.join(DATA_DIR, "pinside_group_map.json");
const PWCLI = path.join(
  process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex"),
  "skills",
  "playwright",
  "scripts",
  "playwright_cli.sh"
);

const OVERRIDES = [
  ["Modern Sterns", "The Walking Dead Remastered", "Stern", "2025", "walking-dead-remastered-premium"],
  ["Modern Sterns", "James Bond 007 60th Anniversary", "Stern", "2023", "stern-james-bond-007-60th-le"],
  ["Modern Sterns", "Heavy Metal", "Stern", "2020", "heavy-metal"],
  ["Modern Sterns", "Primus", "Stern", "2018", "primus"],
  ["Modern Sterns", "Supreme", "Stern", "2018", "supreme"],
  ["Modern Sterns", "Whoa Nellie: Big Juicy Melons", "Stern", "2015", "whoa-nellie-big-juicy-melons-stern"],
  ["Modern Sterns", "WWE: Wrestlemania", "Stern", "2015", "wrestlemania-le"],
  ["Modern Sterns", "The Avengers", "Stern", "2012", "avengers-le"],
  ["Modern Sterns", "The Rolling Stones", "Stern", "2011", "stern-the-rolling-stones-le"],
  ["Modern Sterns", "Transformers", "Stern", "2011", "transformers-le"],
  ["Modern Sterns", "Grand Prix", "Stern", "2005", "grand-prix"],
  ["Modern Sterns", "The Sopranos", "Stern", "2005", "sopranos"],
  ["Spooky", "Looney Tunes", "Spooky", "2024", "looney-tunes-blood-sucker-edition"],
  ["Spooky", "The Texas Chainsaw Massacre", "Spooky", "2024", "texas-chainsaw-massacre-blood-sucker-edition"],
  ["Spooky", "The Jetsons", "Spooky", "2017", "the-jetsons"],
  ["Pinball Brothers", "Queen", "Pinball Brothers", "2022", "queen-limited-rhapsody-edition"],
];

const REMOVALS = [["Multimorphic", "Hoopin' It Up", "Multimorphic", "2019"]];

function parseArgs(argv) {
  const out = {
    credentialsPath:
      process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_CREDENTIALS_FALLBACK,
    headed: true,
    write: true,
    delayMs: 750,
    updateGroupMap: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === "--credentials" && argv[i + 1]) out.credentialsPath = path.resolve(argv[i + 1]);
    if (t === "--headless") out.headed = false;
    if (t === "--headed") out.headed = true;
    if (t === "--dry-run" || t === "--no-write") out.write = false;
    if (t === "--delay-ms" && argv[i + 1]) out.delayMs = Math.max(0, Number(argv[i + 1]) || out.delayMs);
    if (t === "--no-group-map") out.updateGroupMap = false;
  }
  return out;
}

function runPw(session, args) {
  return execFileSync(PWCLI, ["--session", session, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CODEX_HOME: process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex") },
    maxBuffer: 1024 * 1024 * 12,
  });
}

function parsePwResult(output) {
  const lines = output.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.trim() === "### Result");
  if (idx < 0 || idx + 1 >= lines.length) return null;
  const raw = lines[idx + 1].trim();
  if (!raw) return "";
  try {
    return JSON.parse(raw);
  } catch {
    return raw.replace(/^"|"$/g, "");
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, Math.max(0, ms)));
}

function norm(v) {
  return String(v ?? "").trim().toLowerCase();
}

function normLoose(v) {
  return norm(v).replace(/&/g, "and").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(v) {
  return new Set(normLoose(v).split(" ").filter(Boolean));
}

function tokenOverlap(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  let c = 0;
  for (const t of A) if (B.has(t)) c += 1;
  return c;
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

function computePracticeIdentity({ manufacturer, year, pinside_group, pinside_slug }) {
  const manufacturerSlug = slugifyKey(manufacturer);
  const g = String(pinside_group || "").trim();
  const family = g && g !== PINSIDE_GROUP_NONE_MARKER ? g : String(pinside_slug || "").trim();
  const familySlug = slugifyKey(family);
  const y = String(year || "").trim();
  if (!manufacturerSlug || !familySlug || !y) return "";
  return `${manufacturerSlug}--${familySlug}--${y}`;
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
    if (k && !m.has(k)) m.set(k, i);
  });
  return m;
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

function parseMachineTitle(title) {
  const t = String(title ?? "").trim();
  const m = t.match(/^(.*?)\s+Pinball Machine\s+\((.*?),\s*(\d{4})\)\s+\|\s+Pinside Game Archive$/i);
  if (!m) {
    return { rawTitle: t, machineLabel: "", gameLabel: "", manufacturerLabel: "", year: "" };
  }
  const machineLabel = m[1].trim();
  const manufacturerLabel = m[2].trim();
  const year = m[3].trim();
  const vm = machineLabel.match(/^(.*?)(?:\s+\(([^()]*)\))?$/);
  return {
    rawTitle: t,
    machineLabel,
    gameLabel: vm?.[1]?.trim() || machineLabel,
    variantLabel: vm?.[2]?.trim() || "",
    manufacturerLabel,
    year,
  };
}

function extractSlugFromUrl(url) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/pinball\/machine\/([^/?#]+)$/);
    return m?.[1] || "";
  } catch {
    return "";
  }
}

async function openMachineAndExtract(slug, headed, delayMs) {
  const session = `manual-override-${slug.slice(0, 20)}`;
  try {
    runPw(session, ["close"]);
  } catch {}
  const openArgs = ["open", `https://pinside.com/pinball/machine/${slug}`];
  if (headed) openArgs.push("--headed");
  runPw(session, openArgs);
  await sleep(500);

  const expr = {
    href: "location.href",
    title: "document.title",
    group: "((document.body.innerText.match(/This title is part of group:\\s*[\\\"“]?([^\\\"”\\n]+)[\\\"”]?/)||[])[1] || '').trim()",
    pinsideId: "((document.body.innerText.match(/Pinside\\s*ID\\s*:?\\s*(\\d{2,6})/)||[])[1] || '').trim()",
  };

  const href = String(parsePwResult(runPw(session, ["eval", expr.href])) ?? "");
  const title = String(parsePwResult(runPw(session, ["eval", expr.title])) ?? "");
  const group = String(parsePwResult(runPw(session, ["eval", expr.group])) ?? "").trim();
  const pinsideId = String(parsePwResult(runPw(session, ["eval", expr.pinsideId])) ?? "").trim();
  const actualSlug = extractSlugFromUrl(href);
  const parsedTitle = parseMachineTitle(title);
  const blocked = norm(title).includes("just a moment");
  try {
    runPw(session, ["close"]);
  } catch {}
  await sleep(delayMs);
  return { href, title, group, pinsideId, actualSlug, parsedTitle, blocked };
}

async function loadSheetTab(sheetsApi, tabTitle) {
  const escaped = String(tabTitle).replace(/'/g, "''");
  const res = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: CODEX_SPREADSHEET_ID,
    range: `'${escaped}'!A:ZZ`,
    majorDimension: "ROWS",
  });
  const rows = (res.data.values || []).map((r) => r.map((v) => String(v ?? "")));
  const hr = findHeaderRow(rows);
  if (hr < 0) throw new Error(`${tabTitle}: header row not found`);
  const headers = rows[hr] || [];
  const idx = headerIndexMap(headers);
  return { tabTitle, escapedTitle: escaped, rows, headerRowIndex: hr, headers, idx };
}

function findExactGameRow(sheet, game, manufacturer, year) {
  const gi = sheet.idx.get("game");
  const mi = sheet.idx.get("manufacturer");
  const yi = sheet.idx.get("year");
  const matches = [];
  for (let r = sheet.headerRowIndex + 1; r < sheet.rows.length; r += 1) {
    const row = sheet.rows[r] || [];
    if (!getCell(row, gi)) continue;
    if (getCell(row, gi) !== game) continue;
    if (manufacturer && getCell(row, mi) !== manufacturer) continue;
    if (year && getCell(row, yi) !== year) continue;
    matches.push(r);
  }
  if (matches.length !== 1) {
    throw new Error(`${sheet.tabTitle}: expected 1 row for ${game} (${manufacturer} ${year}), found ${matches.length}`);
  }
  return matches[0];
}

async function loadGroupMap() {
  try {
    const parsed = JSON.parse(await fs.readFile(GROUP_MAP_PATH, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function saveGroupMap(map) {
  await fs.writeFile(GROUP_MAP_PATH, `${JSON.stringify(map, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const auth = new google.auth.GoogleAuth({
    keyFile: args.credentialsPath,
    scopes: REQUIRED_SCOPES,
  });
  const sheetsApi = google.sheets({ version: "v4", auth });

  const tabTitles = [...new Set([...OVERRIDES.map((x) => x[0]), ...REMOVALS.map((x) => x[0])])];
  const sheets = new Map();
  for (const tabTitle of tabTitles) sheets.set(tabTitle, await loadSheetTab(sheetsApi, tabTitle));

  const groupMap = args.updateGroupMap ? await loadGroupMap() : null;

  let checked = 0;
  let updatedRows = 0;
  const verification = [];
  const warnings = [];

  for (const [tabTitle, game, manufacturer, year, slug] of OVERRIDES) {
    const sheet = sheets.get(tabTitle);
    const rowIndex = findExactGameRow(sheet, game, manufacturer, year);
    const page = await openMachineAndExtract(slug, args.headed, args.delayMs);
    checked += 1;

    if (page.blocked) throw new Error(`Cloudflare blocked while checking ${slug}`);
    if (!page.actualSlug) throw new Error(`${slug}: did not land on machine page (${page.href})`);
    if (page.actualSlug !== slug) throw new Error(`${slug}: redirected to different slug ${page.actualSlug}`);
    if (!page.pinsideId) throw new Error(`${slug}: missing Pinside ID on page`);

    const titleGame = String(page.parsedTitle.gameLabel || page.parsedTitle.machineLabel || "").trim();
    const titleManufacturer = String(page.parsedTitle.manufacturerLabel || "").trim();
    const titleYear = String(page.parsedTitle.year || "").trim();
    const gameLooksRight =
      norm(titleGame).includes(norm(game)) ||
      norm(game).includes(norm(titleGame)) ||
      tokenOverlap(titleGame, game) >= 2;
    const manuLooksRight = !manufacturer || norm(titleManufacturer).includes(norm(manufacturer)) || norm(manufacturer).includes(norm(titleManufacturer));
    const yearLooksRight = !year || titleYear === year;
    if (!gameLooksRight || !manuLooksRight) {
      throw new Error(
        `${slug}: page mismatch for ${game} (${manufacturer} ${year}) -> title=${page.title}`
      );
    }
    if (!yearLooksRight) {
      warnings.push(
        `${tabTitle} r${rowIndex + 1} ${game}: sheet year=${year} vs Pinside year=${titleYear} (${slug})`
      );
    }

    const row = sheet.rows[rowIndex];
    let changed = false;
    changed = setCell(row, sheet.idx.get("pinside_slug"), slug) || changed;
    changed = setCell(row, sheet.idx.get("pinside_id"), page.pinsideId) || changed;
    changed = setCell(row, sheet.idx.get("pinside_group"), page.group || PINSIDE_GROUP_NONE_MARKER) || changed;
    changed =
      setCell(
        row,
        sheet.idx.get("practice_identity"),
        computePracticeIdentity({
          manufacturer,
          year,
          pinside_group: page.group || PINSIDE_GROUP_NONE_MARKER,
          pinside_slug: slug,
        })
      ) || changed;
    if (changed) updatedRows += 1;

    if (groupMap) groupMap[slug] = page.group || PINSIDE_GROUP_NONE_MARKER;
    verification.push({
      tab: tabTitle,
      row: rowIndex + 1,
      game,
      slug,
      pinside_id: page.pinsideId,
      pinside_group: page.group || PINSIDE_GROUP_NONE_MARKER,
      page_title: page.title,
    });
  }

  for (const [tabTitle, game, manufacturer, year] of REMOVALS) {
    const sheet = sheets.get(tabTitle);
    const rowIndex = findExactGameRow(sheet, game, manufacturer, year);
    sheet.rows.splice(rowIndex, 1);
    updatedRows += 1;
    console.log(`REMOVE ${tabTitle} r${rowIndex + 1} ${game} (${manufacturer} ${year})`);
  }

  if (args.write) {
    for (const sheet of sheets.values()) {
      const usedRows = sheet.rows.length;
      const usedCols = (sheet.headers || []).length;
      const endCol = toA1Column(Math.max(usedCols - 1, 0));
      const endRow = Math.max(usedRows, 1);
      await sheetsApi.spreadsheets.values.clear({
        spreadsheetId: CODEX_SPREADSHEET_ID,
        range: `'${sheet.escapedTitle}'!A:ZZ`,
      });
      await sheetsApi.spreadsheets.values.update({
        spreadsheetId: CODEX_SPREADSHEET_ID,
        range: `'${sheet.escapedTitle}'!A1:${endCol}${endRow}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: sheet.rows },
      });
    }
    if (groupMap) await saveGroupMap(groupMap);
  }

  console.log(`Checked direct Pinside pages: ${checked}`);
  console.log(`Rows updated/removed: ${updatedRows}`);
  if (warnings.length) {
    console.log(`Warnings (${warnings.length}):`);
    for (const w of warnings) console.log(`WARN ${w}`);
  }
  for (const v of verification) {
    console.log(
      `OK ${v.tab} r${v.row} ${v.game} -> slug=${v.slug} id=${v.pinside_id} group=${v.pinside_group}`
    );
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
