import type { IncomingMessage, ServerResponse } from "node:http";

type SupportedProvider = "tf" | "prs" | "jlp" | "pp" | "papa" | "bob";

const ACCEPT_HEADER = "text/html,application/json;q=0.9,*/*;q=0.8";
const USER_AGENT = "Mozilla/5.0 PinballLibraryRulesheetProxy/1.0";

function normalizeString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeProvider(value: string | null): SupportedProvider | null {
  const provider = (value ?? "").trim().toLowerCase();
  if (provider === "pinballrulesheets" || provider === "pinball_rulesheets" || provider === "prs") {
    return "prs";
  }
  if (provider === "pinballcards" || provider === "pinball_cards" || provider === "jlp") {
    return "jlp";
  }
  if (provider === "tf" || provider === "pp" || provider === "papa" || provider === "bob") {
    return provider;
  }
  return null;
}

function allowedHosts(provider: SupportedProvider): string[] {
  switch (provider) {
    case "tf":
      return ["tiltforums.com", "www.tiltforums.com"];
    case "prs":
      return ["pinballrulesheets.com", "www.pinballrulesheets.com"];
    case "jlp":
      return ["pinballcards.net", "www.pinballcards.net"];
    case "pp":
      return ["pinballprimer.github.io", "pinballprimer.com", "www.pinballprimer.com"];
    case "papa":
      return ["pinball.org", "www.pinball.org"];
    case "bob":
      return ["rules.silverballmania.com", "silverballmania.com", "www.silverballmania.com", "flippers.be", "www.flippers.be"];
    default:
      return [];
  }
}

