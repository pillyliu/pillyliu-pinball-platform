import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import Database from "better-sqlite3";

type RawRow = Record<string, unknown>;

type VideoKind = "tutorial" | "gameplay" | "competition";

type LibraryVideo = {
  kind: VideoKind;
  label: string;
  order: number;
  url: string;
};

type LibraryType = "venue" | "manufacturer";

type PlayfieldAssetRow = {
  practiceIdentity: string;
  sourceAliasId: string;
  playfieldLocalPath: string | null;
};

type LibraryV3Item = {
  library_entry_id: string | null;
  practice_identity: string | null;
  opdb_id: string | null;
  library_type: LibraryType;
  library_id: string;
  library_name: string;

  game: string;
  variant: string | null;
  manufacturer: string | null;
  year: number | null;

  venue: string | null;
  pm_location_id: string | null;
  venue_location: string | null;
  area: string | null;
  area_order: number | null;
  group: number | null;
  position: number | null;
  bank: number | null;

  slug: string | null;

  rulesheet_url: string | null;
  playfield_image_url: string | null;
  videos: LibraryVideo[];

  assets: {
    rulesheet_local_practice: string | null;
    gameinfo_local_practice: string | null;
    playfield_local_practice: string | null;
  };

  sort_keys: {
    alphabetical: string;
    year: number | null;
    location: {
      areaOrder: number | null;
      area: string | null;
      group: number | null;
      position: number | null;
    };
    bank: number | null;
  };

  columns: Record<string, string>;
  source: {
    file: string;
    row_number: number;
  };
};

type LibraryV3 = {
  version: 3;
  generated_at: string;
  source_files: string[];
  columns: string[];
  libraries: Array<{
    library_id: string;
    library_name: string;
    library_type: LibraryType;
    item_count: number;
    has_bank: boolean;
    has_location: boolean;
  }>;
  items: LibraryV3Item[];
};

type VenueLayoutArea = {
  source_id: string;
  area: string;
  area_order: number;
};

type VenueMachineLayout = {
  source_id: string;
  opdb_id: string;
  area: string | null;
  group_number: number | null;
  position: number | null;
};

type VenueMachineBank = {
  source_id: string;
  opdb_id: string;
  bank: number;
};

type VenueMetadataOverlays = {
  version: number;
  generated_at: string;
  layout_areas: VenueLayoutArea[];
  machine_layout: VenueMachineLayout[];
  machine_bank: VenueMachineBank[];
};

type VenueMetadataOverlayIndex = {
  areaOrderByKey: Map<string, number>;
  machineLayoutByKey: Map<string, VenueMachineLayout>;
  machineBankByKey: Map<string, VenueMachineBank>;
};

type CuratedLocalRulesheetRecord = {
  practice_identity: string;
  kind: string;
  local_path: string;
  notes?: string;
};

type CuratedLocalRulesheetResources = {
  version: number;
  records: CuratedLocalRulesheetRecord[];
};

type ResolvedVenueMetadata = {
  area: string | null;
  area_order: number | null;
  group: number | null;
  position: number | null;
  bank: number | null;
};

type CatalogVariantMachine = {
  practiceIdentity: string;
  opdbMachineId: string;
  name: string;
  variant: string | null;
  manufacturerName: string | null;
  year: number | null;
};

type CatalogVariantIndex = {
  byPracticeIdentity: Map<string, CatalogVariantMachine[]>;
  byOpdbId: Map<string, CatalogVariantMachine>;
};

