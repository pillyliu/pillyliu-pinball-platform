import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
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
const PINSIDE_GROUP_NONE_MARKER = "~";

const PWCLI = path.join(
  process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex"),
  "skills",
  "playwright",
  "scripts",
  "playwright_cli.sh"
);
const SESSION_SEARCH = "codex-mfg-resolve-search";
const SESSION_MACHINE = "codex-mfg-resolve-machine";

function parseArgs(argv) {
  const out = {
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_CREDENTIALS_FALLBACK,
    headed: true,
    write: true,
    limit: null,
    delayMs: 750,
    tabs: null,
    onlyRows: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === "--credentials" && argv[i + 1]) out.credentialsPath = path.resolve(argv[i + 1]);
    if (t === "--headless") out.headed = false;
    if (t === "--headed") out.headed = true;
    if (t === "--dry-run" || t === "--no-write") out.write = false;
    if (t === "--limit" && argv[i + 1]) out.limit = Math.max(1, Number(argv[i + 1]) || 0);
    if (t === "--delay-ms" && argv[i + 1]) out.delayMs = Math.max(0, Number(argv[i + 1]) || out.delayMs);
    if (t === "--tabs" && argv[i + 1]) {
      out.tabs = new Set(argv[i + 1].split(",").map((v) => v.trim()).filter(Boolean));
    }
    if (t === "--only-rows" && argv[i + 1]) {
      out.onlyRows = new Set(argv[i + 1].split(",").map((v) => v.trim()).filter(Boolean));
    }
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

function overlap(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  let c = 0;
  for (const t of A) if (B.has(t)) c += 1;
  return c;
}

function jaccard(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  if (!A.size || !B.size) return 0;
  let i = 0;
  for (const t of A) if (B.has(t)) i += 1;
  return i / new Set([...A, ...B]).size;
}

function normalizeManufacturer(v) {
  let s = normLoose(v);
  if (s === "jjp") return "jersey jack pinball";
  if (s === "cgc") return "chicago gaming";
  if (s === "pb") return "pinball brothers";
  s = s.replace(/\bllc\b/g, "").replace(/\bpinball inc\b/g, "").replace(/\binc\b/g, "").trim();
  s = s.replace(/\bcompany\b/g, "").replace(/\bco\b/g, "").trim();
  if (s === "stern pinball") return "stern";
  if (s === "chicago gaming company") return "chicago gaming";
  if (s === "spooky pinball") return "spooky";
  return s;
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
  const m = slugifyKey(manufacturer);
  const g = String(pinside_group || "").trim();
  const s = String(pinside_slug || "").trim();
  const family = g && g !== PINSIDE_GROUP_NONE_MARKER ? g : s;
  const f = slugifyKey(family);
  const y = String(year || "").trim();
  if (!m || !f || !y) return "";
  return `${m}--${f}--${y}`;
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
  if (!m) return { rawTitle: t, machineLabel: "", gameLabel: "", variantLabel: "", manufacturerLabel: "", year: "" };
  const machineLabel = m[1].trim();
  const manufacturerLabel = m[2].trim();
  const year = m[3].trim();
  const vm = machineLabel.match(/^(.*?)(?:\s+\(([^()]*)\))?$/);
  const gameLabel = vm?.[1]?.trim() || machineLabel;
  const variantLabel = vm?.[2]?.trim() || "";
  return { rawTitle: t, machineLabel, gameLabel, variantLabel, manufacturerLabel, year };
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

function isSearchUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname === "/pinball/machine/" && u.searchParams.has("query");
  } catch {
    return false;
  }
}

function exprs() {
  return {
    title: "document.title",
    href: "location.href",
    group: "((document.body.innerText.match(/This title is part of group:\\s*[\\\"“]?([^\\\"”\\n]+)[\\\"”]?/)||[])[1] || '').trim()",
    pinsideId: "((document.body.innerText.match(/Pinside\\s*ID\\s*:?\\s*(\\d{2,6})/)||[])[1] || '').trim()",
  };
}

function searchCandidatesExpression() {
  return `JSON.stringify(
    [...document.querySelectorAll('a[href*="/pinball/machine/"]')]
      .map(a => ({ href: a.getAttribute('href') || '', text: (a.textContent||'').trim() }))
      .filter(x => x.href && !/\\/machine\\/?query=/.test(x.href))
      .slice(0, 100)
  )`;
}

