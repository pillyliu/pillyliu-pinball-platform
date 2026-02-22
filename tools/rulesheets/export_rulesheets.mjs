import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import * as cheerio from "cheerio";

const URLS_FILE = path.resolve("tiltforums_urls.txt");

// Canonical output folder for deployed shared pinball data
const OUT_DIR = path.resolve("../../shared/pinball/rulesheets");
const TMP_DIR = path.resolve("./tmp_html");

function normalizeTopicUrl(u) {
  const url = new URL(u);
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function topicJsonUrl(topicUrl) {
  return `${normalizeTopicUrl(topicUrl)}.json`;
}

function buildAttribution(topicUrl) {
  const source = normalizeTopicUrl(topicUrl);
  return `<small class="rulesheet-attribution">Source: Tilt Forums community rulesheet | Original thread: <a href="${source}">link</a> | License: CC BY-NC-SA 3.0 | Reformatted for readability and mobile use.</small>`;
}

// slug ONLY (no numeric id)
function slugFromTopicUrl(topicUrl) {
  // https://tiltforums.com/t/<slug>/<id>
  const m = normalizeTopicUrl(topicUrl).match(/\/t\/([^/]+)\/\d+$/);
  return m ? m[1] : null;
}

function stripGeneratedPreamble(md) {
  let out = md;

  // Remove leading front matter if present.
  if (out.startsWith("---\n")) {
    const end = out.indexOf("\n---\n", 4);
    if (end !== -1) {
      out = out.slice(end + 5);
    }
  }

  // Remove prior attribution if present.
  out = out.replace(
    /^<small class="rulesheet-attribution">[\s\S]*?<\/small>\n*/m,
    ""
  );

  return out.replace(/^\n+/, "");
}

function filePenalty(name) {
  let penalty = 0;
  if (/-rulesheet/i.test(name)) penalty += 10;
  if (/-wiki/i.test(name)) penalty += 10;
  if (/-wip/i.test(name)) penalty += 10;
  return penalty;
}

function choosePreferredFile(a, b) {
  const pa = filePenalty(a);
  const pb = filePenalty(b);
  if (pa !== pb) return pa < pb ? a : b;
  if (a.length !== b.length) return a.length < b.length ? a : b;
  return a < b ? a : b;
}

async function loadSourceToFileMap(outDir) {
  const entries = await fs.readdir(outDir, { withFileTypes: true });
  const map = new Map();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const fullPath = path.join(outDir, entry.name);
    const content = await fs.readFile(fullPath, "utf8");
    const m = content.match(/^source:\s*"([^"]+)"/m);
    if (!m?.[1]) continue;
    let source;
    try {
      source = normalizeTopicUrl(m[1]);
    } catch {
      continue;
    }
    const prev = map.get(source);
    map.set(source, prev ? choosePreferredFile(prev, entry.name) : entry.name);
  }

  return map;
}

function parseTopicEntries(text) {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const entries = [];

  for (const line of lines) {
    const csvLike = line.match(/^([^,\s]+)\s*,\s*(https?:\/\/.+)$/i);
    if (csvLike) {
      entries.push({
        slug: csvLike[1].trim(),
        topicUrl: csvLike[2].trim(),
      });
      continue;
    }

    entries.push({
      slug: null,
      topicUrl: line,
    });
  }

  return entries;
}

function normalizeHeadingText(input) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[`*_~[\]()>#:]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function addIdToHeadingLine(line, id) {
  if (new RegExp(`<span id="${id}"></span>`, "i").test(line)) return line;
  if (/<span id="heading--[a-z0-9-]+"><\/span>/i.test(line)) {
    return line.replace(/^(#{1,6}\s+)/, `$1<span id="${id}"></span>`);
  }
  return line.replace(/^(#{1,6}\s+)/, `$1<span id="${id}"></span>`);
}

function extractHeadingAnchorsFromHtml(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const anchors = [];
  $("h1,h2,h3,h4,h5,h6").each((_, el) => {
    const id = String($(el).attr("id") || "").trim();
    if (!/^heading--[a-z0-9-]+$/i.test(id)) return;
    anchors.push({
      id,
      textNorm: normalizeHeadingText($(el).text()),
    });
  });
  return anchors;
}

function addLegacyHeadingSpans(md, sourceHtml) {
  const lines = md.split("\n");
  const htmlAnchors = extractHeadingAnchorsFromHtml(sourceHtml);
  const headingRows = lines
    .map((line, index) => ({ line, index, m: line.match(/^(#{1,6})\s+(.*)$/) }))
    .filter((row) => row.m)
    .map((row) => ({
      index: row.index,
      textNorm: normalizeHeadingText(
        row.m[2].replace(/<span id="heading--[a-z0-9-]+"><\/span>/gi, "")
      ),
    }));

  let startAt = 0;
  for (const anchor of htmlAnchors) {
    // Empty-text anchors from HTML cannot be aligned to markdown headings.
    // They will be added as standalone spans before the first matching link.
    if (!anchor.textNorm) continue;
    let matched = -1;
    for (let i = startAt; i < headingRows.length; i += 1) {
      if (headingRows[i].textNorm === anchor.textNorm) {
        matched = i;
        break;
      }
    }
    if (matched === -1) continue;
    lines[headingRows[matched].index] = addIdToHeadingLine(
      lines[headingRows[matched].index],
      anchor.id
    );
    startAt = matched + 1;
  }

  const linkIds = [
    ...new Set(
      [...md.matchAll(/\]\(#(heading--[a-z0-9-]+)\)/gi)].map((m) => m[1])
    ),
  ];
  const currentIds = new Set(
    [...lines.join("\n").matchAll(/<span id="(heading--[a-z0-9-]+)"><\/span>/gi)].map((m) => m[1])
  );

  for (const id of linkIds) {
    if (currentIds.has(id)) continue;
    const linkLineIndex = lines.findIndex((line) =>
      new RegExp(`\\]\\(#${id}\\)`, "i").test(line)
    );
    if (linkLineIndex !== -1) {
      lines.splice(linkLineIndex, 0, `<span id="${id}"></span>`);
      currentIds.add(id);
    }
  }

  return lines.join("\n");
}