const SHARED_PINBALL_DIR = path.resolve("../shared/pinball");
const SHARED_PINBALL_DATA_DIR = path.join(SHARED_PINBALL_DIR, "data");
const SHARED_PINBALL_IMAGES_DIR = path.join(SHARED_PINBALL_DIR, "images", "playfields");
const SHARED_PINBALL_RULESHEETS_DIR = path.join(SHARED_PINBALL_DIR, "rulesheets");
const SHARED_PINBALL_GAMEINFO_DIR = path.join(SHARED_PINBALL_DIR, "gameinfo");
const OPDB_CATALOG_PATH = path.join(SHARED_PINBALL_DATA_DIR, "opdb_catalog_v1.json");
const PINPROF_ADMIN_DB_PATH = path.join(SHARED_PINBALL_DATA_DIR, "pinprof_admin_v1.sqlite");
const VENUE_METADATA_OVERLAYS_PATH = path.join(SHARED_PINBALL_DATA_DIR, "venue_metadata_overlays_v1.json");
const CURATED_LOCAL_RULESHEETS_PATH = path.join(SHARED_PINBALL_DATA_DIR, "local_rulesheet_curations_v1.json");
const SUPPORTED_PLAYFIELD_EXTENSIONS = [".webp", ".png", ".jpg", ".jpeg"];
function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function toIntOrNull(v?: unknown): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function cleanString(v?: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

function cleanUrl(v?: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function getHeaderValue(row: RawRow, ...keys: string[]): string {
  for (const key of keys) {
    if (key in row) return String(row[key] ?? "");
  }
  const keyMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    keyMap.set(normalizeHeader(k), v);
  }
  for (const key of keys) {
    const v = keyMap.get(normalizeHeader(key));
    if (v != null) return String(v);
  }
  return "";
}

function venueSourceIdFromPmLocation(pmLocationId: string | null): string | null {
  const cleaned = cleanString(pmLocationId);
  return cleaned ? `venue--pm-${cleaned}` : null;
}

function detectLibraryType(row: RawRow): LibraryType {
  const pmLocationId = cleanString(getHeaderValue(row, "PM_location_id"));
  const venue = cleanString(getHeaderValue(row, "Venue"));
  if (pmLocationId || venue) return "venue";
  return "manufacturer";
}

function buildLibraryIdentity(row: RawRow) {
  const libraryType = detectLibraryType(row);
  if (libraryType === "venue") {
    const pmLocationId = cleanString(getHeaderValue(row, "PM_location_id"));
    const venueName =
      cleanString(getHeaderValue(row, "Venue")) ||
      cleanString(getHeaderValue(row, "Venue Location")) ||
      "Unknown Venue";
    return {
      libraryType,
      libraryName: venueName,
      libraryId: venueSourceIdFromPmLocation(pmLocationId) ?? `venue--${slugify(venueName)}`,
    };
  }

  const manufacturer = cleanString(getHeaderValue(row, "Manufacturer")) || "Unknown Manufacturer";
  return {
    libraryType,
    libraryName: manufacturer,
    libraryId: `manufacturer--${slugify(manufacturer)}`,
  };
}

function isDuplicateHeaderRow(row: RawRow): boolean {
  return (
    getHeaderValue(row, "Game").trim() === "Game" &&
    getHeaderValue(row, "Manufacturer").trim() === "Manufacturer"
  );
}

function isBlankRow(row: RawRow): boolean {
  return Object.values(row).every((v) => String(v ?? "").trim() === "");
}

function overlayAreaKey(sourceId: string, area: string): string {
  return `${sourceId}::${area}`;
}

function overlayMachineKey(sourceId: string, opdbId: string): string {
  return `${sourceId}::${opdbId}`;
}

function loadVenueMetadataOverlays(): VenueMetadataOverlayIndex {
  if (!fileExists(VENUE_METADATA_OVERLAYS_PATH)) {
    return {
      areaOrderByKey: new Map(),
      machineLayoutByKey: new Map(),
      machineBankByKey: new Map(),
    };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(VENUE_METADATA_OVERLAYS_PATH, "utf8")) as Partial<VenueMetadataOverlays>;
    const areaOrderByKey = new Map<string, number>();
    const machineLayoutByKey = new Map<string, VenueMachineLayout>();
    const machineBankByKey = new Map<string, VenueMachineBank>();

    for (const entry of raw.layout_areas ?? []) {
      if (!entry?.source_id || !entry.area || typeof entry.area_order !== "number") continue;
      areaOrderByKey.set(overlayAreaKey(entry.source_id, entry.area), entry.area_order);
    }

    for (const entry of raw.machine_layout ?? []) {
      if (!entry?.source_id || !entry.opdb_id) continue;
      machineLayoutByKey.set(overlayMachineKey(entry.source_id, entry.opdb_id), {
        source_id: entry.source_id,
        opdb_id: entry.opdb_id,
        area: cleanString(entry.area),
        group_number: typeof entry.group_number === "number" ? entry.group_number : null,
        position: typeof entry.position === "number" ? entry.position : null,
      });
    }

    for (const entry of raw.machine_bank ?? []) {
      if (!entry?.source_id || !entry.opdb_id || typeof entry.bank !== "number") continue;
      machineBankByKey.set(overlayMachineKey(entry.source_id, entry.opdb_id), {
        source_id: entry.source_id,
        opdb_id: entry.opdb_id,
        bank: entry.bank,
      });
    }

    return { areaOrderByKey, machineLayoutByKey, machineBankByKey };
  } catch (error) {
    throw new Error(`Failed to parse venue metadata overlays at ${VENUE_METADATA_OVERLAYS_PATH}: ${String(error)}`);
  }
}

