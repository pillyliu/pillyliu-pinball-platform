// src/pages/RulesheetPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { fetchPinballText } from "../lib/pinballCache";
import SiteHeader from "../components/SiteHeader";
import { APP_BACKGROUND_STYLE, Panel } from "../components/ui";

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
    if (!slug) return;
    fetchPinballText(`/pinball/rulesheets/${slug}.md`)
      .then((text) => {
        setRulesheetState({
          slug,
          md: text ? normalizeRulesheet(text) : null,
          status: "loaded",
        });
      })
      .catch(() => {
        setRulesheetState({
          slug,
          md: null,
          status: "missing",
        });
      });
  }, [slug]);

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

  const loading = slug ? rulesheetState.slug !== slug : false;
  const md = rulesheetState.slug === slug ? rulesheetState.md : null;

  return (
    <div className="min-h-screen text-neutral-100" style={APP_BACKGROUND_STYLE}>
      <SiteHeader title="Pinball Library" active="Library" />
      <div className="mx-auto max-w-4xl p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Link className="text-neutral-300 underline" to="/">
            ← Library
          </Link>
          {slug && (
            <Link className="text-neutral-300 underline" to={`/game/${slug}`}>
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
      </div>
    </div>
  );
}
