import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { fetchPinballText } from "../../../shared/ui/pinballCache";
import SiteHeader from "../components/SiteHeader";
import { APP_BACKGROUND_STYLE } from "../components/uiStyles";
import { PageContainer, Panel } from "../components/ui";
import {
  type LibraryGame,
  findLibraryGame,
  loadResolvedLibraryData,
  preferredRulesheetLink,
  referenceLinkProvider,
  rulesheetMarkdownCandidates,
  rulesheetMarkdownCandidatesForLink,
} from "../lib/libraryData";

async function fetchLiveRulesheet(provider: string, url: string): Promise<string> {
  const endpoint = `/pinball/api/rulesheet.php?provider=${encodeURIComponent(provider)}&url=${encodeURIComponent(url)}`;
  const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Live rulesheet request failed (${response.status})`);
  }
  const payload = await response.json() as { body?: unknown };
  if (typeof payload.body !== "string" || !payload.body.trim()) {
    throw new Error("Live rulesheet response was empty");
  }
  return payload.body;
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

function rebaseRelativeHtmlUrls(input: string, baseUrl: string): string {
  const rewrittenAttributes = input.replace(/(\s(?:src|href)=["'])([^"']+)(["'])/gi, (_, prefix, value, suffix) => (
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

function normalizeRulesheet(input: string): string {
  let output = input.replace(/\r\n/g, "\n");
  let sourceUrl: string | null = null;
  if (output.startsWith("---\n")) {
    const end = output.indexOf("\n---", 4);
    if (end !== -1) {
      const frontMatter = output.slice(4, end);
      const sourceMatch = frontMatter.match(/^source:\s*"([^"]+)"/m);
      sourceUrl = sourceMatch?.[1] ?? null;
      const after = output.indexOf("\n", end + 4);
      output = after !== -1 ? output.slice(after + 1) : "";
    }
  }
  if (sourceUrl) {
    output = rebaseRelativeHtmlUrls(output, sourceUrl);
  }
  return output.trim();
}

function scrollToHash(hash: string) {
  const id = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!id) return;
  const byId = document.getElementById(id);
  const element = byId ?? document.querySelector(`[id="${CSS.escape(id)}"]`);
  if (!element) return;
  const header = document.querySelector("header");
  const headerHeight = header instanceof HTMLElement ? header.getBoundingClientRect().height : 0;
  const top = window.scrollY + element.getBoundingClientRect().top - headerHeight - 14;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  history.replaceState(null, "", `#${id}`);
}

