import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  cacheAssetUrl,
  fetchPinballJson,
  prefetchPinballTextAssets,
} from "../../../shared/ui/pinballCache";
import SiteHeader from "../components/SiteHeader";
import {
  APP_BACKGROUND_STYLE,
  CONTROL_INPUT_CLASS,
  CONTROL_SELECT_CLASS,
  PAGE_SIDE_INSET_STYLE,
  PageContainer,
} from "../components/ui";

type Video = { kind: string; label: string; url: string };

type Game = {
  routeId: string;
  variant?: string | null;
  practiceIdentity?: string | null;
  libraryId?: string | null;
  sourceId?: string | null;
  libraryName?: string | null;
  sourceName?: string | null;
  libraryType?: string | null;
  sourceType?: string | null;
  venueName?: string | null;
  area?: string | null;
  areaOrder?: number | null;
  location?: string | null; // legacy field fallback
  group: number | null;
  position?: number | null;
  bank?: number | null;

  name: string;
  manufacturer: string | null;
  year: number | null;
  slug: string;
  playfieldImageUrl?: string | null;
  playfieldLocal: string | null;
  rulesheetLocal: string | null;
  videos: Video[];
};

type LibrarySourceType = "venue" | "category";
type LibrarySource = {
  id: string;
  name: string;
  type: LibrarySourceType;
};

type GroupSection = {
  locationKey: string | null;
  groupKey: number | null;
  games: Game[];
};

type BankSection = {
  bankKey: number | null;
  games: Game[];
};

type SortMode = "area" | "bank" | "alphabetical" | "year";

const FALLBACK_PLAYFIELD_700 = "/pinball/images/playfields/fallback-whitewood-playfield_700.webp";
const FALLBACK_PLAYFIELD_1400 = "/pinball/images/playfields/fallback-whitewood-playfield_1400.webp";
const DEFAULT_AVENUE_SOURCE_IDS = ["venue--the-avenue-cafe", "the-avenue"] as const;
const LIBRARY_SOURCE_STORAGE_KEY = "lpl-library:selected-source-id:v2";

function locationText(location?: string | null, group?: number | null, position?: number | null): string | null {
  if (typeof group !== "number" || typeof position !== "number") return null;
  const normalizedLocation =
    typeof location === "string" && location.trim() && location.trim().toLowerCase() !== "null"
      ? location.trim()
      : null;
  if (normalizedLocation) {
    return `📍 ${normalizedLocation}:${group}:${position}`;
  }
  return `📍 ${group}:${position}`;
}

function manufacturerYearText(g: Game): string {
  const parts: string[] = [];
  parts.push(g.manufacturer ?? "—");
  if (g.year) parts.push(String(g.year));
  return parts.join(" • ");
}

function locationBankMetaText(g: Game): string | null {
  const parts: string[] = [];
  const loc = locationText(g.area ?? g.location, g.group, g.position);
  if (loc) parts.push(loc);
  if (typeof g.bank === "number" && g.bank > 0) parts.push(`Bank ${g.bank}`);
  return parts.length ? parts.join(" • ") : null;
}

function CardMeta({ g }: { g: Game }) {
  const manufacturerYear = manufacturerYearText(g);
  const locationBank = locationBankMetaText(g);
  return (
    <>
      <div className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-neutral-400">
        <span className="min-w-0 truncate">{manufacturerYear}</span>
        {g.variant && (
          <span className="max-w-[9rem] truncate rounded-full border border-neutral-700 px-2 py-0.5 text-xs leading-4 text-neutral-300">
            {g.variant}
          </span>
        )}
      </div>
      {locationBank && <div className="mt-1 text-sm text-neutral-400">{locationBank}</div>}
    </>
  );
}

function derivePlayfieldVariant(local: string, width: 700 | 1400): string | null {
  const trimmed = local.trim();
  if (!trimmed.startsWith("/pinball/images/playfields/")) return null;
  const m = trimmed.match(/^(.*?)(?:_(700|1400))?\.(webp|png|jpe?g)$/i);
  if (!m) return null;
  return `${m[1]}_${width}.webp`;
}

function playfieldImageCandidates(local?: string | null, source?: string | null) {
  const normalizedLocal = typeof local === "string" && local.trim() ? local.trim() : null;
  const local700 = normalizedLocal ? derivePlayfieldVariant(normalizedLocal, 700) : null;
  const local1400 = normalizedLocal ? derivePlayfieldVariant(normalizedLocal, 1400) : null;
  return [local700, local1400, normalizedLocal, source, FALLBACK_PLAYFIELD_700].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );
}

