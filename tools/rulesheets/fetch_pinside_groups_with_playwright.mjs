import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_INPUT_JSON = path.join(ROOT, "shared", "pinball", "data", "pinball_library_v2.json");
const DEFAULT_OUTPUT_JSON = path.join(ROOT, "shared", "pinball", "data", "pinside_group_map.json");
const SESSION_SEARCH = "pinside-search";
const SESSION_MACHINE = "pinside-machine";
const PWCLI = path.join(process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex"), "skills", "playwright", "scripts", "playwright_cli.sh");
const PINSIDE_GROUP_NONE_MARKER = "~";

function parseArgs(argv) {
  const out = {
    inputJson: DEFAULT_INPUT_JSON,
    outputJson: DEFAULT_OUTPUT_JSON,
    headed: true,
    limit: null,
    onlyMissing: true,
    variantsOnly: true,
    restartEach: true,
    delayMs: 1500,
    slugs: null,
    fresh: false,
    directOnly: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--input-json" && argv[i + 1]) out.inputJson = path.resolve(argv[i + 1]);
    if (token === "--output-json" && argv[i + 1]) out.outputJson = path.resolve(argv[i + 1]);
    if (token === "--headless") out.headed = false;
    if (token === "--headed") out.headed = true;
    if (token === "--limit" && argv[i + 1]) out.limit = Number.parseInt(argv[i + 1], 10);
    if (token === "--all") out.onlyMissing = false;
    if (token === "--all-slugs") out.variantsOnly = false;
    if (token === "--no-restart-each") out.restartEach = false;
    if (token === "--delay-ms" && argv[i + 1]) out.delayMs = Number.parseInt(argv[i + 1], 10) || out.delayMs;
    if (token === "--slugs" && argv[i + 1]) {
      out.slugs = new Set(argv[i + 1].split(",").map((s) => s.trim()).filter(Boolean));
    }
    if (token === "--fresh") out.fresh = true;
    if (token === "--direct-only") out.directOnly = true;
  }
  return out;
}

function runPw(session, args) {
  return execFileSync(PWCLI, ["--session", session, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CODEX_HOME: process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex") },
    maxBuffer: 1024 * 1024 * 8,
  });
}

function parseResult(output) {
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

async function loadTargets(inputJson, variantsOnly) {
  const raw = JSON.parse(await fs.readFile(inputJson, "utf8"));
  const items = Array.isArray(raw?.items) ? raw.items : [];
  const bySlug = new Map();
  for (const item of items) {
    const slug = String(item?.pinside_slug ?? "").trim();
    if (!slug) continue;
    if (variantsOnly && !String(item?.variant ?? "").trim()) continue;
    if (!bySlug.has(slug)) {
      bySlug.set(slug, {
        slug,
        game: String(item?.game ?? "").trim() || slug,
        variant: String(item?.variant ?? "").trim() || null,
      });
    }
  }
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

async function loadExistingMap(outputJson) {
  try {
    const raw = JSON.parse(await fs.readFile(outputJson, "utf8"));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

async function saveMap(outputJson, map) {
  await fs.mkdir(path.dirname(outputJson), { recursive: true });
  await fs.writeFile(outputJson, `${JSON.stringify(map, null, 2)}\n`, "utf8");
}

function extractGroupExpression() {
  return "((document.body.innerText.match(/This title is part of group:\\s*[\\\"“]?([^\\\"”\\n]+)[\\\"”]?/)||[])[1] || '').trim()";
}

function titleExpression() {
  return "document.title";
}

function currentUrlExpression() {
  return "location.href";
}

function machineHrefListExpression() {
  return "[...new Set(Array.from(document.querySelectorAll('a[href]')).map(a=>a.href).filter(h=>/\\/pinball\\/machine\\//.test(h) && !/\\/machine\\/?query=/.test(h))))].slice(0,50)";
}

function searchContainsSlugExpression(slug) {
  return `document.documentElement.outerHTML.includes('/pinball/machine/${slug}')`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetsFromJson = await loadTargets(args.inputJson, args.variantsOnly);
  const map = args.fresh ? {} : await loadExistingMap(args.outputJson);
  const queue = targetsFromJson.filter((t) => {
    if (args.slugs && !args.slugs.has(t.slug)) return false;
    if (args.onlyMissing && typeof map[t.slug] === "string" && map[t.slug].trim()) return false;
    return true;
  });
  const targets =
    Number.isFinite(args.limit) && (args.limit ?? 0) > 0 ? queue.slice(0, args.limit) : queue;

  if (!targets.length) {
    console.log("No slugs to fetch.");
    return;
  }

  if (!args.directOnly) {
    try {
      runPw(SESSION_SEARCH, ["close"]);
    } catch {
      // ignore
    }
  }
  try {
    runPw(SESSION_MACHINE, ["close"]);
  } catch {
    // ignore
  }

  let opened = false;
  let fetched = 0;
  let found = 0;
  let noGroup = 0;
  let blocked = 0;

  for (const target of targets) {
    const { slug, game } = target;
    if (args.restartEach && opened) {
      for (const s of args.directOnly ? [SESSION_MACHINE] : [SESSION_SEARCH, SESSION_MACHINE]) {
        try {
          runPw(s, ["close"]);
        } catch {
          // ignore
        }
      }
      opened = false;
    }

    const machineUrl = `https://pinside.com/pinball/machine/${slug}`;
    if (!args.directOnly) {
      const searchUrl = `https://pinside.com/pinball/machine/?query=${encodeURIComponent(game)}`;
      const openArgs = ["open", searchUrl];
      if (!opened && args.headed) openArgs.push("--headed");
      runPw(SESSION_SEARCH, openArgs);
      opened = true;

      const titleOut = runPw(SESSION_SEARCH, ["eval", titleExpression()]);
      const title = String(parseResult(titleOut) ?? "");
      if (title.toLowerCase().includes("just a moment")) {
        blocked += 1;
        console.log(`BLOCKED ${slug} (query=${game}) -> ${title}`);
        continue;
      }
      const searchHasSlugOut = runPw(SESSION_SEARCH, ["eval", searchContainsSlugExpression(slug)]);
      const searchHasSlug = Boolean(parseResult(searchHasSlugOut));
      if (!searchHasSlug) {
        console.log(`SEARCH_MISS ${slug} [${game}] (slug not shown in search results; trying direct machine page)`);
      }
    } else {
      opened = true;
    }

    // Fresh session for the machine page avoids Cloudflare tripping on second navigation.
    try {
      runPw(SESSION_MACHINE, ["close"]);
    } catch {
      // ignore
    }
    const machineOpenArgs = ["open", machineUrl];
    if (args.headed) machineOpenArgs.push("--headed");
    runPw(SESSION_MACHINE, machineOpenArgs);

    const machineTitleOut = runPw(SESSION_MACHINE, ["eval", titleExpression()]);
    const machineTitle = String(parseResult(machineTitleOut) ?? "");
    if (machineTitle.toLowerCase().includes("just a moment")) {
      blocked += 1;
      console.log(`BLOCKED ${slug} (machine page) -> ${machineTitle}`);
      continue;
    }

    const groupOut = runPw(SESSION_MACHINE, ["eval", extractGroupExpression()]);
    const group = String(parseResult(groupOut) ?? "").trim();
    if (group) {
      map[slug] = group;
      found += 1;
      console.log(`GROUP ${slug} [${game}] -> ${group}`);
    } else {
      map[slug] = PINSIDE_GROUP_NONE_MARKER;
      noGroup += 1;
      console.log(`NONE ${slug} [${game}] -> ${PINSIDE_GROUP_NONE_MARKER}`);
    }
    fetched += 1;

    if (fetched % 5 === 0) {
      await saveMap(args.outputJson, map);
    }

    // Small delay for page stabilization / anti-bot friendliness.
    await new Promise((r) => setTimeout(r, Math.max(0, args.delayMs)));
  }

  await saveMap(args.outputJson, map);
  console.log(
    `Done. targets=${targets.length} fetched=${fetched} found=${found} noGroup=${noGroup} blocked=${blocked} output=${args.outputJson}`
  );
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
