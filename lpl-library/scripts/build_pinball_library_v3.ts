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
  coveredAliasIdsJson: string;
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

const SHARED_PINBALL_DIR = path.resolve("../shared/pinball");
const SHARED_PINBALL_DATA_DIR = path.join(SHARED_PINBALL_DIR, "data");
const SHARED_PINBALL_IMAGES_DIR = path.join(SHARED_PINBALL_DIR, "images", "playfields");
const SHARED_PINBALL_RULESHEETS_DIR = path.join(SHARED_PINBALL_DIR, "rulesheets");
const SHARED_PINBALL_GAMEINFO_DIR = path.join(SHARED_PINBALL_DIR, "gameinfo");
const PINPROF_ADMIN_DB_PATH = path.join(SHARED_PINBALL_DATA_DIR, "pinprof_admin_v1.sqlite");
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

function detectLibraryType(row: RawRow): LibraryType {
  const pmLocationId = cleanString(getHeaderValue(row, "PM_location_id"));
  const venue = cleanString(getHeaderValue(row, "Venue"));
  if (pmLocationId || venue) return "venue";
  return "manufacturer";
}

function buildLibraryIdentity(row: RawRow) {
  const libraryType = detectLibraryType(row);
  if (libraryType === "venue") {
    const venueName =
      cleanString(getHeaderValue(row, "Venue")) ||
      cleanString(getHeaderValue(row, "Venue Location")) ||
      "Unknown Venue";
    return {
      libraryType,
      libraryName: venueName,
      libraryId: `venue--${slugify(venueName)}`,
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

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function parseCoveredAliasIds(raw: string | null | undefined): string[] {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return Array.from(new Set(parsed.map((value) => String(value ?? "").trim()).filter(Boolean)));
    }
  } catch {
    return trimmed.split(",").map((value) => value.trim()).filter(Boolean);
  }
  return [];
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
        covered_alias_ids_json AS coveredAliasIdsJson,
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
  if (!rows.length) return null;
  const exact = rows.find((row) => row.sourceAliasId === opdbID && parseCoveredAliasIds(row.coveredAliasIdsJson).includes(opdbID));
  if (exact?.playfieldLocalPath) return exact.playfieldLocalPath;
  const covered = rows.find((row) => parseCoveredAliasIds(row.coveredAliasIdsJson).includes(opdbID));
  return covered?.playfieldLocalPath ?? null;
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

  const avenue = path.join(SHARED_PINBALL_DATA_DIR, "Avenue Pinball - Current.csv");
  const rlm = path.join(SHARED_PINBALL_DATA_DIR, "RLM Amusements - Current.csv");
  return [avenue, rlm].filter((p) => fs.existsSync(p));
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
  if (!inputCsvPaths.length) {
    throw new Error("No input CSV files found for v3 builder.");
  }

  const outPath = path.join(SHARED_PINBALL_DATA_DIR, "pinball_library_v3.json");
  const adminPlayfieldAssets = loadAdminPlayfieldAssetMap();
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
      const game = cleanString(getHeaderValue(row, "Game"));
      if (!game) return;

      const { libraryType, libraryId, libraryName } = buildLibraryIdentity(row);
      const opdbID = cleanString(getHeaderValue(row, "opdb_id"));
      const practiceIdentity = cleanString(getHeaderValue(row, "practice_identity")) ?? opdbGroupIdFromOPDBID(opdbID);
      const legacySlug = deriveLegacySlug(row);
      const rulesheetPracticeBase = practiceIdentity ? `${practiceIdentity}-rulesheet` : null;
      const gameinfoPracticeBase = practiceIdentity ? `${practiceIdentity}-gameinfo` : null;

      const columns: Record<string, string> = {};
      for (const h of headers) columns[h] = String(row[h] ?? "");

      const item: LibraryV3Item = {
        library_entry_id: cleanString(getHeaderValue(row, "library_entry_id")),
        practice_identity: practiceIdentity,
        opdb_id: opdbID,
        library_type: libraryType,
        library_id: libraryId,
        library_name: libraryName,

        game,
        variant: cleanString(getHeaderValue(row, "Variant")),
        manufacturer: cleanString(getHeaderValue(row, "Manufacturer")),
        year: toIntOrNull(getHeaderValue(row, "Year")),

        venue: cleanString(getHeaderValue(row, "Venue")),
        pm_location_id: cleanString(getHeaderValue(row, "PM_location_id")),
        venue_location: cleanString(getHeaderValue(row, "Venue Location")),
        area: cleanString(getHeaderValue(row, "Area", "Location")),
        area_order: toIntOrNull(getHeaderValue(row, "AreaOrder")),
        group: toIntOrNull(getHeaderValue(row, "Group")),
        position: toIntOrNull(getHeaderValue(row, "Position")),
        bank: toIntOrNull(getHeaderValue(row, "Bank")),

        slug: legacySlug,

        rulesheet_url: cleanUrl(getHeaderValue(row, "Rulesheet")),
        playfield_image_url: cleanUrl(getHeaderValue(row, "Playfield Image")),
        videos: buildVideos(row),

        assets: {
          rulesheet_local_practice: findMarkdownLocalPath(SHARED_PINBALL_RULESHEETS_DIR, rulesheetPracticeBase),
          gameinfo_local_practice: findMarkdownLocalPath(SHARED_PINBALL_GAMEINFO_DIR, gameinfoPracticeBase),
          playfield_local_practice: resolvePracticePlayfieldLocalPath(opdbID, practiceIdentity, adminPlayfieldAssets),
        },

        sort_keys: {
          alphabetical: slugify(game),
          year: toIntOrNull(getHeaderValue(row, "Year")),
          location: {
            areaOrder: toIntOrNull(getHeaderValue(row, "AreaOrder")),
            area: cleanString(getHeaderValue(row, "Area", "Location")),
            group: toIntOrNull(getHeaderValue(row, "Group")),
            position: toIntOrNull(getHeaderValue(row, "Position")),
          },
          bank: toIntOrNull(getHeaderValue(row, "Bank")),
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
