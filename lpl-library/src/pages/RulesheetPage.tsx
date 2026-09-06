import { useEffect, useMemo, useRef, useState } from "react";
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

async function fetchLiveRulesheet(provider: string, url: string, legacyUrl: string | null = null): Promise<string> {
  const params = new URLSearchParams({ provider, url });
  // Refresh cached adapted cards when the reader's attribution contract changes.
  if (provider === "jlp") params.set("renderer", "jlp-v2");
  if (legacyUrl) params.set("legacy_url", legacyUrl);
  const endpoint = `/pinball/api/rulesheet.php?${params.toString()}`;
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
  const jlpCardStart = output.search(/<div\b[\s\S]*?\bclass=["'][^"']*\bjlp-card\b[^"']*["'][^>]*>/i);
  if (jlpCardStart >= 0) {
    const attribution = output.slice(0, jlpCardStart).trim();
    // JLP's authored HTML is intentionally readable and heavily indented. Markdown
    // treats an opening tag split across lines (and later indented lines) as a code
    // block, so flatten only this already-sanitized HTML fragment before rehype-raw
    // parses it. HTML whitespace semantics and the card's classes remain unchanged.
    const card = output.slice(jlpCardStart).replace(/\s*\n\s*/g, " ").trim();
    output = attribution ? `${attribution}\n\n${card}` : card;
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

const JLP_COLOR_TOKENS = [
  "blue", "red", "yellow", "green", "orange", "apricot", "purple", "cyan",
  "white", "black", "magenta", "pink", "draingerous",
] as const;

function colorizeJlpCard(root: HTMLElement) {
  const alternation = JLP_COLOR_TOKENS.join("|");
  const pattern = new RegExp(`\\.(${alternation})\\.|\\b(${alternation})\\b`, "gi");
  root.querySelectorAll<HTMLElement>(".jlp-card .colorized").forEach((container) => {
    if (container.dataset.jlpColorized === "true") return;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement?.closest(".jlp-color-token")) continue;
      pattern.lastIndex = 0;
      if (pattern.test(node.nodeValue ?? "")) textNodes.push(node as Text);
    }
    textNodes.forEach((node) => {
      const value = node.nodeValue ?? "";
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      pattern.lastIndex = 0;
      for (let match = pattern.exec(value); match; match = pattern.exec(value)) {
        if (match.index > cursor) fragment.append(value.slice(cursor, match.index));
        if (match[1]) {
          fragment.append(match[1]);
        } else {
          const token = match[2].toLowerCase();
          const span = document.createElement("span");
          span.className = `jlp-color-token jlp-color-${token}`;
          span.textContent = match[2];
          fragment.append(span);
        }
        cursor = match.index + match[0].length;
      }
      if (cursor < value.length) fragment.append(value.slice(cursor));
      node.parentNode?.replaceChild(fragment, node);
    });
    container.dataset.jlpColorized = "true";
  });
}

function JLPRulesheetLegend({ open, onOpen, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      closeRef.current?.focus();
    } else if (wasOpen.current) {
      dialog.close();
      triggerRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <div className="jlp-legend-layer">
        <dialog ref={dialogRef} className="jlp-legend-panel" aria-label="JLP Pinball Cards legend"
          onCancel={(event) => { event.preventDefault(); onClose(); }}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]");
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault(); last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault(); first?.focus();
            }
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
          }}>
          <div className="jlp-legend-heading">
            <div>
              <div className="jlp-legend-kicker">JLP Pinball Cards</div>
              <h2>Legend</h2>
            </div>
            <button ref={closeRef} type="button" className="jlp-legend-close" onClick={onClose} aria-label="Close legend">×</button>
          </div>
          <ul>
            <li>⭐️ — denotes a critical or more desirable choice</li>
            <li>❗️ — indicates an important rule or feature to be aware of (ex: lock stealing)</li>
            <li>🥇 — when you have a choice, this is the best option</li>
            <li>🥈 — when you have a choice, this is the 2nd best option</li>
            <li>🔒 — initially a locked feature, requiring completing something else to unlock</li>
            <li><strong>++X</strong> — this shot adds X to the value with each successful shot</li>
            <li><strong>MB</strong> — Multi-ball, Multiball, Tri-ball, etc…</li>
            <li><strong>JP</strong> — Jackpot</li>
            <li><strong>SJP</strong> — Super Jackpot</li>
            <li><strong>VUK</strong> — Vertical Up-Kicker</li>
            <li><strong>Bonus X, Playfield X, Shot X</strong> — a multiplier applied to bonus, playfield, or a shot</li>
            <li><strong>Draingerous</strong> — a shot that is very high risk to drain the ball</li>
          </ul>
          <a href="https://pinballcards.net/legend" target="_blank" rel="noreferrer">Original JLP legend</a>
        </dialog>
        <button ref={triggerRef} type="button" className="jlp-legend-button" hidden={open} onClick={onOpen} aria-label="Show JLP card legend" aria-haspopup="dialog" aria-expanded={open}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="4" y="3" width="16" height="18" rx="3" />
            <path d="M8 8h8M8 12h8M8 16h5" />
          </svg>
        </button>
    </div>
  );
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
  const [jlpLegendOpen, setJlpLegendOpen] = useState(false);
  const rulesheetContentRef = useRef<HTMLDivElement>(null);

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
          const text = await fetchLiveRulesheet(
            selectedProvider,
            selectedRulesheet.url,
            selectedRulesheet.legacyUrls?.[0] ?? null,
          );
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
        // HAST represents HTML's `class` attribute as `className`. Retaining it
        // preserves JLP's authored layout hooks and enables the app-owned color
        // legend pass; executable attributes remain excluded by the schema.
        "*": [...(attributes["*"] ?? []), "id", "className", "title"],
        a: [...(attributes.a ?? []), "href", "target", "rel", "name", "id", "className"],
        img: [...(attributes.img ?? []), "src", "alt", "width", "height", "loading", "decoding", "className"],
        span: [...(attributes.span ?? []), "id", "className"],
        div: [...(attributes.div ?? []), "id", "className"],
        h1: [...(attributes.h1 ?? []), "id", "className"],
        h2: [...(attributes.h2 ?? []), "id", "className"],
        h3: [...(attributes.h3 ?? []), "id", "className"],
        h4: [...(attributes.h4 ?? []), "id", "className"],
        h5: [...(attributes.h5 ?? []), "id", "className"],
        h6: [...(attributes.h6 ?? []), "id", "className"],
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
  const isJlpRulesheet = referenceLinkProvider(externalRulesheet) === "jlp";

  useEffect(() => {
    setJlpLegendOpen(false);
  }, [stateKey]);

  useEffect(() => {
    if (!md || !isJlpRulesheet || !rulesheetContentRef.current) return;
    colorizeJlpCard(rulesheetContentRef.current);
  }, [isJlpRulesheet, md]);

  return (
    <div className="min-h-screen text-neutral-100" style={APP_BACKGROUND_STYLE}>
      <SiteHeader title="Pinball Library" active="Library" />
      <PageContainer>
        <Link className="text-neutral-300 underline" to={game ? `/game/${encodeURIComponent(game.routeId)}` : "/"}>
          ← Back
        </Link>

        <Panel className={`mt-4 p-4 sm:p-6${isJlpRulesheet ? " jlp-reader-frame" : ""}`}>
          {loading ? (
            <div className="text-sm text-neutral-400">Loading rulesheet…</div>
          ) : md ? (
            <div ref={rulesheetContentRef} className="rulesheet-rich-content prose prose-invert max-w-none break-words">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[[rehypeRaw], [rehypeSanitize, sanitizeSchema]]}
                components={{
                  table: ({ node, ...props }) => {
                    void node;
                    return (
                      <div className="table-scroll">
                        <table {...props} />
                      </div>
                    );
                  },
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
      {md && isJlpRulesheet && (
        <JLPRulesheetLegend
          open={jlpLegendOpen}
          onOpen={() => setJlpLegendOpen(true)}
          onClose={() => setJlpLegendOpen(false)}
        />
      )}
    </div>
  );
}
