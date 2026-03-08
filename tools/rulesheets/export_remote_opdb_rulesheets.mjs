import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHARED_PINBALL_DIR = path.join(ROOT, "shared", "pinball");
const DEFAULT_CATALOG_PATH = path.join(SHARED_PINBALL_DIR, "data", "opdb_catalog_v1.json");
const OUT_DIR = path.join(SHARED_PINBALL_DIR, "rulesheets");
const USER_AGENT = "Mozilla/5.0 PinballLibraryRulesheetExport/1.0";
const SUPPORTED_PROVIDERS = new Set(["tf", "pp", "papa", "bob"]);
const COPYABLE_PROVIDER_PATTERN = /^provider:\s*"(tf|pp|papa|bob)"\s*$/m;

function normalizeString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeTopicUrl(rawUrl) {
  const url = new URL(rawUrl);
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function tiltForumsApiUrl(rawUrl) {
  if (rawUrl.includes("/posts/") && rawUrl.toLowerCase().endsWith(".json")) return rawUrl;
  const normalized = rawUrl.split("?")[0];
  return normalized.toLowerCase().endsWith(".json") ? normalized : `${normalized}.json`;
}

function canonicalTopicUrl(rawUrl) {
  return rawUrl.split("?")[0].replace(/\.json$/i, "");
}

function legacyFetchUrl(provider, rawUrl) {
  if (provider !== "bob" || !rawUrl.includes("silverballmania.com")) return rawUrl;
  const slug = rawUrl.split("/").filter(Boolean).at(-1);
  return slug ? `https://rules.silverballmania.com/print/${slug}` : rawUrl;
}

function stripHtml(text, patterns) {
  return patterns.reduce((current, pattern) => current.replace(pattern, ""), text);
}

function extractBodyHtml(html) {
  return html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? null;
}

function extractMainHtml(html) {
  return html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? null;
}

function shouldTreatAsPlainText(text, mimeType) {
  if (mimeType?.toLowerCase().includes("text/plain")) return true;
  return !/<[a-zA-Z!/][^>]*>/.test(text);
}

function cleanupPrimerHtml(html) {
  let cleaned = stripHtml(extractBodyHtml(html) ?? html, [
    /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    /<style\b[^>]*>[\s\S]*?<\/style>/gi,
    /<!--[\s\S]*?-->/g,
  ]);
  const firstHeading = cleaned.search(/<h1\b[^>]*>/i);
  if (firstHeading >= 0) cleaned = cleaned.slice(firstHeading);
  return cleaned.trim();
}

function rebaseRelativeUrl(value, baseUrl) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed.startsWith("#")) return trimmed;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(trimmed)) return trimmed;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return trimmed;
  }
}

function rebaseRelativeHtmlUrls(input, baseUrl) {
  const rewrittenAttributes = input.replace(/(\s(?:src|href)=["'])([^"']+)(["'])/gi, (_, prefix, value, suffix) => (
    `${prefix}${rebaseRelativeUrl(value, baseUrl)}${suffix}`
  ));
  return rewrittenAttributes.replace(/(\ssrcset=["'])([^"']+)(["'])/gi, (_, prefix, value, suffix) => {
    const rewritten = String(value)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [url, descriptor] = entry.split(/\s+/, 2);
        const rebasedUrl = rebaseRelativeUrl(url, baseUrl);
        return descriptor ? `${rebasedUrl} ${descriptor}` : rebasedUrl;
      })
      .join(", ");
    return `${prefix}${rewritten}${suffix}`;
  });
}

function cleanupLegacyHtml(html, mimeType, provider) {
  if (shouldTreatAsPlainText(html, mimeType)) {
    return `<pre class="rulesheet-preformatted">${escapeHtml(html.trim())}</pre>`;
  }
  if (provider === "bob") {
    const main = extractMainHtml(html);
    if (main) {
      return stripHtml(main, [
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        /<!--[\s\S]*?-->/g,
        /<a\b[^>]*title="Print"[^>]*>[\s\S]*?<\/a>/gi,
      ]).trim();
    }
  }
  return stripHtml(extractBodyHtml(html) ?? html, [
    /<\?[\s\S]*?\?>/g,
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    /<style\b[^>]*>[\s\S]*?<\/style>/gi,
    /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
    /<!--[\s\S]*?-->/g,
    /<\/?(html|head|body|meta|link)\b[^>]*>/gi,
  ]).trim();
}