export default function RulesheetPage() {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();
  const [game, setGame] = useState<LibraryGame | null>(null);
  const [resolveStatus, setResolveStatus] = useState<"idle" | "loading" | "done">("idle");
  const [rulesheetState, setRulesheetState] = useState<{
    key: string | null;
    md: string | null;
    status: "idle" | "loaded" | "missing";
  }>({
    key: null,
    md: null,
    status: "idle",
  });

  useEffect(() => {
    if (!gameId) {
      setResolveStatus("done");
      setGame(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setResolveStatus("loading");
      try {
        const bundle = await loadResolvedLibraryData();
        if (cancelled) return;
        setGame(findLibraryGame(bundle.games, gameId));
      } catch {
        if (cancelled) return;
        setGame(null);
      } finally {
        if (!cancelled) setResolveStatus("done");
      }
    };
    load().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    if (resolveStatus === "loading") return;
    const requestedSource = searchParams.get("source")?.trim().toLowerCase() ?? null;
    const key = `${game?.routeId ?? gameId}::${requestedSource ?? "default"}`;
    const selectedRulesheet = game
      ? requestedSource
        ? game.rulesheetLinks.find((link) => referenceLinkProvider(link) === requestedSource)
          ?? (requestedSource === "local" && game.rulesheetLocal
            ? { label: "Rulesheet", url: "", provider: "local", localPath: null }
            : null)
        : preferredRulesheetLink(game)
      : null;
    const candidates = game
      ? requestedSource
        ? rulesheetMarkdownCandidatesForLink(game, selectedRulesheet)
        : rulesheetMarkdownCandidates(game)
      : [];
    const selectedProvider = selectedRulesheet ? referenceLinkProvider(selectedRulesheet) : null;

    let cancelled = false;
    const load = async () => {
      for (const candidate of candidates) {
        try {
          const text = await fetchPinballText(candidate);
          if (cancelled) return;
          setRulesheetState({
            key,
            md: text ? normalizeRulesheet(text) : null,
            status: "loaded",
          });
          return;
        } catch {
          // try next candidate
        }
      }
      if (selectedRulesheet?.url && selectedProvider && selectedProvider !== "local") {
        try {
          const text = await fetchLiveRulesheet(selectedProvider, selectedRulesheet.url);
          if (cancelled) return;
          setRulesheetState({
            key,
            md: normalizeRulesheet(text),
            status: "loaded",
          });
          return;
        } catch {
          // fall through to missing state
        }
      }
      if (cancelled) return;
      setRulesheetState({
        key,
        md: null,
        status: "missing",
      });
    };
    load().catch(() => {
      if (cancelled) return;
      setRulesheetState({
        key,
        md: null,
        status: "missing",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [game, resolveStatus, searchParams, gameId]);

  useEffect(() => {
    if (!rulesheetState.md || !window.location.hash) return;
    const timer = window.setTimeout(() => scrollToHash(window.location.hash), 0);
    return () => window.clearTimeout(timer);
  }, [rulesheetState.md]);

  const sanitizeSchema = useMemo(() => {
    const base = defaultSchema as {
      tagNames?: string[];
      attributes?: Record<string, string[] | undefined>;
    };
    const extraTags = ["span", "small", "div", "img", "table", "thead", "tbody", "tr", "th", "td", "colgroup", "col", "h1", "h2", "h3", "h4", "h5", "h6"];
    const tagNames = Array.from(new Set([...(base.tagNames ?? []), ...extraTags]));
    const attributes = base.attributes ?? {};
    return {
      ...base,
      tagNames,
      clobber: [],
      clobberPrefix: "",
      attributes: {
        ...attributes,
        "*": [...(attributes["*"] ?? []), "id", "class", "title"],
        a: [...(attributes.a ?? []), "href", "target", "rel", "name", "id", "class"],
        img: [...(attributes.img ?? []), "src", "alt", "width", "height", "loading", "decoding"],
        span: [...(attributes.span ?? []), "id", "class"],
        div: [...(attributes.div ?? []), "id", "class"],
        h1: [...(attributes.h1 ?? []), "id", "class"],
        h2: [...(attributes.h2 ?? []), "id", "class"],
        h3: [...(attributes.h3 ?? []), "id", "class"],
        h4: [...(attributes.h4 ?? []), "id", "class"],
        h5: [...(attributes.h5 ?? []), "id", "class"],
        h6: [...(attributes.h6 ?? []), "id", "class"],
      },
    };
  }, []);

  const requestedSource = searchParams.get("source")?.trim().toLowerCase() ?? null;
  const stateKey = `${game?.routeId ?? gameId ?? ""}::${requestedSource ?? "default"}`;
  const loading = stateKey ? rulesheetState.key !== stateKey : false;
  const md = rulesheetState.key === stateKey ? rulesheetState.md : null;
  const externalRulesheet = useMemo(() => {
    if (!game) return null;
    if (!requestedSource) return preferredRulesheetLink(game);
    return game.rulesheetLinks.find((link) => referenceLinkProvider(link) === requestedSource)
      ?? preferredRulesheetLink(game);
  }, [game, requestedSource]);

  return (
    <div className="min-h-screen text-neutral-100" style={APP_BACKGROUND_STYLE}>
      <SiteHeader title="Pinball Library" active="Library" />
      <PageContainer>
        <Link className="text-neutral-300 underline" to={game ? `/game/${encodeURIComponent(game.routeId)}` : "/"}>
          ← Back
        </Link>

        <Panel className="mt-4 p-4 sm:p-6">
          {loading ? (
            <div className="text-sm text-neutral-400">Loading rulesheet…</div>
          ) : md ? (
            <div className="rulesheet-rich-content prose prose-invert max-w-none break-words">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[[rehypeRaw], [rehypeSanitize, sanitizeSchema]]}
                components={{
                  table: ({ node: _node, ...props }) => (
                    <div className="table-scroll">
                      <table {...props} />
                    </div>
                  ),
                }}
              >
                {md}
              </ReactMarkdown>
            </div>
          ) : externalRulesheet?.url ? (
            <div className="space-y-3">
              <div className="text-sm text-neutral-300">
                No local markdown rulesheet is available for this game.
              </div>
              <a
                className="inline-flex rounded-xl bg-neutral-800 px-4 py-2 text-sm text-neutral-100 hover:bg-neutral-700"
                href={externalRulesheet.url}
                target="_blank"
                rel="noreferrer"
              >
                Open {externalRulesheet.label}
              </a>
            </div>
          ) : (
            <div className="text-sm text-neutral-400">
              {resolveStatus === "loading" ? "Loading rulesheet…" : "No rulesheet available."}
            </div>
          )}
        </Panel>
      </PageContainer>
    </div>
  );
}
