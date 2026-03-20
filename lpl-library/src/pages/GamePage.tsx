import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { cacheAssetUrl, fetchPinballText } from "../../../shared/ui/pinballCache";
import SiteHeader from "../components/SiteHeader";
import { APP_BACKGROUND_STYLE, SUBTLE_BUTTON_CLASS } from "../components/uiStyles";
import {
  PageContainer,
  Panel,
  SectionHeading,
} from "../components/ui";
import {
  detailArtworkCandidates,
  type LibraryGame,
  type LivePlayfieldStatus,
  type ReferenceLink,
  findLibraryGame,
  gameInfoMarkdownCandidates,
  loadResolvedLibraryData,
  locationBankText,
  manufacturerYearText,
  preferredRulesheetLink,
  referenceLinkProvider,
  resolvedPlayfieldOptions,
  rulesheetMarkdownCandidates,
} from "../lib/libraryData";

const livePlayfieldStatusRequests = new Map<string, Promise<LivePlayfieldStatus | null>>();
const LIVE_PLAYFIELD_KINDS = new Set<LivePlayfieldStatus["effectiveKind"]>(["pillyliu", "opdb", "external", "missing"]);

function fetchLivePlayfieldStatus(practiceIdentity: string): Promise<LivePlayfieldStatus | null> {
  const existing = livePlayfieldStatusRequests.get(practiceIdentity);
  if (existing) return existing;

  const request = fetch(`/pinprof-admin/api.php?route=public/playfield-status/${encodeURIComponent(practiceIdentity)}`, {
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const payload = await response.json() as { effectiveKind?: unknown; effectiveUrl?: unknown };
      const kind = typeof payload.effectiveKind === "string" ? payload.effectiveKind : "";
      const effectiveUrl = typeof payload.effectiveUrl === "string" && payload.effectiveUrl.trim()
        ? payload.effectiveUrl.trim()
        : null;
      if (!LIVE_PLAYFIELD_KINDS.has(kind as LivePlayfieldStatus["effectiveKind"])) {
        return null;
      }
      return {
        effectiveKind: kind as LivePlayfieldStatus["effectiveKind"],
        effectiveUrl,
      };
    })
    .catch(() => null);

  livePlayfieldStatusRequests.set(practiceIdentity, request);
  return request;
}

function youtubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.replace("/", "") || null;
    if (parsed.hostname.includes("youtube.com")) return parsed.searchParams.get("v");
    return null;
  } catch {
    return null;
  }
}

function shortRulesheetTitle(link: ReferenceLink): string {
  switch (referenceLinkProvider(link)) {
    case "pinprof":
      return "PinProf";
    case "tf":
      return "TF";
    case "pp":
      return "PP";
    case "papa":
      return "PAPA";
    case "bob":
      return "Bob";
    default:
      return "Local";
  }
}

function ResourceRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="shrink-0 font-semibold text-neutral-400">{title}:</div>
      <div className="min-w-0 flex-1 overflow-x-auto py-1">
        <div className="flex min-h-[2.25rem] items-center gap-2 px-1">{children}</div>
      </div>
    </div>
  );
}