function validateProviderUrl(provider: SupportedProvider, rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    return allowedHosts(provider).some((suffix) => host === suffix || (!["prs", "jlp"].includes(provider) && host.endsWith(`.${suffix}`)))
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function validateLegacyTiltUrl(rawUrl: string | null): string | null {
  const value = normalizeString(rawUrl);
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return ["tiltforums.com", "www.tiltforums.com"].includes(parsed.hostname.toLowerCase())
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function jsonResponse(res: ServerResponse, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=UTF-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(payload));
}

function jsonError(res: ServerResponse, status: number, message: string) {
  jsonResponse(res, status, { error: message });
}

async function httpFetch(url: string): Promise<{ text: string; finalUrl: string; mimeType: string }> {
  const response = await fetch(url, {
    headers: {
      Accept: ACCEPT_HEADER,
      "User-Agent": USER_AGENT,
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Remote fetch failed with status ${response.status}`);
  }
  return {
    text: await response.text(),
    finalUrl: response.url || url,
    mimeType: response.headers.get("content-type") ?? "",
  };
}

function tiltForumsApiUrl(rawUrl: string): string {
  if (rawUrl.includes("/posts/") && rawUrl.toLowerCase().endsWith(".json")) {
    return rawUrl;
  }
  const normalized = rawUrl.replace(/\?.*$/, "");
  return normalized.toLowerCase().endsWith(".json") ? normalized : `${normalized}.json`;
}

function canonicalTopicUrl(rawUrl: string): string {
  return rawUrl.replace(/\?.*$/, "").replace(/\.json$/i, "");
}

function legacyFetchUrl(provider: SupportedProvider, rawUrl: string): string {
  if (provider !== "bob" || !rawUrl.includes("silverballmania.com")) {
    return rawUrl;
  }
  try {
    const parsed = new URL(rawUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const slug = segments.at(-1);
    return slug ? `https://rules.silverballmania.com/print/${slug}` : rawUrl;
  } catch {
    return rawUrl;
  }
}

function extractTagHtml(html: string, tag: string): string | null {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  return pattern.exec(html)?.[1] ?? null;
}

function stripHtmlPatterns(html: string, patterns: RegExp[]): string {
  return patterns.reduce((output, pattern) => output.replace(pattern, ""), html);
}

function shouldTreatAsPlainText(text: string, mimeType: string): boolean {
  if (mimeType.toLowerCase().includes("text/plain")) return true;
  return !/<[a-zA-Z!/][^>]*>/.test(text);
}

function cleanupPrimerHtml(html: string): string {
  const cleaned = stripHtmlPatterns(extractTagHtml(html, "body") ?? html, [
    /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    /<style\b[^>]*>[\s\S]*?<\/style>/gi,
    /<!--[\s\S]*?-->/g,
  ]);
  const h1Match = /<h1\b[^>]*>/i.exec(cleaned);
  return (h1Match ? cleaned.slice(h1Match.index) : cleaned).trim();
}

function cleanupPinballRuleSheetsHtml(html: string): string {
  const match = /<section\b[^>]*\bid\s*=\s*(["'])main_content\1[^>]*>([\s\S]*?)<\/section>/i.exec(html);
  if (!match?.[2]) {
    throw new Error("Pinball Rule Sheets page did not include main_content");
  }
  return stripHtmlPatterns(match[2], [
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    /<style\b[^>]*>[\s\S]*?<\/style>/gi,
    /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
    /<form\b[^>]*>[\s\S]*?<\/form>/gi,
    /<object\b[^>]*>[\s\S]*?<\/object>/gi,
    /<embed\b[^>]*\/?>/gi,
    /<base\b[^>]*\/?>/gi,
    /<!--[\s\S]*?-->/g,
    /\son[a-z0-9_-]+\s*=\s*"[^"]*"/gi,
    /\son[a-z0-9_-]+\s*=\s*'[^']*'/gi,
    /\son[a-z0-9_-]+\s*=\s*[^\s>]+/gi,
    /\s(?:href|src)\s*=\s*"\s*javascript:[^"]*"/gi,
    /\s(?:href|src)\s*=\s*'\s*javascript:[^']*'/gi,
  ]).trim();
}

type HtmlRange = { start: number; end: number };

function classTokens(openingTag: string): Set<string> {
  const value = /\bclass\s*=\s*(["'])([\s\S]*?)\1/i.exec(openingTag)?.[2] ?? "";
  return new Set(value.split(/\s+/).filter(Boolean));
}

function balancedDivRangeAt(html: string, start: number): HtmlRange | null {
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = start;
  let depth = 0;
  let sawOpening = false;
  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    if (!sawOpening && match.index !== start) return null;
    const closing = /^<\s*\//.test(match[0]);
    if (closing) {
      depth -= 1;
      if (sawOpening && depth === 0) return { start, end: tags.lastIndex };
    } else {
      sawOpening = true;
      depth += 1;
    }
  }
  return null;
}

function findBalancedDivRange(
  html: string,
  predicate: (openingTag: string, tokens: Set<string>) => boolean,
): HtmlRange | null {
  const openings = /<div\b[^>]*>/gi;
  for (let match = openings.exec(html); match; match = openings.exec(html)) {
    if (predicate(match[0], classTokens(match[0]))) {
      return balancedDivRangeAt(html, match.index);
    }
  }
  return null;
}

function replaceRange(html: string, range: HtmlRange, replacement: string): string {
  return `${html.slice(0, range.start)}${replacement}${html.slice(range.end)}`;
}

function pinballCardsVideoLessonHtml(html: string): string {
  const lessons: Array<{ url: string; title: string; duration: string | null }> = [];
  const links = /<a\b(?=[^>]*openVideoLightbox\('([^']+)'\))[^>]*>([\s\S]*?)<\/a>/gi;
  for (let match = links.exec(html); match; match = links.exec(html)) {
    const url = normalizeString(match[1]);
    if (!url || !/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(url)) continue;
    const title = normalizeString(
      /<div\b[^>]*class=["'][^"']*font-semibold[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
        .exec(match[2])?.[1]
        ?.replace(/<[^>]+>/g, " "),
    ) ?? "Video lesson";
    const duration = normalizeString(/Duration:\s*([^<]+)/i.exec(match[2])?.[1]);
    lessons.push({ url, title, duration });
  }
  if (!lessons.length) return "";
  const lessonLinks = lessons.map((lesson) => (
    `<a class="jlp-video-lesson" href="${escapeHtml(lesson.url)}">` +
      `<span>${escapeHtml(lesson.title)}</span>` +
      (lesson.duration ? `<small>${escapeHtml(lesson.duration)}</small>` : "") +
    "</a>"
  )).join("\n");
  return `<div class="jlp-video-lessons"><h2>@PinballExplained Video Lessons</h2>${lessonLinks}</div>`;
}

export function cleanupPinballCardsHtml(
  html: string,
  baseUrl: string,
): { html: string; updatedAt: string | null } {
  const updatedAt = normalizeString(/Strategy updated:\s*([^<]+)/i.exec(html)?.[1]);
  const cardRange = findBalancedDivRange(html, (_tag, tokens) => (
    tokens.has("bg-white") && tokens.has("rounded-2xl") && tokens.has("space-y-6")
  ));
  if (!cardRange) throw new Error("JLP Pinball Cards page did not include its card wrapper");

  let card = html.slice(cardRange.start, cardRange.end);
  const videoLessons = pinballCardsVideoLessonHtml(card);
  const videoOverlay = findBalancedDivRange(card, (tag) => /\bid\s*=\s*(["'])video-list-overlay\1/i.test(tag));
  if (videoOverlay) card = replaceRange(card, videoOverlay, "");
  const videoButton = findBalancedDivRange(card, (_tag, tokens) => tokens.has("-mt-2") && tokens.has("mb-2"));
  if (videoButton) card = replaceRange(card, videoButton, videoLessons);

  const mastheadArt = findBalancedDivRange(card, (tag, tokens) => (
    tokens.has("bg-cover") && /background-image\s*:/i.test(tag)
  ));
  if (mastheadArt) {
    const opening = card.slice(mastheadArt.start, card.indexOf(">", mastheadArt.start) + 1);
    const assetPath = /background-image\s*:\s*url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/i.exec(opening)?.[1] ?? null;
    if (assetPath) {
      const assetUrl = rebaseRelativeUrl(assetPath, baseUrl);
      card = replaceRange(
        card,
        mastheadArt,
        `<img class="jlp-masthead-art" src="${escapeHtml(assetUrl)}" alt="" aria-hidden="true">`,
      );
    }
  }

  card = card.replace(
    /^(\s*<div\b[^>]*\bclass\s*=\s*["'])([^"']*)(["'])/i,
    "$1jlp-card $2$3",
  );
  card = stripHtmlPatterns(card, [
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    /<style\b[^>]*>[\s\S]*?<\/style>/gi,
    /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
    /<form\b[^>]*>[\s\S]*?<\/form>/gi,
    /<object\b[^>]*>[\s\S]*?<\/object>/gi,
    /<embed\b[^>]*\/?>/gi,
    /<base\b[^>]*\/?>/gi,
    /<button\b[^>]*>[\s\S]*?<\/button>/gi,
    /<!--[^]*?-->/g,
    /\son[a-z0-9_-]+\s*=\s*"[^"]*"/gi,
    /\son[a-z0-9_-]+\s*=\s*'[^']*'/gi,
    /\son[a-z0-9_-]+\s*=\s*[^\s>]+/gi,
    /\sstyle\s*=\s*"[^"]*"/gi,
    /\sstyle\s*=\s*'[^']*'/gi,
    /\s(?:href|src)\s*=\s*"\s*javascript:[^"]*"/gi,
    /\s(?:href|src)\s*=\s*'\s*javascript:[^']*'/gi,
  ]).trim();
  return { html: rebaseRelativeHtmlUrls(card, baseUrl), updatedAt };
}

