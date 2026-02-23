// src/pages/RulesheetPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { fetchPinballText } from "../../../shared/ui/pinballCache";
import { fetchPinballJson } from "../../../shared/ui/pinballCache";
import SiteHeader from "../components/SiteHeader";
import { APP_BACKGROUND_STYLE, PageContainer, Panel } from "../components/ui";

function normalizeRulesheet(input: string): string {
  let s = input.replace(/\r\n/g, "\n");

  // Remove YAML front matter block:
  // ---
  // ...
  // ---
  if (s.startsWith("---\n")) {
    const end = s.indexOf("\n---", 4);
    if (end !== -1) {
      const after = s.indexOf("\n", end + 4);
      s = after !== -1 ? s.slice(after + 1) : "";
    }
  }

  return s.trim();
}

function scrollToHash(hash: string) {
  const id = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!id) return;

  const elById = document.getElementById(id);
  const el =
    elById ??
    // Fallback: querySelector handles some odd cases
    document.querySelector(`[id="${CSS.escape(id)}"]`);

  if (el) {
    const header = document.querySelector("header");
    const headerHeight =
      header instanceof HTMLElement ? header.getBoundingClientRect().height : 0;
    const top = window.scrollY + el.getBoundingClientRect().top - headerHeight - 14;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
  }
}

