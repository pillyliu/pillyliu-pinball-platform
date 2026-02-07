import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { cacheAssetUrl, fetchPinballJson, fetchPinballText } from "../lib/pinballCache";
import SiteHeader from "../components/SiteHeader";
import { PageContainer, Panel, SectionHeading, SUBTLE_BUTTON_CLASS } from "../components/ui";

type Video = { kind: string; label: string; url: string };

type Game = {
  group?: number | null;
  pos?: number | null;
  bank?: number | null;

  name: string;
  manufacturer: string | null;
  year: number | null;
  slug: string;

  playfieldLocal: string | null;
  playfieldImageUrl: string | null;

  rulesheetLocal: string;
  rulesheetUrl: string | null;

  videos: Video[];
};

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.replace("/", "") || null;
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    return null;
  } catch {
    return null;
  }
}

function locationText(group?: number | null, pos?: number | null): string | null {
  if (typeof group !== "number" || typeof pos !== "number") return null;
  const floor = group >= 1 && group <= 4 ? "U" : "D";
  return `📍 ${floor}:${group}:${pos}`;
}

function playfieldImageSources(slug: string, playfieldLocal: string | null) {
  const base = `/pinball/images/playfields/${slug}`;
  const fallback = playfieldLocal ?? `${base}.jpg`;
  return {
    src: `${base}_700.webp`,
    srcSet: `${base}_700.webp 700w, ${base}_1400.webp 1400w, ${fallback} 2400w`,
    fallback,
  };
}