function loadCuratedLocalRulesheetSet(): Set<string> {
  if (!fileExists(CURATED_LOCAL_RULESHEETS_PATH)) return new Set();
  try {
    const raw = JSON.parse(fs.readFileSync(CURATED_LOCAL_RULESHEETS_PATH, "utf8")) as Partial<CuratedLocalRulesheetResources>;
    const keep = new Set<string>();
    for (const entry of raw.records ?? []) {
      const practiceIdentity = cleanString(entry?.practice_identity);
      const localPath = cleanString(entry?.local_path);
      if (!practiceIdentity || !localPath?.startsWith("/pinball/rulesheets/")) continue;
      keep.add(practiceIdentity);
    }
    return keep;
  } catch (error) {
    throw new Error(`Failed to parse curated local rulesheet resources at ${CURATED_LOCAL_RULESHEETS_PATH}: ${String(error)}`);
  }
}

function resolveVenueMetadata(
  row: RawRow,
  libraryId: string,
  opdbId: string | null,
  overlays: VenueMetadataOverlayIndex,
): ResolvedVenueMetadata {
  const fallbackArea = cleanString(getHeaderValue(row, "Area", "Location"));
  const fallbackAreaOrder = toIntOrNull(getHeaderValue(row, "AreaOrder"));
  const fallbackGroup = toIntOrNull(getHeaderValue(row, "Group"));
  const fallbackPosition = toIntOrNull(getHeaderValue(row, "Position"));
  const fallbackBank = toIntOrNull(getHeaderValue(row, "Bank"));

  if (!opdbId) {
    return {
      area: fallbackArea,
      area_order: fallbackAreaOrder,
      group: fallbackGroup,
      position: fallbackPosition,
      bank: fallbackBank,
    };
  }

  const layout = overlays.machineLayoutByKey.get(overlayMachineKey(libraryId, opdbId));
  const bank = overlays.machineBankByKey.get(overlayMachineKey(libraryId, opdbId));
  const area = layout ? cleanString(layout.area) : fallbackArea;
  const areaOrder =
    layout && area
      ? overlays.areaOrderByKey.get(overlayAreaKey(libraryId, area)) ?? fallbackAreaOrder
      : fallbackAreaOrder;

  return {
    area,
    area_order: areaOrder ?? null,
    group: layout ? layout.group_number : fallbackGroup,
    position: layout ? layout.position : fallbackPosition,
    bank: bank?.bank ?? fallbackBank,
  };
}

const LEGACY_MANUFACTURER_SLUG_ALIASES: Record<string, string[]> = {
  "jersey-jack-pinball": ["jjp"],
  "spooky-pinball": ["spooky"],
  "chicago-gaming-company": ["cgc"],
};

function inferLegacySlugFromPlayfield(row: RawRow): string | null {
  const manufacturer = cleanString(getHeaderValue(row, "Manufacturer"));
  const game = cleanString(getHeaderValue(row, "Game"));
  const variant = cleanString(getHeaderValue(row, "Variant"));
  const year = toIntOrNull(getHeaderValue(row, "Year"));
  if (!manufacturer || !game || !year) return null;

  const manufacturerSlug = slugify(manufacturer);
  const prefixes = Array.from(
    new Set([manufacturerSlug, ...(LEGACY_MANUFACTURER_SLUG_ALIASES[manufacturerSlug] ?? [])].filter(Boolean))
  );

  let entries: string[] = [];
  try {
    entries = fs.readdirSync(SHARED_PINBALL_IMAGES_DIR);
  } catch {
    return null;
  }

  const gameSlug = slugify(game);
  const variantSlug = variant ? slugify(variant) : "";
  const combinedSlug = variantSlug ? slugify(`${game} ${variant}`) : gameSlug;

  let best: { base: string; score: number } | null = null;
  for (const name of entries) {
    if (name.includes("_700.") || name.includes("_1400.")) continue;
    const m = name.match(/^(.+)-playfield\.(?:webp|png|jpe?g)$/i);
    if (!m) continue;
    const base = m[1];
    for (const prefix of prefixes) {
      const mm = base.match(new RegExp(`^${prefix}--(.+)--${year}$`));
      if (!mm) continue;
      const middle = mm[1];
      let score = 0;
      if (middle === combinedSlug) score += 100;
      if (middle === gameSlug) score += 90;
      if (combinedSlug.includes(middle) || middle.includes(combinedSlug)) score += 60;
      if (gameSlug.includes(middle) || middle.includes(gameSlug)) score += 50;
      const midTokens = new Set(middle.split("-"));
      const gameTokens = new Set(gameSlug.split("-"));
      let overlap = 0;
      for (const t of gameTokens) if (midTokens.has(t)) overlap += 1;
      score += overlap * 10;
      if (!best || score > best.score) best = { base, score };
    }
  }

  if (!best || best.score < 20) return null;
  return best.base;
}

