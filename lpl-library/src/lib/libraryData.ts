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
  city?: string | null;
  state?: string | null;
  updatedAt?: string | null;
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

type RawOpdbRow = {
  opdb_id?: unknown;
  is_machine?: unknown;
  name?: unknown;
  common_name?: unknown;
  shortname?: unknown;
  manufacture_date?: unknown;
  manufacturer?: unknown;
  type?: unknown;
  display?: unknown;
  images?: unknown;
};

type DefaultImportedSourcesRoot = {
  records?: ImportedSourceRecord[];
};

type RulesheetAssetRecord = {
  rulesheetAssetId: number;
  opdbId: string;
  provider: string;
  label: string;
  url: string | null;
  localPath: string | null;
  sourceUrl: string | null;
  note: string | null;
  priority: number;
  isHidden: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type VideoAssetRecord = {
  videoAssetId: number;
  opdbId: string;
  provider: string;
  kind: string;
  label: string;
  url: string;
  priority: number;
  isHidden: boolean;
  isActive: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type PlayfieldAssetRecord = {
  playfieldAssetId: number;
  practiceIdentity: string;
  sourceOpdbMachineId: string;
  coveredAliasIds: string[];
  playfieldLocalPath: string | null;
  playfieldOriginalLocalPath: string | null;
  playfieldReferenceLocalPath: string | null;
  playfieldWebLocalPath700: string | null;
  playfieldWebLocalPath1400: string | null;
  playfieldSourceUrl: string | null;
  playfieldSourceNote: string | null;
  playfieldSourcePageUrl: string | null;
  playfieldSourcePageSnapshotPath: string | null;
  playfieldMaskPolygonJson: string | null;
  createdAt: string;
  updatedAt: string;
};

type GameinfoAssetRecord = {
  gameinfoAssetId: number;
  opdbId: string;
  provider: string;
  label: string;
  localPath: string | null;
  priority: number;
  isHidden: boolean;
  isActive: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type VenueLayoutAssetRecord = {
  libraryEntryId: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  practiceIdentity: string | null;
  opdbId: string | null;
  area: string | null;
  areaOrder: number | null;
  groupNumber: number | null;
  position: number | null;
  bank: number | null;
  createdAt: string;
  updatedAt: string;
};

type AssetLayerPayload<T> = {
  generatedAt?: string;
  records?: T[];
};

type RawManufacturerSummary = {
  id: string;
  name: string;
  gameCount: number;
  isModern: boolean;
  featuredRank: number | null;
  sortBucket: number;
};

type MachineRecord = {
  opdbId: string;
  practiceIdentity: string;
  opdbGroupId: string;
  opdbMachineId: string;
  slug: string;
  name: string;
  displayTitle: string;
  variant: string | null;
  manufacturerId: string | null;
  manufacturerName: string | null;
  year: number | null;
  primaryImageUrl: string | null;
  primaryImageLargeUrl: string | null;
  playfieldImageUrl: string | null;
  playfieldImageLargeUrl: string | null;
  opdbType: string | null;
  opdbDisplay: string | null;
  opdbShortname: string | null;
  opdbCommonName: string | null;
  opdbManufactureDate: string | null;
};

type CanonicalLayers = {
  machines: MachineRecord[];
  machineByOpdbId: Map<string, MachineRecord>;
  machinesByPracticeIdentity: Map<string, MachineRecord[]>;
  manufacturerOptions: CatalogManufacturerOption[];
  rulesheetAssetsByOpdbId: Map<string, RulesheetAssetRecord[]>;
  videoAssetsByOpdbId: Map<string, VideoAssetRecord[]>;
  playfieldAssetsByPracticeIdentity: Map<string, PlayfieldAssetRecord[]>;
  gameinfoAssetsByOpdbId: Map<string, GameinfoAssetRecord[]>;
  venueLayoutBySourceAndOpdbId: Map<string, VenueLayoutAssetRecord>;
};

const RAW_OPDB_EXPORT_PATH = "/pinball/data/opdb_export.json";
const RULESHEET_ASSETS_PATH = "/pinball/data/rulesheet_assets.json";
const VIDEO_ASSETS_PATH = "/pinball/data/video_assets.json";
const PLAYFIELD_ASSETS_PATH = "/pinball/data/playfield_assets.json";
const GAMEINFO_ASSETS_PATH = "/pinball/data/gameinfo_assets.json";
const VENUE_LAYOUT_ASSETS_PATH = "/pinball/data/venue_layout_assets.json";
const DEFAULT_IMPORTED_SOURCES_PATH = "/pinball/data/default_pm_venue_sources_v1.json";
const MISSING_ARTWORK_PATH = "/pinball/images/playfields/fallback-image-not-available_2048.webp";
const FALLBACK_PLAYFIELD_700 = MISSING_ARTWORK_PATH;
const FALLBACK_PLAYFIELD_1400 = MISSING_ARTWORK_PATH;
const PM_AVENUE_SOURCE_ID = "venue--pm-8760";
const PM_RLM_SOURCE_ID = "venue--pm-16470";
const DEFAULT_AVENUE_SOURCE_IDS = [PM_AVENUE_SOURCE_ID] as const;
const BUILTIN_SOURCE_IDS = [PM_RLM_SOURCE_ID, PM_AVENUE_SOURCE_ID] as const;
const LEGACY_SOURCE_ID_ALIASES: Record<string, string> = {
  "the-avenue": PM_AVENUE_SOURCE_ID,
  "the-avenue-cafe": PM_AVENUE_SOURCE_ID,
  "venue--the-avenue-cafe": PM_AVENUE_SOURCE_ID,
  "rlm-amusements": PM_RLM_SOURCE_ID,
  "venue--rlm-amusements": PM_RLM_SOURCE_ID,
};
const LIBRARY_SOURCE_STATE_COOKIE = "lpl_library_source_state_v1";
const IMPORTED_SOURCES_STORAGE_KEY = "lpl-library:imported-sources:v1";
export const MAX_PINNED_SOURCES = 10;

const MODERN_MANUFACTURERS = [
  "stern",
  "stern pinball",
  "jersey jack pinball",
  "chicago gaming",
  "american pinball",
  "spooky pinball",
  "multimorphic",
  "barrels of fun",
  "dutch pinball",
  "pinball brothers",
  "turner pinball",
];

const FEATURED_HISTORICAL = [
  "gottlieb",
  "williams",
  "bally",
  "stern electronics",
  "chicago coin",
  "playmatic",
  "zaccaria",
  "sega",
  "recel",
  "inder",
];

let canonicalLayersPromise: Promise<CanonicalLayers> | null = null;

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function normalizedOptionalString(value: unknown): string | null {
  const normalized = String(value ?? "")
    .trim()
    .replace(/^null$/i, "")
    .trim();
  return normalized || null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function compareMaybeNumber(a: number | null | undefined, b: number | null | undefined): number {
  const left = typeof a === "number" && Number.isFinite(a) ? a : Number.MAX_SAFE_INTEGER;
  const right = typeof b === "number" && Number.isFinite(b) ? b : Number.MAX_SAFE_INTEGER;
  return left - right;
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

function parseOpdbIdParts(opdbIdRaw: string | null | undefined) {
  const fullId = normalizedOptionalString(opdbIdRaw);
  const parts = fullId ? fullId.split("-").filter(Boolean) : [];
  const groupId = parts[0] ?? null;
  const machineToken = parts.find((part) => part.startsWith("M")) ?? null;
  const machineId = groupId && machineToken ? `${groupId}-${machineToken}` : groupId;
  const variantId = parts.length > 2 ? fullId : null;
  return { fullId, groupId, machineId, variantId };
}

function expandOpdbCandidateIds(opdbIdRaw: string | null | undefined): string[] {
  const { fullId, machineId, groupId } = parseOpdbIdParts(opdbIdRaw);
  return [fullId, machineId, groupId].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
}

function normalizeCatalogVariantLabel(value: string | null | undefined): string | null {
  const trimmed = normalizedOptionalString(value);
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (lowered === "premium") return "Premium";
  if (lowered === "pro") return "Pro";
  if (lowered === "le" || lowered.includes("limited edition")) return "LE";
  if (lowered === "ce" || lowered.includes("collector")) return "CE";
  if (lowered === "se" || lowered.includes("special edition")) return "SE";
  if (lowered === "premium/le" || lowered === "premium le" || lowered === "premium-le") return "Premium/LE";
  if (lowered === "arcade") return "Arcade";
  if (lowered === "wizard") return "Wizard";
  if (lowered.includes("anniversary")) {
    return trimmed.split(" ").filter(Boolean).map((token) => {
      const lower = token.toLowerCase();
      if (lower === "le" || lower === "ce" || lower === "se") return lower.toUpperCase();
      return token.charAt(0).toUpperCase() + token.slice(1);
    }).join(" ");
  }
  return trimmed;
}

function looksLikeCatalogVariantSuffix(value: string): boolean {
  const lowered = value.trim().toLowerCase();
  if (!lowered) return false;
  return lowered === "premium"
    || lowered === "pro"
    || lowered === "le"
    || lowered === "ce"
    || lowered === "se"
    || lowered === "home"
    || lowered === "arcade"
    || lowered === "wizard"
    || lowered.includes("anniversary")
    || lowered.includes("limited edition")
    || lowered.includes("special edition")
    || lowered.includes("collector")
    || lowered === "premium/le"
    || lowered === "premium le"
    || lowered === "premium-le";
}

function resolvedCatalogVariantLabel(title: string, explicitVariant: string | null | undefined): string | null {
  const explicit = normalizeCatalogVariantLabel(explicitVariant);
  if (explicit) return explicit;
  const trimmedTitle = title.trim();
  if (!trimmedTitle.endsWith(")")) return null;
  const openParenIndex = trimmedTitle.lastIndexOf("(");
  if (openParenIndex <= 0) return null;
  const rawSuffix = trimmedTitle.slice(openParenIndex + 1, -1).trim();
  if (!looksLikeCatalogVariantSuffix(rawSuffix)) return null;
  return normalizeCatalogVariantLabel(rawSuffix);
}

function resolvedCatalogDisplayTitle(title: string, explicitVariant: string | null | undefined): string {
  const trimmedTitle = title.trim();
  if (!trimmedTitle.endsWith(")")) return trimmedTitle;
  const openParenIndex = trimmedTitle.lastIndexOf("(");
  if (openParenIndex <= 0) return trimmedTitle;
  const rawSuffix = trimmedTitle.slice(openParenIndex + 1, -1).trim();
  if (!looksLikeCatalogVariantSuffix(rawSuffix)) return trimmedTitle;
  const normalizedSuffix = normalizeCatalogVariantLabel(rawSuffix);
  const normalizedExplicit = normalizeCatalogVariantLabel(explicitVariant);
  if (normalizedExplicit && normalizedSuffix && normalizedExplicit !== normalizedSuffix) {
    return trimmedTitle;
  }
  const baseTitle = trimmedTitle.slice(0, openParenIndex).trim();
  return baseTitle || trimmedTitle;
}

function sortName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function manufacturerMeta(nameRaw: string) {
  const normalized = sortName(nameRaw);
  const modernRank = MODERN_MANUFACTURERS.findIndex((name) => name === normalized);
  const historicalRank = FEATURED_HISTORICAL.findIndex((name) => name === normalized);
  if (modernRank >= 0) {
    return { isModern: true, featuredRank: modernRank + 1, sortBucket: 0 };
  }
  if (historicalRank >= 0) {
    return { isModern: false, featuredRank: historicalRank + 1, sortBucket: 1 };
  }
  return { isModern: false, featuredRank: null, sortBucket: 2 };
}

function selectImageUrl(
  imagesValue: unknown,
  preferredType: "backglass" | "playfield",
  preferredSize: "medium" | "large",
): string | null {
  const images = Array.isArray(imagesValue) ? imagesValue : [];
  const normalizedImages = images
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => {
      const urls = entry.urls && typeof entry.urls === "object" && !Array.isArray(entry.urls)
        ? entry.urls as Record<string, unknown>
        : {};
      return {
        type: normalizedOptionalString(entry.type),
        primary: Boolean(entry.primary),
        medium: normalizedOptionalString(urls.medium),
        large: normalizedOptionalString(urls.large),
      };
    });
  const preferred = normalizedImages.find((image) => image.type === preferredType && image.primary)
    ?? normalizedImages.find((image) => image.type === preferredType)
    ?? normalizedImages.find((image) => image.primary)
    ?? normalizedImages[0];
  if (!preferred) return null;
  return preferredSize === "large"
    ? preferred.large ?? preferred.medium
    : preferred.medium ?? preferred.large;
}

function machineHasPrimaryImage(machine: MachineRecord): boolean {
  return Boolean(machine.primaryImageLargeUrl || machine.primaryImageUrl);
}

function comparePreferredMachine(left: MachineRecord, right: MachineRecord): number {
  const leftHasPrimary = machineHasPrimaryImage(left);
  const rightHasPrimary = machineHasPrimaryImage(right);
  if (leftHasPrimary !== rightHasPrimary) return leftHasPrimary ? -1 : 1;

  const leftVariant = normalizedOptionalString(left.variant);
  const rightVariant = normalizedOptionalString(right.variant);
  if ((leftVariant === null) !== (rightVariant === null)) return leftVariant === null ? -1 : 1;

  if (left.year !== right.year) return compareMaybeNumber(left.year, right.year);

  const nameCompare = left.displayTitle.localeCompare(right.displayTitle, undefined, { sensitivity: "base" });
  if (nameCompare) return nameCompare;

  return left.opdbId.localeCompare(right.opdbId, undefined, { sensitivity: "base" });
}

function variantMatchScore(machineVariant: string | null, requestedVariant: string | null): number {
  const normalizedMachineVariant = normalizedOptionalString(machineVariant)?.toLowerCase() ?? null;
  const normalizedRequested = normalizedOptionalString(requestedVariant)?.toLowerCase() ?? null;
  if (!normalizedRequested) return 0;
  if (normalizedMachineVariant === normalizedRequested) return 200;
  if (normalizedMachineVariant && normalizedMachineVariant.includes(normalizedRequested)) return 120;
  if (normalizedRequested.includes("premium") && normalizedMachineVariant === "le") return 80;
  if (normalizedRequested === "le" && normalizedMachineVariant?.includes("anniversary")) return 40;
  return 0;
}

function preferredMachineForVariant(candidates: MachineRecord[], requestedVariant: string | null): MachineRecord | null {
  if (!candidates.length) return null;
  const ranked = [...candidates].sort((left, right) => {
    const leftScore = variantMatchScore(left.variant, requestedVariant);
    const rightScore = variantMatchScore(right.variant, requestedVariant);
    if (leftScore !== rightScore) return rightScore - leftScore;
    return comparePreferredMachine(left, right);
  });
  const best = ranked[0] ?? null;
  if (!best) return null;
  if (requestedVariant && variantMatchScore(best.variant, requestedVariant) <= 0) return null;
  return best;
}

function preferredMachineForRequestedId(
  requestedOpdbId: string,
  machineByOpdbId: Map<string, MachineRecord>,
  machinesByPracticeIdentity: Map<string, MachineRecord[]>,
): MachineRecord | null {
  const requested = parseOpdbIdParts(requestedOpdbId);
  const groupCandidates = requested.groupId ? machinesByPracticeIdentity.get(requested.groupId) ?? [] : [];
  const exactMachine = requested.fullId ? machineByOpdbId.get(requested.fullId) ?? null : null;
  const requestedVariant = exactMachine?.variant ?? null;

  if (!exactMachine) {
    const variantMatch = preferredMachineForVariant(groupCandidates, requestedVariant);
    if (variantMatch && machineHasPrimaryImage(variantMatch)) return variantMatch;
    return [...groupCandidates].sort(comparePreferredMachine)[0] ?? null;
  }

  const exactGroupMachines = machinesByPracticeIdentity.get(exactMachine.practiceIdentity) ?? groupCandidates;
  const variantMatch = preferredMachineForVariant(exactGroupMachines, requestedVariant);
  if (variantMatch && machineHasPrimaryImage(variantMatch)) return variantMatch;
  if (machineHasPrimaryImage(exactMachine)) return exactMachine;
  return [...exactGroupMachines].sort(comparePreferredMachine)[0] ?? exactMachine;
}

function dedupeResolvedUrls(values: Array<string | null | undefined>): string[] {
  return values.filter((value, index, items): value is string => Boolean(value) && items.indexOf(value) === index);
}

function resolveLibraryUrl(pathOrUrl: string | null | undefined): string | null {
  const raw = normalizedOptionalString(pathOrUrl);
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/Users/") || raw.startsWith("/private/")) return null;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function normalizeLibraryCachePath(path: string | null | undefined): string | null {
  const raw = normalizedOptionalString(path);
  if (!raw) return null;
  const normalizePlayfieldPublishedPath = (value: string): string =>
    value.replace(/(\/pinball\/images\/playfields\/.+?)(?:_(700|1400))?\.[A-Za-z0-9]+$/i, "$1.webp");
  if (raw.startsWith("/Users/") || raw.startsWith("/private/")) return null;
  if (raw.startsWith("/")) return raw.includes("/pinball/images/playfields/") ? normalizePlayfieldPublishedPath(raw) : raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const url = new URL(raw);
      if (url.host.toLowerCase() === "pillyliu.com" && url.pathname) {
        return url.pathname.includes("/pinball/images/playfields/")
          ? normalizePlayfieldPublishedPath(url.pathname)
          : url.pathname;
      }
    } catch {
      return raw;
    }
    return raw;
  }
  const normalized = `/${raw}`;
  return normalized.includes("/pinball/images/playfields/")
    ? normalizePlayfieldPublishedPath(normalized)
    : normalized;
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

function groupKeyForGame(game: Pick<LibraryGame, "opdbGroupId" | "practiceIdentity" | "routeId">): string {
  return normalizedOptionalString(game.opdbGroupId) ?? normalizedOptionalString(game.practiceIdentity) ?? game.routeId;
}

function dedupeSources(sources: LibrarySource[]): LibrarySource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.id)) return false;
    seen.add(source.id);
    return true;
  });
}