function playfieldCardSources(local?: string | null, source?: string | null) {
  const candidates = playfieldImageCandidates(local, source);
  const local700 = typeof local === "string" && local.trim() ? derivePlayfieldVariant(local.trim(), 700) : null;
  if (local700) {
    return {
      src: local700,
      srcSet: undefined,
      sizes: undefined,
      candidates,
    };
  }

  return {
    src: candidates[0] ?? FALLBACK_PLAYFIELD_700,
    srcSet:
      (candidates[0] ?? FALLBACK_PLAYFIELD_700) === FALLBACK_PLAYFIELD_700
        ? `${FALLBACK_PLAYFIELD_700} 700w, ${FALLBACK_PLAYFIELD_1400} 1400w`
        : undefined,
    sizes:
      (candidates[0] ?? FALLBACK_PLAYFIELD_700) === FALLBACK_PLAYFIELD_700
        ? "(min-width: 1024px) 22vw, (min-width: 768px) 32vw, 48vw"
        : undefined,
    candidates,
  };
}

function compareMaybeNumber(a: number | null | undefined, b: number | null | undefined): number {
  const left = typeof a === "number" && Number.isFinite(a) ? a : Number.MAX_SAFE_INTEGER;
  const right = typeof b === "number" && Number.isFinite(b) ? b : Number.MAX_SAFE_INTEGER;
  return left - right;
}

function sourceTypeOf(game: Game): LibrarySourceType {
  const raw = (game.libraryType ?? game.sourceType ?? "").trim().toLowerCase();
  return raw === "category" || raw === "manufacturer" ? "category" : "venue";
}

function sourceNameOf(game: Game): string {
  return (
    game.libraryName?.trim() ||
    game.sourceName?.trim() ||
    game.venueName?.trim() ||
    "The Avenue"
  );
}

function slugifySourceId(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "the-avenue"
  );
}

function sourceIdOf(game: Game): string {
  return (
    game.libraryId?.trim() ||
    game.sourceId?.trim() ||
    slugifySourceId(sourceNameOf(game))
  );
}

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

function normalizeSourceType(raw?: string | null): LibrarySourceType {
  const value = String(raw ?? "").trim().toLowerCase();
  return value === "category" || value === "manufacturer" ? "category" : "venue";
}

function preferredLibrarySourceId(sources: LibrarySource[], requestedId?: string | null): string | null {
  const candidates = [
    requestedId?.trim() || null,
    ...DEFAULT_AVENUE_SOURCE_IDS,
  ].filter((v): v is string => Boolean(v));

  for (const id of candidates) {
    const match = sources.find((s) => s.id === id);
    if (match) return match.id;
  }
  return sources[0]?.id ?? null;
}