function cleanupLegacyHtml(html: string, mimeType: string, provider: SupportedProvider): string {
  if (shouldTreatAsPlainText(html, mimeType)) {
    return `<pre class="rulesheet-preformatted">${escapeHtml(html.trim())}</pre>`;
  }

  if (provider === "bob") {
    const main = extractTagHtml(html, "main");
    if (main !== null) {
      return stripHtmlPatterns(main, [
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        /<!--[\s\S]*?-->/g,
        /<a\b[^>]*title="Print"[^>]*>[\s\S]*?<\/a>/gi,
      ]).trim();
    }
  }

  return stripHtmlPatterns(extractTagHtml(html, "body") ?? html, [
    /<\?[\s\S]*?\?>/g,
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    /<style\b[^>]*>[\s\S]*?<\/style>/gi,
    /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
    /<!--[\s\S]*?-->/g,
    /<\/?(html|head|body|meta|link)\b[^>]*>/gi,
  ]).trim();
}

function rebaseRelativeUrl(value: string, baseUrl: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("#")) return trimmed;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(trimmed)) return trimmed;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return trimmed;
  }
}

function rebaseRelativeHtmlUrls(html: string, baseUrl: string): string {
  const rewrittenAttributes = html.replace(/(\s(?:src|href)=["'])([^"']+)(["'])/gi, (_, prefix, value, suffix) => (
    `${prefix}${rebaseRelativeUrl(String(value), baseUrl)}${suffix}`
  ));
  return rewrittenAttributes.replace(/(\ssrcset=["'])([^"']+)(["'])/gi, (_, prefix, value, suffix) => {
    const rewritten = String(value)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [url, descriptor] = entry.split(/\s+/, 2);
        const nextUrl = rebaseRelativeUrl(url, baseUrl);
        return descriptor ? `${nextUrl} ${descriptor}` : nextUrl;
      })
      .join(", ");
    return `${prefix}${rewritten}${suffix}`;
  });
}

