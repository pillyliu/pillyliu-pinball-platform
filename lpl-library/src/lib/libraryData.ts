import { fetchPinballJson } from "../../../shared/ui/pinballCache";

export type Video = { kind: string; label: string; url: string };
export type ReferenceLink = {
  label: string;
  url: string;
  provider: string | null;
  localPath: string | null;
};

export type LibrarySourceType = "venue" | "category" | "manufacturer" | "tournament";

export type LibrarySource = {
  id: string;
  name: string;
  type: LibrarySourceType;
};

export type SortMode = "area" | "bank" | "alphabetical" | "year";

export type LibraryGame = {
  routeId: string;
  libraryEntryId: string | null;
  practiceIdentity: string | null;
  opdbId: string | null;
  opdbGroupId: string | null;
  variant: string | null;
  sourceId: string;
  sourceName: string;
  sourceType: LibrarySourceType;
  area: string | null;
  areaOrder: number | null;
  group: number | null;
  position: number | null;
  bank: number | null;
  name: string;
  manufacturer: string | null;
  year: number | null;
  slug: string;
  primaryImageUrl: string | null;
  primaryImageLargeUrl: string | null;
  playfieldImageUrl: string | null;
  alternatePlayfieldImageUrl: string | null;
  playfieldLocalOriginal: string | null;
  playfieldLocal: string | null;
  groupPlayfieldLocalOriginal: string | null;
  groupPlayfieldLocal: string | null;
  playfieldSourceLabel: string | null;
  gameinfoLocal: string | null;
  rulesheetLocal: string | null;
  rulesheetUrl: string | null;
  rulesheetLinks: ReferenceLink[];
  videos: Video[];
};

export type CatalogManufacturerOption = {
  id: string;
  name: string;
  gameCount: number;
  isModern: boolean;
  featuredRank: number | null;
  sortBucket: number;
};

export type ImportedSourceProvider = "opdb" | "pinball_map" | "match_play";

export type ImportedSourceRecord = {
  id: string;
  name: string;
  type: LibrarySourceType;
  provider: ImportedSourceProvider;
  providerSourceId: string;
  machineIds: string[];
  lastSyncedAtMs?: number | null;
  searchQuery?: string | null;
  distanceMiles?: number | null;
};

export type LibrarySourceState = {
  enabledSourceIds: string[];
  pinnedSourceIds: string[];
  selectedSourceId: string | null;
  selectedSortBySource: Record<string, string>;
  selectedBankBySource: Record<string, number>;
};

export type LibraryVenueSearchResult = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  distanceMiles: number | null;
  machineCount: number;
};

export type ResolvedLibraryData = {
  games: LibraryGame[];
  sources: LibrarySource[];
  visibleSources: LibrarySource[];
  sourceState: LibrarySourceState;
  importedSources: ImportedSourceRecord[];
  manufacturerOptions: CatalogManufacturerOption[];
  sourceGameCounts: Record<string, number>;
};

export type LivePlayfieldStatus = {
  effectiveKind: "pillyliu" | "opdb" | "external" | "missing";
  effectiveUrl: string | null;
};

export type PlayfieldOption = {
  title: string;
  candidates: string[];
};

type ParsedLibraryData = {
  games: LibraryGame[];
  sources: LibrarySource[];
};

type CatalogManufacturerRecord = {
  id: string;
  name: string;
  isModern: boolean;
  featuredRank: number | null;
  gameCount: number;
  sortBucket: number;
};

type CatalogMachineRecord = {
  practiceIdentity: string;
  opdbMachineId: string | null;
  opdbGroupId: string | null;
  slug: string;
  name: string;
  variant: string | null;
  manufacturerId: string | null;
  manufacturerName: string | null;
  year: number | null;
  primaryImageMediumUrl: string | null;
  primaryImageLargeUrl: string | null;
  playfieldImageMediumUrl: string | null;
  playfieldImageLargeUrl: string | null;
};

type CatalogRulesheetLinkRecord = {
  practiceIdentity: string;
  provider: string;
  label: string;
  url: string | null;
  localPath: string | null;
  priority: number | null;
};

type CatalogVideoLinkRecord = {
  practiceIdentity: string;
  provider: string;
  kind: string | null;
  label: string;
  url: string | null;
  priority: number | null;
};

type CatalogRoot = {
  manufacturers: CatalogManufacturerRecord[];
  machines: CatalogMachineRecord[];
  rulesheetLinks: CatalogRulesheetLinkRecord[];
  videoLinks: CatalogVideoLinkRecord[];
};

type LegacyCuratedOverride = {
  practiceIdentity: string;
  nameOverride?: string | null;
  variantOverride?: string | null;
  manufacturerOverride?: string | null;
  yearOverride?: number | null;
  playfieldLocalPath?: string | null;
  playfieldSourceUrl?: string | null;
  gameinfoLocalPath?: string | null;
  rulesheetLocalPath?: string | null;
  rulesheetLinks?: ReferenceLink[];
  videos?: Video[];
};

type ResolvedRulesheetLinks = {
  localPath: string | null;
  links: ReferenceLink[];
};

type GroupPlayfieldOverride = {
  playfieldLocalPath: string | null;
  playfieldSourceUrl?: string | null;
};

type PublicLibraryPlayfieldOverrideRecord = {
  practiceIdentity: string;
  opdbGroupId: string | null;
  playfieldLocalPath: string | null;
  playfieldSourceUrl: string | null;
};

type PublicLibraryOverridesRoot = {
  playfieldOverrides: PublicLibraryPlayfieldOverrideRecord[];
};

const OPDB_CATALOG_PATH = "/pinball/data/opdb_catalog_v1.json";
const LIBRARY_PATH = "/pinball/data/pinball_library_v3.json";
const PUBLIC_LIBRARY_OVERRIDES_PATH = "/pinball/data/pinball_library_seed_overrides_v1.json";
const FALLBACK_PLAYFIELD_700 = "/pinball/images/playfields/fallback-whitewood-playfield_700.webp";
const FALLBACK_PLAYFIELD_1400 = "/pinball/images/playfields/fallback-whitewood-playfield_1400.webp";
const DEFAULT_AVENUE_SOURCE_IDS = ["venue--the-avenue-cafe", "the-avenue"] as const;
const BUILTIN_SOURCE_IDS = ["venue--rlm-amusements", "venue--the-avenue-cafe"] as const;
const LEGACY_SOURCE_ID_ALIASES: Record<string, string> = {
  "the-avenue": "venue--the-avenue-cafe",
  "rlm-amusements": "venue--rlm-amusements",
};
const LIBRARY_SOURCE_STATE_COOKIE = "lpl_library_source_state_v1";
const IMPORTED_SOURCES_STORAGE_KEY = "lpl-library:imported-sources:v1";
export const MAX_PINNED_SOURCES = 10;

let baseCatalogPromise: Promise<{
  payload: ParsedLibraryData;
  catalogRoot: CatalogRoot;
  publicOverrides: PublicLibraryOverridesRoot;
}> | null = null;

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function normalizedOptionalString(value: unknown): string | null {
  return String(value ?? "")
    .trim()
    .replace(/^null$/i, "")
    .trim() || null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function machineGroupKey(machine: Pick<CatalogMachineRecord, "opdbGroupId" | "practiceIdentity">): string | null {
  return normalizedOptionalString(machine.opdbGroupId) ?? normalizedOptionalString(machine.practiceIdentity);
}

function gameGroupKey(game: Pick<LibraryGame, "opdbGroupId" | "practiceIdentity" | "routeId">): string {
  return normalizedOptionalString(game.opdbGroupId) ?? normalizedOptionalString(game.practiceIdentity) ?? game.routeId;
}

function normalizeSourceType(raw?: unknown): LibrarySourceType {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "category") return "category";
  if (value === "manufacturer") return "manufacturer";
  if (value === "tournament") return "tournament";
  return "venue";
}

function canonicalLibrarySourceId(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  return LEGACY_SOURCE_ID_ALIASES[trimmed] ?? trimmed;
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

function deriveRouteId(item: Record<string, unknown>, slug: string, fallback: string): string {
  const libraryId = normalizedOptionalString(item.library_id);
  if (libraryId && slug) return `${libraryId}::${slug}`;
  return (
    slug ||
    normalizedOptionalString(item.library_entry_id) ||
    normalizedOptionalString(item.opdb_id) ||
    normalizedOptionalString(item.practice_identity) ||
    fallback
  );
}

function normalizeLibraryCachePath(path: string | null | undefined): string | null {
  const raw = normalizedOptionalString(path);
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const url = new URL(raw);
      if (url.host.toLowerCase() === "pillyliu.com" && url.pathname) {
        return url.pathname;
      }
    } catch {
      return raw;
    }
    return raw;
  }
  return `/${raw}`;
}

function normalizeLibraryPlayfieldLocalPath(path: string | null | undefined): string | null {
  const raw = normalizedOptionalString(path);
  if (!raw) return null;
  if (/_700\.webp$/i.test(raw)) return raw;
  if (/_1400\.webp$/i.test(raw)) return raw.replace(/_1400\.webp$/i, "_700.webp");
  if (raw.includes("/pinball/images/playfields/")) {
    return raw.replace(/\.[A-Za-z0-9]+$/, "_700.webp");
  }
  return raw;
}

function resolveLibraryUrl(pathOrUrl: string | null | undefined): string | null {
  const raw = normalizedOptionalString(pathOrUrl);
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function dedupeResolvedUrls(values: Array<string | null | undefined>): string[] {
  return values.filter((value, index, items): value is string => Boolean(value) && items.indexOf(value) === index);
}

function loadCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const pair = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));
  if (!pair) return null;
  return decodeURIComponent(pair.slice(name.length + 1));
}