async function openMachineAndExtract(slug, headed) {
  try {
    runPw(SESSION_MACHINE, ["close"]);
  } catch {}
  const openArgs = ["open", `https://pinside.com/pinball/machine/${slug}`];
  if (headed) openArgs.push("--headed");
  runPw(SESSION_MACHINE, openArgs);
  await sleep(500);
  const e = exprs();
  const title = String(parsePwResult(runPw(SESSION_MACHINE, ["eval", e.title])) ?? "");
  const href = String(parsePwResult(runPw(SESSION_MACHINE, ["eval", e.href])) ?? "");
  const group = String(parsePwResult(runPw(SESSION_MACHINE, ["eval", e.group])) ?? "").trim();
  const pinsideId = String(parsePwResult(runPw(SESSION_MACHINE, ["eval", e.pinsideId])) ?? "").trim();
  const actualSlug = extractSlugFromUrl(href);
  const blocked = title.toLowerCase().includes("just a moment");
  const validMachine = !blocked && href && !isSearchUrl(href) && actualSlug && pinsideId;
  return { title, href, group, pinsideId, actualSlug, blocked, validMachine, parsedTitle: parseMachineTitle(title) };
}

async function openSearchCandidates(query, headed) {
  const url = `https://pinside.com/pinball/machine/?query=${encodeURIComponent(query)}`;
  const openArgs = ["open", url];
  if (headed) openArgs.push("--headed");
  runPw(SESSION_SEARCH, openArgs);
  await sleep(1200);
  const title = String(parsePwResult(runPw(SESSION_SEARCH, ["eval", "document.title"])) ?? "");
  const href = String(parsePwResult(runPw(SESSION_SEARCH, ["eval", "location.href"])) ?? "");
  if (title.toLowerCase().includes("just a moment")) {
    return { title, href, blocked: true, candidates: [] };
  }
  let candidates = [];
  try {
    const raw = String(parsePwResult(runPw(SESSION_SEARCH, ["eval", searchCandidatesExpression()])) ?? "[]");
    candidates = JSON.parse(raw).filter((c) => c && c.href);
  } catch {
    candidates = [];
  }
  if (!candidates.length) {
    try {
      const html = String(parsePwResult(runPw(SESSION_SEARCH, ["eval", "document.documentElement.outerHTML"])) ?? "");
      const seen = new Set();
      const re = /href=\"([^\"]*\/pinball\/machine\/[^\"?#]+)\"/g;
      let m;
      while ((m = re.exec(html))) {
        let href = m[1];
        if (!href || href.includes("?query=") || href === "/pinball/machine/random") continue;
        href = href.replace(/&amp;/g, "&");
        if (!href.startsWith("/")) {
          try {
            href = new URL(href).pathname;
          } catch {
            continue;
          }
        }
        if (seen.has(href)) continue;
        seen.add(href);
        candidates.push({ href, text: href });
      }
    } catch {
      // ignore fallback parse errors
    }
  }
  return { title, href, blocked: false, candidates };
}

function yearMatches(a, b) {
  const x = String(a ?? "").trim();
  const y = String(b ?? "").trim();
  return Boolean(x && y && x === y);
}

function manufacturerMatches(a, b) {
  const x = normalizeManufacturer(a);
  const y = normalizeManufacturer(b);
  return Boolean(x && y && x === y);
}

function gameScore(rowGame, pageGame) {
  let s = 0;
  const sim = jaccard(rowGame, pageGame);
  s += sim * 4;
  const rg = normLoose(rowGame);
  const pg = normLoose(pageGame);
  if (rg && pg && (pg.includes(rg) || rg.includes(pg))) s += 2;
  return s;
}

function scoreMachineCandidate(row, info) {
  if (!info?.validMachine) return { score: -999, reasons: ["invalid-machine"] };
  const reasons = [];
  let score = 0;
  if (manufacturerMatches(row.manufacturer, info.parsedTitle?.manufacturerLabel)) {
    score += 5;
    reasons.push("manufacturer");
  } else {
    score -= 2;
    reasons.push("manufacturer-mismatch");
  }
  if (yearMatches(row.year, info.parsedTitle?.year)) {
    score += 5;
    reasons.push("year");
  } else {
    score -= 2;
    reasons.push("year-mismatch");
  }
  const gs = gameScore(row.game, info.parsedTitle?.gameLabel || info.parsedTitle?.machineLabel || "");
  score += gs;
  reasons.push(`game=${gs.toFixed(2)}`);
  return { score, reasons };
}