function deriveLegacySlug(row: RawRow): string | null {
  const pinsideSlug = cleanString(getHeaderValue(row, "pinside_slug"));
  if (pinsideSlug && pinsideSlug.toLowerCase() !== "none") return pinsideSlug;

  const inferredFromPlayfield = inferLegacySlugFromPlayfield(row);
  if (inferredFromPlayfield) return inferredFromPlayfield;

  const explicitSlug = cleanString(getHeaderValue(row, "slug"));
  if (explicitSlug) return explicitSlug;

  const game = cleanString(getHeaderValue(row, "Game"));
  const variant = cleanString(getHeaderValue(row, "Variant"));
  if (!game) return null;
  return slugify(variant ? `${game} ${variant}` : game);
}

function opdbGroupIdFromOPDBID(opdbID: string | null): string | null {
  const raw = String(opdbID ?? "").trim();
  const match = raw.match(/^(G[a-zA-Z0-9]+)(?:-M[a-zA-Z0-9]+(?:-A[a-zA-Z0-9]+)?)?$/);
  return match?.[1] ?? null;
}

function normalizeMatchText(input: string | null): string {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function catalogLooksLikeVariantSuffix(value: string): boolean {
  const lowered = value.trim().toLowerCase();
  if (!lowered) return false;
  return lowered === "premium" ||
    lowered === "pro" ||
    lowered === "le" ||
    lowered === "ce" ||
    lowered === "se" ||
    lowered === "home" ||
    lowered.includes("anniversary") ||
    lowered.includes("limited edition") ||
    lowered.includes("special edition") ||
    lowered.includes("collector") ||
    lowered === "premium/le" ||
    lowered === "premium le" ||
    lowered === "premium-le";
}

function normalizeCatalogVariantLabel(value: string | null): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (lowered === "null" || lowered === "none") return null;
  if (lowered === "premium") return "Premium";
  if (lowered === "pro") return "Pro";
  if (lowered === "le" || lowered.includes("limited edition")) return "LE";
  if (lowered === "ce" || lowered.includes("collector")) return "CE";
  if (lowered === "se" || lowered.includes("special edition")) return "SE";
  if (lowered === "premium/le" || lowered === "premium le" || lowered === "premium-le") return "Premium/LE";
  if (lowered.includes("anniversary")) {
    return trimmed
      .split(/\s+/)
      .map((token) => {
        const normalized = token.toLowerCase();
        if (normalized === "le" || normalized === "ce" || normalized === "se") return normalized.toUpperCase();
        return token.slice(0, 1).toUpperCase() + token.slice(1);
      })
      .join(" ");
  }
  return trimmed;
}

function catalogVariantSuffixFromTitle(title: string): string | null {
  const trimmedTitle = title.trim();
  if (!trimmedTitle.endsWith(")")) return null;
  const openParenIndex = trimmedTitle.lastIndexOf("(");
  if (openParenIndex <= 0) return null;
  const rawSuffix = trimmedTitle.slice(openParenIndex + 1, -1).trim();
  if (!catalogLooksLikeVariantSuffix(rawSuffix)) return null;
  return normalizeCatalogVariantLabel(rawSuffix);
}

function resolvedCatalogDisplayTitle(title: string, explicitVariant: string | null): string {
  const trimmedTitle = title.trim();
  if (!trimmedTitle.endsWith(")")) return trimmedTitle;
  const openParenIndex = trimmedTitle.lastIndexOf("(");
  if (openParenIndex <= 0) return trimmedTitle;
  const rawSuffix = trimmedTitle.slice(openParenIndex + 1, -1).trim();
  if (!catalogLooksLikeVariantSuffix(rawSuffix)) return trimmedTitle;
  const normalizedSuffix = normalizeCatalogVariantLabel(rawSuffix);
  const normalizedExplicit = normalizeCatalogVariantLabel(explicitVariant);
  if (normalizedExplicit && normalizedSuffix && normalizedExplicit !== normalizedSuffix) {
    return trimmedTitle;
  }
  const baseTitle = trimmedTitle.slice(0, openParenIndex).trim();
  return baseTitle || trimmedTitle;
}

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function parseOpdbIdParts(opdbId: string | null | undefined) {
  const clean = cleanString(opdbId);
  if (!clean) {
    return { fullId: null, groupId: null, machineId: null, aliasId: null };
  }
  const parts = clean.split("-");
  const groupId = parts[0] ?? null;
  const machinePart = parts.find((part) => part.startsWith("M")) ?? null;
  const aliasPart = parts.find((part) => part.startsWith("A")) ?? null;
  const machineId = groupId && machinePart ? `${groupId}-${machinePart}` : groupId;
  return {
    fullId: clean,
    groupId,
    machineId,
    aliasId: aliasPart ? clean : null,
  };
}