function deriveLibraryPayload(raw: unknown): { games: Game[]; sources: LibrarySource[] } {
  const fallbackSource: LibrarySource = { id: "the-avenue", name: "The Avenue", type: "venue" };
  if (raw && typeof raw === "object" && !Array.isArray(raw) && typeof (raw as { version?: unknown }).version === "number" && Number((raw as { version?: unknown }).version) >= 2) {
    const root = raw as {
      items?: Array<Record<string, unknown>>;
      libraries?: Array<Record<string, unknown>>;
    };
    const items = Array.isArray(root.items) ? root.items : [];
    const games: Game[] = items.map((item, idx) => {
      const legacySlug = String(item.slug ?? "").trim();
      const routeId = deriveRouteId(item, legacySlug, `row-${idx + 1}`);
      const assets =
        item.assets && typeof item.assets === "object"
          ? (item.assets as Record<string, unknown>)
          : {};
      const videos = Array.isArray(item.videos) ? item.videos : [];
      return {
        routeId,
        variant: String(item.variant ?? "").trim() || null,
        practiceIdentity: String(item.practice_identity ?? "").trim() || null,
        libraryId: String(item.library_id ?? "").trim() || null,
        sourceId: String(item.library_id ?? "").trim() || null,
        libraryName: String(item.library_name ?? "").trim() || null,
        sourceName: String(item.library_name ?? "").trim() || null,
        libraryType: String(item.library_type ?? "").trim() || null,
        sourceType: String(item.library_type ?? "").trim() || null,
        venueName: String(item.venue ?? "").trim() || null,
        area: String(item.area ?? "").trim() || null,
        areaOrder: typeof item.area_order === "number" ? item.area_order : null,
        location: String(item.area ?? "").trim() || null,
        group: typeof item.group === "number" ? item.group : null,
        position: typeof item.position === "number" ? item.position : null,
        bank: typeof item.bank === "number" ? item.bank : null,
        name: String(item.game ?? "").trim() || legacySlug || routeId,
        manufacturer: String(item.manufacturer ?? "").trim() || null,
        year: typeof item.year === "number" ? item.year : null,
        slug: legacySlug || routeId,
        playfieldImageUrl: String(item.playfield_image_url ?? "").trim() || null,
        playfieldLocal: String(assets.playfield_local_practice ?? "").trim() || null,
        rulesheetLocal: String(assets.rulesheet_local_practice ?? "").trim() || null,
        videos: videos
          .map((v) => {
            const o = (v ?? {}) as Record<string, unknown>;
            return {
              kind: String(o.kind ?? ""),
              label: String(o.label ?? ""),
              url: String(o.url ?? ""),
            };
          })
          .filter((v) => v.url),
      };
    });

    const sources = Array.isArray(root.libraries)
      ? root.libraries
          .map((s) => ({
            id: String(s.library_id ?? "").trim(),
            name: String(s.library_name ?? "").trim() || String(s.library_id ?? "").trim(),
            type: normalizeSourceType(String(s.library_type ?? "")),
          }))
          .filter((s) => s.id)
      : [];
    return { games, sources: sources.length ? sources : [fallbackSource] };
  }

  const root = raw as
    | Game[]
    | { games?: Game[]; items?: Game[]; sources?: Array<{ id?: string; name?: string; type?: string }> }
    | null;
  const games = Array.isArray(root)
    ? root
    : Array.isArray(root?.games)
      ? root.games
      : Array.isArray(root?.items)
        ? root.items
        : [];
  const normalizedGames = games.map((g, idx) => ({
    ...g,
    routeId: (g as { routeId?: string; slug?: string }).routeId ?? (g as { slug?: string }).slug ?? `row-${idx + 1}`,
  })) as Game[];
  const providedSources = !Array.isArray(root) && Array.isArray(root?.sources)
    ? root.sources
        .filter((s) => s && typeof s.id === "string" && s.id.trim())
        .map((s) => ({
          id: String(s.id).trim(),
          name: (typeof s.name === "string" && s.name.trim()) ? s.name.trim() : String(s.id).trim(),
          type: normalizeSourceType(s.type),
        }))
    : [];
  if (providedSources.length) return { games: normalizedGames, sources: providedSources };
  const byId = new Map<string, LibrarySource>();
  for (const game of normalizedGames) {
    const id = sourceIdOf(game);
    if (byId.has(id)) continue;
    byId.set(id, { id, name: sourceNameOf(game), type: sourceTypeOf(game) });
  }
  const sources = byId.size ? [...byId.values()] : [fallbackSource];
  return { games: normalizedGames, sources };
}