function isStrongMachineMatch(row, info) {
  if (!info?.validMachine) return false;
  if (!manufacturerMatches(row.manufacturer, info.parsedTitle?.manufacturerLabel)) return false;
  if (!yearMatches(row.year, info.parsedTitle?.year)) return false;
  const gs = gameScore(row.game, info.parsedTitle?.gameLabel || info.parsedTitle?.machineLabel || "");
  return gs >= 3;
}

function buildSearchQueries(row) {
  const game = String(row.game || "").trim();
  const gameNoLeadingThe = game.replace(/^the\s+/i, "").trim();
  const gameSearchNormalized = game.replace(/&/g, "and").replace(/[:']/g, " ").replace(/\s+/g, " ").trim();
  const out = [
    `${game} ${row.manufacturer} ${row.year}`.trim(),
    `${game} ${row.manufacturer}`.trim(),
    `${game} ${row.year}`.trim(),
    game,
    gameNoLeadingThe,
    gameSearchNormalized,
  ].filter(Boolean);
  if (normalizeManufacturer(row.manufacturer) === "pinball brothers" && /alien/i.test(game)) out.push("Alien Pinball Brothers");
  return [...new Set(out)];
}

function scoreSearchLinkText(row, text) {
  const t = String(text ?? "");
  let score = 0;
  score += jaccard(row.game, t) * 5;
  const rg = normLoose(row.game);
  const tt = normLoose(t);
  if (rg && (tt.includes(rg) || rg.includes(tt))) score += 2;
  return score;
}

function queryVariantsFor(row) {
  const game = row.game;
  const manufacturer = row.manufacturer;
  const year = row.year;
  return [...new Set([
    `${game} ${manufacturer} ${year}`.trim(),
    `${game} ${year}`.trim(),
    `${game} ${manufacturer}`.trim(),
    `${game}`.trim(),
  ])];
}

async function resolveRow(row, headed) {
  const attempts = [];
  for (const q of buildSearchQueries(row)) {
    const search = await openSearchCandidates(q, headed);
    attempts.push({ query: q, candidates: search.candidates.length, blocked: search.blocked });
    if (search.blocked) return { status: "blocked", attempts };
    const rankedLinks = [...search.candidates]
      .map((c) => ({ ...c, _linkScore: scoreSearchLinkText(row, c.text) }))
      .sort((a, b) => b._linkScore - a._linkScore);

    const ranked = [];
    let foundStrong = false;
    for (const c of rankedLinks) {
      const href = String(c.href || "");
      const full = /^https?:\/\//.test(href) ? href : `https://pinside.com${href}`;
      const slug = extractSlugFromUrl(full);
      if (!slug) continue;
      const info = await openMachineAndExtract(slug, headed);
      if (!info.validMachine) continue;
      const scored = scoreMachineCandidate(row, info);
      ranked.push({ slug, info, score: scored.score });
      await sleep(200);
      if (isStrongMachineMatch(row, info)) {
        foundStrong = true;
        break;
      }
    }
    ranked.sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const second = ranked[1];
    if (best && best.info.validMachine && best.score >= 8 && (!second || best.score - second.score >= 1.5)) {
      return {
        status: "ok",
        attempts,
        resolved: {
          pinside_slug: best.info.actualSlug,
          pinside_id: best.info.pinsideId,
          pinside_group: best.info.group || PINSIDE_GROUP_NONE_MARKER,
          page_title: best.info.title,
          page_url: best.info.href,
          score: best.score,
        },
      };
    }
    if (foundStrong) break;
  }
  return { status: "unresolved", attempts };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
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
    .filter((p) => (args.tabs ? args.tabs.has(p.title) : true));

  const targetsByTab = [];
  for (const tab of tabs) {
    const escaped = String(tab.title).replace(/'/g, "''");
    const valuesRes = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: CODEX_SPREADSHEET_ID,
      range: `'${escaped}'!A:ZZ`,
      majorDimension: "ROWS",
    });
    const rows = (valuesRes.data.values || []).map((r) => r.map((v) => String(v ?? "")));
    const hr = findHeaderRow(rows);
    if (hr < 0) continue;
    const idx = headerIndexMap(rows[hr] || []);
    if (!idx.has("game") || !idx.has("manufacturer") || !idx.has("year")) continue;
    const missing = [];
    for (let r = hr + 1; r < rows.length; r += 1) {
      const row = rows[r] || [];
      const game = getCell(row, idx.get("game"));
      if (!game) continue;
      const manufacturer = getCell(row, idx.get("manufacturer"));
      const year = getCell(row, idx.get("year"));
      const pid = getCell(row, idx.get("pinside_id"));
      const slug = getCell(row, idx.get("pinside_slug"));
      const grp = getCell(row, idx.get("pinside_group"));
      const prac = getCell(row, idx.get("practice_identity"));
      if (!manufacturer || !year) continue;
      if (pid || slug || grp || prac) continue;
      const label = `${tab.title}#${r + 1}`;
      if (args.onlyRows && !args.onlyRows.has(label)) continue;
      missing.push({ rowIndex: r, game, manufacturer, year, label });
    }
    if (missing.length) {
      targetsByTab.push({ tab, escapedTitle: escaped, rows, headerIndex: hr, idx, missing });
    }
  }

  let targets = targetsByTab.flatMap((t) => t.missing.map((m) => ({ ...m, tabTitle: t.tab.title })));
  if (args.limit && targets.length > args.limit) {
    const allowed = new Set(targets.slice(0, args.limit).map((t) => `${t.tabTitle}#${t.rowIndex}`));
    for (const t of targetsByTab) t.missing = t.missing.filter((m) => allowed.has(`${t.tab.title}#${m.rowIndex}`));
    targets = targets.slice(0, args.limit);
  }

  console.log(`Targets: ${targets.length}`);
  if (!targets.length) return;

  try { runPw(SESSION_SEARCH, ["close"]); } catch {}
  try { runPw(SESSION_MACHINE, ["close"]); } catch {}

  let fixed = 0;
  let unresolved = 0;
  let blocked = 0;

  for (const tabBlock of targetsByTab) {
    if (!tabBlock.missing.length) continue;
    const rows = tabBlock.rows;
    const idx = tabBlock.idx;
    let changed = false;

    for (const m of tabBlock.missing) {
      const label = `${tabBlock.tab.title}#${m.rowIndex + 1}`;
      const res = await resolveRow(m, args.headed);
      if (res.status === "blocked") {
        blocked += 1;
        console.log(`BLOCKED ${label} ${m.game}`);
        continue;
      }
      if (res.status !== "ok" || !res.resolved) {
        unresolved += 1;
        const att = (res.attempts || []).map((a) => `${a.query}:${a.candidates}${a.blocked ? ":blocked" : ""}`).join(" | ");
        console.log(`MISS ${label} ${m.game} (${m.manufacturer} ${m.year})${att ? ` | attempts=${att}` : ""}`);
        continue;
      }
      const out = res.resolved;
      const row = rows[m.rowIndex];
      let rowChanged = false;
      rowChanged = setCell(row, idx.get("pinside_slug"), out.pinside_slug) || rowChanged;
      rowChanged = setCell(row, idx.get("pinside_id"), out.pinside_id) || rowChanged;
      rowChanged = setCell(row, idx.get("pinside_group"), out.pinside_group) || rowChanged;
      const practiceIdentity = computePracticeIdentity({
        manufacturer: m.manufacturer,
        year: m.year,
        pinside_group: out.pinside_group,
        pinside_slug: out.pinside_slug,
      });
      rowChanged = setCell(row, idx.get("practice_identity"), practiceIdentity) || rowChanged;
      changed = changed || rowChanged;
      fixed += rowChanged ? 1 : 0;

      console.log(
        `OK ${label} ${m.game} -> slug=${out.pinside_slug} id=${out.pinside_id} group=${out.pinside_group} | title=${out.page_title}`
      );
      await sleep(args.delayMs);
    }

    if (changed && args.write) {
      const headers = rows[tabBlock.headerIndex] || [];
      const usedRows = rows.length;
      const usedCols = headers.length;
      const endCol = toA1Column(Math.max(usedCols - 1, 0));
      const endRow = Math.max(usedRows, 1);
      await sheetsApi.spreadsheets.values.clear({
        spreadsheetId: CODEX_SPREADSHEET_ID,
        range: `'${tabBlock.escapedTitle}'!A:ZZ`,
      });
      await sheetsApi.spreadsheets.values.update({
        spreadsheetId: CODEX_SPREADSHEET_ID,
        range: `'${tabBlock.escapedTitle}'!A1:${endCol}${endRow}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      });
    }
  }

  console.log(`Done. fixed=${fixed} unresolved=${unresolved} blocked=${blocked}`);
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
