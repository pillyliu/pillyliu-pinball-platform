import type { IncomingMessage, ServerResponse } from "node:http";

type SupportedProvider = "tf" | "pp" | "papa" | "bob";

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
  if (provider === "tf" || provider === "pp" || provider === "papa" || provider === "bob") {
    return provider;
  }
  return null;
}

function allowedHosts(provider: SupportedProvider): string[] {
  switch (provider) {
    case "tf":
      return ["tiltforums.com", "www.tiltforums.com"];
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
    return allowedHosts(provider).some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
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
  return `<small class="rulesheet-attribution">Source: ${escapeHtml(meta.sourceName)} | ${escapeHtml(meta.linkLabel)}: <a href="${escapeHtml(displayUrl)}">link</a>${updatedText} | ${escapeHtml(meta.details)} | Reformatted for readability and mobile use.</small>`;
}

async function renderRulesheet(provider: SupportedProvider, rawUrl: string): Promise<{ body: string; sourceUrl: string }> {
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
    const rendered = await renderRulesheet(provider, validatedUrl);
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