function sourceMeta(provider: SupportedProvider): { sourceName: string; linkLabel: string; details: string } {
  switch (provider) {
    case "tf":
      return {
        sourceName: "Tilt Forums community rulesheet",
        linkLabel: "Original thread",
        details: "License/source terms remain with Tilt Forums and the original authors.",
      };
    case "prs":
      return {
        sourceName: "Pinball Rule Sheets",
        linkLabel: "Original page",
        details: "Source terms and author/site rights remain with Pinball Rule Sheets and the original authors.",
      };
    case "jlp":
      return {
        sourceName: "JLP Pinball Cards",
        linkLabel: "Original card",
        details: "JLP Pinball Cards content and credited source assets are reproduced with permission.",
      };
    case "pp":
      return {
        sourceName: "Pinball Primer",
        linkLabel: "Original page",
        details: "Source terms and author/site rights remain with Pinball Primer and its original author.",
      };
    case "papa":
      return {
        sourceName: "PAPA / pinball.org rulesheet archive",
        linkLabel: "Original page",
        details: "Source terms and author/site rights remain with PAPA / pinball.org, the original archive, and its original contributors.",
      };
    case "bob":
      return {
        sourceName: "Silverball Rules (Bob Matthews source)",
        linkLabel: "Original page",
        details: "Source terms and author/site rights remain with Bob Matthews / Silverball Rules.",
      };
  }
}

function attributionHtml(provider: SupportedProvider, displayUrl: string, updatedAt: string | null): string {
  const meta = sourceMeta(provider);
  const updatedText = updatedAt ? ` | Updated: ${escapeHtml(updatedAt)}` : "";
  const adaptation = provider === "jlp"
    ? "Adapted to the PinProf reader while retaining the original card structure, masthead artwork, references, and credits."
    : "Reformatted for readability and mobile use.";
  return `<small class="rulesheet-attribution">Source: ${escapeHtml(meta.sourceName)} | ${escapeHtml(meta.linkLabel)}: <a href="${escapeHtml(displayUrl)}">link</a>${updatedText} | ${escapeHtml(meta.details)} | ${escapeHtml(adaptation)}</small>`;
}

