import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { cacheAssetUrl, fetchPinballJson, fetchPinballText } from "../../../shared/ui/pinballCache";
import SiteHeader from "../components/SiteHeader";
import {
  APP_BACKGROUND_STYLE,
  PageContainer,
  Panel,
  SectionHeading,
  SUBTLE_BUTTON_CLASS,
} from "../components/ui";

type Video = { kind: string; label: string; url: string };
const FALLBACK_PLAYFIELD_700 = "/pinball/images/playfields/fallback-whitewood-playfield_700.webp";
const FALLBACK_PLAYFIELD_1400 = "/pinball/images/playfields/fallback-whitewood-playfield_1400.webp";

type Game = {
  routeId: string;
  variant?: string | null;
  practiceIdentity?: string | null;
  area?: string | null;
  location?: string | null; // legacy field fallback
  group?: number | null;
  position?: number | null;
  bank?: number | null;

  name: string;
  manufacturer: string | null;
  year: number | null;
  slug: string;

  playfieldLocal: string | null;
  playfieldImageUrl: string | null;

  rulesheetLocal: string | null;
  rulesheetUrl: string | null;
  gameinfoLocalPractice?: string | null;

  videos: Video[];
};

function deriveRouteId(item: Record<string, unknown>, slug: string, fallback: string): string {
  const libraryId = String(item.library_id ?? "").trim();
  if (libraryId && slug) return `${libraryId}::${slug}`;
  return (
    slug ||
    String(item.library_entry_id ?? "").trim() ||
    String(item.opdb_id ?? "").trim() ||
    String(item.practice_identity ?? "").trim() ||
    fallback
  );
}

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

function locationText(location?: string | null, group?: number | null, position?: number | null): string | null {
  if (typeof group !== "number" || typeof position !== "number") return null;
  if (location && location.trim()) {
    return `📍 ${location.trim()}:${group}:${position}`;
  }
  return `📍 ${group}:${position}`;
}

function derivePlayfieldVariant(local: string, width: 700 | 1400): string | null {
  const trimmed = local.trim();
  if (!trimmed.startsWith("/pinball/images/playfields/")) return null;
  const m = trimmed.match(/^(.*?)(?:_(700|1400))?\.(webp|png|jpe?g)$/i);
  if (!m) return null;
  return `${m[1]}_${width}.webp`;
}

function playfieldImageSources(playfieldLocal: string | null) {
  if (playfieldLocal) {
    const local700 = derivePlayfieldVariant(playfieldLocal, 700);
    const local1400 = derivePlayfieldVariant(playfieldLocal, 1400);
    if (local700 && local1400) {
      return {
        src: local700,
        srcSet: `${local700} 700w, ${local1400} 1400w`,
        fallback: playfieldLocal,
      };
    }
    return {
      src: playfieldLocal,
      srcSet: undefined,
      fallback: playfieldLocal,
    };
  }
  return {
    src: FALLBACK_PLAYFIELD_700,
    srcSet: `${FALLBACK_PLAYFIELD_700} 700w, ${FALLBACK_PLAYFIELD_1400} 1400w`,
    fallback: FALLBACK_PLAYFIELD_700,
  };
}