function saveCookie(name: string, value: string) {
  if (!isBrowser()) return;
  const expires = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function removeCookie(name: string) {
  if (!isBrowser()) return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

export function loadLibrarySourceState(): LibrarySourceState {
  const raw = loadCookie(LIBRARY_SOURCE_STATE_COOKIE);
  if (!raw) {
    return {
      enabledSourceIds: [],
      pinnedSourceIds: [],
      selectedSourceId: null,
      selectedSortBySource: {},
      selectedBankBySource: {},
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LibrarySourceState>;
    const enabledSourceIds = Array.isArray(parsed.enabledSourceIds)
      ? parsed.enabledSourceIds.map((id) => canonicalLibrarySourceId(id)).filter(Boolean) as string[]
      : [];
    const pinnedSourceIds = Array.isArray(parsed.pinnedSourceIds)
      ? parsed.pinnedSourceIds.map((id) => canonicalLibrarySourceId(id)).filter(Boolean) as string[]
      : [];
    const selectedSortBySource = Object.fromEntries(
      Object.entries(parsed.selectedSortBySource ?? {})
        .map(([key, value]) => [canonicalLibrarySourceId(key), String(value ?? "")] as const)
        .filter(([key, value]) => Boolean(key && value)),
    ) as Record<string, string>;
    const selectedBankBySource = Object.fromEntries(
      Object.entries(parsed.selectedBankBySource ?? {})
        .map(([key, value]) => [canonicalLibrarySourceId(key), parseNumber(value)] as const)
        .filter(([key, value]) => Boolean(key && typeof value === "number")),
    ) as Record<string, number>;
    return {
      enabledSourceIds: [...new Set(enabledSourceIds)],
      pinnedSourceIds: [...new Set(pinnedSourceIds)],
      selectedSourceId: canonicalLibrarySourceId(parsed.selectedSourceId),
      selectedSortBySource,
      selectedBankBySource,
    };
  } catch {
    return {
      enabledSourceIds: [],
      pinnedSourceIds: [],
      selectedSourceId: null,
      selectedSortBySource: {},
      selectedBankBySource: {},
    };
  }
}

export function saveLibrarySourceState(state: LibrarySourceState) {
  const normalized: LibrarySourceState = {
    enabledSourceIds: [...new Set(state.enabledSourceIds.map((id) => canonicalLibrarySourceId(id)).filter(Boolean) as string[])],
    pinnedSourceIds: [...new Set(state.pinnedSourceIds.map((id) => canonicalLibrarySourceId(id)).filter(Boolean) as string[])],
    selectedSourceId: canonicalLibrarySourceId(state.selectedSourceId),
    selectedSortBySource: Object.fromEntries(
      Object.entries(state.selectedSortBySource).filter(([key, value]) => canonicalLibrarySourceId(key) && value),
    ),
    selectedBankBySource: Object.fromEntries(
      Object.entries(state.selectedBankBySource).filter(([key, value]) => canonicalLibrarySourceId(key) && typeof value === "number"),
    ),
  };
  if (
    !normalized.enabledSourceIds.length &&
    !normalized.pinnedSourceIds.length &&
    !normalized.selectedSourceId &&
    !Object.keys(normalized.selectedSortBySource).length &&
    !Object.keys(normalized.selectedBankBySource).length
  ) {
    removeCookie(LIBRARY_SOURCE_STATE_COOKIE);
    return;
  }
  saveCookie(LIBRARY_SOURCE_STATE_COOKIE, JSON.stringify(normalized));
}

export function synchronizeLibrarySourceState(
  state: LibrarySourceState,
  sources: LibrarySource[],
): LibrarySourceState {
  const validIds = new Set(sources.map((source) => source.id));
  const filteredEnabled = state.enabledSourceIds.filter((id, index, arr) => validIds.has(id) && arr.indexOf(id) === index);
  const filteredPinned = state.pinnedSourceIds.filter((id, index, arr) => validIds.has(id) && arr.indexOf(id) === index).slice(0, MAX_PINNED_SOURCES);
  const builtinEnabled = [...filteredEnabled];
  for (const builtinId of BUILTIN_SOURCE_IDS) {
    if (validIds.has(builtinId) && !builtinEnabled.includes(builtinId)) {
      builtinEnabled.push(builtinId);
    }
  }
  const next: LibrarySourceState = {
    enabledSourceIds: builtinEnabled.length ? builtinEnabled : sources.map((source) => source.id),
    pinnedSourceIds: filteredPinned.length ? filteredPinned : sources.slice(0, MAX_PINNED_SOURCES).map((source) => source.id),
    selectedSourceId: state.selectedSourceId && validIds.has(state.selectedSourceId) ? state.selectedSourceId : null,
    selectedSortBySource: Object.fromEntries(
      Object.entries(state.selectedSortBySource).filter(([id]) => validIds.has(id)),
    ),
    selectedBankBySource: Object.fromEntries(
      Object.entries(state.selectedBankBySource).filter(([id]) => validIds.has(id)),
    ),
  };
  saveLibrarySourceState(next);
  return next;
}

export function setLibrarySourceEnabled(
  sourceId: string,
  isEnabled: boolean,
  current: LibrarySourceState,
): LibrarySourceState {
  const canonicalId = canonicalLibrarySourceId(sourceId);
  if (!canonicalId) return current;
  const enabled = current.enabledSourceIds.filter((id) => id !== canonicalId);
  const pinned = current.pinnedSourceIds.filter((id) => id !== canonicalId);
  if (isEnabled) enabled.push(canonicalId);
  const next = {
    ...current,
    enabledSourceIds: enabled,
    pinnedSourceIds: pinned,
    selectedSourceId: !isEnabled && current.selectedSourceId === canonicalId ? null : current.selectedSourceId,
  };
  saveLibrarySourceState(next);
  return next;
}

export function setLibrarySourcePinned(
  sourceId: string,
  isPinned: boolean,
  current: LibrarySourceState,
): { state: LibrarySourceState; ok: boolean } {
  const canonicalId = canonicalLibrarySourceId(sourceId);
  if (!canonicalId) return { state: current, ok: false };
  const enabled = [...current.enabledSourceIds];
  const pinned = current.pinnedSourceIds.filter((id) => id !== canonicalId);
  if (isPinned) {
    if (pinned.length >= MAX_PINNED_SOURCES) {
      return { state: current, ok: false };
    }
    if (!enabled.includes(canonicalId)) enabled.push(canonicalId);
    pinned.push(canonicalId);
  }
  const next = {
    ...current,
    enabledSourceIds: enabled,
    pinnedSourceIds: pinned,
  };
  saveLibrarySourceState(next);
  return { state: next, ok: true };
}

export function setLibrarySourceVisible(
  sourceId: string,
  isVisible: boolean,
  current: LibrarySourceState,
): LibrarySourceState {
  const canonicalId = canonicalLibrarySourceId(sourceId);
  if (!canonicalId) return current;
  const enabled = current.enabledSourceIds.filter((id) => id !== canonicalId);
  if (isVisible) {
    enabled.push(canonicalId);
  }
  const next = {
    ...current,
    enabledSourceIds: enabled,
    pinnedSourceIds: enabled,
    selectedSourceId: !isVisible && current.selectedSourceId === canonicalId ? null : current.selectedSourceId,
  };
  saveLibrarySourceState(next);
  return next;
}

export function setSelectedLibrarySource(
  sourceId: string | null,
  current: LibrarySourceState,
): LibrarySourceState {
  const next = {
    ...current,
    selectedSourceId: canonicalLibrarySourceId(sourceId),
  };
  saveLibrarySourceState(next);
  return next;
}

export function setSelectedSortForSource(
  sourceId: string,
  sortKey: string,
  current: LibrarySourceState,
): LibrarySourceState {
  const canonicalId = canonicalLibrarySourceId(sourceId);
  if (!canonicalId) return current;
  const next = {
    ...current,
    selectedSortBySource: {
      ...current.selectedSortBySource,
      [canonicalId]: sortKey,
    },
  };
  saveLibrarySourceState(next);
  return next;
}

export function setSelectedBankForSource(
  sourceId: string,
  bank: number | null,
  current: LibrarySourceState,
): LibrarySourceState {
  const canonicalId = canonicalLibrarySourceId(sourceId);
  if (!canonicalId) return current;
  const selectedBankBySource = { ...current.selectedBankBySource };
  if (typeof bank === "number") {
    selectedBankBySource[canonicalId] = bank;
  } else {
    delete selectedBankBySource[canonicalId];
  }
  const next = {
    ...current,
    selectedBankBySource,
  };
  saveLibrarySourceState(next);
  return next;
}

export function loadImportedSources(): ImportedSourceRecord[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(IMPORTED_SOURCES_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ImportedSourceRecord[];
    return (Array.isArray(parsed) ? parsed : [])
      .map((source) => ({
        ...source,
        id: canonicalLibrarySourceId(source.id) ?? source.id,
        name: normalizedOptionalString(source.name) ?? source.id,
        providerSourceId: normalizedOptionalString(source.providerSourceId) ?? "",
        machineIds: Array.isArray(source.machineIds)
          ? source.machineIds.map((id) => normalizedOptionalString(id)).filter(Boolean) as string[]
          : [],
        type: normalizeSourceType(source.type),
        provider: source.provider,
      }))
      .filter((source) => source.id && source.providerSourceId)
      .sort((left, right) => {
        if (left.type !== right.type) return left.type.localeCompare(right.type);
        return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
      });
  } catch {
    return [];
  }
}

export function saveImportedSources(records: ImportedSourceRecord[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(IMPORTED_SOURCES_STORAGE_KEY, JSON.stringify(records));
}

export function upsertImportedSource(record: ImportedSourceRecord): ImportedSourceRecord[] {
  const canonicalId = canonicalLibrarySourceId(record.id);
  if (!canonicalId) return loadImportedSources();
  const current = loadImportedSources().filter((source) => source.id !== canonicalId);
  const next = [
    ...current,
    {
      ...record,
      id: canonicalId,
      machineIds: [...new Set(record.machineIds.map((id) => normalizedOptionalString(id)).filter(Boolean) as string[])],
    },
  ].sort((left, right) => {
    if (left.type !== right.type) return left.type.localeCompare(right.type);
    return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
  saveImportedSources(next);
  return next;
}

export function removeImportedSource(sourceId: string): ImportedSourceRecord[] {
  const canonicalId = canonicalLibrarySourceId(sourceId);
  if (!canonicalId) return loadImportedSources();
  const next = loadImportedSources().filter((source) => source.id !== canonicalId);
  saveImportedSources(next);
  return next;
}

async function repairImportedSources(records: ImportedSourceRecord[]): Promise<ImportedSourceRecord[]> {
  const staleVenueSources = records.filter((source) =>
    source.provider === "pinball_map" &&
    source.type === "venue" &&
    source.providerSourceId &&
    source.machineIds.length === 0,
  );
  if (!staleVenueSources.length) return records;

  let changed = false;
  const repaired = [...records];
  for (const source of staleVenueSources) {
    try {
      const machineIds = await fetchVenueMachineIds(source.providerSourceId);
      if (!machineIds.length) continue;
      const index = repaired.findIndex((entry) => entry.id === source.id);
      if (index < 0) continue;
      repaired[index] = {
        ...source,
        machineIds,
        lastSyncedAtMs: Date.now(),
      };
      changed = true;
    } catch {
      // Keep the stale record and let the user refresh manually if the repair attempt fails.
    }
  }

  if (changed) {
    saveImportedSources(repaired);
  }
  return repaired;
}

async function fetchPublicLibraryOverrides(): Promise<PublicLibraryOverridesRoot> {
  try {
    return parsePublicLibraryOverrides(await fetchPinballJson<unknown>(PUBLIC_LIBRARY_OVERRIDES_PATH));
  } catch {
    return { playfieldOverrides: [] };
  }
}

async function loadBaseCatalog(): Promise<{
  payload: ParsedLibraryData;
  catalogRoot: CatalogRoot;
  publicOverrides: PublicLibraryOverridesRoot;
}> {
  if (!baseCatalogPromise) {
    baseCatalogPromise = (async () => {
      const [libraryResult, catalogResult, publicOverridesResult] = await Promise.allSettled([
        fetchPinballJson<unknown>(LIBRARY_PATH),
        fetchPinballJson<unknown>(OPDB_CATALOG_PATH),
        fetchPublicLibraryOverrides(),
      ]);
      if (libraryResult.status !== "fulfilled") {
        throw libraryResult.reason;
      }
      return {
        payload: parseLibraryPayload(libraryResult.value),
        catalogRoot: catalogResult.status === "fulfilled" ? parseCatalogRoot(catalogResult.value) : emptyCatalogRoot(),
        publicOverrides: publicOverridesResult.status === "fulfilled"
          ? publicOverridesResult.value
          : { playfieldOverrides: [] },
      };
    })();
  }
  return baseCatalogPromise;
}

function emptyCatalogRoot(): CatalogRoot {
  return {
    manufacturers: [],
    machines: [],
    rulesheetLinks: [],
    videoLinks: [],
  };
}

function parsePublicLibraryOverrides(raw: unknown): PublicLibraryOverridesRoot {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { playfieldOverrides: [] };
  }
  const root = raw as { playfieldOverrides?: unknown[] };
  const playfieldOverrides = Array.isArray(root.playfieldOverrides)
    ? root.playfieldOverrides.map((value) => parsePublicLibraryPlayfieldOverride(value)).filter((value): value is PublicLibraryPlayfieldOverrideRecord => Boolean(value))
    : [];
  return { playfieldOverrides };
}

function parsePublicLibraryPlayfieldOverride(value: unknown): PublicLibraryPlayfieldOverrideRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const practiceIdentity = normalizedOptionalString(row.practiceIdentity);
  const playfieldLocalPath = normalizedOptionalString(row.playfieldLocalPath);
  const playfieldSourceUrl = normalizedOptionalString(row.playfieldSourceUrl);
  if (!practiceIdentity || (!playfieldLocalPath && !playfieldSourceUrl)) {
    return null;
  }
  return {
    practiceIdentity,
    opdbGroupId: normalizedOptionalString(row.opdbGroupId),
    playfieldLocalPath,
    playfieldSourceUrl,
  };
}

function parseLibraryPayload(raw: unknown): ParsedLibraryData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { games: [], sources: [] };
  }
  const root = raw as { items?: unknown[]; libraries?: unknown[]; sources?: unknown[]; games?: unknown[] };
  const items = Array.isArray(root.items)
    ? root.items
    : Array.isArray(root.games)
      ? root.games
      : [];
  const games = items
    .map((value, index) => parseBaseGame(value, index))
    .filter((game): game is LibraryGame => Boolean(game));
  const sources = parseSources(Array.isArray(root.libraries) ? root.libraries : Array.isArray(root.sources) ? root.sources : []);
  return {
    games,
    sources: sources.length ? sources : inferSourcesFromGames(games),
  };
}

function parseBaseGame(value: unknown, index: number): LibraryGame | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const slug = normalizedOptionalString(item.slug) ?? "";
  const routeId = deriveRouteId(item, slug, `row-${index + 1}`);
  const assets = item.assets && typeof item.assets === "object" && !Array.isArray(item.assets)
    ? item.assets as Record<string, unknown>
    : {};
  const videos = Array.isArray(item.videos) ? item.videos : [];
  const rulesheetLinks = Array.isArray(item.rulesheet_links)
    ? item.rulesheet_links
        .map((entry) => {
          const link = entry as Record<string, unknown>;
          const url = normalizedOptionalString(link.url);
          if (!url) return null;
          return {
            label: normalizedOptionalString(link.label) ?? "Rulesheet",
            url,
            provider: normalizedOptionalString(link.provider),
            localPath: normalizeLibraryCachePath(normalizedOptionalString(link.local_path)),
          };
        })
        .filter((entry): entry is ReferenceLink => Boolean(entry))
    : [];
  const sourceName =
    normalizedOptionalString(item.library_name) ??
    normalizedOptionalString(item.sourceName) ??
    normalizedOptionalString(item.venue) ??
    "The Avenue";
  const sourceId =
    canonicalLibrarySourceId(normalizedOptionalString(item.library_id)) ??
    canonicalLibrarySourceId(normalizedOptionalString(item.sourceId)) ??
    slugifySourceId(sourceName);
  return {
    routeId,
    libraryEntryId: normalizedOptionalString(item.library_entry_id),
    practiceIdentity: normalizedOptionalString(item.practice_identity),
    opdbId: normalizedOptionalString(item.opdb_id),
    opdbGroupId: normalizedOptionalString(item.opdb_group_id),
    variant: normalizedOptionalString(item.variant),
    sourceId: sourceId ?? "the-avenue",
    sourceName,
    sourceType: normalizeSourceType(item.library_type ?? item.sourceType),
    area: normalizedOptionalString(item.area) ?? normalizedOptionalString(item.location),
    areaOrder: parseNumber(item.area_order ?? item.areaOrder),
    group: parseNumber(item.group),
    position: parseNumber(item.position),
    bank: parseNumber(item.bank),
    name: normalizedOptionalString(item.game) ?? normalizedOptionalString(item.name) ?? slug ?? routeId,
    manufacturer: normalizedOptionalString(item.manufacturer),
    year: parseNumber(item.year),
    slug: slug || routeId,
    primaryImageUrl: normalizedOptionalString(item.primary_image_url),
    primaryImageLargeUrl: normalizedOptionalString(item.primary_image_large_url),
    playfieldImageUrl: normalizedOptionalString(item.playfield_image_url) ?? normalizedOptionalString(item.playfieldImageUrl),
    alternatePlayfieldImageUrl:
      normalizedOptionalString(item.alternate_playfield_image_url) ?? normalizedOptionalString(item.alternatePlayfieldImageUrl),
    playfieldLocalOriginal: normalizeLibraryCachePath(normalizedOptionalString(assets.playfield_local_practice)),
    playfieldLocal: normalizeLibraryPlayfieldLocalPath(normalizedOptionalString(assets.playfield_local_practice)),
    groupPlayfieldLocalOriginal: null,
    groupPlayfieldLocal: null,
    playfieldSourceLabel: normalizedOptionalString(item.playfield_source_label),
    gameinfoLocal: normalizedOptionalString(assets.gameinfo_local_practice),
    rulesheetLocal: normalizedOptionalString(assets.rulesheet_local_practice),
    rulesheetUrl: normalizedOptionalString(item.rulesheet_url),
    rulesheetLinks,
    videos: videos
      .map((entry) => {
        const video = entry as Record<string, unknown>;
        const url = normalizedOptionalString(video.url);
        if (!url) return null;
        return {
          kind: normalizedOptionalString(video.kind) ?? "",
          label: normalizedOptionalString(video.label) ?? "Video",
          url,
        };
      })
      .filter((entry): entry is Video => Boolean(entry)),
  };
}

function parseSources(values: unknown[]): LibrarySource[] {
  return values
    .map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const item = value as Record<string, unknown>;
      const id = canonicalLibrarySourceId(normalizedOptionalString(item.id) ?? normalizedOptionalString(item.library_id));
      if (!id) return null;
      return {
        id,
        name: normalizedOptionalString(item.name) ?? normalizedOptionalString(item.library_name) ?? id,
        type: normalizeSourceType(item.type ?? item.library_type),
      };
    })
    .filter((entry): entry is LibrarySource => Boolean(entry));
}