function findMissingLegacyAnchors(md) {
  const linkIds = [
    ...new Set(
      [...md.matchAll(/\]\(#(heading--[a-z0-9-]+)\)/gi)].map((m) => m[1])
    ),
  ];
  const anchorIds = new Set(
    [...md.matchAll(/<span id="(heading--[a-z0-9-]+)"><\/span>/gi)].map((m) => m[1])
  );
  return linkIds.filter((id) => !anchorIds.has(id));
}

function runPandoc(htmlPath, mdPath) {
  return new Promise((resolve, reject) => {
    const p = spawn(
      "pandoc",
      [htmlPath, "-f", "html", "-t", "gfm", "--wrap=preserve", "-o", mdPath],
      { stdio: "inherit" }
    );
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`pandoc exit ${code}`))
    );
  });
}

function cleanAndRewriteHtml(cookedHtml, topicUrl) {
  const baseTopic = normalizeTopicUrl(topicUrl);
  const $ = cheerio.load(cookedHtml, { decodeEntities: false });

  // Remove Discourse table edit UI
  $("div.fullscreen-table-wrapper__buttons").remove();

  // Unwrap Discourse table containers
  $("div.md-table.fullscreen-table-wrapper").each((_, el) => {
    const w = $(el);
    w.replaceWith(w.contents());
  });

  // Rewrite same-topic links to local anchors
  $("a[href]").each((_, el) => {
    const a = $(el);
    const href = a.attr("href");
    if (!href) return;

    // Already local
    if (href.startsWith("#")) return;

    // Absolute same-topic anchor
    if (href.startsWith(baseTopic + "#")) {
      a.attr("href", "#" + href.split("#")[1]);
      return;
    }

    // Normalize and re-check
    try {
      const u = new URL(href, baseTopic);
      const normalized = u.toString().replace(/\/$/, "");
      if (normalized.startsWith(baseTopic + "#")) {
        a.attr("href", "#" + u.hash.replace(/^#/, ""));
      }
    } catch {
      /* ignore */
    }
  });

  return `<div class="pinball-rulesheet">\n${$.root().html()}\n</div>\n`;
}

async function fetchFirstPostCooked(topicUrl) {
  const res = await fetch(topicJsonUrl(topicUrl), {
    headers: {
      "User-Agent": "pillyliu-rulesheet-export/1.0",
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed ${res.status} fetching JSON for ${topicUrl}`);
  }

  const data = await res.json();
  const post = data?.post_stream?.posts?.[0];

  if (!post?.cooked) {
    throw new Error(`No cooked HTML found for ${topicUrl}`);
  }

  return {
    cooked: post.cooked,
    title: data?.title || "",
    updatedAt: post.updated_at || "",
  };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(TMP_DIR, { recursive: true });
  const sourceToFile = await loadSourceToFileMap(OUT_DIR);

  const entries = parseTopicEntries(await fs.readFile(URLS_FILE, "utf8"));

  for (const entry of entries) {
    const topicUrl = entry.topicUrl;
    const topicSlug = slugFromTopicUrl(topicUrl);
    if (!topicSlug) {
      console.warn(`Skipping invalid topic URL: ${topicUrl}`);
      continue;
    }

    const outputSlug = entry.slug || topicSlug;
    console.log(`\n=== ${outputSlug} ===`);

    const { cooked, title, updatedAt } =
      await fetchFirstPostCooked(topicUrl);

    const cleanedHtml = cleanAndRewriteHtml(cooked, topicUrl);

    const tmpHtml = path.join(TMP_DIR, `${topicSlug}.html`);
    const normalizedSource = normalizeTopicUrl(topicUrl);
    const mappedName = sourceToFile.get(normalizedSource);
    const outName = entry.slug ? `${entry.slug}.md` : mappedName || `${outputSlug}.md`;
    const outMd = path.join(OUT_DIR, outName);

    await fs.writeFile(tmpHtml, cleanedHtml, "utf8");
    await runPandoc(tmpHtml, outMd);

    const mdBody = await fs.readFile(outMd, "utf8");
    const contentBody = addLegacyHeadingSpans(stripGeneratedPreamble(mdBody), cleanedHtml);
    const missingAnchors = findMissingLegacyAnchors(contentBody);
    if (missingAnchors.length) {
      throw new Error(
        `Legacy anchor mismatch in ${outName}: missing ${missingAnchors.join(", ")}`
      );
    }
    const frontMatter =
      `---\n` +
      `title: "${title.replace(/"/g, '\\"')}"\n` +
      `source: "${normalizedSource}"\n` +
      (updatedAt ? `source_updated_at: "${updatedAt}"\n` : "") +
      `---\n\n`;
    const attribution = buildAttribution(topicUrl);

    await fs.writeFile(
      outMd,
      `${frontMatter}${attribution}\n\n${contentBody}`,
      "utf8"
    );

    console.log(`Wrote: ${path.basename(outMd)}`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