function mapV2ItemsToGames(raw: unknown): Game[] | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || Number((raw as { version?: unknown }).version ?? 0) < 2) {
    return null;
  }
  const root = raw as { items?: Array<Record<string, unknown>> };
  const items = Array.isArray(root.items) ? root.items : [];
  return items.map((item, idx) => {
    const assets =
      item.assets && typeof item.assets === "object" ? (item.assets as Record<string, unknown>) : {};
    const legacySlug = String(item.slug ?? "").trim();
    const routeId = deriveRouteId(item, legacySlug, `row-${idx + 1}`);
    const videosRaw = Array.isArray(item.videos) ? item.videos : [];
    return {
      routeId,
      variant: String(item.variant ?? "").trim() || null,
      practiceIdentity: String(item.practice_identity ?? "").trim() || null,
      area: String(item.area ?? "").trim() || null,
      location: String(item.area ?? "").trim() || null,
      group: typeof item.group === "number" ? item.group : null,
      position: typeof item.position === "number" ? item.position : null,
      bank: typeof item.bank === "number" ? item.bank : null,
      name: String(item.game ?? "").trim() || legacySlug || routeId,
      manufacturer: String(item.manufacturer ?? "").trim() || null,
      year: typeof item.year === "number" ? item.year : null,
      slug: legacySlug || routeId,
      playfieldLocal: String(assets.playfield_local_practice ?? "").trim() || null,
      playfieldImageUrl: String(item.playfield_image_url ?? "").trim() || null,
      rulesheetLocal: String(assets.rulesheet_local_practice ?? "").trim() || null,
      rulesheetUrl: String(item.rulesheet_url ?? "").trim() || null,
      gameinfoLocalPractice: String(assets.gameinfo_local_practice ?? "").trim() || null,
      videos: videosRaw
        .map((v) => {
          const o = (v ?? {}) as Record<string, unknown>;
          return { kind: String(o.kind ?? ""), label: String(o.label ?? ""), url: String(o.url ?? "") };
        })
        .filter((v) => v.url),
    };
  });
}