function inferSourcesFromGames(games: LibraryGame[]): LibrarySource[] {
  const byId = new Map<string, LibrarySource>();
  for (const game of games) {
    if (byId.has(game.sourceId)) continue;
    byId.set(game.sourceId, {
      id: game.sourceId,
      name: game.sourceName,
      type: game.sourceType,
    });
  }
  return byId.size ? [...byId.values()] : [{ id: "venue--the-avenue-cafe", name: "The Avenue Cafe", type: "venue" }];
}

function parseCatalogRoot(raw: unknown): CatalogRoot {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyCatalogRoot();
  const root = raw as Record<string, unknown>;
  const manufacturers = Array.isArray(root.manufacturers) ? root.manufacturers : [];
  const machines = Array.isArray(root.machines) ? root.machines : [];
  const rulesheetLinks = Array.isArray(root.rulesheet_links) ? root.rulesheet_links : [];
  const videoLinks = Array.isArray(root.video_links) ? root.video_links : [];
  return {
    manufacturers: manufacturers
      .map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
        const item = entry as Record<string, unknown>;
        const id = normalizedOptionalString(item.id);
        const name = normalizedOptionalString(item.name);
        if (!id || !name) return null;
        return {
          id,
          name,
          isModern: Boolean(item.is_modern),
          featuredRank: parseNumber(item.featured_rank),
          gameCount: parseNumber(item.game_count) ?? 0,
          sortBucket: parseNumber(item.sort_bucket) ?? 0,
        };
      })
      .filter((entry): entry is CatalogManufacturerRecord => Boolean(entry)),
    machines: machines
      .map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
        const item = entry as Record<string, unknown>;
        const primary = item.primary_image && typeof item.primary_image === "object" && !Array.isArray(item.primary_image)
          ? item.primary_image as Record<string, unknown>
          : {};
        const playfield = item.playfield_image && typeof item.playfield_image === "object" && !Array.isArray(item.playfield_image)
          ? item.playfield_image as Record<string, unknown>
          : {};
        const practiceIdentity = normalizedOptionalString(item.practice_identity);
        const name = normalizedOptionalString(item.name);
        if (!practiceIdentity || !name) return null;
        return {
          practiceIdentity,
          opdbMachineId: normalizedOptionalString(item.opdb_machine_id),
          opdbGroupId: normalizedOptionalString(item.opdb_group_id),
          slug: normalizedOptionalString(item.slug) ?? practiceIdentity,
          name,
          variant: normalizedOptionalString(item.variant),
          manufacturerId: normalizedOptionalString(item.manufacturer_id),
          manufacturerName: normalizedOptionalString(item.manufacturer_name),
          year: parseNumber(item.year),
          primaryImageMediumUrl: normalizedOptionalString(primary.medium_url),
          primaryImageLargeUrl: normalizedOptionalString(primary.large_url),
          playfieldImageMediumUrl: normalizedOptionalString(playfield.medium_url),
          playfieldImageLargeUrl: normalizedOptionalString(playfield.large_url),
        };
      })
      .filter((entry): entry is CatalogMachineRecord => Boolean(entry)),
    rulesheetLinks: rulesheetLinks
      .map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
        const item = entry as Record<string, unknown>;
        const practiceIdentity = normalizedOptionalString(item.practice_identity);
        if (!practiceIdentity) return null;
        return {
          practiceIdentity,
          provider: normalizedOptionalString(item.provider) ?? "",
          label: normalizedOptionalString(item.label) ?? "Rulesheet",
          url: normalizedOptionalString(item.url),
          localPath: normalizedOptionalString(item.local_path),
          priority: parseNumber(item.priority),
        };
      })
      .filter((entry): entry is CatalogRulesheetLinkRecord => Boolean(entry)),
    videoLinks: videoLinks
      .map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
        const item = entry as Record<string, unknown>;
        const practiceIdentity = normalizedOptionalString(item.practice_identity);
        if (!practiceIdentity) return null;
        return {
          practiceIdentity,
          provider: normalizedOptionalString(item.provider) ?? "",
          kind: normalizedOptionalString(item.kind),
          label: normalizedOptionalString(item.label) ?? "Video",
          url: normalizedOptionalString(item.url),
          priority: parseNumber(item.priority),
        };
      })
      .filter((entry): entry is CatalogVideoLinkRecord => Boolean(entry)),
  };
}