function loadCatalogVariantIndex(): CatalogVariantIndex {
  if (!fileExists(OPDB_CATALOG_PATH)) {
    return {
      byPracticeIdentity: new Map(),
      byOpdbId: new Map(),
    };
  }

  const root = JSON.parse(fs.readFileSync(OPDB_CATALOG_PATH, "utf8")) as { machines?: unknown[] };
  const machines = Array.isArray(root.machines) ? root.machines : [];
  const byPracticeIdentity = new Map<string, CatalogVariantMachine[]>();
  const byOpdbId = new Map<string, CatalogVariantMachine>();

  for (const entry of machines) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const item = entry as Record<string, unknown>;
    const practiceIdentity = cleanString(item.practice_identity);
    const opdbMachineId = cleanString(item.opdb_machine_id);
    const name = cleanString(item.name);
    if (!practiceIdentity || !opdbMachineId || !name) continue;
    const machine: CatalogVariantMachine = {
      practiceIdentity,
      opdbMachineId,
      name,
      variant: cleanString(item.variant),
      manufacturerName: cleanString(item.manufacturer_name),
      year: toIntOrNull(item.year),
    };
    const existing = byPracticeIdentity.get(practiceIdentity) ?? [];
    existing.push(machine);
    byPracticeIdentity.set(practiceIdentity, existing);
    byOpdbId.set(opdbMachineId, machine);
  }

  return { byPracticeIdentity, byOpdbId };
}

function scoreCatalogVariantCandidate(rawOpdbId: string, variant: string, machine: CatalogVariantMachine): number {
  let score = 0;
  const normalizedVariant = normalizeMatchText(variant);
  const normalizedMachineName = normalizeMatchText(machine.name);
  const normalizedMachineVariant = normalizeMatchText(machine.variant);
  if (machine.opdbMachineId === rawOpdbId) score += 100;
  if (machine.name.toLowerCase().includes(`(${variant.toLowerCase()})`)) {
    score += 300;
  } else if (normalizedMachineName.includes(normalizedVariant)) {
    score += 200;
  }
  if (normalizedMachineVariant && normalizedMachineVariant === normalizedVariant) score += 250;
  if (machine.name.includes("/")) score -= 25;
  if (machine.opdbMachineId.includes("-A")) score += 10;
  return score;
}

function resolveRowOpdbId(row: RawRow, catalogVariants: CatalogVariantIndex): string | null {
  const rawOpdbId = cleanString(getHeaderValue(row, "opdb_id"));
  if (!rawOpdbId) return null;
  if (rawOpdbId.includes("-A")) return rawOpdbId;

  const variant = cleanString(getHeaderValue(row, "Variant"));
  if (!variant) return rawOpdbId;

  const practiceIdentity = cleanString(getHeaderValue(row, "practice_identity")) ?? opdbGroupIdFromOPDBID(rawOpdbId);
  if (!practiceIdentity) return rawOpdbId;

  const candidates = catalogVariants.byPracticeIdentity.get(practiceIdentity) ?? [];
  if (!candidates.length) return rawOpdbId;

  let best: { score: number; opdbMachineId: string } | null = null;
  for (const candidate of candidates) {
    const score = scoreCatalogVariantCandidate(rawOpdbId, variant, candidate);
    if (!best || score > best.score) {
      best = { score, opdbMachineId: candidate.opdbMachineId };
    }
  }

  return best && best.score > 100 ? best.opdbMachineId : rawOpdbId;
}

function resolveCatalogMachineForRow(
  row: RawRow,
  opdbId: string | null,
  catalogVariants: CatalogVariantIndex,
): CatalogVariantMachine | null {
  const normalizedOpdbId = cleanString(opdbId);
  if (!normalizedOpdbId) return null;

  const exact = catalogVariants.byOpdbId.get(normalizedOpdbId);
  if (exact) return exact;

  const variant = cleanString(getHeaderValue(row, "Variant"));
  if (!variant) return null;

  const practiceIdentity = cleanString(getHeaderValue(row, "practice_identity")) ?? opdbGroupIdFromOPDBID(normalizedOpdbId);
  if (!practiceIdentity) return null;
  const candidates = catalogVariants.byPracticeIdentity.get(practiceIdentity) ?? [];
  if (!candidates.length) return null;

  let best: { score: number; machine: CatalogVariantMachine } | null = null;
  for (const candidate of candidates) {
    const score = scoreCatalogVariantCandidate(normalizedOpdbId, variant, candidate);
    if (!best || score > best.score) {
      best = { score, machine: candidate };
    }
  }
  return best && best.score > 100 ? best.machine : null;
}