export default function GamePage() {
  const { slug } = useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  const [infoMd, setInfoMd] = useState<string | null>(null);
  const [infoStatus, setInfoStatus] = useState<
    "idle" | "loading" | "loaded" | "missing" | "error"
  >("idle");

  useEffect(() => {
    fetchPinballJson<Game[]>("/pinball/data/pinball_library.json")
      .then((data) => {
        const found = Array.isArray(data) ? data.find((g: any) => g.slug === slug) : null;
        setGame(found ?? null);
      })
      .catch(() => setGame(null));
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    setInfoStatus("loading");
    setInfoMd(null);

    fetchPinballText(`/pinball/gameinfo/${slug}.md`)
      .then((text) => {
        setInfoMd(text);
        setInfoStatus("loaded");
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error ?? "");
        setInfoStatus(message.includes("404") ? "missing" : "error");
        setInfoMd(null);
      });
  }, [slug]);

  const videoCards = useMemo(() => {
    if (!game) return [];
    return (game.videos || [])
      .map((v) => ({ ...v, id: v.url ? youtubeId(v.url) : null }))
      .filter((v) => Boolean(v.id)) as Array<Video & { id: string }>;
  }, [game]);

  useEffect(() => {
    if (videoCards.length && !activeVideo) setActiveVideo(videoCards[0].id);
  }, [videoCards, activeVideo]);

  const metaLine = useMemo(() => {
    if (!game) return "—";
    const parts: string[] = [];

    parts.push(game.manufacturer ?? "—");
    if (game.year) parts.push(String(game.year));

    const loc = locationText(game.group, game.pos);
    if (loc) parts.push(loc);

    if (typeof game.bank === "number" && game.bank > 0) parts.push(`Bank ${game.bank}`);

    return parts.join(" • ");
  }, [game]);

  if (!game) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
        <Link className="text-neutral-300 underline" to="/">
          ← Back
        </Link>
        <div className="mt-6 text-neutral-300">Game not found.</div>
      </div>
    );
  }

  const playfieldImage = playfieldImageSources(game.slug, game.playfieldLocal);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <SiteHeader title="Pinball Library" active="Library" />
      <PageContainer>
        <Link className="text-neutral-300 underline" to="/">
          ← Back to library
        </Link>

        <div className="mt-4 flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">{game.name}</h1>
          <div className="text-neutral-400">{metaLine}</div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <Panel className="overflow-hidden">
            <div className="aspect-[16/9] bg-neutral-800">
              {game.playfieldLocal ? (
                <img
                  src={playfieldImage.src}
                  srcSet={playfieldImage.srcSet}
                  sizes="(min-width: 1024px) 325px, 100vw"
                  alt={`${game.name} playfield`}
                  className="h-full w-full object-cover"
                  onLoad={(e) => cacheAssetUrl((e.currentTarget as HTMLImageElement).currentSrc)}
                  onError={(e) => {
                    const el = e.currentTarget as HTMLImageElement;
                    el.removeAttribute("srcset");
                    el.removeAttribute("sizes");
                    el.src = playfieldImage.fallback;
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-neutral-400">
                  No hosted playfield yet
                </div>
              )}
            </div>

            <div className="p-4 flex flex-wrap gap-3">
              <Link
                className={SUBTLE_BUTTON_CLASS}
                to={`/rules/${game.slug}`}
              >
                Rulesheet (hosted)
              </Link>

              {game.playfieldLocal && (
                <a
                  className={SUBTLE_BUTTON_CLASS}
                  href={game.playfieldLocal}
                  target="_blank"
                  rel="noreferrer"
                >
                  Playfield (hosted)
                </a>
              )}

              {game.rulesheetUrl && (
                <a
                  className={SUBTLE_BUTTON_CLASS}
                  href={game.rulesheetUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Rulesheet (source)
                </a>
              )}

              {game.playfieldImageUrl && (
                <a
                  className={SUBTLE_BUTTON_CLASS}
                  href={game.playfieldImageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Playfield image (source)
                </a>
              )}
            </div>
          </Panel>

          <Panel className="p-4 2xl:col-span-2">
            <SectionHeading>Videos</SectionHeading>

            {videoCards.length === 0 ? (
              <div className="mt-4 text-neutral-400">No videos listed.</div>
            ) : (
              <>
                <div className="mt-4 aspect-w-16 aspect-h-9 w-full overflow-hidden rounded-xl bg-black">
                  {activeVideo && (
                    <iframe
                      className="h-full w-full"
                      src={`https://www.youtube-nocookie.com/embed/${activeVideo}`}
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 2xl:grid-cols-4">
                  {videoCards.map((v) => (
                    <button
                      key={v.label}
                      onClick={() => setActiveVideo(v.id)}
                      className={`rounded-xl ring-1 p-2 text-left transition ${
                        activeVideo === v.id
                          ? "bg-neutral-800 ring-neutral-600"
                          : "bg-neutral-900 ring-neutral-800 hover:ring-neutral-600"
                      }`}
                    >
                      <img
                        className="w-full rounded-lg"
                        src={`https://img.youtube.com/vi/${v.id}/hqdefault.jpg`}
                        alt={v.label}
                        onLoad={(e) => cacheAssetUrl((e.currentTarget as HTMLImageElement).currentSrc)}
                      />
                      <div className="mt-2 text-sm text-neutral-200">{v.label}</div>
                      <div className="text-xs text-neutral-500">{v.kind}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </Panel>

          <Panel className="p-4">
            <SectionHeading>Game Info</SectionHeading>

            <div className="mt-4">
              {infoStatus === "loading" && (
                <div className="text-sm text-neutral-400">Loading…</div>
              )}

              {infoStatus === "missing" && (
                <div className="text-sm text-neutral-400">No game info yet.</div>
              )}

              {infoStatus === "error" && (
                <div className="text-sm text-neutral-400">Could not load game info.</div>
              )}

              {infoMd && (
                <div className="prose prose-invert max-w-none break-words prose-p:my-3 prose-a:break-all prose-code:break-all prose-pre:overflow-x-auto prose-hr:my-4 prose-hr:border-neutral-800">
                  <ReactMarkdown>{infoMd}</ReactMarkdown>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2 text-xs text-neutral-500">
              <div>
                Info file path:{" "}
                <code className="rounded bg-neutral-950 px-2 py-1 break-all">
                  /pinball/gameinfo/{game.slug}.md
                </code>
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-8 text-sm text-neutral-500">
          Local rulesheet page target:{" "}
          <code className="rounded bg-neutral-900 px-2 py-1 break-all">{game.rulesheetLocal}</code>
        </div>
      </PageContainer>
    </div>
  );
}
