import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cacheAssetUrl, prefetchPinballTextAssets } from "../../../shared/ui/pinballCache";
import SiteHeader from "../components/SiteHeader";
import {
  APP_BACKGROUND_STYLE,
  CONTROL_INPUT_CLASS,
  CONTROL_SELECT_CLASS,
  PAGE_SIDE_INSET_STYLE,
  SUBTLE_BUTTON_CLASS,
} from "../components/uiStyles";
import {
  PageContainer,
  Panel,
} from "../components/ui";
import {
  type CatalogManufacturerOption,
  type ImportedSourceRecord,
  type LibraryGame,
  type LibrarySource,
  type LibrarySourceState,
  type LibraryVenueSearchResult,
  availableSortModesForSource,
  cardArtworkCandidates,
  fetchVenueMachineIds,
  loadLibrarySourceState,
  loadResolvedLibraryData,
  locationBankText,
  manufacturerYearCardText,
  preferredDefaultSortMode,
  preferredDefaultYearDescending,
  preferredLibrarySourceId,
  removeImportedSource,
  searchPinballMapVenues,
  setLibrarySourceVisible,
  setSelectedBankForSource,
  setSelectedLibrarySource,
  setSelectedSortForSource,
  sortLibraryGames,
  upsertImportedSource,
} from "../lib/libraryData";

type SortMode = "area" | "bank" | "alphabetical" | "year";
type SettingsView = "home" | "manufacturer" | "venue";

const BUILTIN_SOURCE_IDS = new Set(["venue--pm-16470", "venue--pm-8760"]);
const VENUE_MIN_GAME_COUNT_STORAGE_KEY = "lpl-library:settings-add-venue-min-game-count:v1";

function fallbackSourceState(): LibrarySourceState {
  return {
    enabledSourceIds: [],
    pinnedSourceIds: [],
    selectedSourceId: null,
    selectedSortBySource: {},
    selectedBankBySource: {},
  };
}

function fallbackImageCandidates(game: LibraryGame): string[] {
  return cardArtworkCandidates(game);
}

function imagePropsForCandidates(candidates: string[]) {
  return {
    src: candidates[0] ?? "",
    srcSet: undefined as string | undefined,
    sizes: undefined as string | undefined,
    candidates,
  };
}

function sourceSubtitle(
  source: ImportedSourceRecord,
  manufacturers: CatalogManufacturerOption[],
  sourceGameCounts: Record<string, number>,
) {
  if (source.type === "manufacturer") {
    const count = manufacturers.find((manufacturer) => manufacturer.id === source.providerSourceId)?.gameCount ?? 0;
    return `Manufacturer • ${count === 1 ? "1 game" : `${count} games`}`;
  }
  if (source.type === "venue") {
    const count = sourceGameCounts[source.id] ?? 0;
    return `Imported venue • ${count === 1 ? "1 game" : `${count} games`}`;
  }
  if (source.type === "tournament") {
    const count = sourceGameCounts[source.id] ?? 0;
    return `Match Play tournament • ${count === 1 ? "1 game" : `${count} games`}`;
  }
  return "Category";
}

function bucketedManufacturers(
  manufacturers: CatalogManufacturerOption[],
  bucket: "modern" | "classic" | "other",
) {
  const classicTopIds = manufacturers
    .filter((manufacturer) => !manufacturer.isModern)
    .sort((left, right) => {
      if (left.gameCount !== right.gameCount) return right.gameCount - left.gameCount;
      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    })
    .slice(0, 20)
    .map((manufacturer) => manufacturer.id);
  const classicSet = new Set(classicTopIds);
  if (bucket === "modern") return manufacturers.filter((manufacturer) => manufacturer.isModern);
  if (bucket === "classic") {
    return manufacturers
      .filter((manufacturer) => classicSet.has(manufacturer.id))
      .sort((left, right) => {
        if (left.gameCount !== right.gameCount) return right.gameCount - left.gameCount;
        return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
      });
  }
  return manufacturers.filter((manufacturer) => !manufacturer.isModern && !classicSet.has(manufacturer.id));
}