export default function GamePage() {
  const { slug } = useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [gameLookupStatus, setGameLookupStatus] = useState<"idle" | "loading" | "done">("idle");
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const [infoState, setInfoState] = useState<{
    slug: string | null;
    md: string | null;
    status: "idle" | "loaded" | "missing" | "error";
  }>({
    slug: null,
    md: null,
    status: "idle",
  });

  useEffect(() => {
    let cancelled = false;
    setGameLookupStatus("loading");
    fetchPinballJson<unknown>("/pinball/data/pinball_library_v3.json")
      .then((data) => {
        if (cancelled) return;
        const v2Games = mapV2ItemsToGames(data);
        const root = data as Game[] | { games?: Game[]; items?: Game[] } | null;
        const games = (v2Games ?? (Array.isArray(root)
          ? root
          : Array.isArray(root?.games)
            ? root.games
            : Array.isArray(root?.items)
              ? root.items
              : [])).map((g, idx) => ({ ...g, routeId: (g as Game).routeId ?? g.slug ?? `row-${idx + 1}` }));
        const found = games.find((g) => g.routeId === slug || g.slug === slug) ?? null;
        setGame(found ?? null);
        setGameLookupStatus("done");
      })
      .catch(() => {
        if (cancelled) return;
        setGame(null);
        setGameLookupStatus("done");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    if (gameLookupStatus === "loading") return;
    const key = game?.routeId ?? slug;
    const candidates = [
      game?.gameinfoLocalPractice,
      game?.practiceIdentity ? `/pinball/gameinfo/${game.practiceIdentity}-gameinfo.md` : null,
    ].filter((v, i, a): v is string => Boolean(v) && a.indexOf(v as string) === i);

    let cancelled = false;
    const load = async () => {
      let lastError: unknown = null;
      for (const candidate of candidates) {
        try {
          const text = await fetchPinballText(candidate);
          if (cancelled) return;
          setInfoState({ slug: key, md: text, status: "loaded" });
          return;
        } catch (err) {
          lastError = err;
        }
      }
      if (cancelled) return;
      const message = lastError instanceof Error ? lastError.message : String(lastError ?? "");
      setInfoState({
        slug: key,
        md: null,
        status: message.includes("404") ? "missing" : "error",
      });
    };
    load().catch(() => {
      if (cancelled) return;
      setInfoState({ slug: key, md: null, status: "error" });
    });
    return () => {
      cancelled = true;
    };
  }, [slug, gameLookupStatus, game?.routeId, game?.gameinfoLocalPractice, game?.practiceIdentity]);

  const videoCards = useMemo(() => {
    if (!game) return [];
    return (game.videos || [])
      .map((v) => ({ ...v, id: v.url ? youtubeId(v.url) : null }))
      .filter((v) => Boolean(v.id)) as Array<Video & { id: string }>;
  }, [game]);

  const activeVideo = useMemo(() => {
    if (!videoCards.length) return null;
    if (selectedVideoId && videoCards.some((v) => v.id === selectedVideoId)) {
      return selectedVideoId;
    }
    return videoCards[0].id;
  }, [videoCards, selectedVideoId]);

  const infoStatus = useMemo(() => {
    const key = game?.routeId ?? slug;
    if (!key) return "idle";
    if (infoState.slug !== key) return "loading";
    return infoState.status;
  }, [slug, game?.routeId, infoState.slug, infoState.status]);

  const infoMd = infoState.slug === (game?.routeId ?? slug) ? infoState.md : null;

  const metaLine = useMemo(() => {
    if (!game) return "—";
    const parts: string[] = [];

    parts.push(game.manufacturer ?? "—");
    if (game.year) parts.push(String(game.year));

    const loc = locationText(game.area ?? game.location, game.group, game.position);
    if (loc) parts.push(loc);

    if (typeof game.bank === "number" && game.bank > 0) parts.push(`Bank ${game.bank}`);

    return parts.join(" • ");
  }, [game]);

  if (!game) {
    return (
      <div className="min-h-screen text-neutral-100 p-6" style={APP_BACKGROUND_STYLE}>
        <Link className="text-neutral-300 underline" to="/">
          ← Back
        </Link>
        <div className="mt-6 text-neutral-300">Game not found.</div>
      </div>
    );
  }

  const playfieldImage = playfieldImageSources(game.playfieldLocal);

  return (
    <div className="min-h-screen text-neutral-100" style={APP_BACKGROUND_STYLE}>
      <SiteHeader title="Pinball Library" active="Library" />
      <PageContainer>
        <Link className="text-neutral-300 underline" to="/">
          ← Back to library
        </Link>

        <div className="mt-4 flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">
            <span>{game.name}</span>
            {game.variant && (
              <span className="ml-2 inline-flex rounded-full border border-neutral-600 px-2 py-0.5 text-xs align-middle text-neutral-200">
                {game.variant}
              </span>
            )}
          </h1>
          <div className="text-neutral-400">{metaLine}</div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <Panel className="overflow-hidden">
            <div className="aspect-[16/9] bg-neutral-800">
              {game.playfieldLocal ? (
                <img
                  src={playfieldImage.src}
                  srcSet={playfieldImage.srcSet}
                  sizes="(max-width: 767px) 100vw, 350px"
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
                to={`/rules/${encodeURIComponent(game.routeId)}`}
              >
                Rulesheet
              </Link>

              {game.playfieldLocal && (
                <a
                  className={SUBTLE_BUTTON_CLASS}
                  href={game.playfieldLocal}
                  target="_blank"
                  rel="noreferrer"
                >
                  Playfield
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
                      onClick={() => setSelectedVideoId(v.id)}
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
          </Panel>
        </div>

        {(game.rulesheetUrl || game.playfieldImageUrl) && (
          <div className="mt-8 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            {game.rulesheetUrl && (
              <a
                className="rounded-lg bg-neutral-900 px-2.5 py-1 text-xs text-neutral-200 ring-1 ring-neutral-700 hover:ring-neutral-500"
                href={game.rulesheetUrl}
                target="_blank"
                rel="noreferrer"
              >
                Rulesheet (source)
              </a>
            )}
            {game.playfieldImageUrl && (
              <a
                className="rounded-lg bg-neutral-900 px-2.5 py-1 text-xs text-neutral-200 ring-1 ring-neutral-700 hover:ring-neutral-500"
                href={game.playfieldImageUrl}
                target="_blank"
                rel="noreferrer"
              >
                Playfield (source)
              </a>
            )}
          </div>
        )}
      </PageContainer>
    </div>
  );
}