function compareMaybeNumber(a: number | null | undefined, b: number | null | undefined): number {
  const left = typeof a === "number" && Number.isFinite(a) ? a : Number.MAX_SAFE_INTEGER;
  const right = typeof b === "number" && Number.isFinite(b) ? b : Number.MAX_SAFE_INTEGER;
  return left - right;
}

function catalogMachineHasPrimaryImage(machine: CatalogMachineRecord): boolean {
  return Boolean(machine.primaryImageLargeUrl || machine.primaryImageMediumUrl);
}

function comparePreferredMachine(left: CatalogMachineRecord, right: CatalogMachineRecord): number {
  const leftHasPrimary = catalogMachineHasPrimaryImage(left);
  const rightHasPrimary = catalogMachineHasPrimaryImage(right);
  if (leftHasPrimary !== rightHasPrimary) return leftHasPrimary ? -1 : 1;

  const leftVariant = normalizedOptionalString(left.variant);
  const rightVariant = normalizedOptionalString(right.variant);
  if ((leftVariant === null) !== (rightVariant === null)) return leftVariant === null ? -1 : 1;

  if (left.year !== right.year) return compareMaybeNumber(left.year, right.year);

  const nameCompare = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  if (nameCompare) return nameCompare;

  return (left.opdbMachineId ?? left.practiceIdentity).localeCompare(right.opdbMachineId ?? right.practiceIdentity, undefined, { sensitivity: "base" });
}

function compareGroupDefaultMachine(left: CatalogMachineRecord, right: CatalogMachineRecord): number {
  const leftVariant = normalizedOptionalString(left.variant);
  const rightVariant = normalizedOptionalString(right.variant);
  if ((leftVariant === null) !== (rightVariant === null)) return leftVariant === null ? -1 : 1;
  if (left.year !== right.year) return compareMaybeNumber(left.year, right.year);
  const nameCompare = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  if (nameCompare) return nameCompare;
  return (left.opdbMachineId ?? left.practiceIdentity).localeCompare(right.opdbMachineId ?? right.practiceIdentity, undefined, { sensitivity: "base" });
}

function catalogVariantScore(machineVariant: string | null, requestedVariant: string | null): number {
  const normalizedMachineVariant = normalizedOptionalString(machineVariant)?.toLowerCase() ?? null;
  const normalizedRequested = normalizedOptionalString(requestedVariant)?.toLowerCase() ?? null;
  if (!normalizedRequested) return 0;
  if (normalizedMachineVariant === normalizedRequested) return 200;
  if (normalizedMachineVariant && normalizedMachineVariant.includes(normalizedRequested)) return 120;
  if (normalizedRequested.includes("premium") && normalizedMachineVariant === "le") return 80;
  if (normalizedRequested === "le" && normalizedMachineVariant?.includes("anniversary")) return 40;
  return 0;
}

function preferredMachineForVariant(
  candidates: CatalogMachineRecord[],
  requestedVariant: string | null,
): CatalogMachineRecord | null {
  if (!candidates.length) return null;
  const ranked = [...candidates].sort((left, right) => {
    const leftScore = catalogVariantScore(left.variant, requestedVariant);
    const rightScore = catalogVariantScore(right.variant, requestedVariant);
    if (leftScore !== rightScore) return rightScore - leftScore;
    return comparePreferredMachine(left, right);
  });
  const best = ranked[0] ?? null;
  if (!best) return null;
  if (requestedVariant && catalogVariantScore(best.variant, requestedVariant) <= 0) return null;
  return best;
}

function preferredMachineForLegacyGame(
  legacyGame: LibraryGame,
  machineByOpdbId: Map<string, CatalogMachineRecord>,
  machineByPracticeIdentity: Map<string, CatalogMachineRecord[]>,
  requestedVariant: string | null,
): CatalogMachineRecord | null {
  const groupKey = normalizedOptionalString(legacyGame.practiceIdentity ?? legacyGame.opdbGroupId);
  const groupCandidates = groupKey ? machineByPracticeIdentity.get(groupKey) ?? [] : [];
  const preferredGroupMachine = groupCandidates.length ? [...groupCandidates].sort(compareGroupDefaultMachine)[0] : null;
  const groupArtFallback = groupCandidates
    .filter(catalogMachineHasPrimaryImage)
    .sort(comparePreferredMachine)[0] ?? null;

  const requestedMachineId = normalizedOptionalString(legacyGame.opdbId);
  if (!requestedMachineId) {
    const variantMatch = preferredMachineForVariant(groupCandidates, requestedVariant);
    if (variantMatch && catalogMachineHasPrimaryImage(variantMatch)) return variantMatch;
    if (preferredGroupMachine && catalogMachineHasPrimaryImage(preferredGroupMachine)) return preferredGroupMachine;
    return groupArtFallback ?? preferredGroupMachine;
  }

  const exactMachine = machineByOpdbId.get(requestedMachineId) ?? null;
  if (!exactMachine) {
    const variantMatch = preferredMachineForVariant(groupCandidates, requestedVariant);
    if (variantMatch && catalogMachineHasPrimaryImage(variantMatch)) return variantMatch;
    if (preferredGroupMachine && catalogMachineHasPrimaryImage(preferredGroupMachine)) return preferredGroupMachine;
    return groupArtFallback ?? preferredGroupMachine;
  }

  const variantCandidates = machineByPracticeIdentity.get(exactMachine.practiceIdentity) ?? groupCandidates;
  const variantMatch = preferredMachineForVariant(variantCandidates, requestedVariant);
  if (variantMatch && catalogMachineHasPrimaryImage(variantMatch)) return variantMatch;
  if (catalogMachineHasPrimaryImage(exactMachine)) return exactMachine;
  if (preferredGroupMachine && catalogMachineHasPrimaryImage(preferredGroupMachine)) return preferredGroupMachine;
  return groupArtFallback ?? preferredGroupMachine ?? variantMatch ?? exactMachine;
}