function groupByKey<T>(rows: T[], readKey: (row: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const key = readKey(row);
    if (!key) continue;
    out.set(key, [...(out.get(key) ?? []), row]);
  }
  return out;
}

function parseRawOpdbRows(rows: RawOpdbRow[]): { machines: MachineRecord[]; manufacturerOptions: CatalogManufacturerOption[] } {
  const machines: MachineRecord[] = [];
  const manufacturerBuckets = new Map<string, RawManufacturerSummary & { groupKeys: Set<string> }>();

  for (const row of rows) {
    const opdbId = normalizedOptionalString(row.opdb_id);
    const name = normalizedOptionalString(row.name);
    if (!opdbId || !name) continue;
    const parts = parseOpdbIdParts(opdbId);
    if (!parts.groupId || !parts.machineId) continue;
    const manufacturerObject = row.manufacturer && typeof row.manufacturer === "object" && !Array.isArray(row.manufacturer)
      ? row.manufacturer as Record<string, unknown>
      : {};
    const manufacturerNumericId = normalizedOptionalString(manufacturerObject.manufacturer_id);
    const manufacturerId = manufacturerNumericId ? `manufacturer-${manufacturerNumericId}` : null;
    const manufacturerName = normalizedOptionalString(manufacturerObject.name);
    const manufactureDate = normalizedOptionalString(row.manufacture_date);
    const year = manufactureDate && /^\d{4}/.test(manufactureDate) ? Number.parseInt(manufactureDate.slice(0, 4), 10) : null;
    const variant = resolvedCatalogVariantLabel(name, null);
    const displayTitle = resolvedCatalogDisplayTitle(name, null);

    machines.push({
      opdbId,
      practiceIdentity: parts.groupId,
      opdbGroupId: parts.groupId,
      opdbMachineId: parts.machineId,
      slug: opdbId,
      name,
      displayTitle,
      variant,
      manufacturerId,
      manufacturerName,
      year: Number.isFinite(year) ? year : null,
      primaryImageUrl: selectImageUrl(row.images, "backglass", "medium"),
      primaryImageLargeUrl: selectImageUrl(row.images, "backglass", "large"),
      playfieldImageUrl: selectImageUrl(row.images, "playfield", "medium"),
      playfieldImageLargeUrl: selectImageUrl(row.images, "playfield", "large"),
      opdbType: normalizedOptionalString(row.type),
      opdbDisplay: normalizedOptionalString(row.display),
      opdbShortname: normalizedOptionalString(row.shortname),
      opdbCommonName: normalizedOptionalString(row.common_name),
      opdbManufactureDate: manufactureDate,
    });

    if (manufacturerId && manufacturerName && parts.groupId) {
      const current = manufacturerBuckets.get(manufacturerId) ?? (() => {
        const meta = manufacturerMeta(manufacturerName);
        return {
          id: manufacturerId,
          name: manufacturerName,
          gameCount: 0,
          isModern: meta.isModern,
          featuredRank: meta.featuredRank,
          sortBucket: meta.sortBucket,
          groupKeys: new Set<string>(),
        };
      })();
      current.groupKeys.add(parts.groupId);
      current.gameCount = current.groupKeys.size;
      manufacturerBuckets.set(manufacturerId, current);
    }
  }

  const manufacturerOptions = [...manufacturerBuckets.values()]
    .map((item) => ({
      id: item.id,
      name: item.name,
      gameCount: item.groupKeys.size,
      isModern: item.isModern,
      featuredRank: item.featuredRank,
      sortBucket: item.sortBucket,
    }))
    .sort((left, right) => {
      if (left.sortBucket !== right.sortBucket) return left.sortBucket - right.sortBucket;
      if ((left.featuredRank ?? Number.MAX_SAFE_INTEGER) !== (right.featuredRank ?? Number.MAX_SAFE_INTEGER)) {
        return (left.featuredRank ?? Number.MAX_SAFE_INTEGER) - (right.featuredRank ?? Number.MAX_SAFE_INTEGER);
      }
      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });

  return { machines, manufacturerOptions };
}