async function fetchDocument(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`Remote rulesheet request failed (${response.status}) for ${url}`);
  }
  return {
    text: await response.text(),
    mimeType: response.headers.get("content-type") || "",
    finalUrl: response.url,
  };
}

function sourceMeta(provider) {
  switch (provider) {
    case "tf":
      return {
        sourceName: "Tilt Forums community rulesheet",
        originalLinkLabel: "Original thread",
        detailsText: "License/source terms remain with Tilt Forums and the original authors.",
      };
    case "pp":
      return {
        sourceName: "Pinball Primer",
        originalLinkLabel: "Original page",
        detailsText: "Preserve source attribution and any author/site rights notes from the original page.",
      };
    case "papa":
      return {
        sourceName: "PAPA / pinball.org rulesheet archive",
        originalLinkLabel: "Original page",
        detailsText: "Preserve source attribution and any author/site rights notes from the original page.",
      };
    case "bob":
      return {
        sourceName: "Silverball Rules (Bob Matthews source)",
        originalLinkLabel: "Original page",
        detailsText: "Preserve source attribution and any author/site rights notes from the original page.",
      };
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

function attributionHtml(provider, displayUrl, updatedAt) {
  const meta = sourceMeta(provider);
  const updatedText = updatedAt ? ` | Updated: ${escapeHtml(updatedAt)}` : "";
  return `<small class="rulesheet-attribution">Source: ${escapeHtml(meta.sourceName)} | ${escapeHtml(meta.originalLinkLabel)}: <a href="${escapeHtml(displayUrl)}">link</a>${updatedText} | ${escapeHtml(meta.detailsText)} | Reformatted for readability and mobile use.</small>`;
}

async function renderRemoteRulesheet(provider, rawUrl) {
  if (provider === "tf") {
    const fetched = await fetchDocument(tiltForumsApiUrl(rawUrl));
    const root = JSON.parse(fetched.text);
    const post = root?.post_stream?.posts?.[0] ?? root;
    const cooked = normalizeString(post?.cooked);
    if (!cooked) throw new Error(`Missing Tilt Forums cooked HTML for ${rawUrl}`);
    const topicSlug = normalizeString(post?.topic_slug);
    const topicId = Number(post?.topic_id) || null;
    const canonicalUrl = topicSlug && topicId ? `https://tiltforums.com/t/${topicSlug}/${topicId}` : canonicalTopicUrl(rawUrl);
    return {
      sourceUrl: canonicalUrl,
      updatedAt: normalizeString(post?.updated_at),
      body: `${attributionHtml(provider, canonicalUrl, normalizeString(post?.updated_at))}\n\n<div class="pinball-rulesheet remote-rulesheet tiltforums-rulesheet">\n${cooked}\n</div>`,
    };
  }

  const fetched = await fetchDocument(provider === "bob" ? legacyFetchUrl(provider, rawUrl) : rawUrl);
  if (provider === "pp") {
    return {
      sourceUrl: fetched.finalUrl,
      updatedAt: null,
      body: `${attributionHtml(provider, fetched.finalUrl, null)}\n\n<div class="pinball-rulesheet remote-rulesheet primer-rulesheet">\n${rebaseRelativeHtmlUrls(cleanupPrimerHtml(fetched.text), fetched.finalUrl)}\n</div>`,
    };
  }

  return {
    sourceUrl: fetched.finalUrl,
    updatedAt: null,
    body: `${attributionHtml(provider, fetched.finalUrl, null)}\n\n<div class="pinball-rulesheet remote-rulesheet legacy-rulesheet">\n${rebaseRelativeHtmlUrls(cleanupLegacyHtml(fetched.text, fetched.mimeType, provider), fetched.finalUrl)}\n</div>`,
  };
}

function frontMatterValue(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function selectRulesheetLinks(catalog) {
  const nameByGroup = new Map();
  for (const machine of catalog.machines || []) {
    const groupId = normalizeString(machine.opdb_group_id || machine.practice_identity);
    const name = normalizeString(machine.name);
    if (groupId && name && !nameByGroup.has(groupId)) {
      nameByGroup.set(groupId, name);
    }
  }

  const linksByGroup = new Map();
  for (const link of catalog.rulesheet_links || []) {
    const groupId = normalizeString(link.practice_identity);
    const provider = normalizeString(link.provider);
    const url = normalizeString(link.url);
    if (!groupId || !provider || !url || !SUPPORTED_PROVIDERS.has(provider)) continue;
    if (!linksByGroup.has(groupId)) linksByGroup.set(groupId, []);
    linksByGroup.get(groupId).push({
      provider,
      url,
      priority: Number(link.priority || 0),
      label: normalizeString(link.label) || "Rulesheet",
      gameName: nameByGroup.get(groupId) || groupId,
    });
  }

  return Array.from(linksByGroup.entries())
    .flatMap(([groupId, links]) =>
      links
        .sort((left, right) => left.priority - right.priority || left.provider.localeCompare(right.provider))
        .map((link, index) => ({
          groupId,
          link,
          isPrimary: index === 0,
        })),
    )
    .sort((left, right) => left.groupId.localeCompare(right.groupId));
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isGeneratedRemoteRulesheet(filePath) {
  if (!(await pathExists(filePath))) return false;
  const text = await fs.readFile(filePath, "utf8");
  return COPYABLE_PROVIDER_PATTERN.test(text);
}

async function readGeneratedProvider(filePath) {
  if (!(await pathExists(filePath))) return null;
  const text = await fs.readFile(filePath, "utf8");
  if (!COPYABLE_PROVIDER_PATTERN.test(text)) return null;
  return text.match(COPYABLE_PROVIDER_PATTERN)?.[1] ?? null;
}

function providerOutputPath(entry) {
  return path.join(OUT_DIR, `${entry.groupId}-${entry.link.provider}-rulesheet.md`);
}

function primaryOutputPath(entry) {
  return path.join(OUT_DIR, `${entry.groupId}-rulesheet.md`);
}

async function ensureAlias(targetPath, aliasPath) {
  if (await pathExists(aliasPath)) {
    if (!(await isGeneratedRemoteRulesheet(aliasPath))) {
      return false;
    }
    return true;
  }
  await fs.copyFile(targetPath, aliasPath);
  return true;
}

async function processEntry(entry) {
  const outputPath = providerOutputPath(entry);
  const aliasPath = entry.isPrimary ? primaryOutputPath(entry) : null;
  try {
    const outputExists = await pathExists(outputPath);
    if (outputExists && !(await isGeneratedRemoteRulesheet(outputPath))) {
      return { status: "skipped", groupId: entry.groupId, provider: entry.link.provider };
    }
    if (outputExists) {
      if (aliasPath) {
        await ensureAlias(outputPath, aliasPath);
      }
      return { status: "skipped", groupId: entry.groupId, provider: entry.link.provider };
    }
    if (aliasPath) {
      const existingAliasProvider = await readGeneratedProvider(aliasPath);
      if (existingAliasProvider === entry.link.provider) {
        await fs.copyFile(aliasPath, outputPath);
        return { status: "written", groupId: entry.groupId, provider: entry.link.provider };
      }
    }

    const rendered = await renderRemoteRulesheet(entry.link.provider, entry.link.url);
    const frontMatter = [
      "---",
      `title: "${frontMatterValue(entry.link.gameName)}"`,
      `source: "${frontMatterValue(rendered.sourceUrl)}"`,
      `provider: "${frontMatterValue(entry.link.provider)}"`,
      rendered.updatedAt ? `source_updated_at: "${frontMatterValue(rendered.updatedAt)}"` : null,
      "---",
      "",
    ].filter(Boolean).join("\n");
    await fs.writeFile(outputPath, `${frontMatter}\n${rendered.body.trim()}\n`, "utf8");
    if (aliasPath) {
      await ensureAlias(outputPath, aliasPath);
    }
    return { status: "written", groupId: entry.groupId, provider: entry.link.provider };
  } catch (error) {
    return {
      status: "failed",
      groupId: entry.groupId,
      provider: entry.link.provider,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runWithConcurrency(entries, worker, concurrency) {
  const queue = [...entries];
  const results = [];
  const runners = Array.from({ length: Math.min(concurrency, queue.length || 1) }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) break;
      results.push(await worker(next));
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const catalogPath = process.argv[2] && !process.argv[2].startsWith("--")
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_CATALOG_PATH;
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  const entries = selectRulesheetLinks(catalog);
  const results = await runWithConcurrency(entries, processEntry, 6);

  let written = 0;
  let skipped = 0;
  let failed = 0;
  for (const result of results) {
    if (result.status === "written") written += 1;
    if (result.status === "skipped") skipped += 1;
    if (result.status === "failed") {
      failed += 1;
      console.warn(`rulesheet export failed for ${result.groupId} (${result.provider}): ${result.message}`);
    }
  }
  console.log(`exported remote OPDB rulesheets: written=${written} skipped=${skipped} failed=${failed} total=${results.length} catalog=${catalogPath}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