function catalogRulesheetLabel(provider: string, fallback: string): string {
  switch (provider.toLowerCase()) {
    case "tf":
      return "Rulesheet (TF)";
    case "pp":
      return "Rulesheet (PP)";
    case "bob":
      return "Rulesheet (Bob)";
    case "papa":
      return "Rulesheet (PAPA)";
    case "opdb":
      return "Rulesheet (OPDB)";
    case "local":
      return "Rulesheet";
    default:
      return fallback;
  }
}

export function referenceLinkProvider(link: ReferenceLink | null | undefined): string | null {
  if (!link) return null;
  const explicit = normalizedOptionalString(link.provider)?.toLowerCase();
  if (explicit) return explicit;
  const label = link.label.toLowerCase();
  const url = normalizedOptionalString(link.url)?.toLowerCase() ?? "";
  if (label.includes("(tf)") || url.includes("tiltforums.com")) return "tf";
  if (label.includes("(pp)") || url.includes("pinballprimer.github.io") || url.includes("pinballprimer.com")) return "pp";
  if (label.includes("(papa)") || url.includes("pinball.org")) return "papa";
  if (label.includes("(bob)") || url.includes("silverballmania.com") || url.includes("flippers.be") || url.includes("bobs")) return "bob";
  if (label.includes("(local)") || label.includes("(source)")) return "local";
  return null;
}

function resolveRulesheetLinks(links: CatalogRulesheetLinkRecord[]): ResolvedRulesheetLinks {
  const sortedLinks = [...links].sort((left, right) => {
    const priorityCompare = compareMaybeNumber(left.priority, right.priority);
    if (priorityCompare) return priorityCompare;
    return left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
  });
  return {
    localPath: sortedLinks[0]?.localPath ?? null,
    links: sortedLinks.flatMap((link): ReferenceLink[] => (
      link.url
        ? [{
            label: catalogRulesheetLabel(link.provider, link.label),
            url: link.url,
            provider: link.provider,
            localPath: normalizeLibraryCachePath(link.localPath),
          }]
        : []
    )),
  };
}

function compareVideoLinks(left: CatalogVideoLinkRecord, right: CatalogVideoLinkRecord): number {
  const priorityCompare = compareMaybeNumber(left.priority, right.priority);
  if (priorityCompare) return priorityCompare;
  return left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
}

function resolveVideoLinks(videoLinks: CatalogVideoLinkRecord[]): Video[] {
  const groupedByProvider = new Map<string, CatalogVideoLinkRecord[]>();
  for (const link of videoLinks) {
    const key = link.provider.toLowerCase();
    groupedByProvider.set(key, [...(groupedByProvider.get(key) ?? []), link]);
  }
  const preferred =
    groupedByProvider.get("local")?.sort(compareVideoLinks) ??
    groupedByProvider.get("matchplay")?.sort(compareVideoLinks) ??
    [];
  return preferred
    .map((link) => {
      if (!link.url) return null;
      return {
        kind: link.kind ?? "",
        label: link.label,
        url: link.url,
      };
    })
    .filter((entry): entry is Video => Boolean(entry));
}

function buildLegacyCuratedOverrides(games: LibraryGame[]): Map<string, LegacyCuratedOverride> {
  const overrides = new Map<string, LegacyCuratedOverride>();
  for (const game of games) {
    const key = normalizedOptionalString(game.practiceIdentity ?? game.opdbGroupId);
    if (!key) continue;
    const current = overrides.get(key) ?? { practiceIdentity: key };
    current.nameOverride ??= normalizedOptionalString(game.name);
    current.variantOverride ??= normalizedOptionalString(game.variant);
    current.manufacturerOverride ??= normalizedOptionalString(game.manufacturer);
    current.yearOverride ??= game.year;
    current.playfieldLocalPath ??= normalizedOptionalString(game.playfieldLocalOriginal ?? game.playfieldLocal);
    current.playfieldSourceUrl ??= normalizedOptionalString(game.playfieldImageUrl);
    current.gameinfoLocalPath ??= normalizedOptionalString(game.gameinfoLocal);
    current.rulesheetLocalPath ??= normalizedOptionalString(game.rulesheetLocal);
    if (!current.rulesheetLinks?.length) {
      current.rulesheetLinks = game.rulesheetLinks.length
        ? game.rulesheetLinks
        : game.rulesheetUrl
          ? [{ label: "Rulesheet", url: game.rulesheetUrl, provider: null, localPath: null }]
          : [];
    }
    if (!current.videos?.length && game.videos.length) {
      current.videos = game.videos;
    }
    overrides.set(key, current);
  }
  return overrides;
}

function buildGroupPlayfieldOverrides(games: LibraryGame[]): Map<string, GroupPlayfieldOverride> {
  const overrides = new Map<string, GroupPlayfieldOverride>();
  for (const game of games) {
    const key = normalizedOptionalString(game.opdbGroupId ?? game.practiceIdentity);
    if (!key) continue;
    const playfieldLocalPath = normalizedOptionalString(game.playfieldLocalOriginal ?? game.playfieldLocal);
    if (!playfieldLocalPath) continue;
    const current = overrides.get(key) ?? { playfieldLocalPath: null };
    current.playfieldLocalPath ??= playfieldLocalPath;
    overrides.set(key, current);
  }
  return overrides;
}

function curatedOverrideForKeys(
  practiceIdentity: string | null | undefined,
  opdbGroupId: string | null | undefined,
  curatedOverrides: Map<string, LegacyCuratedOverride>,
): LegacyCuratedOverride | undefined {
  const candidateKeys = [
    normalizedOptionalString(practiceIdentity),
    normalizedOptionalString(opdbGroupId),
  ].filter((value): value is string => Boolean(value));

  for (const key of candidateKeys) {
    const override = curatedOverrides.get(key);
    if (override) return override;
  }

  return undefined;
}

function applyPublicPlayfieldOverrides(
  curatedOverrides: Map<string, LegacyCuratedOverride>,
  groupPlayfieldOverrides: Map<string, GroupPlayfieldOverride>,
  publicOverrides: PublicLibraryOverridesRoot,
) {
  for (const override of publicOverrides.playfieldOverrides) {
    const practiceCurrent = curatedOverrides.get(override.practiceIdentity) ?? { practiceIdentity: override.practiceIdentity };
    practiceCurrent.playfieldLocalPath = override.playfieldLocalPath;
    if (override.playfieldSourceUrl) {
      practiceCurrent.playfieldSourceUrl = override.playfieldSourceUrl;
    }
    curatedOverrides.set(override.practiceIdentity, practiceCurrent);

    const groupKey = normalizedOptionalString(override.opdbGroupId ?? override.practiceIdentity);
    if (groupKey) {
      curatedOverrides.set(groupKey, {
        ...practiceCurrent,
        practiceIdentity: groupKey,
      });
    }
    if (!groupKey) continue;
    const groupCurrent = groupPlayfieldOverrides.get(groupKey) ?? { playfieldLocalPath: null, playfieldSourceUrl: null };
    groupCurrent.playfieldLocalPath = override.playfieldLocalPath;
    if (override.playfieldSourceUrl) {
      groupCurrent.playfieldSourceUrl = override.playfieldSourceUrl;
    }
    groupPlayfieldOverrides.set(groupKey, groupCurrent);
  }
}

