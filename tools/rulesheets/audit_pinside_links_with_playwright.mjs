import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA_DIR = path.join(ROOT, "shared", "pinball", "data");
const PWCLI = path.join(
  process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex"),
  "skills",
  "playwright",
  "scripts",
  "playwright_cli.sh"
);
const SESSION_SEARCH = "pinside-audit-search";
const SESSION_MACHINE = "pinside-audit-machine";

const SHEETS = [
  "Avenue Pinball - Current.csv",
  "RLM Amusements - Current.csv",
  "Codex Pinball Library - Current.csv",
];

function parseArgs(argv) {
  const out = {
    headed: true,
    limit: null,
    onlyRows: null,
    outputJson: path.join(DATA_DIR, "pinside_link_audit_report.json"),
    writeResolvedMap: path.join(DATA_DIR, "pinside_resolved_machine_map.json"),
    delayMs: 750,
    maxCandidatesPerQuery: 8,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === "--headless") out.headed = false;
    if (t === "--headed") out.headed = true;
    if (t === "--limit" && argv[i + 1]) out.limit = Number.parseInt(argv[i + 1], 10);
    if (t === "--only-rows" && argv[i + 1]) {
      out.onlyRows = new Set(argv[i + 1].split(",").map((s) => s.trim()).filter(Boolean));
    }
    if (t === "--output-json" && argv[i + 1]) out.outputJson = path.resolve(argv[i + 1]);
    if (t === "--write-resolved-map" && argv[i + 1]) out.writeResolvedMap = path.resolve(argv[i + 1]);
    if (t === "--delay-ms" && argv[i + 1]) out.delayMs = Number.parseInt(argv[i + 1], 10) || out.delayMs;
    if (t === "--max-candidates-per-query" && argv[i + 1]) {
      out.maxCandidatesPerQuery = Number.parseInt(argv[i + 1], 10) || out.maxCandidatesPerQuery;
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
  const idx = lines.findIndex((line) => line.trim() === "### Result");
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

function norm(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normLoose(value) {
  return norm(value).replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value) {
  return new Set(normLoose(value).split(" ").filter(Boolean));
}

function jaccard(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = new Set([...A, ...B]).size;
  return union ? inter / union : 0;
}

function normalizeVariant(v) {
  const s = normLoose(v)
    .replace(/\blimited edition\b/g, "le")
    .replace(/\bcollector'?s edition\b/g, "ce")
    .replace(/\bcollectors edition\b/g, "ce");
  if (!s) return "";
  if (/\bpro\b/.test(s)) return "pro";
  if (/\bpremium\b/.test(s)) return "premium";
  if (/\ble\b/.test(s)) return "le";
  if (/\bgold\b/.test(s)) return "gold";
  if (/\bse\b/.test(s)) return "se";
  if (/\bce\b/.test(s)) return "ce";
  return s;
}

function normalizeManufacturer(v) {
  let s = normLoose(v);
  if (s === "pb") return "pinball brothers";
  if (s === "jjp") return "jersey jack pinball";
  s = s.replace(/\bllc\b/g, "").trim();
  s = s.replace(/\bpinball inc\b/g, "").replace(/\binc\b/g, "").trim();
  s = s.replace(/\bcompany\b/g, "").trim();
  s = s.replace(/\bco\b/g, "").trim();
  if (s === "stern pinball") return "stern";
  if (s === "chicago gaming") return "chicago gaming";
  if (s === "chicago gaming company") return "chicago gaming";
  if (s === "spooky pinball") return "spooky";
  return s;
}

function parseMachineTitle(title) {
  const t = String(title ?? "").trim();
  const m = t.match(/^(.*?)\s+Pinball Machine\s+\((.*?),\s*(\d{4})\)\s+\|\s+Pinside Game Archive$/i);
  if (!m) {
    return {
      rawTitle: t,
      machineLabel: "",
      gameLabel: "",
      variantLabel: "",
      manufacturerLabel: "",
      year: "",
    };
  }
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

async function loadSheetRows() {
  const out = [];
  for (const filename of SHEETS) {
    const full = path.join(DATA_DIR, filename);
    const raw = await fs.readFile(full, "utf8");
    const rows = csvParse(raw);
    if (!rows.length) continue;
    const headers = rows[0].map((h) => String(h ?? ""));
    const headerIdx = new Map(headers.map((h, idx) => [norm(h), idx]));
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      const get = (k) => String(row[headerIdx.get(norm(k))] ?? "").trim();
      const game = get("Game");
      if (!game || norm(game) === "game") continue;
      out.push({
        row_key: `${filename}#${i + 1}`,
        source_file: filename,
        source_row_number: i + 1,
        game,
        variant: get("Variant"),
        manufacturer: get("Manufacturer"),
        year: get("Year"),
        pinside_slug: get("pinside_slug"),
        pinside_id: get("pinside_id"),
        practice_identity: get("practice_identity"),
      });
    }
  }
  return out;
}

function machineEvalExpressions() {
  return {
    href: "location.href",
    title: "document.title",
    group: "((document.body.innerText.match(/This title is part of group:\\s*[\\\"“]?([^\\\"”\\n]+)[\\\"”]?/)||[])[1] || '').trim()",
    pinsideId: "((document.body.innerText.match(/Pinside\\s*ID\\s*:?\\s*(\\d{2,6})/)||[])[1] || '').trim()",
  };
}

function searchCandidatesExpression() {
  return "JSON.stringify(Array.from(document.querySelectorAll('a[href]')).map(function(a){return {href:a.getAttribute('href')||'',text:(a.innerText||a.textContent||'').trim()};}).filter(function(x){return x.href.indexOf('/pinball/machine/')>=0 && x.href.indexOf('?query=')<0 && x.text && x.href !== '/pinball/machine/random';}).slice(0,80))";
}

async function closeSession(session) {
  try {
    runPw(session, ["close"]);
  } catch {
    // ignore
  }
}

async function openMachineAndExtract(slugOrUrl, headed, cache) {
  const key = String(slugOrUrl);
  if (cache.machine.has(key)) return cache.machine.get(key);

  await closeSession(SESSION_MACHINE);
  const url = /^https?:\/\//.test(key) ? key : `https://pinside.com/pinball/machine/${key}`;
  const openArgs = ["open", url];
  if (headed) openArgs.push("--headed");
  runPw(SESSION_MACHINE, openArgs);

  const exprs = machineEvalExpressions();
  const href = String(parsePwResult(runPw(SESSION_MACHINE, ["eval", exprs.href])) ?? "");
  const title = String(parsePwResult(runPw(SESSION_MACHINE, ["eval", exprs.title])) ?? "");
  const group = String(parsePwResult(runPw(SESSION_MACHINE, ["eval", exprs.group])) ?? "").trim();
  const pinsideId = String(parsePwResult(runPw(SESSION_MACHINE, ["eval", exprs.pinsideId])) ?? "").trim();
  const actualSlug = extractSlugFromUrl(href);
  const parsedTitle = parseMachineTitle(title);
  const isBlocked = norm(title).includes("just a moment");
  const validMachine = Boolean(!isBlocked && href && !isSearchUrl(href) && actualSlug && pinsideId);

  const info = {
    requested: key,
    url,
    href,
    title,
    isBlocked,
    validMachine,
    actualSlug,
    pinsideId,
    group,
    parsedTitle,
  };
  cache.machine.set(key, info);
  return info;
}

async function openSearchAndExtractCandidates(query, headed, cache) {
  if (cache.search.has(query)) return cache.search.get(query);

  await closeSession(SESSION_SEARCH);
  const url = `https://pinside.com/pinball/machine/?query=${encodeURIComponent(query)}`;
  const openArgs = ["open", url];
  if (headed) openArgs.push("--headed");
  runPw(SESSION_SEARCH, openArgs);
  const title = String(parsePwResult(runPw(SESSION_SEARCH, ["eval", "document.title"])) ?? "");
  const href = String(parsePwResult(runPw(SESSION_SEARCH, ["eval", "location.href"])) ?? "");
  const raw = String(parsePwResult(runPw(SESSION_SEARCH, ["eval", searchCandidatesExpression()])) ?? "[]");
  let candidates = [];
  try {
    candidates = JSON.parse(raw);
  } catch {
    candidates = [];
  }
  const out = { query, title, href, candidates };
  cache.search.set(query, out);
  return out;
}

function variantMatches(rowVariant, pageVariant) {
  const rv = normalizeVariant(rowVariant);
  const pv = normalizeVariant(pageVariant);
  if (!rv) return true;
  return rv === pv;
}

function yearMatches(rowYear, pageYear) {
  const a = String(rowYear ?? "").trim();
  const b = String(pageYear ?? "").trim();
  if (!a || !b) return false;
  return a === b;
}

function manufacturerMatches(rowManufacturer, pageManufacturer) {
  const a = normalizeManufacturer(rowManufacturer);
  const b = normalizeManufacturer(pageManufacturer);
  if (!a || !b) return false;
  return a === b;
}

function gameScore(rowGame, pageGame, rowVariant, pageVariant) {
  let s = 0;
  const sim = jaccard(rowGame, pageGame);
  s += sim * 4;
  const rg = normLoose(rowGame);
  const pg = normLoose(pageGame);
  if (rg && pg && (pg.includes(rg) || rg.includes(pg))) s += 2;
  if (variantMatches(rowVariant, pageVariant)) s += 3;
  return s;
}

function scoreMachineCandidate(row, info) {
  if (!info?.validMachine) return { score: -999, reasons: ["invalid-machine"] };
  const reasons = [];
  let score = 0;
  if (variantMatches(row.variant, info.parsedTitle.variantLabel)) {
    score += 5;
    reasons.push("variant");
  } else if (row.variant) {
    score -= 4;
    reasons.push("variant-mismatch");
  }
  if (manufacturerMatches(row.manufacturer, info.parsedTitle.manufacturerLabel)) {
    score += 5;
    reasons.push("manufacturer");
  } else {
    score -= 2;
    reasons.push("manufacturer-mismatch");
  }
  if (yearMatches(row.year, info.parsedTitle.year)) {
    score += 5;
    reasons.push("year");
  } else {
    score -= 2;
    reasons.push("year-mismatch");
  }
  const gs = gameScore(row.game, info.parsedTitle.gameLabel || info.parsedTitle.machineLabel, row.variant, info.parsedTitle.variantLabel);
  score += gs;
  reasons.push(`game=${gs.toFixed(2)}`);
  return { score, reasons };
}

function isStrongMachineMatch(row, info) {
  if (!info?.validMachine) return false;
  if (!variantMatches(row.variant, info.parsedTitle.variantLabel)) return false;
  if (!manufacturerMatches(row.manufacturer, info.parsedTitle.manufacturerLabel)) return false;
  if (!yearMatches(row.year, info.parsedTitle.year)) return false;
  const gs = gameScore(row.game, info.parsedTitle.gameLabel || info.parsedTitle.machineLabel, row.variant, info.parsedTitle.variantLabel);
  return gs >= 3;
}

function currentSlugLooksCorrect(row, info) {
  if (!info?.validMachine) return false;
  if (!variantMatches(row.variant, info.parsedTitle.variantLabel)) return false;
  if (!manufacturerMatches(row.manufacturer, info.parsedTitle.manufacturerLabel)) return false;
  if (!yearMatches(row.year, info.parsedTitle.year)) return false;
  const gs = gameScore(row.game, info.parsedTitle.gameLabel || info.parsedTitle.machineLabel, row.variant, info.parsedTitle.variantLabel);
  return gs >= 2.0;
}

function buildSearchQueries(row) {
  const out = [];
  const game = row.game.trim();
  const variant = row.variant.trim();
  const gameNoLeadingThe = game.replace(/^the\s+/i, "").trim();
  const dedupeVariantSuffix = new RegExp(`\\s+${String(variant || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  const gameWithoutExactVariantSuffix = variant ? game.replace(dedupeVariantSuffix, "").trim() : game;
  const gameWithoutVariantTokens = game
    .replace(/\b(pro|premium|le|limited edition|ce|collector'?s edition|collectors edition|se|special edition|gold)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const gameSearchNormalized = game
    .replace(/&/g, "and")
    .replace(/[:']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (game && variant) out.push(`${game} ${variant}`);
  if (game) out.push(game);
  if (gameWithoutExactVariantSuffix && gameWithoutExactVariantSuffix !== game) out.push(gameWithoutExactVariantSuffix);
  if (gameWithoutVariantTokens && gameWithoutVariantTokens !== game) out.push(gameWithoutVariantTokens);
  if (gameNoLeadingThe && gameNoLeadingThe !== game) out.push(gameNoLeadingThe);
  if (gameSearchNormalized && gameSearchNormalized !== game) out.push(gameSearchNormalized);
  if (gameWithoutVariantTokens && gameNoLeadingThe && gameWithoutVariantTokens !== gameNoLeadingThe) {
    out.push(gameWithoutVariantTokens.replace(/^the\s+/i, "").trim());
  }
  if (normalizeManufacturer(row.manufacturer) === "pinball brothers" && /alien/i.test(game)) {
    out.push("Alien Pinball Brothers");
  }
  if (/dungeons/i.test(game) && /tyrant/i.test(game)) {
    out.push("Dungeons and Dragons Tyrants Eye");
  }
  return [...new Set(out)];
}

function scoreSearchLinkText(row, text) {
  const t = String(text ?? "");
  let score = 0;
  const sim = jaccard(row.game, t);
  score += sim * 5;
  const rv = normalizeVariant(row.variant);
  const tt = normLoose(t);
  if (rv && tt.includes(rv)) score += 4;
  if (!rv) score += 1;
  const rg = normLoose(row.game);
  if (rg && (tt.includes(rg) || rg.includes(tt))) score += 2;
  return score;
}

async function resolveRow(row, args, cache) {
  const result = {
    row_key: row.row_key,
    source_file: row.source_file,
    source_row_number: row.source_row_number,
    sheet: {
      game: row.game,
      variant: row.variant,
      manufacturer: row.manufacturer,
      year: row.year,
      pinside_slug: row.pinside_slug,
      pinside_id: row.pinside_id,
    },
    status: "unresolved",
    using: "current_slug",
    current_machine: null,
    resolved: null,
    search_attempts: [],
    notes: [],
  };

  if (row.pinside_slug) {
    const info = await openMachineAndExtract(row.pinside_slug, args.headed, cache);
    result.current_machine = info;
    if (info.isBlocked) {
      result.status = "blocked";
      result.notes.push("cloudflare_blocked");
      return result;
    }
    if (currentSlugLooksCorrect(row, info)) {
      result.status = "ok";
      result.resolved = {
        pinside_slug: info.actualSlug,
        pinside_id: info.pinsideId,
        pinside_group: info.group || "~",
        group_found: Boolean(info.group),
      };
      return result;
    }
    if (!info.validMachine) {
      result.notes.push("slug_does_not_land_on_machine_page");
    } else {
      result.notes.push("slug_lands_on_wrong_machine_or_variant");
    }
  } else {
    result.notes.push("missing_slug");
  }

  result.using = "search_fallback";
  const machineCandidates = [];
  for (const query of buildSearchQueries(row)) {
    const search = await openSearchAndExtractCandidates(query, args.headed, cache);
    const entry = {
      query,
      title: search.title,
      href: search.href,
      candidate_count: search.candidates.length,
      candidates: [],
    };
    result.search_attempts.push(entry);

    const rankedLinks = [...search.candidates]
      .map((c) => ({ ...c, _linkScore: scoreSearchLinkText(row, c.text) }))
      .sort((a, b) => b._linkScore - a._linkScore)
      .slice(0, Math.max(1, args.maxCandidatesPerQuery));

    let foundStrongInThisQuery = false;
    for (const c of rankedLinks) {
      const slug = extractSlugFromUrl(`https://pinside.com${c.href}`);
      if (!slug) continue;
      if (machineCandidates.some((x) => x.slug === slug)) continue;
      const info = await openMachineAndExtract(slug, args.headed, cache);
      const scored = scoreMachineCandidate(row, info);
      entry.candidates.push({
        slug,
        result_text: c.text,
        href: c.href,
        score: Number(scored.score.toFixed(2)),
        reasons: scored.reasons,
        machine_title: info.title,
        machine_href: info.href,
        validMachine: info.validMachine,
        pinsideId: info.pinsideId,
        group: info.group || "",
      });
      machineCandidates.push({ slug, info, score: scored.score, reasons: scored.reasons, text: c.text });
      await sleep(args.delayMs);

      if (isStrongMachineMatch(row, info)) {
        // Stop early when we have an exact manufacturer/year/variant match with strong game similarity.
        foundStrongInThisQuery = true;
        break;
      }
    }
    entry.candidates.sort((a, b) => b.score - a.score);
    if (foundStrongInThisQuery) break;
  }

  machineCandidates.sort((a, b) => b.score - a.score);
  const best = machineCandidates[0];
  const second = machineCandidates[1];
  if (best && best.info.validMachine && best.score >= 8 && (!second || best.score - second.score >= 1.5)) {
    result.status = "repaired";
    result.resolved = {
      pinside_slug: best.info.actualSlug,
      pinside_id: best.info.pinsideId,
      pinside_group: best.info.group || "~",
      group_found: Boolean(best.info.group),
    };
    result.notes.push(`selected_search_candidate:${best.slug}`);
  } else {
    result.status = "unresolved";
    if (best) {
      result.notes.push(`best_candidate_score=${Number(best.score.toFixed(2))}`);
      result.notes.push(`best_candidate_slug=${best.slug}`);
    } else {
      result.notes.push("no_search_candidates");
    }
  }

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = await loadSheetRows();
  const targetRows = rows.filter((r) => (args.onlyRows ? args.onlyRows.has(r.row_key) : true));
  const targets =
    Number.isFinite(args.limit) && (args.limit ?? 0) > 0 ? targetRows.slice(0, args.limit) : targetRows;

  const cache = {
    machine: new Map(),
    search: new Map(),
  };

  await closeSession(SESSION_SEARCH);
  await closeSession(SESSION_MACHINE);

  const results = [];
  const summary = {
    rows: targets.length,
    ok: 0,
    repaired: 0,
    unresolved: 0,
    blocked: 0,
    slug_changed: 0,
    id_changed: 0,
    group_found: 0,
    group_missing: 0,
  };

  for (let i = 0; i < targets.length; i += 1) {
    const row = targets[i];
    console.log(`START ${i + 1}/${targets.length} ${row.row_key} | ${row.game}${row.variant ? ` [${row.variant}]` : ""}`);
    const res = await resolveRow(row, args, cache);
    results.push(res);

    summary[res.status] = (summary[res.status] || 0) + 1;
    if (res.resolved) {
      if (res.resolved.group_found) summary.group_found += 1;
      else summary.group_missing += 1;
      if (norm(res.resolved.pinside_slug) !== norm(row.pinside_slug)) summary.slug_changed += 1;
      if (String(res.resolved.pinside_id || "").trim() !== String(row.pinside_id || "").trim()) summary.id_changed += 1;
    }

    const tag = res.status.toUpperCase().padEnd(9, " ");
    const resolvedSlug = res.resolved?.pinside_slug || "";
    const resolvedId = res.resolved?.pinside_id || "";
    console.log(
      `${i + 1}/${targets.length} ${tag} ${row.row_key} | ${row.game}${row.variant ? ` [${row.variant}]` : ""} | slug=${row.pinside_slug} -> ${resolvedSlug || "-"} | id=${row.pinside_id} -> ${resolvedId || "-"}`
    );
    if ((i + 1) % 5 === 0) {
      await fs.mkdir(path.dirname(args.outputJson), { recursive: true });
      await fs.writeFile(args.outputJson, `${JSON.stringify({ summary, results }, null, 2)}\n`, "utf8");
    }
    await sleep(args.delayMs);
  }

  const resolvedMap = {};
  for (const res of results) {
    if (!res.resolved) continue;
    resolvedMap[res.row_key] = {
      source_file: res.source_file,
      source_row_number: res.source_row_number,
      pinside_slug: res.resolved.pinside_slug,
      pinside_id: res.resolved.pinside_id,
      pinside_group: res.resolved.pinside_group,
      status: res.status,
    };
  }

  await fs.mkdir(path.dirname(args.outputJson), { recursive: true });
  await fs.writeFile(args.outputJson, `${JSON.stringify({ summary, results }, null, 2)}\n`, "utf8");
  await fs.mkdir(path.dirname(args.writeResolvedMap), { recursive: true });
  await fs.writeFile(args.writeResolvedMap, `${JSON.stringify(resolvedMap, null, 2)}\n`, "utf8");
  console.log(`Summary: ${JSON.stringify(summary)}`);
  console.log(`Wrote audit report: ${args.outputJson}`);
  console.log(`Wrote resolved row map: ${args.writeResolvedMap}`);

  await closeSession(SESSION_SEARCH);
  await closeSession(SESSION_MACHINE);
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