function groupedSections(games: LibraryGame[]) {
  const sections: Array<{ key: string; games: LibraryGame[] }> = [];
  for (const game of games) {
    const key = String(game.group ?? "nogroup");
    const last = sections[sections.length - 1];
    if (!last || last.key !== key) {
      sections.push({ key, games: [game] });
    } else {
      last.games.push(game);
    }
  }
  return sections;
}

function bankSections(games: LibraryGame[]) {
  const sections: Array<{ key: string; games: LibraryGame[] }> = [];
  for (const game of games) {
    const key = String(game.bank ?? "nobank");
    const last = sections[sections.length - 1];
    if (!last || last.key !== key) {
      sections.push({ key, games: [game] });
    } else {
      last.games.push(game);
    }
  }
  return sections;
}

function GameCard({ game }: { game: LibraryGame }) {
  const image = imagePropsForCandidates(fallbackImageCandidates(game));
  return (
    <Link
      to={`/game/${encodeURIComponent(game.routeId)}`}
      className="group overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-neutral-800 transition hover:ring-neutral-600"
    >
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-neutral-950">
        {image.candidates.length ? (
          <img
            src={image.src}
            srcSet={image.srcSet}
            sizes={image.sizes}
            data-fallback-idx={0}
            loading="lazy"
            decoding="async"
            alt={game.name}
            className="block w-full h-auto"
            onLoad={(event) => cacheAssetUrl((event.currentTarget as HTMLImageElement).currentSrc)}
            onError={(event) => {
              const element = event.currentTarget as HTMLImageElement;
              const currentIndex = Number(element.dataset.fallbackIdx ?? "0");
              const nextIndex = currentIndex + 1;
              if (nextIndex < image.candidates.length) {
                element.dataset.fallbackIdx = String(nextIndex);
                element.src = image.candidates[nextIndex];
              }
            }}
          />
        ) : (
          <div className="text-sm text-neutral-500">No image</div>
        )}
      </div>

      <div className="bg-gradient-to-b from-neutral-900/50 to-neutral-950 px-3 pb-3 pt-2.5">
        <div className="flex min-h-10 items-start text-[16px] font-semibold leading-4 text-white">
          <span className="line-clamp-2 min-w-0">{game.name}</span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-white/95">
          <span className="min-w-0 truncate">{manufacturerYearCardText(game)}</span>
          {game.variant && (
            <span className="max-w-[5.25rem] truncate rounded-full border border-white/20 bg-black/45 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/90">
              {game.variant}
            </span>
          )}
        </div>
        <div className={`mt-1 text-xs text-white/85 ${locationBankText(game) ? "" : "opacity-0"}`}>
          {locationBankText(game) || "placeholder"}
        </div>
      </div>
    </Link>
  );
}