function resolveLegacyGame(
  legacyGame: LibraryGame,
  machineByPracticeIdentity: Map<string, CatalogMachineRecord[]>,
  machineByOpdbId: Map<string, CatalogMachineRecord>,
  manufacturerById: Map<string, CatalogManufacturerRecord>,
  curatedOverrides: Map<string, LegacyCuratedOverride>,
  groupPlayfieldOverrides: Map<string, GroupPlayfieldOverride>,
  rulesheetLinksByPracticeIdentity: Map<string, CatalogRulesheetLinkRecord[]>,
  videoLinksByPracticeIdentity: Map<string, CatalogVideoLinkRecord[]>,
): LibraryGame {
  const machine = preferredMachineForLegacyGame(
    legacyGame,
    machineByOpdbId,
    machineByPracticeIdentity,
    normalizedOptionalString(legacyGame.variant)?.toLowerCase() ?? null,
  );
  if (!machine) return legacyGame;

  const practiceIdentity = legacyGame.practiceIdentity ?? machine.practiceIdentity;
  const curatedOverride = curatedOverrideForKeys(
    practiceIdentity,
    normalizedOptionalString(legacyGame.opdbGroupId) ?? machine.opdbGroupId,
    curatedOverrides,
  );
  const manufacturerName =
    normalizedOptionalString(legacyGame.manufacturer) ??
    machine.manufacturerName ??
    (machine.manufacturerId ? manufacturerById.get(machine.manufacturerId)?.name ?? null : null);
  const hasCuratedRulesheet = Boolean(
    legacyGame.rulesheetLocal ||
    legacyGame.rulesheetLinks.length ||
    legacyGame.rulesheetUrl,
  );
  const hasCuratedVideos = legacyGame.videos.length > 0;
  const playfieldLocalPath =
    normalizedOptionalString(curatedOverride?.playfieldLocalPath) ??
    normalizedOptionalString(legacyGame.playfieldLocalOriginal ?? legacyGame.playfieldLocal);
  const curatedPlayfieldSourceUrl =
    normalizedOptionalString(curatedOverride?.playfieldSourceUrl) ??
    normalizedOptionalString(legacyGame.playfieldImageUrl);
  const opdbPlayfieldSourceUrl = normalizedOptionalString(machine.playfieldImageLargeUrl ?? machine.playfieldImageMediumUrl);
  const hasCuratedPlayfield = Boolean(playfieldLocalPath || curatedPlayfieldSourceUrl);
  const resolvedRulesheets = hasCuratedRulesheet
    ? {
        localPath: normalizedOptionalString(legacyGame.rulesheetLocal),
        links: legacyGame.rulesheetLinks.length
          ? legacyGame.rulesheetLinks
          : legacyGame.rulesheetUrl
            ? [{ label: "Rulesheet", url: legacyGame.rulesheetUrl, provider: null, localPath: null }]
            : [],
      }
    : resolveRulesheetLinks(rulesheetLinksByPracticeIdentity.get(practiceIdentity) ?? []);
  const resolvedVideos = hasCuratedVideos
    ? legacyGame.videos
    : resolveVideoLinks(videoLinksByPracticeIdentity.get(practiceIdentity) ?? []);
  const playfieldImageUrl = hasCuratedPlayfield
    ? curatedPlayfieldSourceUrl
    : opdbPlayfieldSourceUrl;
  const groupPlayfieldLocalPath = normalizedOptionalString(
    groupPlayfieldOverrides.get(normalizedOptionalString(legacyGame.opdbGroupId) ?? machine.opdbGroupId ?? practiceIdentity)?.playfieldLocalPath,
  );

  return {
    ...legacyGame,
    practiceIdentity,
    opdbId: normalizedOptionalString(legacyGame.opdbId) ?? machine.opdbMachineId,
    opdbGroupId: normalizedOptionalString(legacyGame.opdbGroupId) ?? machine.opdbGroupId,
    variant: normalizedOptionalString(legacyGame.variant ?? machine.variant),
    manufacturer: normalizedOptionalString(manufacturerName),
    year: legacyGame.year ?? machine.year,
    primaryImageUrl: normalizedOptionalString(machine.primaryImageMediumUrl),
    primaryImageLargeUrl: normalizedOptionalString(machine.primaryImageLargeUrl),
    playfieldImageUrl,
    alternatePlayfieldImageUrl: hasCuratedPlayfield ? opdbPlayfieldSourceUrl : null,
    playfieldLocalOriginal: normalizeLibraryCachePath(playfieldLocalPath),
    playfieldLocal: normalizeLibraryPlayfieldLocalPath(playfieldLocalPath),
    groupPlayfieldLocalOriginal: normalizeLibraryCachePath(groupPlayfieldLocalPath),
    groupPlayfieldLocal: normalizeLibraryPlayfieldLocalPath(groupPlayfieldLocalPath),
    playfieldSourceLabel: hasCuratedPlayfield ? null : opdbPlayfieldSourceUrl ? "Playfield (OPDB)" : null,
    rulesheetLocal: resolvedRulesheets.localPath,
    rulesheetUrl: resolvedRulesheets.links[0]?.url ?? null,
    rulesheetLinks: resolvedRulesheets.links,
    videos: resolvedVideos,
  };
}

function preferredMachineForSourceLookup(
  requestedMachineId: string,
  machineByOpdbId: Map<string, CatalogMachineRecord>,
  machineByPracticeIdentity: Map<string, CatalogMachineRecord[]>,
): CatalogMachineRecord | null {
  const normalizedMachineId = normalizedOptionalString(requestedMachineId);
  const preferredGroupMachine = normalizedMachineId
    ? [...(machineByPracticeIdentity.get(normalizedMachineId) ?? [])].sort(comparePreferredMachine)[0] ?? null
    : null;
  const exactMachine = normalizedMachineId ? machineByOpdbId.get(normalizedMachineId) ?? null : null;
  if (!exactMachine) return preferredGroupMachine;
  if (catalogMachineHasPrimaryImage(exactMachine)) return exactMachine;
  const exactGroupMachine = [...(machineByPracticeIdentity.get(exactMachine.practiceIdentity) ?? [])].sort(comparePreferredMachine)[0] ?? null;
  return exactGroupMachine ?? preferredGroupMachine ?? exactMachine;
}

function resolveImportedGame(
  machine: CatalogMachineRecord,
  source: ImportedSourceRecord,
  manufacturerById: Map<string, CatalogManufacturerRecord>,
  curatedOverrides: Map<string, LegacyCuratedOverride>,
  groupPlayfieldOverrides: Map<string, GroupPlayfieldOverride>,
  rulesheetLinks: CatalogRulesheetLinkRecord[],
  videoLinks: CatalogVideoLinkRecord[],
): LibraryGame {
  const curatedOverride = curatedOverrideForKeys(machine.practiceIdentity, machine.opdbGroupId, curatedOverrides);
  const manufacturerName =
    curatedOverride?.manufacturerOverride ??
    machine.manufacturerName ??
    (machine.manufacturerId ? manufacturerById.get(machine.manufacturerId)?.name ?? null : null);
  const resolvedRulesheets = !curatedOverride?.rulesheetLocalPath && !(curatedOverride?.rulesheetLinks?.length)
    ? resolveRulesheetLinks(rulesheetLinks)
    : {
        localPath: normalizedOptionalString(curatedOverride?.rulesheetLocalPath),
        links: curatedOverride?.rulesheetLinks ?? [],
      };
  const resolvedVideos = curatedOverride?.videos?.length
    ? curatedOverride.videos
    : resolveVideoLinks(videoLinks);
  const playfieldLocalPath = normalizedOptionalString(curatedOverride?.playfieldLocalPath);
  const groupPlayfieldLocalPath = normalizedOptionalString(
    groupPlayfieldOverrides.get(machine.opdbGroupId ?? machine.practiceIdentity)?.playfieldLocalPath,
  );
  const curatedPlayfieldSourceUrl = normalizedOptionalString(curatedOverride?.playfieldSourceUrl);
  const opdbPlayfieldSourceUrl = normalizedOptionalString(machine.playfieldImageLargeUrl ?? machine.playfieldImageMediumUrl);
  const hasCuratedPlayfield = Boolean(playfieldLocalPath || curatedPlayfieldSourceUrl);
  const playfieldSourceUrl = hasCuratedPlayfield ? curatedPlayfieldSourceUrl : opdbPlayfieldSourceUrl;
  const slug = normalizedOptionalString(machine.slug) ?? machine.practiceIdentity;
  const routeId = `${source.id}::${slug}`;
  return {
    routeId,
    libraryEntryId: `${source.id}:${machine.practiceIdentity}`,
    practiceIdentity: machine.practiceIdentity,
    opdbId: machine.opdbMachineId,
    opdbGroupId: machine.opdbGroupId,
    variant: source.type === "manufacturer"
      ? null
      : normalizedOptionalString(curatedOverride?.variantOverride ?? machine.variant),
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    area: null,
    areaOrder: null,
    group: null,
    position: null,
    bank: null,
    name: normalizedOptionalString(curatedOverride?.nameOverride) ?? machine.name,
    manufacturer: normalizedOptionalString(manufacturerName),
    year: curatedOverride?.yearOverride ?? machine.year,
    slug,
    primaryImageUrl: normalizedOptionalString(machine.primaryImageMediumUrl),
    primaryImageLargeUrl: normalizedOptionalString(machine.primaryImageLargeUrl),
    playfieldImageUrl: playfieldSourceUrl,
    alternatePlayfieldImageUrl: hasCuratedPlayfield ? opdbPlayfieldSourceUrl : null,
    playfieldLocalOriginal: normalizeLibraryCachePath(playfieldLocalPath),
    playfieldLocal: normalizeLibraryPlayfieldLocalPath(playfieldLocalPath),
    groupPlayfieldLocalOriginal: normalizeLibraryCachePath(groupPlayfieldLocalPath),
    groupPlayfieldLocal: normalizeLibraryPlayfieldLocalPath(groupPlayfieldLocalPath),
    playfieldSourceLabel:
      !hasCuratedPlayfield && (machine.playfieldImageLargeUrl || machine.playfieldImageMediumUrl)
        ? "Playfield (OPDB)"
        : null,
    gameinfoLocal: normalizedOptionalString(curatedOverride?.gameinfoLocalPath),
    rulesheetLocal: resolvedRulesheets.localPath,
    rulesheetUrl: resolvedRulesheets.links[0]?.url ?? null,
    rulesheetLinks: resolvedRulesheets.links,
    videos: resolvedVideos,
  };
}

function dedupeSources(sources: LibrarySource[]): LibrarySource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.id)) return false;
    seen.add(source.id);
    return true;
  });
}