export default function GamePage() {
  const { slug } = useParams();
  const [game, setGame] = useState<LibraryGame | null>(null);
  const [gameLookupStatus, setGameLookupStatus] = useState<"idle" | "loading" | "done">("idle");
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [infoState, setInfoState] = useState<{
    key: string | null;
    md: string | null;
    status: "idle" | "loaded" | "missing" | "error";
  }>({
    key: null,
    md: null,
    status: "idle",
  });
  const [livePlayfieldState, setLivePlayfieldState] = useState<{
    key: string | null;
    data: LivePlayfieldStatus | null;
    status: "idle" | "loading" | "loaded";
  }>({
    key: null,
    data: null,
    status: "idle",
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setGameLookupStatus("loading");
      try {
        const bundle = await loadResolvedLibraryData();
        if (cancelled) return;
        setGame(findLibraryGame(bundle.games, slug));
      } catch {
        if (cancelled) return;
        setGame(null);
      } finally {
        if (!cancelled) setGameLookupStatus("done");
      }
    };
    load().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    if (gameLookupStatus === "loading") return;
    const key = game?.routeId ?? slug;
    const candidates = game ? gameInfoMarkdownCandidates(game) : [];

    let cancelled = false;
    const load = async () => {
      let lastError: unknown = null;
      for (const candidate of candidates) {
        try {
          const text = await fetchPinballText(candidate);
          if (cancelled) return;
          setInfoState({ key, md: text, status: "loaded" });
          return;
        } catch (error) {
          lastError = error;
        }
      }
      if (cancelled) return;
      const message = lastError instanceof Error ? lastError.message : String(lastError ?? "");
      setInfoState({
        key,
        md: null,
        status: message.includes("404") ? "missing" : "error",
      });
    };
    load().catch(() => {
      if (cancelled) return;
      setInfoState({ key, md: null, status: "error" });
    });
    return () => {
      cancelled = true;
    };
  }, [game, gameLookupStatus, slug]);

  useEffect(() => {
    const practiceIdentity = game?.practiceIdentity ?? null;
    if (!practiceIdentity) {
      setLivePlayfieldState({ key: null, data: null, status: "idle" });
      return;
    }

    let cancelled = false;
    setLivePlayfieldState({ key: practiceIdentity, data: null, status: "loading" });
    fetchLivePlayfieldStatus(practiceIdentity)
      .then((data) => {
        if (cancelled) return;
        setLivePlayfieldState({ key: practiceIdentity, data, status: "loaded" });
      })
      .catch(() => {
        if (cancelled) return;
        setLivePlayfieldState({ key: practiceIdentity, data: null, status: "loaded" });
      });

    return () => {
      cancelled = true;
    };
  }, [game?.practiceIdentity]);

  const videoCards = useMemo(() => {
    if (!game) return [];
    return game.videos
      .map((video) => ({ ...video, id: video.url ? youtubeId(video.url) : null }))
      .filter((video): video is typeof video & { id: string } => Boolean(video.id));
  }, [game]);

  const activeVideo = useMemo(() => {
    if (!videoCards.length) return null;
    if (selectedVideoId && videoCards.some((video) => video.id === selectedVideoId)) {
      return selectedVideoId;
    }
    return videoCards[0].id;
  }, [selectedVideoId, videoCards]);

  const infoStatus = useMemo(() => {
    const key = game?.routeId ?? slug;
    if (!key) return "idle";
    if (infoState.key !== key) return "loading";
    return infoState.status;
  }, [game?.routeId, infoState.key, infoState.status, slug]);

  const infoMd = infoState.key === (game?.routeId ?? slug) ? infoState.md : null;
  const metaLine = useMemo(() => {
    if (!game) return "—";
    const parts = [manufacturerYearText(game)];
    const locationBank = locationBankText(game);
    if (locationBank) parts.push(locationBank);
    return parts.join(" • ");
  }, [game]);

  const artworkCandidates = useMemo(() => (game ? detailArtworkCandidates(game) : []), [game]);
  const livePlayfieldStatus = useMemo(() => {
    if (!game?.practiceIdentity) return null;
    if (livePlayfieldState.key !== game.practiceIdentity) return null;
    return livePlayfieldState.data;
  }, [game?.practiceIdentity, livePlayfieldState.data, livePlayfieldState.key]);
  const playfieldOptions = useMemo(
    () => (game ? resolvedPlayfieldOptions(game, livePlayfieldStatus) : []),
    [game, livePlayfieldStatus],
  );
  const isCheckingLivePlayfield = Boolean(game?.practiceIdentity) &&
    livePlayfieldState.key === game?.practiceIdentity &&
    livePlayfieldState.status === "loading";
  const hasLocalRulesheet = useMemo(() => (game ? rulesheetMarkdownCandidates(game).length > 0 : false), [game]);
  const rulesheetLinks = useMemo(() => {
    if (!game) return [];
    if (game.rulesheetLinks.length) return game.rulesheetLinks;
    if (game.rulesheetUrl) {
      return [{ label: "Rulesheet (source)", url: game.rulesheetUrl, provider: null, localPath: null }];
    }
    return [];
  }, [game]);
  const primaryRulesheet = useMemo(() => (game ? preferredRulesheetLink(game) : null), [game]);

  if (!game) {
    return (
      <div className="min-h-screen p-6 text-neutral-100" style={APP_BACKGROUND_STYLE}>
        <Link className="text-neutral-300 underline" to="/">
          ← Back
        </Link>
        <div className="mt-6 text-neutral-300">
          {gameLookupStatus === "loading" ? "Loading game…" : "Game not found."}
        </div>
      </div>
    );
  }

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
            <div className="aspect-[4/3] bg-neutral-900">
              {artworkCandidates.length ? (
                <img
                  src={artworkCandidates[0]}
                  data-fallback-idx={0}
                  alt={`${game.name} backglass`}
                  className="h-full w-full object-contain"
                  onLoad={(event) => cacheAssetUrl((event.currentTarget as HTMLImageElement).currentSrc)}
                  onError={(event) => {
                    const element = event.currentTarget as HTMLImageElement;
                    const currentIndex = Number(element.dataset.fallbackIdx ?? "0");
                    const nextIndex = currentIndex + 1;
                    if (nextIndex < artworkCandidates.length) {
                      element.dataset.fallbackIdx = String(nextIndex);
                      element.src = artworkCandidates[nextIndex];
                    }
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-neutral-500">No image</div>
              )}
            </div>

            <div className="space-y-3 p-4">
              <ResourceRow title="Rulesheet">
                {rulesheetLinks.length ? (
                  rulesheetLinks.map((link, index) => {
                    const chipTitle = shortRulesheetTitle(link);
                    const provider = referenceLinkProvider(link);
                    const embeddedRoute = provider
                      ? `/rules/${encodeURIComponent(game.routeId)}?source=${encodeURIComponent(provider)}`
                      : `/rules/${encodeURIComponent(game.routeId)}`;
                    const useEmbeddedRoute = Boolean(provider) || (hasLocalRulesheet && primaryRulesheet?.url === link.url);
                    if (useEmbeddedRoute) {
                      return (
                        <Link
                          key={`${chipTitle}-${link.url ?? index}`}
                          className={SUBTLE_BUTTON_CLASS}
                          to={embeddedRoute}
                        >
                          {chipTitle}
                        </Link>
                      );
                    }
                    return (
                      <a
                        key={`${chipTitle}-${link.url ?? index}`}
                        className={SUBTLE_BUTTON_CLASS}
                        href={link.url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {chipTitle}
                      </a>
                    );
                  })
                ) : hasLocalRulesheet ? (
                  <Link className={SUBTLE_BUTTON_CLASS} to={`/rules/${encodeURIComponent(game.routeId)}`}>
                    Local
                  </Link>
                ) : (
                  <span className="rounded-xl bg-neutral-800 px-4 py-2 text-sm text-neutral-400">Unavailable</span>
                )}
              </ResourceRow>

              <ResourceRow title="Playfield">
                {isCheckingLivePlayfield ? (
                  <span className="rounded-xl bg-neutral-800 px-4 py-2 text-sm text-neutral-400">Checking…</span>
                ) : playfieldOptions.length ? (
                  playfieldOptions.map((option) => (
                    <a
                      key={`${option.title}-${option.candidates[0] ?? "missing"}`}
                      className={SUBTLE_BUTTON_CLASS}
                      href={option.candidates[0] ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {option.title}
                    </a>
                  ))
                ) : (
                  <span className="rounded-xl bg-neutral-800 px-4 py-2 text-sm text-neutral-400">Unavailable</span>
                )}
              </ResourceRow>
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
                  {videoCards.map((video) => (
                    <button
                      key={`${video.kind}-${video.label}-${video.id}`}
                      onClick={() => setSelectedVideoId(video.id)}
                      className={`rounded-xl p-2 text-left ring-1 transition ${
                        activeVideo === video.id
                          ? "bg-neutral-800 ring-neutral-600"
                          : "bg-neutral-900 ring-neutral-800 hover:ring-neutral-600"
                      }`}
                    >
                      <img
                        className="w-full rounded-lg"
                        src={`https://img.youtube.com/vi/${video.id}/hqdefault.jpg`}
                        alt={video.label}
                        onLoad={(event) => cacheAssetUrl((event.currentTarget as HTMLImageElement).currentSrc)}
                      />
                      <div className="mt-2 text-sm text-neutral-200">{video.label}</div>
                      <div className="text-xs text-neutral-500">{video.kind}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </Panel>

          <Panel className="p-4">
            <SectionHeading>Game Info</SectionHeading>

            <div className="mt-4">
              {infoStatus === "loading" && <div className="text-sm text-neutral-400">Loading…</div>}
              {infoStatus === "missing" && <div className="text-sm text-neutral-400">No game info yet.</div>}
              {infoStatus === "error" && <div className="text-sm text-neutral-400">Could not load game info.</div>}
              {infoMd && (
                <div className="prose prose-invert max-w-none break-words prose-p:my-3 prose-a:break-all prose-code:break-all prose-pre:overflow-x-auto prose-hr:my-4 prose-hr:border-neutral-800">
                  <ReactMarkdown>{infoMd}</ReactMarkdown>
                </div>
              )}
            </div>
          </Panel>
        </div>

        {(primaryRulesheet?.url || game.playfieldImageUrl) && (
          <div className="mt-8 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            {primaryRulesheet?.url && (
              <a
                className="rounded-lg bg-neutral-900 px-2.5 py-1 text-xs text-neutral-200 ring-1 ring-neutral-700 hover:ring-neutral-500"
                href={primaryRulesheet.url}
                target="_blank"
                rel="noreferrer"
              >
                {primaryRulesheet.label}
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