export default function LibraryIndex() {
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<LibraryGame[]>([]);
  const [sources, setSources] = useState<LibrarySource[]>([]);
  const [visibleSources, setVisibleSources] = useState<LibrarySource[]>([]);
  const [manufacturerOptions, setManufacturerOptions] = useState<CatalogManufacturerOption[]>([]);
  const [importedSources, setImportedSources] = useState<ImportedSourceRecord[]>([]);
  const [sourceGameCounts, setSourceGameCounts] = useState<Record<string, number>>({});
  const [sourceState, setSourceState] = useState<LibrarySourceState>(() => loadLibrarySourceState());
  const [selectedSourceId, setSelectedSourceId] = useState("venue--pm-8760");
  const [query, setQuery] = useState("");
  const [bank, setBank] = useState<number | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("area");
  const [yearDescending, setYearDescending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>("home");
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [manufacturerQuery, setManufacturerQuery] = useState("");
  const [manufacturerBucket, setManufacturerBucket] = useState<"modern" | "classic" | "other">("modern");

  const [venueQuery, setVenueQuery] = useState("");
  const [venueRadiusMiles, setVenueRadiusMiles] = useState(50);
  const [venueResults, setVenueResults] = useState<LibraryVenueSearchResult[]>([]);
  const [venueSearching, setVenueSearching] = useState(false);
  const [venueHasSearched, setVenueHasSearched] = useState(false);
  const [venueSearchError, setVenueSearchError] = useState<string | null>(null);
  const settingsBodyRef = useRef<HTMLDivElement | null>(null);
  const [minimumGameCount, setMinimumGameCount] = useState<number>(() => {
    try {
      const raw = window.localStorage.getItem(VENUE_MIN_GAME_COUNT_STORAGE_KEY);
      const parsed = raw ? Number.parseInt(raw, 10) : NaN;
      return Number.isFinite(parsed) ? parsed : 5;
    } catch {
      return 5;
    }
  });

  useEffect(() => {
    prefetchPinballTextAssets().catch(() => undefined);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(VENUE_MIN_GAME_COUNT_STORAGE_KEY, String(minimumGameCount));
    } catch {
      // ignore storage errors
    }
  }, [minimumGameCount]);

  useEffect(() => {
    if (!settingsOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [settingsOpen]);

  useEffect(() => {
    settingsBodyRef.current?.scrollTo({ top: 0 });
  }, [settingsOpen, settingsView]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const bundle = await loadResolvedLibraryData();
        if (cancelled) return;
        setGames(bundle.games);
        setSources(bundle.sources);
        setVisibleSources(bundle.visibleSources);
        setManufacturerOptions(bundle.manufacturerOptions);
        setImportedSources(bundle.importedSources);
        setSourceGameCounts(bundle.sourceGameCounts);
        setSourceState(bundle.sourceState);
        const preferredId = preferredLibrarySourceId(bundle.sources, bundle.sourceState, null);
        if (preferredId) setSelectedSourceId(preferredId);
      } catch (error) {
        console.error("Failed to load library data.", error);
        if (cancelled) return;
        setGames([]);
        setSources([]);
        setVisibleSources([]);
        setImportedSources([]);
        setManufacturerOptions([]);
        setSourceGameCounts({});
        setSourceState(fallbackSourceState());
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const reloadLibrary = async (requestedSourceId?: string | null) => {
    const bundle = await loadResolvedLibraryData();
    setGames(bundle.games);
    setSources(bundle.sources);
    setVisibleSources(bundle.visibleSources);
    setManufacturerOptions(bundle.manufacturerOptions);
    setImportedSources(bundle.importedSources);
    setSourceGameCounts(bundle.sourceGameCounts);
    setSourceState(bundle.sourceState);
    const preferredId = preferredLibrarySourceId(bundle.sources, bundle.sourceState, requestedSourceId ?? selectedSourceId);
    if (preferredId) setSelectedSourceId(preferredId);
  };

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId) ?? sources[0] ?? null,
    [selectedSourceId, sources],
  );

  const sourceScopedGames = useMemo(() => {
    if (!selectedSource) return games;
    return games.filter((game) => game.sourceId === selectedSource.id);
  }, [games, selectedSource]);

  const supportsBankFilter = useMemo(
    () => selectedSource?.type === "venue" && sourceScopedGames.some((game) => (game.bank ?? 0) > 0),
    [selectedSource, sourceScopedGames],
  );

  const availableSortModes = useMemo(
    () => availableSortModesForSource(selectedSource, sourceScopedGames),
    [selectedSource, sourceScopedGames],
  );

  useEffect(() => {
    if (!selectedSource) return;
    setSourceState((current) => (
      current.selectedSourceId === selectedSource.id
        ? current
        : setSelectedLibrarySource(selectedSource.id, current)
    ));
  }, [selectedSource]);

  useEffect(() => {
    if (!selectedSource) return;
    const persistedSort = sourceState.selectedSortBySource[selectedSource.id];
    const defaultSort = preferredDefaultSortMode(selectedSource, sourceScopedGames);
    const defaultYearDescending = preferredDefaultYearDescending(selectedSource, sourceScopedGames);
    if (persistedSort === "YEAR_DESC" && availableSortModes.includes("year")) {
      setSortMode("year");
      setYearDescending(true);
    } else if (persistedSort === "year" && availableSortModes.includes("year")) {
      setSortMode("year");
      setYearDescending(false);
    } else if (persistedSort && availableSortModes.includes(persistedSort as SortMode)) {
      setSortMode(persistedSort as SortMode);
      setYearDescending(false);
    } else {
      setSortMode(availableSortModes.includes(defaultSort) ? defaultSort : availableSortModes[0]);
      setYearDescending(defaultYearDescending);
    }
    const persistedBank = sourceState.selectedBankBySource[selectedSource.id];
    setBank(supportsBankFilter && typeof persistedBank === "number" ? persistedBank : "all");
  }, [availableSortModes, selectedSource, sourceScopedGames, sourceState, supportsBankFilter]);

  useEffect(() => {
    if (!supportsBankFilter) setBank("all");
  }, [supportsBankFilter]);

  const bankOptions = useMemo(() => {
    const uniqueBanks = new Set<number>();
    for (const game of sourceScopedGames) {
      if (typeof game.bank === "number" && game.bank > 0) uniqueBanks.add(game.bank);
    }
    return [...uniqueBanks].sort((left, right) => left - right);
  }, [sourceScopedGames]);

  const filteredGames = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const scoped = sourceScopedGames.filter((game) => {
      const matchesQuery =
        !normalizedQuery ||
        `${game.name} ${game.manufacturer ?? ""} ${game.year ?? ""}`.toLowerCase().includes(normalizedQuery);
      const matchesBank =
        !supportsBankFilter ||
        bank === "all" ||
        (typeof game.bank === "number" && game.bank === bank);
      return matchesQuery && matchesBank;
    });
    return sortLibraryGames(scoped, sortMode, yearDescending);
  }, [bank, query, sortMode, sourceScopedGames, supportsBankFilter, yearDescending]);

  const grouped = useMemo(() => groupedSections(filteredGames), [filteredGames]);
  const bankGrouped = useMemo(() => bankSections(filteredGames), [filteredGames]);
  const showGroupedView = supportsBankFilter ? bank === "all" && sortMode === "area" : sortMode === "area";
  const showBankGroupedView = supportsBankFilter && bank === "all" && sortMode === "bank";

  const filteredManufacturers = useMemo(() => {
    const bucketed = bucketedManufacturers(manufacturerOptions, manufacturerBucket);
    const normalized = manufacturerQuery.trim().toLowerCase();
    if (!normalized) return bucketed;
    return bucketed.filter((manufacturer) => manufacturer.name.toLowerCase().includes(normalized));
  }, [manufacturerBucket, manufacturerOptions, manufacturerQuery]);

  const visibleVenueResults = useMemo(
    () => venueResults.filter((venue) => venue.machineCount >= minimumGameCount),
    [minimumGameCount, venueResults],
  );

  const venueEmptyMessage = useMemo(() => {
    if (!venueHasSearched) return null;
    if (!venueResults.length) return "No venues found for that search.";
    if (!visibleVenueResults.length) {
      return minimumGameCount === 1
        ? "No venues found with at least 1 game."
        : `No venues found with at least ${minimumGameCount} games.`;
    }
    return null;
  }, [minimumGameCount, venueHasSearched, venueResults.length, visibleVenueResults.length]);

  const visibleLibrarySources = visibleSources.length ? visibleSources : sources;

  const handleSourceChange = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    setBank("all");
  };

  const handleSortSelect = (value: string) => {
    if (!selectedSource) return;
    if (value === "YEAR_DESC") {
      setSortMode("year");
      setYearDescending(true);
      const nextState = setSelectedSortForSource(selectedSource.id, "YEAR_DESC", sourceState);
      setSourceState(nextState);
      return;
    }
    const nextSort = value as SortMode;
    setSortMode(nextSort);
    setYearDescending(false);
    const nextState = setSelectedSortForSource(selectedSource.id, nextSort, sourceState);
    setSourceState(nextState);
  };

  const handleBankChange = (value: string) => {
    if (!selectedSource) return;
    const nextBank = value === "all" ? null : Number.parseInt(value, 10);
    setBank(nextBank ?? "all");
    const nextState = setSelectedBankForSource(selectedSource.id, nextBank, sourceState);
    setSourceState(nextState);
  };

  const addManufacturer = async (manufacturer: CatalogManufacturerOption) => {
    upsertImportedSource({
      id: `manufacturer--${manufacturer.id}`,
      name: manufacturer.name,
      type: "manufacturer",
      provider: "opdb",
      providerSourceId: manufacturer.id,
      machineIds: [],
      lastSyncedAtMs: Date.now(),
    });
    const sourceId = `manufacturer--${manufacturer.id}`;
    const visibleState = setLibrarySourceVisible(sourceId, true, loadLibrarySourceState());
    const nextState = setSelectedLibrarySource(sourceId, visibleState);
    setSourceState(nextState);
    setSelectedSourceId(sourceId);
    setSettingsError(null);
    setSettingsOpen(false);
    await reloadLibrary(sourceId);
  };

  const runVenueSearch = async () => {
    setVenueSearching(true);
    setVenueSearchError(null);
    setVenueHasSearched(true);
    try {
      const results = await searchPinballMapVenues(venueQuery, venueRadiusMiles);
      setVenueResults(results);
    } catch (error) {
      setVenueSearchError(error instanceof Error ? error.message : "Venue search failed.");
      setVenueResults([]);
    } finally {
      setVenueSearching(false);
    }
  };

  const importVenue = async (venue: LibraryVenueSearchResult) => {
    setVenueSearching(true);
    setVenueSearchError(null);
    try {
      const machineIds = await fetchVenueMachineIds(venue.id.replace("venue--pm-", ""));
      if (!machineIds.length) {
        throw new Error("This venue does not currently expose any OPDB-linked machines to import.");
      }
      upsertImportedSource({
        id: venue.id,
        name: venue.name,
        type: "venue",
        provider: "pinball_map",
        providerSourceId: venue.id.replace("venue--pm-", ""),
        machineIds,
        lastSyncedAtMs: Date.now(),
        searchQuery: venueQuery.trim(),
        distanceMiles: venueRadiusMiles,
      });
      const visibleState = setLibrarySourceVisible(venue.id, true, loadLibrarySourceState());
      const nextState = setSelectedLibrarySource(venue.id, visibleState);
      setSourceState(nextState);
      setSelectedSourceId(venue.id);
      setSettingsError(null);
      setSettingsOpen(false);
      await reloadLibrary(venue.id);
    } catch (error) {
      setVenueSearchError(error instanceof Error ? error.message : "Venue import failed.");
    } finally {
      setVenueSearching(false);
    }
  };

  const refreshImportedVenue = async (source: ImportedSourceRecord) => {
    setSettingsError(null);
    try {
      const machineIds = await fetchVenueMachineIds(source.providerSourceId);
      upsertImportedSource({
        ...source,
        machineIds,
        lastSyncedAtMs: Date.now(),
      });
      await reloadLibrary();
    } catch (error) {
      setSettingsError(error instanceof Error ? `Venue refresh failed: ${error.message}` : "Venue refresh failed.");
    }
  };

  const deleteImported = async (sourceId: string) => {
    removeImportedSource(sourceId);
    const nextState = setLibrarySourceVisible(sourceId, false, loadLibrarySourceState());
    setSourceState(nextState);
    await reloadLibrary();
  };

  const toggleLibrary = async (sourceId: string, isVisible: boolean) => {
    const nextState = setLibrarySourceVisible(sourceId, isVisible, sourceState);
    setSourceState(nextState);
    setSettingsError(null);
    await reloadLibrary();
  };

  const managedRows = [
    ...sources
      .filter((source) => BUILTIN_SOURCE_IDS.has(source.id))
      .map((source) => ({
        source,
        builtin: true,
        subtitle: "Built-in venue",
        imported: null as ImportedSourceRecord | null,
      })),
    ...importedSources
      .filter((source) => !BUILTIN_SOURCE_IDS.has(source.id))
      .map((source) => ({
      source: { id: source.id, name: source.name, type: source.type } as LibrarySource,
      builtin: false,
      subtitle: sourceSubtitle(source, manufacturerOptions, sourceGameCounts),
      imported: source,
      })),
  ];

  const controls = (
    <div className="rounded-2xl bg-neutral-950/55 px-2 py-2 backdrop-blur-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search games…"
          className={`${CONTROL_INPUT_CLASS} md:flex-1`}
        />

        <div className="flex w-full flex-wrap gap-3 md:w-auto md:flex-none md:items-center">
          <div className="flex w-full items-center gap-2 md:w-[16.5rem]">
            <div className="relative min-w-0 flex-1">
              <select
                value={selectedSource?.id ?? selectedSourceId}
                onChange={(event) => handleSourceChange(event.target.value)}
                className={CONTROL_SELECT_CLASS}
                aria-label="Select library"
              >
                {visibleLibrarySources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl text-neutral-300">▾</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setSettingsOpen(true);
                setSettingsView("home");
                setSettingsError(null);
              }}
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-neutral-200 ring-1 ring-neutral-700 transition hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              aria-label="Library settings"
              title="Library settings"
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current" aria-hidden="true">
                <path
                  d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7Zm8 3.5l-1.7-.6a6.7 6.7 0 0 0-.5-1.3l.8-1.6l-1.9-1.9l-1.6.8c-.4-.2-.9-.4-1.3-.5L13 4h-2l-.6 1.7c-.5.1-.9.3-1.3.5l-1.6-.8l-1.9 1.9l.8 1.6c-.2.4-.4.9-.5 1.3L4 11v2l1.7.6c.1.5.3.9.5 1.3l-.8 1.6l1.9 1.9l1.6-.8c.4.2.9.4 1.3.5L11 20h2l.6-1.7c.5-.1.9-.3 1.3-.5l1.6.8l1.9-1.9l-.8-1.6c.2-.4.4-.9.5-1.3L20 13v-2Z"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div className="relative w-full md:w-[15rem]">
            <select
              value={sortMode === "year" && yearDescending ? "YEAR_DESC" : sortMode}
              onChange={(event) => handleSortSelect(event.target.value)}
              className={CONTROL_SELECT_CLASS}
              aria-label="Sort games"
            >
              {availableSortModes.flatMap((mode) => {
                if (mode === "year") {
                  return [
                    <option key="year-asc" value="year">
                      Sort: Year (Old-New)
                    </option>,
                    <option key="year-desc" value="YEAR_DESC">
                      Sort: Year (New-Old)
                    </option>,
                  ];
                }
                return (
                  <option key={mode} value={mode}>
                    {mode === "area" ? "Sort: Area" : mode === "bank" ? "Sort: Bank" : "Sort: A-Z"}
                  </option>
                );
              })}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl text-neutral-300">▾</span>
          </div>

          {supportsBankFilter ? (
            <div className="relative w-full md:w-auto">
              <select
                value={bank === "all" ? "all" : String(bank)}
                onChange={(event) => handleBankChange(event.target.value)}
                className={CONTROL_SELECT_CLASS}
                aria-label="Filter by bank"
              >
                <option value="all">All banks</option>
                {bankOptions.map((value) => (
                  <option key={value} value={String(value)}>
                    Bank {value}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl text-neutral-300">▾</span>
            </div>
          ) : null}
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
        <div className="pointer-events-none mb-4 opacity-0" aria-hidden>
          {controls}
        </div>

        <div className="mt-6">
          {loading && games.length === 0 ? (
            <div className="text-neutral-400">Loading library…</div>
          ) : showGroupedView ? (
            <div className="space-y-8">
              {grouped.map((section, index) => (
                <div key={`${section.key}-${index}`}>
                  {index > 0 && <div className="mb-6 h-px w-full bg-white/55" />}
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {section.games.map((game) => (
                      <GameCard key={game.routeId} game={game} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : showBankGroupedView ? (
            <div className="space-y-8">
              {bankGrouped.map((section, index) => (
                <div key={`${section.key}-${index}`}>
                  {index > 0 && <div className="mb-6 h-px w-full bg-white/55" />}
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {section.games.map((game) => (
                      <GameCard key={game.routeId} game={game} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {filteredGames.map((game) => (
                <GameCard key={game.routeId} game={game} />
              ))}
            </div>
          )}
        </div>

        {!loading && games.length === 0 && (
          <div className="mt-8 text-neutral-400">
            No data loaded. Confirm the clean foundation files are deployed:
            {" "}
            <code className="rounded bg-neutral-900 px-2 py-1">/pinball/data/opdb_export.json</code>,
            {" "}
            <code className="rounded bg-neutral-900 px-2 py-1">/pinball/data/default_pm_venue_sources_v1.json</code>,
            {" "}
            <code className="rounded bg-neutral-900 px-2 py-1">/pinball/data/rulesheet_assets.json</code>,
            {" "}
            <code className="rounded bg-neutral-900 px-2 py-1">/pinball/data/video_assets.json</code>,
            {" "}
            <code className="rounded bg-neutral-900 px-2 py-1">/pinball/data/playfield_assets.json</code>,
            {" "}
            <code className="rounded bg-neutral-900 px-2 py-1">/pinball/data/gameinfo_assets.json</code>,
            {" "}
            and <code className="rounded bg-neutral-900 px-2 py-1">/pinball/data/venue_layout_assets.json</code>.
          </div>
        )}
      </PageContainer>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <Panel className="flex max-h-[90vh] min-h-0 w-full max-w-5xl flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <div>
                <div className="text-lg font-semibold">
                  {settingsView === "home" ? "Library Settings" : settingsView === "manufacturer" ? "Add Manufacturer" : "Add Venue"}
                </div>
                <div className="text-sm text-neutral-400">
                  {settingsView === "home"
                    ? "Match the app's source management inside Library."
                    : settingsView === "manufacturer"
                      ? "Browse OPDB manufacturers and add them as Library sources."
                      : "Search Pinball Map and import a venue into Library."}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {settingsView !== "home" && (
                  <button
                    type="button"
                    onClick={() => setSettingsView("home")}
                    className={SUBTLE_BUTTON_CLASS}
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className={SUBTLE_BUTTON_CLASS}
                >
                  Close
                </button>
              </div>
            </div>

            <div ref={settingsBodyRef} className="min-h-0 overflow-y-auto px-5 py-4">
              {settingsError && (
                <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-950/45 px-4 py-3 text-sm text-rose-200">
                  {settingsError}
                </div>
              )}

              {settingsView === "home" && (
                <div className="space-y-4">
                  <Panel className="p-4">
                    <div className="text-lg font-semibold">Library</div>
                    <div className="mt-3 text-sm font-semibold text-neutral-300">Add:</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setSettingsView("manufacturer")} className={SUBTLE_BUTTON_CLASS}>
                        Manufacturer
                      </button>
                      <button type="button" onClick={() => setSettingsView("venue")} className={SUBTLE_BUTTON_CLASS}>
                        Venue
                      </button>
                    </div>
                    <div className="mt-3 text-xs text-neutral-400">
                      Library controls whether a source&apos;s games are included here and whether that source appears in the library picker.
                    </div>

                    <div className="mt-4 overflow-hidden rounded-xl border border-neutral-800">
                      <div className="grid grid-cols-[minmax(0,1fr)_5.25rem] gap-3 bg-neutral-950/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">
                        <div>Source</div>
                        <div className="text-center">Library</div>
                      </div>
                      {managedRows.map((row, index) => (
                        <div key={row.source.id} className={`${index > 0 ? "border-t border-neutral-800" : ""} grid grid-cols-[minmax(0,1fr)_5.25rem] gap-3 px-4 py-3`}>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{row.source.name}</div>
                            <div className="truncate text-xs text-neutral-400">{row.subtitle}</div>
                            {!row.builtin && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {row.imported?.type === "venue" && (
                                  <button
                                    type="button"
                                    onClick={() => row.imported && refreshImportedVenue(row.imported)}
                                    className="rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-500"
                                  >
                                    Refresh
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => deleteImported(row.source.id)}
                                  className="rounded-lg border border-rose-500/30 px-2 py-1 text-xs text-rose-200 hover:border-rose-400/50"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={sourceState.enabledSourceIds.includes(row.source.id)}
                              onChange={(event) => toggleLibrary(row.source.id, event.target.checked)}
                              className="h-4 w-4 accent-sky-400"
                              aria-label={`Show ${row.source.name} in Library`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {importedSources.length === 0 && (
                      <div className="mt-4 text-xs text-neutral-400">No additional sources added yet.</div>
                    )}
                  </Panel>
                </div>
              )}

              {settingsView === "manufacturer" && (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[auto_auto_auto_minmax(0,1fr)]">
                    {(["modern", "classic", "other"] as const).map((bucket) => (
                      <button
                        key={bucket}
                        type="button"
                        onClick={() => setManufacturerBucket(bucket)}
                        className={`rounded-xl px-4 py-2 text-sm ${manufacturerBucket === bucket ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40" : "bg-neutral-900 text-neutral-300 ring-1 ring-neutral-800"}`}
                      >
                        {bucket === "modern" ? "Modern" : bucket === "classic" ? "Classic" : "Other"}
                      </button>
                    ))}
                    <input
                      value={manufacturerQuery}
                      onChange={(event) => setManufacturerQuery(event.target.value)}
                      placeholder="Search manufacturers"
                      className={CONTROL_INPUT_CLASS}
                    />
                  </div>

                  <div className="space-y-2">
                    {filteredManufacturers.map((manufacturer) => (
                      <Panel key={manufacturer.id} className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate font-semibold">{manufacturer.name}</div>
                              {manufacturer.isModern && (
                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-neutral-200">
                                  Modern
                                </span>
                              )}
                              <span className="text-xs text-neutral-400">
                                {manufacturer.gameCount} games
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => addManufacturer(manufacturer)}
                            className={SUBTLE_BUTTON_CLASS}
                          >
                            Add
                          </button>
                        </div>
                      </Panel>
                    ))}
                    {filteredManufacturers.length === 0 && (
                      <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-3 text-sm text-neutral-400">
                        {manufacturerOptions.length === 0
                          ? "Manufacturer catalog unavailable right now."
                          : "No manufacturers match that filter."}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {settingsView === "venue" && (
                <div className="space-y-4">
                  <div className="text-xs text-neutral-400">
                    Search powered by <a className="underline" href="https://www.pinballmap.com" target="_blank" rel="noreferrer">Pinball Map</a>
                  </div>

                  <input
                    value={venueQuery}
                    onChange={(event) => setVenueQuery(event.target.value)}
                    placeholder="City or ZIP code"
                    className={CONTROL_INPUT_CLASS}
                  />

                  <div className="flex flex-wrap gap-2">
                    {[10, 25, 50, 100].map((miles) => (
                      <button
                        key={miles}
                        type="button"
                        onClick={() => setVenueRadiusMiles(miles)}
                        className={`rounded-xl px-4 py-2 text-sm ${venueRadiusMiles === miles ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40" : "bg-neutral-900 text-neutral-300 ring-1 ring-neutral-800"}`}
                      >
                        {miles} mi
                      </button>
                    ))}
                  </div>

                  <label className="flex items-center gap-3 text-sm text-neutral-300">
                    <span>Minimum games</span>
                    <input
                      type="number"
                      min={0}
                      value={minimumGameCount}
                      onChange={(event) => setMinimumGameCount(Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0))}
                      className="w-24 rounded-lg bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-700"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => runVenueSearch().catch(() => undefined)}
                    disabled={venueSearching || !venueQuery.trim()}
                    className={`${SUBTLE_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {venueSearching ? "Searching..." : "Search Pinball Map"}
                  </button>

                  {venueSearchError && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-950/45 px-4 py-3 text-sm text-rose-200">
                      {venueSearchError}
                    </div>
                  )}

                  {venueEmptyMessage && (
                    <div className="text-sm text-neutral-400">{venueEmptyMessage}</div>
                  )}

                  {!venueHasSearched && !venueResults.length && !venueSearching && (
                    <div className="text-sm text-neutral-400">
                      Search Pinball Map by city or ZIP, then import a venue as a Library source.
                    </div>
                  )}

                  <div className="space-y-2">
                    {visibleVenueResults.map((venue) => (
                      <Panel key={venue.id} className="p-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold">{venue.name}</div>
                            <div className="text-xs text-neutral-400">
                              {[venue.city, venue.state, venue.zip].filter(Boolean).join(", ")}
                            </div>
                            <div className="mt-1 text-xs text-neutral-400">
                              {`${venue.machineCount} games${venue.distanceMiles != null ? ` • ${venue.distanceMiles.toFixed(1)} mi` : ""}`}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => importVenue(venue).catch(() => undefined)}
                            disabled={venueSearching}
                            className={`${SUBTLE_BUTTON_CLASS} whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            Import Venue
                          </button>
                        </div>
                      </Panel>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