function resolveCatalogDisplayFields(machine: CatalogVariantMachine): {
  game: string;
  variant: string | null;
  manufacturer: string | null;
  year: number | null;
} {
  const variant = normalizeCatalogVariantLabel(machine.variant) ?? catalogVariantSuffixFromTitle(machine.name);
  return {
    game: resolvedCatalogDisplayTitle(machine.name, variant),
    variant,
    manufacturer: machine.manufacturerName,
    year: machine.year,
  };
}

function scorePlayfieldSourceMatch(requestedOpdbId: string | null, sourceOpdbId: string | null): number {
  const requested = parseOpdbIdParts(requestedOpdbId);
  const source = parseOpdbIdParts(sourceOpdbId);
  if (!requested.fullId || !source.fullId || requested.groupId !== source.groupId) {
    return -1;
  }
  if (requested.fullId === source.fullId) return 500;
  if (requested.machineId && source.fullId === requested.machineId) return 460;
  if (requested.machineId && source.machineId === requested.machineId) {
    return source.aliasId ? 440 : 450;
  }
  if (source.machineId === source.groupId && !source.aliasId) return 300;
  if (source.aliasId) return 240;
  return 250;
}

function loadAdminPlayfieldAssetMap(): Map<string, PlayfieldAssetRow[]> {
  if (!fileExists(PINPROF_ADMIN_DB_PATH)) {
    return new Map();
  }

  const db = new Database(PINPROF_ADMIN_DB_PATH, { readonly: true });
  try {
    const table = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = 'playfield_assets'
    `).get() as { name?: string } | undefined;
    if (!table?.name) {
      return new Map();
    }

    const rows = db.prepare(`
      SELECT
        practice_identity AS practiceIdentity,
        source_opdb_machine_id AS sourceAliasId,
        playfield_local_path AS playfieldLocalPath
      FROM playfield_assets
      WHERE playfield_local_path IS NOT NULL AND trim(playfield_local_path) != ''
      ORDER BY datetime(updated_at) DESC, lower(source_opdb_machine_id)
    `).all() as PlayfieldAssetRow[];

    const out = new Map<string, PlayfieldAssetRow[]>();
    for (const row of rows) {
      const existing = out.get(row.practiceIdentity) ?? [];
      existing.push(row);
      out.set(row.practiceIdentity, existing);
    }
    return out;
  } finally {
    db.close();
  }
}

function findMarkdownLocalPath(dir: string, basename: string | null): string | null {
  if (!basename) return null;
  const filePath = path.join(dir, `${basename}.md`);
  const webDir = path.basename(dir);
  if (fileExists(filePath)) return `/pinball/${webDir}/${basename}.md`;
  return null;
}

function findPlayfieldLocalPath(baseName: string | null): string | null {
  if (!baseName) return null;
  for (const ext of SUPPORTED_PLAYFIELD_EXTENSIONS) {
    const direct = path.join(SHARED_PINBALL_IMAGES_DIR, `${baseName}${ext}`);
    if (fileExists(direct)) return `/pinball/images/playfields/${baseName}${ext}`;
  }
  for (const ext of SUPPORTED_PLAYFIELD_EXTENSIONS) {
    const resized = path.join(SHARED_PINBALL_IMAGES_DIR, `${baseName}_700${ext}`);
    if (fileExists(resized)) return `/pinball/images/playfields/${baseName}_700${ext}`;
  }
  for (const ext of SUPPORTED_PLAYFIELD_EXTENSIONS) {
    const resized = path.join(SHARED_PINBALL_IMAGES_DIR, `${baseName}_1400${ext}`);
    if (fileExists(resized)) return `/pinball/images/playfields/${baseName}_1400${ext}`;
  }
  return null;
}

function resolveAdminPlayfieldLocalPath(
  practiceIdentity: string | null,
  opdbID: string | null,
  adminAssets: Map<string, PlayfieldAssetRow[]>,
): string | null {
  if (!practiceIdentity || !opdbID) return null;
  const rows = adminAssets.get(practiceIdentity) ?? [];
  let best: { score: number; path: string } | null = null;
  for (const row of rows) {
    if (!row.playfieldLocalPath || !fileExists(path.join(SHARED_PINBALL_DIR, row.playfieldLocalPath.replace(/^\/pinball\/?/, "")))) {
      continue;
    }
    const score = scorePlayfieldSourceMatch(opdbID, row.sourceAliasId);
    if (score < 0 || !row.playfieldLocalPath) continue;
    if (!best || score > best.score) {
      best = { score, path: row.playfieldLocalPath };
    }
  }
  return best?.path ?? null;
}

function findCanonicalPlayfieldLocalPath(practiceIdentity: string | null): string | null {
  if (!practiceIdentity) return null;
  const base = `${practiceIdentity}-playfield`;
  return findPlayfieldLocalPath(base);
}

function findMachineAliasPlayfieldLocalPath(opdbID: string | null): string | null {
  if (!opdbID) return null;
  return findPlayfieldLocalPath(`${opdbID}-playfield`);
}

function resolvePracticePlayfieldLocalPath(
  opdbID: string | null,
  practiceIdentity: string | null,
  adminAssets: Map<string, PlayfieldAssetRow[]>,
): string | null {
  return (
    resolveAdminPlayfieldLocalPath(practiceIdentity, opdbID, adminAssets) ??
    findMachineAliasPlayfieldLocalPath(opdbID) ??
    findCanonicalPlayfieldLocalPath(practiceIdentity)
  );
}

function buildVideos(row: RawRow): LibraryVideo[] {
  const videos: LibraryVideo[] = [];
  const re = /^(tutorial|gameplay|competition)(?:\s+(\d+))?$/i;

  for (const [header, rawValue] of Object.entries(row)) {
    const url = cleanUrl(rawValue);
    if (!url) continue;
    const match = header.trim().match(re);
    if (!match) continue;
    const kind = match[1].toLowerCase() as VideoKind;
    const order = match[2] ? Number.parseInt(match[2], 10) : 1;
    if (!Number.isFinite(order)) continue;
    videos.push({
      kind,
      order,
      label: `${kind[0].toUpperCase()}${kind.slice(1)} ${order}`,
      url,
    });
  }

  videos.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.order - b.order;
  });
  return videos;
}

function parseCsvFile(csvPath: string) {
  const csvText = fs.readFileSync(csvPath, "utf8");
  const parsed = Papa.parse<RawRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors?.length) {
    throw new Error(`CSV parse errors in ${csvPath}: ${JSON.stringify(parsed.errors.slice(0, 5))}`);
  }
  return parsed;
}

function resolveInputCsvPaths(): string[] {
  const args = process.argv.slice(2).filter(Boolean);
  if (args.length > 0) {
    return args.map((p) => path.resolve(p));
  }
  return [
    path.join(SHARED_PINBALL_DATA_DIR, "Avenue Pinball - Current.csv"),
    path.join(SHARED_PINBALL_DATA_DIR, "RLM Amusements - Current.csv"),
  ].filter((candidate) => fileExists(candidate));
}

function writeJsonIfChanged(outPath: string, next: LibraryV3) {
  let previousComparable = "";
  if (fs.existsSync(outPath)) {
    try {
      const previous = JSON.parse(fs.readFileSync(outPath, "utf8")) as Partial<LibraryV3>;
      previousComparable = JSON.stringify({ ...previous, generated_at: "__IGNORED__" });
    } catch {
      previousComparable = "";
    }
  }

  const nextComparable = JSON.stringify({ ...next, generated_at: "__IGNORED__" });
  if (previousComparable !== "" && previousComparable === nextComparable) {
    return false;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return true;
}

function main() {
  const inputCsvPaths = resolveInputCsvPaths();
  const outPath = path.join(SHARED_PINBALL_DATA_DIR, "pinball_library_v3.json");
  const adminPlayfieldAssets = loadAdminPlayfieldAssetMap();
  const catalogVariants = loadCatalogVariantIndex();
  const venueMetadataOverlays = loadVenueMetadataOverlays();
  const curatedLocalRulesheets = loadCuratedLocalRulesheetSet();
  const items: LibraryV3Item[] = [];
  const allColumns = new Set<string>();

  for (const csvPath of inputCsvPaths) {
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Missing CSV: ${csvPath}`);
    }

    const parsed = parseCsvFile(csvPath);
    const rawRows = (parsed.data ?? []) as RawRow[];
    const headers = (parsed.meta.fields ?? []) as string[];
    for (const h of headers) allColumns.add(h);

    rawRows.forEach((row, idx) => {
      if (!row || isBlankRow(row) || isDuplicateHeaderRow(row)) return;
      const legacyGame = cleanString(getHeaderValue(row, "Game"));
      if (!legacyGame) return;

      const { libraryType, libraryId, libraryName } = buildLibraryIdentity(row);
      const opdbID = resolveRowOpdbId(row, catalogVariants);
      const catalogMachine = resolveCatalogMachineForRow(row, opdbID, catalogVariants);
      const catalogFields = catalogMachine ? resolveCatalogDisplayFields(catalogMachine) : null;
      const practiceIdentity = cleanString(getHeaderValue(row, "practice_identity")) ?? opdbGroupIdFromOPDBID(opdbID);
      const legacySlug = deriveLegacySlug(row);
      const rulesheetPracticeBase = practiceIdentity ? `${practiceIdentity}-rulesheet` : null;
      const gameinfoPracticeBase = practiceIdentity ? `${practiceIdentity}-gameinfo` : null;
      const rulesheetUrl = cleanUrl(getHeaderValue(row, "Rulesheet"));
      const rulesheetLocalPractice =
        practiceIdentity && curatedLocalRulesheets.has(practiceIdentity)
          ? findMarkdownLocalPath(SHARED_PINBALL_RULESHEETS_DIR, rulesheetPracticeBase)
          : null;
      const venueMetadata =
        libraryType === "venue"
          ? resolveVenueMetadata(row, libraryId, opdbID, venueMetadataOverlays)
          : {
              area: null,
              area_order: null,
              group: null,
              position: null,
              bank: null,
            };

      const columns: Record<string, string> = {};
      for (const h of headers) columns[h] = String(row[h] ?? "");

      const item: LibraryV3Item = {
        library_entry_id: cleanString(getHeaderValue(row, "library_entry_id")),
        practice_identity: practiceIdentity,
        opdb_id: opdbID,
        library_type: libraryType,
        library_id: libraryId,
        library_name: libraryName,

        game: catalogFields?.game ?? legacyGame,
        variant: catalogFields?.variant ?? cleanString(getHeaderValue(row, "Variant")),
        manufacturer: catalogFields?.manufacturer ?? cleanString(getHeaderValue(row, "Manufacturer")),
        year: catalogFields?.year ?? toIntOrNull(getHeaderValue(row, "Year")),

        venue: cleanString(getHeaderValue(row, "Venue")),
        pm_location_id: cleanString(getHeaderValue(row, "PM_location_id")),
        venue_location: cleanString(getHeaderValue(row, "Venue Location")),
        area: venueMetadata.area,
        area_order: venueMetadata.area_order,
        group: venueMetadata.group,
        position: venueMetadata.position,
        bank: venueMetadata.bank,

        slug: legacySlug,

        rulesheet_url: rulesheetUrl,
        playfield_image_url: cleanUrl(getHeaderValue(row, "Playfield Image")),
        videos: buildVideos(row),

        assets: {
          rulesheet_local_practice: rulesheetLocalPractice,
          gameinfo_local_practice: findMarkdownLocalPath(SHARED_PINBALL_GAMEINFO_DIR, gameinfoPracticeBase),
          playfield_local_practice: resolvePracticePlayfieldLocalPath(opdbID, practiceIdentity, adminPlayfieldAssets),
        },

        sort_keys: {
          alphabetical: slugify(catalogFields?.game ?? legacyGame),
          year: catalogFields?.year ?? toIntOrNull(getHeaderValue(row, "Year")),
          location: {
            areaOrder: venueMetadata.area_order,
            area: venueMetadata.area,
            group: venueMetadata.group,
            position: venueMetadata.position,
          },
          bank: venueMetadata.bank,
        },

        columns,
        source: {
          file: path.basename(csvPath),
          row_number: idx + 2,
        },
      };

      items.push(item);
    });
  }

  const libraryMap = new Map<
    string,
    {
      library_id: string;
      library_name: string;
      library_type: LibraryType;
      item_count: number;
      has_bank: boolean;
      has_location: boolean;
    }
  >();

  for (const item of items) {
    const cur = libraryMap.get(item.library_id) ?? {
      library_id: item.library_id,
      library_name: item.library_name,
      library_type: item.library_type,
      item_count: 0,
      has_bank: false,
      has_location: false,
    };
    cur.item_count += 1;
    cur.has_bank = cur.has_bank || item.bank != null;
    cur.has_location =
      cur.has_location ||
      item.area_order != null ||
      item.area != null ||
      item.group != null ||
      item.position != null;
    libraryMap.set(item.library_id, cur);
  }

  const out: LibraryV3 = {
    version: 3,
    generated_at: new Date().toISOString(),
    source_files: inputCsvPaths.map((p) => path.basename(p)),
    columns: [...allColumns],
    libraries: [...libraryMap.values()].sort((a, b) => {
      if (a.library_type !== b.library_type) return a.library_type.localeCompare(b.library_type);
      return a.library_name.localeCompare(b.library_name);
    }),
    items,
  };

  const changed = writeJsonIfChanged(outPath, out);
  console.log(`${changed ? "Wrote" : "Unchanged"} ${items.length} items -> ${outPath}`);
  console.log(`Source CSVs: ${inputCsvPaths.join(", ")}`);
  console.log(`Libraries: ${out.libraries.length}`);
}

main();
