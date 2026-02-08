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

// slug ONLY (no numeric id)
function slugFromTopicUrl(topicUrl) {
  // https://tiltforums.com/t/<slug>/<id>
  const m = normalizeTopicUrl(topicUrl).match(/\/t\/([^/]+)\/\d+$/);
  return m ? m[1] : null;
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

  const urls = (await fs.readFile(URLS_FILE, "utf8"))
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const topicUrl of urls) {
    const slug = slugFromTopicUrl(topicUrl);
    if (!slug) {
      console.warn(`Skipping invalid topic URL: ${topicUrl}`);
      continue;
    }

    console.log(`\n=== ${slug} ===`);

    const { cooked, title, updatedAt } =
      await fetchFirstPostCooked(topicUrl);

    const cleanedHtml = cleanAndRewriteHtml(cooked, topicUrl);

    const tmpHtml = path.join(TMP_DIR, `${slug}.html`);
    const outMd = path.join(OUT_DIR, `${slug}.md`);

    await fs.writeFile(tmpHtml, cleanedHtml, "utf8");
    await runPandoc(tmpHtml, outMd);

    const mdBody = await fs.readFile(outMd, "utf8");
    const frontMatter =
      `---\n` +
      `title: "${title.replace(/"/g, '\\"')}"\n` +
      `source: "${normalizeTopicUrl(topicUrl)}"\n` +
      (updatedAt ? `source_updated_at: "${updatedAt}"\n` : "") +
      `---\n\n`;

    if (!mdBody.startsWith("---\n")) {
      await fs.writeFile(outMd, frontMatter + mdBody, "utf8");
    }

    console.log(`Wrote: ${slug}.md`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