export default function LibraryIndex() {
  const [preferredSourceId, setPreferredSourceId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LIBRARY_SOURCE_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [games, setGames] = useState<Game[]>([]);
  const [sources, setSources] = useState<LibrarySource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState("the-avenue");
  const [q, setQ] = useState("");
  const [bank, setBank] = useState<number | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("area");

  useEffect(() => {
    fetchPinballJson<unknown>("/pinball/data/pinball_library_v3.json")
      .then((data) => {
        const payload = deriveLibraryPayload(data);
        setGames(payload.games);
        setSources(payload.sources);
        const nextId = preferredLibrarySourceId(payload.sources, preferredSourceId ?? selectedSourceId);
        if (nextId) setSelectedSourceId(nextId);
      })
      .catch(() => {
        setGames([]);
        setSources([{ id: "the-avenue", name: "The Avenue", type: "venue" }]);
        setSelectedSourceId("the-avenue");
      });
  }, []);

  useEffect(() => {
    if (!sources.length) return;
    if (selectedSourceId && sources.some((s) => s.id === selectedSourceId)) return;
    const nextId = preferredLibrarySourceId(sources, preferredSourceId);
    if (nextId) setSelectedSourceId(nextId);
  }, [sources, preferredSourceId, selectedSourceId]);

  useEffect(() => {
    if (!selectedSourceId) return;
    setPreferredSourceId(selectedSourceId);
    try {
      localStorage.setItem(LIBRARY_SOURCE_STORAGE_KEY, selectedSourceId);
    } catch {
      // ignore storage errors
    }
  }, [selectedSourceId]);

  useEffect(() => {
    prefetchPinballTextAssets().catch(() => undefined);
  }, []);

  const selectedSource = useMemo(
    () => sources.find((s) => s.id === selectedSourceId) ?? sources[0] ?? null,
    [sources, selectedSourceId],
  );

  const sourceScopedGames = useMemo(() => {
    if (!selectedSource) return games;
    return games.filter((g) => sourceIdOf(g) === selectedSource.id);
  }, [games, selectedSource]);

  const supportsBankFilter = useMemo(() => {
    if (!selectedSource) return false;
    if (selectedSource.type !== "venue") return false;
    return sourceScopedGames.some((g) => typeof g.bank === "number" && g.bank > 0);
  }, [selectedSource, sourceScopedGames]);

  const availableSortModes = useMemo<SortMode[]>(() => {
    if (!selectedSource) return ["area", "alphabetical"];
    if (selectedSource.type === "category") return ["alphabetical", "year"];
    const venueModes: SortMode[] = ["area"];
    if (supportsBankFilter) venueModes.push("bank");
    venueModes.push("alphabetical", "year");
    return venueModes;
  }, [selectedSource, supportsBankFilter]);

  useEffect(() => {
    if (!availableSortModes.includes(sortMode)) {
      const fallback = selectedSource?.type === "category" ? "alphabetical" : "area";
      setSortMode(availableSortModes.includes(fallback) ? fallback : availableSortModes[0]);
    }
  }, [availableSortModes, sortMode, selectedSource]);

  useEffect(() => {
    if (!supportsBankFilter) setBank("all");
  }, [supportsBankFilter]);

  const bankOptions = useMemo<number[]>(() => {
    const s = new Set<number>();
    for (const g of sourceScopedGames) {
      if (typeof g.bank === "number" && g.bank > 0) s.add(g.bank);
    }
    return Array.from(s).sort((a, b) => a - b);
  }, [sourceScopedGames]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const effectiveBank = supportsBankFilter ? bank : "all";

    const scoped = sourceScopedGames.filter((g) => {
      const matchesQuery =
        !query ||
        `${g.name} ${g.manufacturer ?? ""} ${g.year ?? ""}`
          .toLowerCase()
          .includes(query);

      const matchesBank =
        effectiveBank === "all" || (typeof g.bank === "number" && g.bank === effectiveBank);

      return matchesQuery && matchesBank;
    });

    return [...scoped].sort((a, b) => {
      if (sortMode === "year") {
        return (
          compareMaybeNumber(a.year, b.year) ||
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
      }
      if (sortMode === "alphabetical") {
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }

      if (sortMode === "bank") {
        return (
          compareMaybeNumber(a.bank, b.bank) ||
          compareMaybeNumber(a.group, b.group) ||
          compareMaybeNumber(a.position, b.position) ||
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
      }

      return (
        compareMaybeNumber(a.areaOrder, b.areaOrder) ||
        compareMaybeNumber(a.group, b.group) ||
        compareMaybeNumber(a.position, b.position) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
    });
  }, [sourceScopedGames, q, bank, sortMode, supportsBankFilter]);

  const sections = useMemo<GroupSection[]>(() => {
    const out: GroupSection[] = [];
    for (const g of filtered) {
      const locationKey = null;
      const last = out[out.length - 1];
      if (!last || last.locationKey !== locationKey || last.groupKey !== g.group) {
        out.push({ locationKey, groupKey: g.group ?? null, games: [g] });
      } else {
        last.games.push(g);
      }
    }
    return out;
  }, [filtered]);

  const bankSections = useMemo<BankSection[]>(() => {
    const out: BankSection[] = [];
    for (const g of filtered) {
      const key = typeof g.bank === "number" && Number.isFinite(g.bank) ? g.bank : null;
      const last = out[out.length - 1];
      if (!last || last.bankKey !== key) {
        out.push({ bankKey: key, games: [g] });
      } else {
        last.games.push(g);
      }
    }
    return out;
  }, [filtered]);

  const effectiveBank = supportsBankFilter ? bank : "all";
  const showGroupedView = effectiveBank === "all" && sortMode === "area";
  const showBankSectionedView = effectiveBank === "all" && sortMode === "bank";
  const controls = (
    <div className="rounded-xl bg-neutral-950/35 px-2 py-2 backdrop-blur-[1px]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search games…"
          className={`${CONTROL_INPUT_CLASS} md:flex-1`}
        />

        <div
          className={`grid w-full gap-3 md:w-auto md:flex-none ${
            supportsBankFilter
              ? "grid-cols-2 md:w-[42rem] md:grid-cols-3"
              : "grid-cols-2 md:w-[28rem] md:grid-cols-2"
          }`}
        >
          <div className="relative">
            <select
              value={selectedSource?.id ?? selectedSourceId}
              onChange={(e) => {
                const source = sources.find((s) => s.id === e.target.value);
                if (!source) return;
                setSelectedSourceId(source.id);
                setBank("all");
                setSortMode(source.type === "category" ? "alphabetical" : "area");
              }}
              className={CONTROL_SELECT_CLASS}
              aria-label="Select library"
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl text-neutral-300">
              ▾
            </span>
          </div>

          <div className="relative">
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className={CONTROL_SELECT_CLASS}
              aria-label="Sort games"
            >
              {availableSortModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode === "area"
                    ? "Sort: Area"
                    : mode === "bank"
                      ? "Sort: Bank"
                      : mode === "year"
                        ? "Sort: Year"
                        : "Sort: A-Z"}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl text-neutral-300">
              ▾
            </span>
          </div>

          {supportsBankFilter && (
            <div className="relative">
              <select
                value={bank === "all" ? "all" : String(bank)}
                onChange={(e) => {
                  const v = e.target.value;
                  setBank(v === "all" ? "all" : Number(v));
                }}
                className={CONTROL_SELECT_CLASS}
                aria-label="Filter by bank"
              >
                <option value="all">All banks</option>
                {bankOptions.map((b) => (
                  <option key={b} value={String(b)}>
                    Bank {b}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl text-neutral-300">
                ▾
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-neutral-100" style={APP_BACKGROUND_STYLE}>
      <SiteHeader title="Pinball Library" active="Library" />
      <PageContainer className="pt-0">
        <div className="library-controls-fixed z-10">
          <div className="mx-auto max-w-screen-2xl" style={PAGE_SIDE_INSET_STYLE}>
            {controls}
          </div>
        </div>
        <div className="mb-4 opacity-0 pointer-events-none" aria-hidden>
          {controls}
        </div>

        <div className="mt-6">
          {showGroupedView ? (
            <div className="space-y-8">
              {sections.map((section, idx) => (
                <div key={`${section.groupKey ?? "nogroup"}-${idx}`}>
                  {idx > 0 && (
                    <div className="mb-6 h-px w-full bg-white/55" />
                  )}

                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {section.games.map((g) => {
                      const image = playfieldCardSources(g.playfieldLocal, g.playfieldImageUrl);
                      return (
                        <Link
                          key={g.routeId}
                          to={`/game/${encodeURIComponent(g.routeId)}`}
                          className="group rounded-2xl bg-neutral-900 ring-1 ring-neutral-800 hover:ring-neutral-600 transition overflow-hidden"
                        >
                          <div className="aspect-[16/9] bg-neutral-800">
                            <img
                              src={image.src}
                              srcSet={image.srcSet}
                              sizes={image.sizes}
                              data-fallback-idx={0}
                              loading="lazy"
                              decoding="async"
                              alt={`${g.name} playfield`}
                              className="h-full w-full object-cover opacity-90 group-hover:opacity-100"
                              onLoad={(e) => cacheAssetUrl((e.currentTarget as HTMLImageElement).currentSrc)}
                              onError={(e) => {
                                const el = e.currentTarget as HTMLImageElement;
                                const currentIdx = Number(el.dataset.fallbackIdx ?? "0");
                                const nextIdx = currentIdx + 1;
                                if (nextIdx < image.candidates.length) {
                                  el.dataset.fallbackIdx = String(nextIdx);
                                  el.removeAttribute("srcset");
                                  el.removeAttribute("sizes");
                                  el.src = image.candidates[nextIdx];
                                }
                              }}
                            />
                          </div>

                          <div className="p-4">
                            <div className="flex h-14 items-start overflow-hidden text-lg font-semibold leading-5">
                              <span className="min-w-0">{g.name}</span>
                            </div>
                            <CardMeta g={g} />

                            <div className="mt-3 text-sm text-neutral-300">
                              Videos: {g.videos.length}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : showBankSectionedView ? (
            <div className="space-y-8">
              {bankSections.map((section, idx) => (
                <div key={`${section.bankKey ?? "nobank"}-${idx}`}>
                  {idx > 0 && (
                    <div className="mb-6 h-px w-full bg-white/55" />
                  )}

                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {section.games.map((g) => {
                      const image = playfieldCardSources(g.playfieldLocal, g.playfieldImageUrl);
                      return (
                        <Link
                          key={g.routeId}
                          to={`/game/${encodeURIComponent(g.routeId)}`}
                          className="group rounded-2xl bg-neutral-900 ring-1 ring-neutral-800 hover:ring-neutral-600 transition overflow-hidden"
                        >
                          <div className="aspect-[16/9] bg-neutral-800">
                            <img
                              src={image.src}
                              srcSet={image.srcSet}
                              sizes={image.sizes}
                              data-fallback-idx={0}
                              loading="lazy"
                              decoding="async"
                              alt={`${g.name} playfield`}
                              className="h-full w-full object-cover opacity-90 group-hover:opacity-100"
                              onLoad={(e) => cacheAssetUrl((e.currentTarget as HTMLImageElement).currentSrc)}
                              onError={(e) => {
                                const el = e.currentTarget as HTMLImageElement;
                                const currentIdx = Number(el.dataset.fallbackIdx ?? "0");
                                const nextIdx = currentIdx + 1;
                                if (nextIdx < image.candidates.length) {
                                  el.dataset.fallbackIdx = String(nextIdx);
                                  el.removeAttribute("srcset");
                                  el.removeAttribute("sizes");
                                  el.src = image.candidates[nextIdx];
                                }
                              }}
                            />
                          </div>

                          <div className="p-4">
                            <div className="flex h-14 items-start overflow-hidden text-lg font-semibold leading-5">
                              <span className="min-w-0">{g.name}</span>
                            </div>
                            <CardMeta g={g} />

                            <div className="mt-3 text-sm text-neutral-300">
                              Videos: {g.videos.length}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {filtered.map((g) => {
                const image = playfieldCardSources(g.playfieldLocal, g.playfieldImageUrl);
                return (
                  <Link
                    key={g.routeId}
                    to={`/game/${encodeURIComponent(g.routeId)}`}
                    className="group rounded-2xl bg-neutral-900 ring-1 ring-neutral-800 hover:ring-neutral-600 transition overflow-hidden"
                  >
                    <div className="aspect-[16/9] bg-neutral-800">
                      <img
                        src={image.src}
                        srcSet={image.srcSet}
                        sizes={image.sizes}
                        data-fallback-idx={0}
                        loading="lazy"
                        decoding="async"
                        alt={`${g.name} playfield`}
                        className="h-full w-full object-cover opacity-90 group-hover:opacity-100"
                        onLoad={(e) => cacheAssetUrl((e.currentTarget as HTMLImageElement).currentSrc)}
                        onError={(e) => {
                          const el = e.currentTarget as HTMLImageElement;
                          const currentIdx = Number(el.dataset.fallbackIdx ?? "0");
                          const nextIdx = currentIdx + 1;
                          if (nextIdx < image.candidates.length) {
                            el.dataset.fallbackIdx = String(nextIdx);
                            el.removeAttribute("srcset");
                            el.removeAttribute("sizes");
                            el.src = image.candidates[nextIdx];
                          }
                        }}
                      />
                    </div>

                    <div className="p-4">
                      <div className="flex h-14 items-start overflow-hidden text-lg font-semibold leading-5">
                        <span className="min-w-0">{g.name}</span>
                      </div>
                      <CardMeta g={g} />

                      <div className="mt-3 text-sm text-neutral-300">
                        Videos: {g.videos.length}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {games.length === 0 && (
          <div className="mt-8 text-neutral-400">
            No data loaded. Confirm canonical file{" "}
            <code className="rounded bg-neutral-900 px-2 py-1">
              shared/pinball/data/pinball_library_v3.json
            </code>{" "}
            exists and has been deployed to <code className="rounded bg-neutral-900 px-2 py-1">/pinball/data/pinball_library_v3.json</code>.
          </div>
        )}
      </PageContainer>
    </div>
  );
}