function mergeCatalogs(
  basePayload: ParsedLibraryData,
  catalogRoot: CatalogRoot,
  publicOverrides: PublicLibraryOverridesRoot,
  importedSources: ImportedSourceRecord[],
): ParsedLibraryData {
  if (!catalogRoot.machines.length) {
    return {
      games: basePayload.games,
      sources: dedupeSources([
        ...basePayload.sources,
        ...importedSources.map((source) => ({ id: source.id, name: source.name, type: source.type })),
      ]),
    };
  }

  const machineByPracticeIdentity = new Map<string, CatalogMachineRecord[]>();
  const machineByOpdbId = new Map<string, CatalogMachineRecord>();
  for (const machine of catalogRoot.machines) {
    machineByPracticeIdentity.set(machine.practiceIdentity, [...(machineByPracticeIdentity.get(machine.practiceIdentity) ?? []), machine]);
    if (machine.opdbMachineId) {
      machineByOpdbId.set(machine.opdbMachineId, machine);
    }
  }
  const manufacturerById = new Map(catalogRoot.manufacturers.map((manufacturer) => [manufacturer.id, manufacturer] as const));
  const curatedOverrides = buildLegacyCuratedOverrides(basePayload.games);
  const groupPlayfieldOverrides = buildGroupPlayfieldOverrides(basePayload.games);
  applyPublicPlayfieldOverrides(curatedOverrides, groupPlayfieldOverrides, publicOverrides);
  const rulesheetLinksByPracticeIdentity = new Map<string, CatalogRulesheetLinkRecord[]>();
  const videoLinksByPracticeIdentity = new Map<string, CatalogVideoLinkRecord[]>();
  for (const link of catalogRoot.rulesheetLinks) {
    rulesheetLinksByPracticeIdentity.set(link.practiceIdentity, [...(rulesheetLinksByPracticeIdentity.get(link.practiceIdentity) ?? []), link]);
  }
  for (const link of catalogRoot.videoLinks) {
    videoLinksByPracticeIdentity.set(link.practiceIdentity, [...(videoLinksByPracticeIdentity.get(link.practiceIdentity) ?? []), link]);
  }

  const mergedBaseGames = basePayload.games.map((game) =>
    resolveLegacyGame(
      game,
      machineByPracticeIdentity,
      machineByOpdbId,
      manufacturerById,
      curatedOverrides,
      groupPlayfieldOverrides,
      rulesheetLinksByPracticeIdentity,
      videoLinksByPracticeIdentity,
    ),
  );

  const importedGames: LibraryGame[] = [];
  for (const source of importedSources) {
    if (source.type === "manufacturer") {
      const grouped = new Map<string, CatalogMachineRecord[]>();
      for (const machine of catalogRoot.machines) {
        if (machine.manufacturerId !== source.providerSourceId) continue;
        const key = machine.opdbGroupId ?? machine.practiceIdentity;
        grouped.set(key, [...(grouped.get(key) ?? []), machine]);
      }
      const preferredMachines = [...grouped.values()]
        .map((machines) => [...machines].sort(comparePreferredMachine)[0] ?? null)
        .filter((machine): machine is CatalogMachineRecord => Boolean(machine));
      for (const machine of preferredMachines) {
        importedGames.push(
          resolveImportedGame(
            machine,
            source,
            manufacturerById,
            curatedOverrides,
            groupPlayfieldOverrides,
            rulesheetLinksByPracticeIdentity.get(machine.practiceIdentity) ?? [],
            videoLinksByPracticeIdentity.get(machine.practiceIdentity) ?? [],
          ),
        );
      }
      continue;
    }

    if (source.type === "venue" || source.type === "tournament") {
      for (const machineId of source.machineIds) {
        const machine = preferredMachineForSourceLookup(machineId, machineByOpdbId, machineByPracticeIdentity);
        if (!machine) continue;
        importedGames.push(
          resolveImportedGame(
            machine,
            source,
            manufacturerById,
            curatedOverrides,
            groupPlayfieldOverrides,
            rulesheetLinksByPracticeIdentity.get(machine.practiceIdentity) ?? [],
            videoLinksByPracticeIdentity.get(machine.practiceIdentity) ?? [],
          ),
        );
      }
    }
  }

  return {
    games: [...mergedBaseGames, ...importedGames],
    sources: dedupeSources([
      ...basePayload.sources,
      ...importedSources.map((source) => ({ id: source.id, name: source.name, type: source.type })),
    ]),
  };
}

function filterPayloadByState(payload: ParsedLibraryData, state: LibrarySourceState): ParsedLibraryData {
  const enabled = new Set(state.enabledSourceIds);
  const filteredSources = payload.sources.filter((source) => enabled.has(source.id));
  if (!filteredSources.length) return payload;
  const sourceIds = new Set(filteredSources.map((source) => source.id));
  return {
    games: payload.games.filter((game) => sourceIds.has(game.sourceId)),
    sources: filteredSources,
  };
}

function resolveVisibleSources(sources: LibrarySource[], state: LibrarySourceState, selectedSourceId: string | null): LibrarySource[] {
  const enabled = state.enabledSourceIds
    .map((id) => sources.find((source) => source.id === id) ?? null)
    .filter((source): source is LibrarySource => Boolean(source));
  const visible = [...enabled];
  const selected = selectedSourceId ? sources.find((source) => source.id === selectedSourceId) ?? null : null;
  if (selected && !visible.some((source) => source.id === selected.id)) {
    visible.push(selected);
  }
  return visible.length ? visible : sources;
}

export async function loadResolvedLibraryData(): Promise<ResolvedLibraryData> {
  const [{ payload, catalogRoot, publicOverrides }, importedSourcesRaw] = await Promise.all([loadBaseCatalog(), Promise.resolve(loadImportedSources())]);
  const importedSources = await repairImportedSources(importedSourcesRaw);
  const mergedPayload = mergeCatalogs(payload, catalogRoot, publicOverrides, importedSources);
  const sourceGameCounts = mergedPayload.games.reduce<Record<string, number>>((counts, game) => {
    const sourceId = game.sourceId;
    const existing = counts[sourceId];
    if (typeof existing === "number") {
      return counts;
    }
    counts[sourceId] = 0;
    return counts;
  }, {});
  const groupKeysBySource = new Map<string, Set<string>>();
  for (const game of mergedPayload.games) {
    const sourceId = game.sourceId;
    const groupKeys = groupKeysBySource.get(sourceId) ?? new Set<string>();
    groupKeys.add(gameGroupKey(game));
    groupKeysBySource.set(sourceId, groupKeys);
  }
  for (const [sourceId, groupKeys] of groupKeysBySource) {
    sourceGameCounts[sourceId] = groupKeys.size;
  }
  const synchronizedState = synchronizeLibrarySourceState(loadLibrarySourceState(), mergedPayload.sources);
  const filteredPayload = filterPayloadByState(mergedPayload, synchronizedState);
  const manufacturerGameCounts = catalogRoot.machines.reduce<Map<string, Set<string>>>((counts, machine) => {
    const manufacturerId = normalizedOptionalString(machine.manufacturerId);
    const groupKey = machineGroupKey(machine);
    if (!manufacturerId || !groupKey) return counts;
    const groupKeys = counts.get(manufacturerId) ?? new Set<string>();
    groupKeys.add(groupKey);
    counts.set(manufacturerId, groupKeys);
    return counts;
  }, new Map<string, Set<string>>());
  return {
    games: filteredPayload.games,
    sources: filteredPayload.sources,
    visibleSources: resolveVisibleSources(filteredPayload.sources, synchronizedState, synchronizedState.selectedSourceId),
    sourceState: synchronizedState,
    importedSources,
    manufacturerOptions: catalogRoot.manufacturers.map((manufacturer) => ({
      id: manufacturer.id,
      name: manufacturer.name,
      gameCount: manufacturerGameCounts.get(manufacturer.id)?.size ?? manufacturer.gameCount,
      isModern: manufacturer.isModern,
      featuredRank: manufacturer.featuredRank,
      sortBucket: manufacturer.sortBucket,
    })).sort((left, right) => {
      if (left.sortBucket !== right.sortBucket) return left.sortBucket - right.sortBucket;
      if ((left.featuredRank ?? Number.MAX_SAFE_INTEGER) !== (right.featuredRank ?? Number.MAX_SAFE_INTEGER)) {
        return (left.featuredRank ?? Number.MAX_SAFE_INTEGER) - (right.featuredRank ?? Number.MAX_SAFE_INTEGER);
      }
      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    }),
    sourceGameCounts,
  };
}

export function preferredLibrarySourceId(
  sources: LibrarySource[],
  state: LibrarySourceState,
  requestedId?: string | null,
): string | null {
  const candidates = [
    canonicalLibrarySourceId(requestedId),
    canonicalLibrarySourceId(state.selectedSourceId),
    ...DEFAULT_AVENUE_SOURCE_IDS,
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (sources.some((source) => source.id === candidate)) return candidate;
  }
  return sources[0]?.id ?? null;
}

export function availableSortModesForSource(source: LibrarySource | null, games: LibraryGame[]): SortMode[] {
  if (!source) return ["area", "alphabetical"];
  if (source.type === "category" || source.type === "manufacturer" || source.type === "tournament") {
    return ["year", "alphabetical"];
  }
  const modes: SortMode[] = ["area"];
  if (games.some((game) => (game.bank ?? 0) > 0)) modes.push("bank");
  modes.push("alphabetical", "year");
  return modes;
}

export function preferredDefaultSortMode(source: LibrarySource, games: LibraryGame[]): SortMode {
  if (source.type === "manufacturer") return "year";
  if (source.type === "category" || source.type === "tournament") return "alphabetical";
  const hasArea = games.some((game) => {
    const area = normalizedOptionalString(game.area);
    return Boolean(area);
  });
  return hasArea ? "area" : "alphabetical";
}

export function preferredDefaultYearDescending(source: LibrarySource, games: LibraryGame[]): boolean {
  return source.type === "manufacturer" && preferredDefaultSortMode(source, games) === "year";
}

export function sortLibraryGames(games: LibraryGame[], sortMode: SortMode, yearDescending = false): LibraryGame[] {
  const sorted = [...games];
  if (sortMode === "area") {
    return sorted.sort((left, right) =>
      compareMaybeNumber(left.areaOrder, right.areaOrder) ||
      compareMaybeNumber(left.group, right.group) ||
      compareMaybeNumber(left.position, right.position) ||
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
    );
  }
  if (sortMode === "bank") {
    return sorted.sort((left, right) =>
      compareMaybeNumber(left.bank, right.bank) ||
      compareMaybeNumber(left.group, right.group) ||
      compareMaybeNumber(left.position, right.position) ||
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
    );
  }
  if (sortMode === "year") {
    return sorted.sort((left, right) => {
      if (yearDescending) {
        return compareMaybeNumber(right.year, left.year) ||
          left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
      }
      return compareMaybeNumber(left.year, right.year) ||
        left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });
  }
  return sorted.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) ||
    compareMaybeNumber(left.group, right.group) ||
    compareMaybeNumber(left.position, right.position),
  );
}

export function manufacturerYearText(game: LibraryGame): string {
  return game.year ? `${game.manufacturer ?? "—"} • ${game.year}` : (game.manufacturer ?? "—");
}