export default function RulesheetPage() {
  const { slug } = useParams();
  const [resolveStatus, setResolveStatus] = useState<"idle" | "loading" | "done">("idle");
  const [resolvedGame, setResolvedGame] = useState<{
    routeId: string;
    legacySlug: string | null;
    practiceIdentity: string | null;
    rulesheetPractice: string | null;
    rulesheetLegacy: string | null;
  } | null>(null);
  const [rulesheetState, setRulesheetState] = useState<{
    slug: string | null;
    md: string | null;
    status: "idle" | "loaded" | "missing";
  }>({
    slug: null,
    md: null,
    status: "idle",
  });

  useEffect(() => {
    if (!slug) {
      setResolveStatus("done");
      setResolvedGame(null);
      return;
    }
    let cancelled = false;
    setResolveStatus("loading");
    fetchPinballJson<unknown>("/pinball/data/pinball_library_v2.json")
      .then((raw) => {
        if (cancelled) return;
        if (!raw || typeof raw !== "object" || Array.isArray(raw) || (raw as { version?: unknown }).version !== 2) {
          setResolvedGame(null);
          setResolveStatus("done");
          return;
        }
        const items = Array.isArray((raw as { items?: unknown[] }).items) ? (raw as { items: unknown[] }).items : [];
        const found = items.find((it) => {
          const item = (it ?? {}) as Record<string, unknown>;
          const routeId = String(item.library_entry_id ?? "").trim();
          const pinsideId = String(item.pinside_id ?? "").trim();
          const legacySlug = String(item.pinside_slug ?? "").trim();
          const practiceIdentity = String(item.practice_identity ?? "").trim();
          return routeId === slug || pinsideId === slug || legacySlug === slug || practiceIdentity === slug;
        }) as Record<string, unknown> | undefined;
        if (!found) {
          setResolvedGame(null);
          setResolveStatus("done");
          return;
        }
        const assets = found.assets && typeof found.assets === "object" ? (found.assets as Record<string, unknown>) : {};
        setResolvedGame({
          routeId: String(found.library_entry_id ?? "").trim() || slug,
          legacySlug: String(found.pinside_slug ?? "").trim() || null,
          practiceIdentity: String(found.practice_identity ?? "").trim() || null,
          rulesheetPractice: String(assets.rulesheet_local_practice ?? "").trim() || null,
          rulesheetLegacy: String(assets.rulesheet_local_legacy ?? "").trim() || null,
        });
        setResolveStatus("done");
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedGame(null);
        setResolveStatus("done");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    if (resolveStatus === "loading") return;
    const key = resolvedGame?.routeId ?? slug;
    const candidates = [
      resolvedGame?.rulesheetPractice,
      resolvedGame?.rulesheetLegacy,
      resolvedGame?.practiceIdentity ? `/pinball/rulesheets/${resolvedGame.practiceIdentity}-rulesheet.md` : null,
      resolvedGame?.legacySlug ? `/pinball/rulesheets/${resolvedGame.legacySlug}.md` : null,
      `/pinball/rulesheets/${slug}-rulesheet.md`,
      `/pinball/rulesheets/${slug}.md`,
    ].filter((v, i, a): v is string => Boolean(v) && a.indexOf(v as string) === i);

    let cancelled = false;
    (async () => {
      for (const candidate of candidates) {
        try {
          const text = await fetchPinballText(candidate);
          if (cancelled) return;
          setRulesheetState({
            slug: key,
            md: text ? normalizeRulesheet(text) : null,
            status: "loaded",
          });
          return;
        } catch {
          // try next candidate
        }
      }
      if (cancelled) return;
      setRulesheetState({
        slug: key,
        md: null,
        status: "missing",
      });
    })().catch(() => {
      if (cancelled) return;
      setRulesheetState({
        slug: key,
        md: null,
        status: "missing",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [slug, resolvedGame, resolveStatus]);

  useEffect(() => {
    if (!rulesheetState.md) return;
    if (!window.location.hash) return;
    const timer = window.setTimeout(() => scrollToHash(window.location.hash), 0);
    return () => window.clearTimeout(timer);
  }, [rulesheetState.md]);

  const sanitizeSchema = useMemo(() => {
    const base = defaultSchema as {
      tagNames?: string[];
      attributes?: Record<string, string[] | undefined>;
    };

    // Your rulesheets include raw HTML anchors like:
    // <span id="heading--..."></span>
    // Two key requirements:
    // 1) allow the span tag
    // 2) DO NOT clobber/prefix ids (otherwise ids become "user-content-...")
    const extraTags = [
      "span",
      "small",
      "div",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "colgroup",
      "col",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
    ];

    const tagNames = Array.from(
      new Set([...(base.tagNames ?? []), ...extraTags])
    );

    const attrs = base.attributes ?? {};

    return {
      ...base,
      tagNames,

      // Critical for hash links: keep ids exactly as-authored
      clobber: [],
      clobberPrefix: "",

      attributes: {
        ...attrs,

        "*": [...(attrs["*"] ?? []), "id", "class", "title"],

        a: [...(attrs.a ?? []), "href", "target", "rel"],

        img: [
          ...(attrs.img ?? []),
          "src",
          "alt",
          "width",
          "height",
          "loading",
          "decoding",
        ],

        span: [...(attrs.span ?? []), "id", "class"],

        div: [...(attrs.div ?? []), "id", "class"],

        h1: [...(attrs.h1 ?? []), "id", "class"],
        h2: [...(attrs.h2 ?? []), "id", "class"],
        h3: [...(attrs.h3 ?? []), "id", "class"],
        h4: [...(attrs.h4 ?? []), "id", "class"],
        h5: [...(attrs.h5 ?? []), "id", "class"],
        h6: [...(attrs.h6 ?? []), "id", "class"],
      },
    };
  }, []);

  const stateKey = resolvedGame?.routeId ?? slug;
  const loading = stateKey ? rulesheetState.slug !== stateKey : false;
  const md = rulesheetState.slug === stateKey ? rulesheetState.md : null;

  return (
    <div className="min-h-screen text-neutral-100" style={APP_BACKGROUND_STYLE}>
      <SiteHeader title="Pinball Library" active="Library" />
      <PageContainer className="max-w-4xl">
        <div className="flex flex-wrap items-center gap-4">
          <Link className="text-neutral-300 underline" to="/">
            ← Library
          </Link>
          {slug && (
            <Link className="text-neutral-300 underline" to={`/game/${encodeURIComponent(resolvedGame?.routeId ?? slug)}`}>
              Back to game
            </Link>
          )}
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-semibold">Rulesheet</h1>
          <div className="text-sm text-neutral-400">{slug ?? ""}</div>
        </div>

        <Panel className="mt-6 p-6">
          {loading ? (
            <div className="text-neutral-400">Loading rulesheet…</div>
          ) : md ? (
            <article
              className="
                prose prose-invert max-w-none
                prose-headings:scroll-mt-28
                prose-a:underline
                prose-pre:bg-neutral-950 prose-pre:ring-1 prose-pre:ring-neutral-800
                prose-hr:border-neutral-800
                prose-table:block prose-table:overflow-x-auto
                [&_.rulesheet-attribution]:block
                [&_.rulesheet-attribution]:text-[0.78rem]
                [&_.rulesheet-attribution]:leading-5
                [&_.rulesheet-attribution]:text-neutral-400
                [&_.rulesheet-attribution]:mb-3
              "
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
                components={{
                  a: ({ href, children, ...props }) => {
                    const h = typeof href === "string" ? href : "";
                    const isHash = h.startsWith("#");

                    if (isHash) {
                      return (
                        <a
                          {...props}
                          href={h}
                          onClick={(e) => {
                            e.preventDefault();
                            scrollToHash(h);
                          }}
                        >
                          {children}
                        </a>
                      );
                    }

                    return (
                      <a {...props} href={h} target="_blank" rel="noreferrer">
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {md}
              </ReactMarkdown>
            </article>
          ) : (
            <div>
              <div className="text-lg font-semibold">Rulesheet not available</div>
              <div className="mt-2 text-neutral-400">
                Expected file:
                <code className="ml-2 rounded bg-neutral-950 px-2 py-1">
                  shared/pinball/rulesheets/{slug}.md
                </code>
              </div>
            </div>
          )}
        </Panel>
      </PageContainer>
    </div>
  );
}