async function renderRulesheet(
  provider: SupportedProvider,
  rawUrl: string,
  legacyTiltUrl: string | null = null,
): Promise<{ body: string; sourceUrl: string }> {
  if (provider === "tf") {
    const fetched = await httpFetch(tiltForumsApiUrl(rawUrl));
    const payload = JSON.parse(fetched.text) as {
      post_stream?: { posts?: Array<Record<string, unknown>> };
      cooked?: unknown;
      topic_slug?: unknown;
      topic_id?: unknown;
      updated_at?: unknown;
    };
    const post = payload.post_stream?.posts?.[0] ?? payload;
    const cooked = normalizeString(typeof post.cooked === "string" ? post.cooked : null);
    if (!cooked) {
      throw new Error("Tilt Forums payload missing cooked HTML");
    }
    const topicSlug = normalizeString(typeof post.topic_slug === "string" ? post.topic_slug : null);
    const topicId = typeof post.topic_id === "number"
      ? post.topic_id
      : typeof post.topic_id === "string" && post.topic_id.trim()
        ? Number.parseInt(post.topic_id, 10)
        : null;
    const canonicalUrl = topicSlug && Number.isFinite(topicId)
      ? `https://tiltforums.com/t/${encodeURIComponent(topicSlug)}/${topicId}`
      : canonicalTopicUrl(rawUrl);
    const updatedAt = normalizeString(typeof post.updated_at === "string" ? post.updated_at : null);
    return {
      body: `${attributionHtml(provider, canonicalUrl, updatedAt)}\n\n<div class="pinball-rulesheet remote-rulesheet tiltforums-rulesheet">\n${cooked}\n</div>`,
      sourceUrl: canonicalUrl,
    };
  }

  const fetched = await httpFetch(provider === "bob" ? legacyFetchUrl(provider, rawUrl) : rawUrl);
  if (provider === "jlp") {
    const card = cleanupPinballCardsHtml(fetched.text, fetched.finalUrl);
    return {
      body: `${attributionHtml(provider, fetched.finalUrl, card.updatedAt)}\n\n<div class="pinball-rulesheet remote-rulesheet jlp-pinball-card">\n${card.html}\n</div>`,
      sourceUrl: fetched.finalUrl,
    };
  }
  if (provider === "prs") {
    const body = rebaseRelativeHtmlUrls(cleanupPinballRuleSheetsHtml(fetched.text), fetched.finalUrl);
    const migrationNote = legacyTiltUrl
      ? '\n\n<p class="rulesheet-migration-note">Migrated from Tilt Forums.</p>'
      : "";
    return {
      body: `${attributionHtml(provider, fetched.finalUrl, null)}${migrationNote}\n\n<div class="pinball-rulesheet remote-rulesheet pinball-rulesheets-rulesheet">\n${body}\n</div>`,
      sourceUrl: fetched.finalUrl,
    };
  }
  if (provider === "pp") {
    const body = rebaseRelativeHtmlUrls(cleanupPrimerHtml(fetched.text), fetched.finalUrl);
    return {
      body: `${attributionHtml(provider, fetched.finalUrl, null)}\n\n<div class="pinball-rulesheet remote-rulesheet primer-rulesheet">\n${body}\n</div>`,
      sourceUrl: fetched.finalUrl,
    };
  }

  const body = rebaseRelativeHtmlUrls(cleanupLegacyHtml(fetched.text, fetched.mimeType, provider), fetched.finalUrl);
  return {
    body: `${attributionHtml(provider, fetched.finalUrl, null)}\n\n<div class="pinball-rulesheet remote-rulesheet legacy-rulesheet">\n${body}\n</div>`,
    sourceUrl: fetched.finalUrl,
  };
}

export async function handlePinballRulesheetProxyRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  if (requestUrl.pathname !== "/pinball/api/rulesheet.php") return false;

  if (req.method !== "GET") {
    jsonError(res, 405, "Method not allowed");
    return true;
  }

  const provider = normalizeProvider(requestUrl.searchParams.get("provider"));
  const rawUrl = normalizeString(requestUrl.searchParams.get("url"));
  const legacyTiltUrl = validateLegacyTiltUrl(
    requestUrl.searchParams.get("legacy_url") ?? requestUrl.searchParams.get("legacyUrl"),
  );
  if (!provider || !rawUrl) {
    jsonError(res, 400, "Missing provider or url");
    return true;
  }

  const validatedUrl = validateProviderUrl(provider, rawUrl);
  if (!validatedUrl) {
    jsonError(res, 400, "URL is not allowed for provider");
    return true;
  }

  try {
    const rendered = await renderRulesheet(provider, validatedUrl, legacyTiltUrl);
    res.setHeader("Cache-Control", `public, max-age=${provider === "tf" ? 300 : 3600}`);
    jsonResponse(res, 200, {
      provider,
      url: validatedUrl,
      sourceUrl: rendered.sourceUrl,
      body: rendered.body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "Remote fetch failed");
    jsonError(res, 502, message);
  }

  return true;
}