export function locationText(game: LibraryGame): string | null {
  if (typeof game.group !== "number" || typeof game.position !== "number") return null;
  const normalizedArea = normalizedOptionalString(game.area);
  return normalizedArea ? `📍 ${normalizedArea}:${game.group}:${game.position}` : `📍 ${game.group}:${game.position}`;
}

export function locationBankText(game: LibraryGame): string {
  const parts: string[] = [];
  const location = locationText(game);
  if (location) parts.push(location);
  if (typeof game.bank === "number" && game.bank > 0) parts.push(`Bank ${game.bank}`);
  return parts.join(" • ");
}

export function findLibraryGame(games: LibraryGame[], slug: string | undefined): LibraryGame | null {
  if (!slug) return null;
  return games.find((game) =>
    game.routeId === slug ||
    game.slug === slug ||
    game.opdbId === slug ||
    game.practiceIdentity === slug,
  ) ?? null;
}

function derivePlayfieldVariant(local: string, width: 700 | 1400): string | null {
  const trimmed = local.trim();
  if (!trimmed.startsWith("/pinball/images/playfields/")) return null;
  const match = trimmed.match(/^(.*?)(?:_(700|1400))?\.(webp|png|jpe?g)$/i);
  if (!match) return null;
  return `${match[1]}_${width}.webp`;
}

function explicitPlayfieldCandidates(game: LibraryGame): string[] {
  const localOriginal = normalizedOptionalString(game.playfieldLocalOriginal ?? game.playfieldLocal);
  const local700 = localOriginal ? derivePlayfieldVariant(localOriginal, 700) : null;
  const local1400 = localOriginal ? derivePlayfieldVariant(localOriginal, 1400) : null;
  const groupLocalOriginal = normalizedOptionalString(game.groupPlayfieldLocalOriginal ?? game.groupPlayfieldLocal);
  const groupLocal700 = groupLocalOriginal ? derivePlayfieldVariant(groupLocalOriginal, 700) : null;
  const groupLocal1400 = groupLocalOriginal ? derivePlayfieldVariant(groupLocalOriginal, 1400) : null;
  return dedupeResolvedUrls([
    resolveLibraryUrl(game.playfieldLocalOriginal),
    resolveLibraryUrl(local1400),
    resolveLibraryUrl(game.playfieldLocal),
    resolveLibraryUrl(local700),
    resolveLibraryUrl(game.groupPlayfieldLocalOriginal),
    resolveLibraryUrl(groupLocal1400),
    resolveLibraryUrl(game.groupPlayfieldLocal),
    resolveLibraryUrl(groupLocal700),
    resolveLibraryUrl(game.playfieldImageUrl),
  ]);
}

function playfieldSourceLabelForGame(game: LibraryGame): string {
  if (game.playfieldSourceLabel) {
    return game.playfieldSourceLabel === "Playfield (OPDB)" ? "OPDB" : "Local";
  }
  if (game.playfieldLocalOriginal || game.playfieldLocal || game.groupPlayfieldLocalOriginal || game.groupPlayfieldLocal) {
    return "Local";
  }
  const playfieldUrl = resolveLibraryUrl(game.playfieldImageUrl);
  if (!playfieldUrl) return "View";
  try {
    const parsed = new URL(playfieldUrl, "https://pillyliu.com");
    if (parsed.host.toLowerCase() === "pillyliu.com" && parsed.pathname.startsWith("/pinball/images/playfields/")) {
      return "Local";
    }
    if (parsed.host.toLowerCase().includes("opdb.org")) {
      return "OPDB";
    }
  } catch {
    // Fall through to remote.
  }
  return "Remote";
}

export function cardArtworkCandidates(game: LibraryGame): string[] {
  return dedupeResolvedUrls([
    resolveLibraryUrl(game.primaryImageLargeUrl),
    resolveLibraryUrl(game.primaryImageUrl),
  ]);
}

export function detailArtworkCandidates(game: LibraryGame): string[] {
  return dedupeResolvedUrls([
    resolveLibraryUrl(game.primaryImageLargeUrl),
    resolveLibraryUrl(game.primaryImageUrl),
  ]);
}

export function gamePlayfieldCandidates(game: LibraryGame): string[] {
  return [
    ...explicitPlayfieldCandidates(game),
    FALLBACK_PLAYFIELD_700,
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
}

export function directPlayfieldUrl(game: LibraryGame): string | null {
  const preferredCandidates = explicitPlayfieldCandidates(game);
  return preferredCandidates.find((candidate) =>
    candidate !== FALLBACK_PLAYFIELD_700 && candidate !== FALLBACK_PLAYFIELD_1400,
  ) ?? null;
}

export function resolvedPlayfieldOptions(
  game: LibraryGame,
  liveStatus: LivePlayfieldStatus | null,
): PlayfieldOption[] {
  const explicitCandidates = explicitPlayfieldCandidates(game);
  if (liveStatus?.effectiveKind === "missing" && explicitCandidates.length === 0) {
    return [];
  }

  const options: PlayfieldOption[] = [];
  const usedCandidates = new Set<string>();
  const liveKind = liveStatus?.effectiveKind ?? null;

  if (explicitCandidates.length) {
    options.push({ title: playfieldSourceLabelForGame(game), candidates: explicitCandidates });
    explicitCandidates.forEach((candidate) => usedCandidates.add(candidate));
  } else {
    const primaryCandidates = dedupeResolvedUrls([
      resolveLibraryUrl(liveStatus?.effectiveUrl),
    ]);
    if (primaryCandidates.length) {
      let title = playfieldSourceLabelForGame(game);
      if (liveKind === "pillyliu") title = "Local";
      if (liveKind === "opdb") title = "OPDB";
      if (liveKind === "external") title = "Remote";
      if (liveKind === "missing" && explicitCandidates.length === 0) {
        title = "Unavailable";
      }
      options.push({ title, candidates: primaryCandidates });
      primaryCandidates.forEach((candidate) => usedCandidates.add(candidate));
    }
  }

  const liveUrl = resolveLibraryUrl(liveStatus?.effectiveUrl);
  if (liveUrl && liveKind !== "missing" && !usedCandidates.has(liveUrl)) {
    let title = playfieldSourceLabelForGame(game);
    if (liveKind === "pillyliu") title = "Local";
    if (liveKind === "opdb") title = "OPDB";
    if (liveKind === "external") title = "Remote";
    options.push({ title, candidates: [liveUrl] });
    usedCandidates.add(liveUrl);
  }

  const alternateUrl = resolveLibraryUrl(game.alternatePlayfieldImageUrl);
  if (alternateUrl && !usedCandidates.has(alternateUrl)) {
    options.push({ title: "OPDB", candidates: [alternateUrl] });
    usedCandidates.add(alternateUrl);
  }

  return options;
}

export function rulesheetMarkdownCandidates(game: LibraryGame): string[] {
  return rulesheetMarkdownCandidatesForLink(game, preferredRulesheetLink(game));
}

export function rulesheetMarkdownCandidatesForLink(game: LibraryGame, link: ReferenceLink | null): string[] {
  const provider = referenceLinkProvider(link);
  const localFallback = !link || provider === "local" ? resolveLibraryUrl(game.rulesheetLocal) : null;
  const explicitLocalPath = provider === "local" ? resolveLibraryUrl(link?.localPath ?? null) : null;
  return [
    explicitLocalPath,
    localFallback,
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
}

export function gameInfoMarkdownCandidates(game: LibraryGame): string[] {
  return [
    resolveLibraryUrl(game.gameinfoLocal),
    game.practiceIdentity ? `/pinball/gameinfo/${game.practiceIdentity}-gameinfo.md` : null,
    game.opdbGroupId ? `/pinball/gameinfo/${game.opdbGroupId}-gameinfo.md` : null,
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
}

export function preferredRulesheetLink(game: LibraryGame): ReferenceLink | null {
  return game.rulesheetLinks[0] ?? (game.rulesheetUrl
    ? { label: "Rulesheet", url: game.rulesheetUrl, provider: null, localPath: null }
    : null);
}

export async function searchPinballMapVenues(query: string, radiusMiles: number): Promise<LibraryVenueSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const encoded = encodeURIComponent(trimmed);
  const response = await fetch(
    `https://pinballmap.com/api/v1/locations/closest_by_address.json?address=${encoded}&max_distance=${radiusMiles}&send_all_within_distance=true`,
  );
  if (!response.ok) {
    throw new Error(`Pinball Map request failed (${response.status})`);
  }
  const root = await response.json() as { locations?: Array<Record<string, unknown>> };
  return (Array.isArray(root.locations) ? root.locations : []).map((location) => ({
    id: `venue--pm-${parseNumber(location.id) ?? String(location.id ?? "").trim()}`,
    name: normalizedOptionalString(location.name) ?? "Imported Venue",
    city: normalizedOptionalString(location.city),
    state: normalizedOptionalString(location.state),
    zip: normalizedOptionalString(location.zip),
    distanceMiles: typeof location.distance === "number" ? location.distance : null,
    machineCount: parseNumber(location.machine_count) ?? parseNumber(location.num_machines) ?? 0,
  }));
}

export async function fetchVenueMachineIds(locationId: string): Promise<string[]> {
  const trimmed = locationId.trim();
  if (!trimmed) return [];
  const response = await fetch(`https://pinballmap.com/api/v1/locations/${trimmed}/machine_details.json`);
  if (!response.ok) {
    throw new Error(`Pinball Map request failed (${response.status})`);
  }
  const root = await response.json() as { machines?: Array<Record<string, unknown>> };
  return (Array.isArray(root.machines) ? root.machines : [])
    .map((machine) => normalizedOptionalString(machine.opdb_id))
    .filter((id): id is string => Boolean(id));
}