function parseAssetLayer<T extends Record<string, unknown>>(raw: unknown): T[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const root = raw as AssetLayerPayload<T>;
  return Array.isArray(root.records)
    ? root.records.filter((record): record is T => Boolean(record) && typeof record === "object" && !Array.isArray(record))
    : [];
}

async function loadCanonicalLayers(): Promise<CanonicalLayers> {
  if (!canonicalLayersPromise) {
    canonicalLayersPromise = (async () => {
      const [
        rawOpdbRows,
        rulesheetAssetsRaw,
        videoAssetsRaw,
        playfieldAssetsRaw,
        gameinfoAssetsRaw,
        venueLayoutAssetsRaw,
      ] = await Promise.all([
        fetchPinballJson<RawOpdbRow[]>(RAW_OPDB_EXPORT_PATH),
        fetchPinballJson<unknown>(RULESHEET_ASSETS_PATH),
        fetchPinballJson<unknown>(VIDEO_ASSETS_PATH),
        fetchPinballJson<unknown>(PLAYFIELD_ASSETS_PATH),
        fetchPinballJson<unknown>(GAMEINFO_ASSETS_PATH),
        fetchPinballJson<unknown>(VENUE_LAYOUT_ASSETS_PATH),
      ]);

      const { machines, manufacturerOptions } = parseRawOpdbRows(Array.isArray(rawOpdbRows) ? rawOpdbRows : []);
      const machineByOpdbId = new Map(machines.map((machine) => [machine.opdbId, machine] as const));
      const machinesByPracticeIdentity = groupByKey(machines, (machine) => machine.practiceIdentity);

      const rulesheetAssets = parseAssetLayer<RulesheetAssetRecord>(rulesheetAssetsRaw);
      const videoAssets = parseAssetLayer<VideoAssetRecord>(videoAssetsRaw);
      const playfieldAssets = parseAssetLayer<PlayfieldAssetRecord>(playfieldAssetsRaw);
      const gameinfoAssets = parseAssetLayer<GameinfoAssetRecord>(gameinfoAssetsRaw);
      const venueLayoutAssets = parseAssetLayer<VenueLayoutAssetRecord>(venueLayoutAssetsRaw);

      const rulesheetAssetsByOpdbId = groupByKey(rulesheetAssets, (row) => normalizedOptionalString(row.opdbId));
      const videoAssetsByOpdbId = groupByKey(videoAssets, (row) => normalizedOptionalString(row.opdbId));
      const playfieldAssetsByPracticeIdentity = groupByKey(playfieldAssets, (row) => normalizedOptionalString(row.practiceIdentity));
      const gameinfoAssetsByOpdbId = groupByKey(gameinfoAssets, (row) => normalizedOptionalString(row.opdbId));

      const venueLayoutBySourceAndOpdbId = new Map<string, VenueLayoutAssetRecord>();
      for (const row of venueLayoutAssets) {
        const sourceId = canonicalLibrarySourceId(normalizedOptionalString(row.sourceId)) ?? normalizedOptionalString(row.sourceId);
        const opdbId = normalizedOptionalString(row.opdbId);
        if (!sourceId || !opdbId) continue;
        venueLayoutBySourceAndOpdbId.set(`${sourceId}::${opdbId}`, {
          ...row,
          sourceId,
        });
      }

      return {
        machines,
        machineByOpdbId,
        machinesByPracticeIdentity,
        manufacturerOptions,
        rulesheetAssetsByOpdbId,
        videoAssetsByOpdbId,
        playfieldAssetsByPracticeIdentity,
        gameinfoAssetsByOpdbId,
        venueLayoutBySourceAndOpdbId,
      };
    })();
  }

  return canonicalLayersPromise;
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

function saveLibrarySourceState(state: LibrarySourceState) {
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

function synchronizeLibrarySourceState(
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

export function setLibrarySourceVisible(
  sourceId: string,
  isVisible: boolean,
  current: LibrarySourceState,
): LibrarySourceState {
  const canonicalId = canonicalLibrarySourceId(sourceId);
  if (!canonicalId) return current;
  const enabled = current.enabledSourceIds.filter((id) => id !== canonicalId);
  if (isVisible) enabled.push(canonicalId);
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

function loadImportedSources(): ImportedSourceRecord[] {
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
        city: normalizedOptionalString(source.city),
        state: normalizedOptionalString(source.state),
        updatedAt: normalizedOptionalString(source.updatedAt),
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

function saveImportedSources(records: ImportedSourceRecord[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(IMPORTED_SOURCES_STORAGE_KEY, JSON.stringify(records));
}

function dedupeImportedSources(
  defaults: ImportedSourceRecord[],
  stored: ImportedSourceRecord[],
): ImportedSourceRecord[] {
  const byId = new Map<string, ImportedSourceRecord>();
  for (const source of defaults) byId.set(source.id, source);
  for (const source of stored) byId.set(source.id, source);
  return [...byId.values()].sort((left, right) => {
    if (left.type !== right.type) return left.type.localeCompare(right.type);
    return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
}

async function fetchDefaultImportedSources(): Promise<ImportedSourceRecord[]> {
  try {
    const raw = await fetchPinballJson<DefaultImportedSourcesRoot>(DEFAULT_IMPORTED_SOURCES_PATH);
    const records = Array.isArray(raw?.records) ? raw.records : [];
    return records
      .map((source) => ({
        ...source,
        id: canonicalLibrarySourceId(source.id) ?? source.id,
        name: normalizedOptionalString(source.name) ?? source.id,
        providerSourceId: normalizedOptionalString(source.providerSourceId) ?? "",
        machineIds: Array.isArray(source.machineIds)
          ? source.machineIds.map((id) => normalizedOptionalString(id)).filter(Boolean) as string[]
          : [],
        city: normalizedOptionalString(source.city),
        state: normalizedOptionalString(source.state),
        updatedAt: normalizedOptionalString(source.updatedAt),
        type: normalizeSourceType(source.type),
        provider: source.provider,
      }))
      .filter((source) => source.id && source.providerSourceId);
  } catch {
    return [];
  }
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
      city: normalizedOptionalString(record.city),
      state: normalizedOptionalString(record.state),
      updatedAt: normalizedOptionalString(record.updatedAt),
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
      // keep stale record
    }
  }

  if (changed) saveImportedSources(repaired);
  return repaired;
}

function rulesheetPreferenceOrder(link: ReferenceLink): number {
  const provider = referenceLinkProvider(link);
  switch (provider) {
    case "local":
      return 0;
    case "pinprof":
      return 1;
    case "tf":
      return 2;
    case "bob":
      return 3;
    case "papa":
      return 4;
    case "pp":
      return 5;
    default:
      return 6;
  }
}

function rulesheetMergeKey(link: ReferenceLink): string {
  const localPath = normalizeLibraryCachePath(link.localPath);
  if (localPath) return `local::${localPath.toLowerCase()}`;
  const url = normalizedOptionalString(link.url);
  if (url) return `url::${url.toLowerCase()}`;
  return `fallback::${(link.provider ?? "").toLowerCase()}::${link.label.toLowerCase()}`;
}

function mergeRulesheetReferences(...groups: ReferenceLink[][]): ReferenceLink[] {
  const out: ReferenceLink[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    const sorted = [...group].sort((left, right) => rulesheetPreferenceOrder(left) - rulesheetPreferenceOrder(right));
    for (const link of sorted) {
      const key = rulesheetMergeKey(link);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(link);
    }
  }
  return out.sort((left, right) => {
    const orderCompare = rulesheetPreferenceOrder(left) - rulesheetPreferenceOrder(right);
    if (orderCompare) return orderCompare;
    return left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
  });
}

function collapseDisplayedRulesheetReferences(links: ReferenceLink[]): ReferenceLink[] {
  const hasTiltForums = links.some((link) => referenceLinkProvider(link) === "tf");
  if (!hasTiltForums) return links;
  return links.filter((link) => {
    const provider = referenceLinkProvider(link);
    const hasLocalPath = Boolean(normalizeLibraryCachePath(link.localPath));
    const hasUrl = Boolean(normalizedOptionalString(link.url));
    return !(provider === "pinprof" && hasLocalPath && !hasUrl);
  });
}

function rulesheetLinksForMachine(machine: MachineRecord, layers: CanonicalLayers): { localPath: string | null; links: ReferenceLink[] } {
  const linksByCandidate: ReferenceLink[][] = [];
  let localPath: string | null = null;

  for (const candidateId of expandOpdbCandidateIds(machine.opdbId)) {
    const candidateRows = (layers.rulesheetAssetsByOpdbId.get(candidateId) ?? [])
      .filter((row) => row.isActive && !row.isHidden)
      .sort((left, right) => {
        if (left.priority !== right.priority) return left.priority - right.priority;
        return left.rulesheetAssetId - right.rulesheetAssetId;
      });
    if (!candidateRows.length) continue;

    if (!localPath) {
      const localRow = candidateRows.find((row) => normalizedOptionalString(row.localPath));
      if (localRow) localPath = normalizeLibraryCachePath(localRow.localPath);
    }

    linksByCandidate.push(candidateRows.flatMap((row): ReferenceLink[] => {
      const url = normalizedOptionalString(row.url);
      const localCandidate = normalizeLibraryCachePath(row.localPath);
      if (!url) {
        if (localCandidate) {
          return [{ label: row.label || "Local", url: "", provider: row.provider, localPath: localCandidate }];
        }
        return [];
      }
      return [{
        label: row.label || "Rulesheet",
        url,
        provider: normalizedOptionalString(row.provider),
        localPath: localCandidate,
      }];
    }));
  }

  return {
    localPath,
    links: collapseDisplayedRulesheetReferences(mergeRulesheetReferences(...linksByCandidate)),
  };
}

function videoProviderOrder(provider: string | null | undefined): number {
  switch ((provider ?? "").trim().toLowerCase()) {
    case "pinprof":
    case "local":
      return 0;
    case "matchplay":
      return 1;
    default:
      return 9;
  }
}

function videoKindOrder(kind: string | null | undefined): number {
  switch ((kind ?? "").trim().toLowerCase()) {
    case "tutorial":
      return 0;
    case "gameplay":
      return 1;
    case "competition":
      return 2;
    default:
      return 9;
  }
}

function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.trim().toLowerCase();
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (host === "youtu.be" || host === "www.youtu.be") return pathParts[0] ?? null;
    if (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtube-nocookie.com" ||
      host === "www.youtube-nocookie.com" ||
      host.endsWith(".youtube.com") ||
      host.endsWith(".youtube-nocookie.com")
    ) {
      if (pathParts[0] === "watch") return parsed.searchParams.get("v");
      if ((pathParts[0] === "embed" || pathParts[0] === "shorts" || pathParts[0] === "live") && pathParts[1]) {
        return pathParts[1];
      }
      return parsed.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return null;
}

function canonicalVideoIdentity(url: string): string {
  const youtubeId = extractYouTubeVideoId(url);
  if (youtubeId) return `youtube:${youtubeId}`;
  return `url:${url.trim()}`;
}

function canonicalVideoMergeKey(kind: string | null | undefined, url: string): string {
  return `${(kind ?? "").trim().toLowerCase()}::${canonicalVideoIdentity(url)}`;
}

function videosForMachine(machine: MachineRecord, layers: CanonicalLayers): Video[] {
  const out = new Map<string, Video>();
  for (const candidateId of expandOpdbCandidateIds(machine.opdbId)) {
    const rows = (layers.videoAssetsByOpdbId.get(candidateId) ?? [])
      .filter((row) => row.isActive && !row.isHidden && normalizedOptionalString(row.url))
      .sort((left, right) => {
        const providerCompare = videoProviderOrder(left.provider) - videoProviderOrder(right.provider);
        if (providerCompare) return providerCompare;
        const kindCompare = videoKindOrder(left.kind) - videoKindOrder(right.kind);
        if (kindCompare) return kindCompare;
        if (left.priority !== right.priority) return left.priority - right.priority;
        return left.videoAssetId - right.videoAssetId;
      });
    for (const row of rows) {
      const url = normalizedOptionalString(row.url);
      if (!url) continue;
      const key = canonicalVideoMergeKey(row.kind, url);
      if (out.has(key)) continue;
      out.set(key, {
        kind: normalizedOptionalString(row.kind) ?? "",
        label: normalizedOptionalString(row.label) ?? "Video",
        url,
      });
    }
  }
  return [...out.values()].sort((left, right) => {
    const providerCompare = videoKindOrder(left.kind) - videoKindOrder(right.kind);
    if (providerCompare) return providerCompare;
    return left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
  });
}

function scorePlayfieldSourceMatch(requestedOpdbId: string | null, sourceOpdbId: string | null): number {
  const requested = parseOpdbIdParts(requestedOpdbId);
  const source = parseOpdbIdParts(sourceOpdbId);
  if (!requested.fullId || !source.fullId || requested.groupId !== source.groupId) return -1;
  if (requested.fullId === source.fullId) return 500;
  if (requested.machineId && source.fullId === requested.machineId) return 460;
  if (requested.machineId && source.machineId === requested.machineId) return source.variantId ? 440 : 450;
  if (source.machineId === source.groupId && !source.variantId) return 300;
  if (source.variantId) return 240;
  return 250;
}

function playfieldAssetForMachine(machine: MachineRecord, layers: CanonicalLayers): PlayfieldAssetRecord | null {
  const candidates = (layers.playfieldAssetsByPracticeIdentity.get(machine.practiceIdentity) ?? [])
    .filter((row) => normalizedOptionalString(row.playfieldLocalPath) || normalizedOptionalString(row.playfieldWebLocalPath700) || normalizedOptionalString(row.playfieldWebLocalPath1400));
  if (!candidates.length) return null;

  let best: PlayfieldAssetRecord | null = null;
  let bestScore = -1;
  for (const row of candidates) {
    const aliases = row.coveredAliasIds.length ? row.coveredAliasIds : [row.sourceOpdbMachineId];
    const score = Math.max(...aliases.map((alias) => scorePlayfieldSourceMatch(machine.opdbId, alias)));
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return best ?? candidates[0] ?? null;
}

function gameinfoPathForMachine(machine: MachineRecord, layers: CanonicalLayers): string | null {
  for (const candidateId of expandOpdbCandidateIds(machine.opdbId)) {
    const rows = (layers.gameinfoAssetsByOpdbId.get(candidateId) ?? [])
      .filter((row) => row.isActive && !row.isHidden && normalizedOptionalString(row.localPath))
      .sort((left, right) => {
        if (left.priority !== right.priority) return left.priority - right.priority;
        return left.gameinfoAssetId - right.gameinfoAssetId;
      });
    const path = normalizedOptionalString(rows[0]?.localPath);
    if (path) return path;
  }
  return null;
}

function venueLayoutForMachine(sourceId: string, requestedOpdbId: string, machine: MachineRecord, layers: CanonicalLayers) {
  const candidateIds = [
    ...expandOpdbCandidateIds(requestedOpdbId),
    ...expandOpdbCandidateIds(machine.opdbId),
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
  for (const candidateId of candidateIds) {
    const row = layers.venueLayoutBySourceAndOpdbId.get(`${sourceId}::${candidateId}`);
    if (row) {
      return {
        area: normalizedOptionalString(row.area),
        areaOrder: typeof row.areaOrder === "number" ? row.areaOrder : null,
        group: typeof row.groupNumber === "number" ? row.groupNumber : null,
        position: typeof row.position === "number" ? row.position : null,
        bank: typeof row.bank === "number" ? row.bank : null,
      };
    }
  }
  return {
    area: null,
    areaOrder: null,
    group: null,
    position: null,
    bank: null,
  };
}

function buildLibraryGame(
  machine: MachineRecord,
  source: ImportedSourceRecord,
  layers: CanonicalLayers,
  requestedMachineId?: string | null,
): LibraryGame {
  const requestedId = normalizedOptionalString(requestedMachineId) ?? machine.opdbId;
  const rulesheets = rulesheetLinksForMachine(machine, layers);
  const videos = videosForMachine(machine, layers);
  const playfieldAsset = playfieldAssetForMachine(machine, layers);
  const gameinfoLocal = gameinfoPathForMachine(machine, layers);
  const layout = source.type === "venue" || source.type === "tournament"
    ? venueLayoutForMachine(source.id, requestedId, machine, layers)
    : { area: null, areaOrder: null, group: null, position: null, bank: null };
  const playfieldLocalOriginal = normalizeLibraryCachePath(
    playfieldAsset?.playfieldOriginalLocalPath ??
      playfieldAsset?.playfieldLocalPath ??
      playfieldAsset?.playfieldWebLocalPath1400 ??
      playfieldAsset?.playfieldWebLocalPath700,
  );
  const playfieldLocal = normalizeLibraryPlayfieldLocalPath(
    playfieldAsset?.playfieldWebLocalPath700 ??
      playfieldAsset?.playfieldLocalPath ??
      playfieldAsset?.playfieldOriginalLocalPath,
  );
  const opdbPlayfieldUrl = normalizedOptionalString(machine.playfieldImageLargeUrl ?? machine.playfieldImageUrl);
  const hasLocalPlayfield = Boolean(playfieldLocalOriginal || playfieldLocal);

  return {
    routeId: `${source.id}::${requestedId}`,
    libraryEntryId: `${source.id}:${requestedId}`,
    practiceIdentity: machine.practiceIdentity,
    opdbId: machine.opdbId,
    opdbGroupId: machine.opdbGroupId,
    variant: source.type === "manufacturer" ? null : normalizeCatalogVariantLabel(machine.variant),
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    area: layout.area,
    areaOrder: layout.areaOrder,
    group: layout.group,
    position: layout.position,
    bank: layout.bank,
    name: machine.displayTitle,
    manufacturer: normalizedOptionalString(machine.manufacturerName),
    year: machine.year,
    slug: requestedId,
    primaryImageUrl: normalizedOptionalString(machine.primaryImageUrl),
    primaryImageLargeUrl: normalizedOptionalString(machine.primaryImageLargeUrl),
    playfieldImageUrl: opdbPlayfieldUrl,
    alternatePlayfieldImageUrl: hasLocalPlayfield ? opdbPlayfieldUrl : null,
    playfieldLocalOriginal,
    playfieldLocal,
    groupPlayfieldLocalOriginal: null,
    groupPlayfieldLocal: null,
    playfieldSourceLabel: !hasLocalPlayfield && opdbPlayfieldUrl ? "Playfield (OPDB)" : null,
    gameinfoLocal: normalizedOptionalString(gameinfoLocal),
    rulesheetLocal: rulesheets.localPath,
    rulesheetUrl: rulesheets.links[0]?.url ?? null,
    rulesheetLinks: rulesheets.links,
    videos,
  };
}

function sourceGames(source: ImportedSourceRecord, layers: CanonicalLayers): LibraryGame[] {
  if (source.type === "manufacturer") {
    const grouped = new Map<string, MachineRecord[]>();
    for (const machine of layers.machines) {
      if (machine.manufacturerId !== source.providerSourceId) continue;
      grouped.set(machine.practiceIdentity, [...(grouped.get(machine.practiceIdentity) ?? []), machine]);
    }
    return [...grouped.values()]
      .map((machines) => [...machines].sort(comparePreferredMachine)[0] ?? null)
      .filter((machine): machine is MachineRecord => Boolean(machine))
      .map((machine) => buildLibraryGame(machine, source, layers, machine.opdbId));
  }

  if (source.type === "venue" || source.type === "tournament") {
    return source.machineIds
      .map((machineId) => {
        const machine = preferredMachineForRequestedId(machineId, layers.machineByOpdbId, layers.machinesByPracticeIdentity);
        if (!machine) return null;
        return buildLibraryGame(machine, source, layers, machineId);
      })
      .filter((game): game is LibraryGame => Boolean(game));
  }

  return [];
}

function filterPayloadByState(
  games: LibraryGame[],
  sources: LibrarySource[],
  state: LibrarySourceState,
): { games: LibraryGame[]; sources: LibrarySource[] } {
  const enabled = new Set(state.enabledSourceIds);
  const filteredSources = sources.filter((source) => enabled.has(source.id));
  if (!filteredSources.length) return { games, sources };
  const sourceIds = new Set(filteredSources.map((source) => source.id));
  return {
    games: games.filter((game) => sourceIds.has(game.sourceId)),
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
  const [layers, importedSourcesRaw, defaultImportedSources] = await Promise.all([
    loadCanonicalLayers(),
    Promise.resolve(loadImportedSources()),
    fetchDefaultImportedSources(),
  ]);
  const importedSources = await repairImportedSources(dedupeImportedSources(defaultImportedSources, importedSourcesRaw));
  const sources = dedupeSources(importedSources.map((source) => ({
    id: source.id,
    name: source.name,
    type: source.type,
  })));
  const allGames = importedSources.flatMap((source) => sourceGames(source, layers));
  const sourceGameCounts = allGames.reduce<Record<string, number>>((counts, game) => {
    const key = game.sourceId;
    counts[key] = counts[key] ?? 0;
    return counts;
  }, {});
  const groupKeysBySource = new Map<string, Set<string>>();
  for (const game of allGames) {
    const groupKeys = groupKeysBySource.get(game.sourceId) ?? new Set<string>();
    groupKeys.add(groupKeyForGame(game));
    groupKeysBySource.set(game.sourceId, groupKeys);
  }
  for (const [sourceId, groupKeys] of groupKeysBySource) {
    sourceGameCounts[sourceId] = groupKeys.size;
  }

  const synchronizedState = synchronizeLibrarySourceState(loadLibrarySourceState(), sources);
  const filtered = filterPayloadByState(allGames, sources, synchronizedState);

  return {
    games: filtered.games,
    sources: filtered.sources,
    visibleSources: resolveVisibleSources(filtered.sources, synchronizedState, synchronizedState.selectedSourceId),
    sourceState: synchronizedState,
    importedSources,
    manufacturerOptions: layers.manufacturerOptions,
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
  const hasArea = games.some((game) => Boolean(normalizedOptionalString(game.area)));
  const hasPosition = games.some((game) => (game.group ?? 0) > 0 || (game.position ?? 0) > 0);
  return hasArea || hasPosition ? "area" : "alphabetical";
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

function abbreviateLibraryCardManufacturer(manufacturer: string | null | undefined): string | null {
  const normalized = normalizedOptionalString(manufacturer);
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (lower === "jersey jack pinball") return "JJP";
  if (lower === "barrels of fun") return "BoF";
  if (lower === "chicago gaming") return "CGC";
  return normalized;
}

export function manufacturerYearCardText(game: LibraryGame): string {
  const maker = abbreviateLibraryCardManufacturer(game.manufacturer) ?? "—";
  return game.year ? `${maker} • ${game.year}` : maker;
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
  const localOriginal = normalizedOptionalString(game.playfieldLocalOriginal);
  const local1400 = localOriginal ? derivePlayfieldVariant(localOriginal, 1400) : null;
  const local700 = localOriginal ? derivePlayfieldVariant(localOriginal, 700) : null;
  const groupLocalOriginal = normalizedOptionalString(game.groupPlayfieldLocalOriginal);
  const groupLocal1400 = groupLocalOriginal ? derivePlayfieldVariant(groupLocalOriginal, 1400) : null;
  const groupLocal700 = groupLocalOriginal ? derivePlayfieldVariant(groupLocalOriginal, 700) : null;
  return dedupeResolvedUrls([
    resolveLibraryUrl(game.playfieldLocalOriginal),
    resolveLibraryUrl(local1400),
    resolveLibraryUrl(local700),
    resolveLibraryUrl(game.groupPlayfieldLocalOriginal),
    resolveLibraryUrl(groupLocal1400),
    resolveLibraryUrl(groupLocal700),
    resolveLibraryUrl(game.playfieldLocal),
    resolveLibraryUrl(game.groupPlayfieldLocal),
  ]);
}

function playfieldSourceLabelForGame(game: LibraryGame): string {
  if (game.playfieldSourceLabel) {
    return game.playfieldSourceLabel === "Playfield (OPDB)" ? "OPDB" : "PinProf";
  }
  if (game.playfieldLocalOriginal || game.playfieldLocal || game.groupPlayfieldLocalOriginal || game.groupPlayfieldLocal) {
    return "PinProf";
  }
  const playfieldUrl = resolveLibraryUrl(game.playfieldImageUrl);
  if (!playfieldUrl) return "View";
  try {
    const parsed = new URL(playfieldUrl, "https://pillyliu.com");
    if (parsed.host.toLowerCase().includes("opdb.org") || parsed.host.toLowerCase().includes("img.opdb.org")) {
      return "OPDB";
    }
  } catch {
    return "Remote";
  }
  return "Remote";
}

function playfieldSourceLabelForUrl(url: string | null | undefined): string {
  const playfieldUrl = resolveLibraryUrl(url);
  if (!playfieldUrl) return "View";
  try {
    const parsed = new URL(playfieldUrl, "https://pillyliu.com");
    if (parsed.host.toLowerCase().includes("opdb.org") || parsed.host.toLowerCase().includes("img.opdb.org")) {
      return "OPDB";
    }
  } catch {
    return "Remote";
  }
  return "Remote";
}

export function cardArtworkCandidates(game: LibraryGame): string[] {
  return dedupeResolvedUrls([
    resolveLibraryUrl(game.primaryImageLargeUrl),
    resolveLibraryUrl(game.primaryImageUrl),
    resolveLibraryUrl(MISSING_ARTWORK_PATH),
  ]);
}

export function detailArtworkCandidates(game: LibraryGame): string[] {
  return cardArtworkCandidates(game);
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
      liveStatus?.effectiveKind === "external" ? null : resolveLibraryUrl(liveStatus?.effectiveUrl),
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
  if (liveUrl && liveKind !== "missing" && liveKind !== "external" && !usedCandidates.has(liveUrl)) {
    let title = playfieldSourceLabelForGame(game);
    if (liveKind === "pillyliu") title = "Local";
    if (liveKind === "opdb") title = "OPDB";
    options.push({ title, candidates: [liveUrl] });
    usedCandidates.add(liveUrl);
  }

  const primaryUrl = resolveLibraryUrl(game.playfieldImageUrl);
  if (primaryUrl && !usedCandidates.has(primaryUrl)) {
    options.push({ title: playfieldSourceLabelForUrl(primaryUrl), candidates: [primaryUrl] });
    usedCandidates.add(primaryUrl);
  }

  const alternateUrl = resolveLibraryUrl(game.alternatePlayfieldImageUrl);
  if (alternateUrl && !usedCandidates.has(alternateUrl)) {
    options.push({ title: playfieldSourceLabelForUrl(alternateUrl), candidates: [alternateUrl] });
    usedCandidates.add(alternateUrl);
  }

  return options;
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
  if (url.includes("pinprof.com") || url.includes("pillyliu.com")) return "pinprof";
  if (label.includes("(local)") || label.includes("(source)")) return "local";
  return null;
}

export function preferredRulesheetLink(game: LibraryGame): ReferenceLink | null {
  const links = game.rulesheetLinks;
  const preferredTf = links.find((link) => referenceLinkProvider(link) === "tf");
  if (preferredTf) return preferredTf;
  return links[0] ?? (game.rulesheetUrl
    ? { label: "Rulesheet", url: game.rulesheetUrl, provider: null, localPath: null }
    : null);
}

export function rulesheetMarkdownCandidates(game: LibraryGame): string[] {
  return rulesheetMarkdownCandidatesForLink(game, preferredRulesheetLink(game));
}

export function rulesheetMarkdownCandidatesForLink(game: LibraryGame, link: ReferenceLink | null): string[] {
  const provider = referenceLinkProvider(link);
  const localFallback = !link || provider === "local" || provider === "pinprof" ? resolveLibraryUrl(game.rulesheetLocal) : null;
  const explicitLocalPath = provider === "local" || provider === "pinprof" ? resolveLibraryUrl(link?.localPath ?? null) : null;
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
