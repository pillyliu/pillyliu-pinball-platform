import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

type RawRow = Record<string, unknown>;

type VideoKind = "tutorial" | "gameplay" | "competition";

type LibraryVideo = {
  kind: VideoKind;
  label: string;
  order: number;
  url: string;
};

type LibraryType = "venue" | "manufacturer";

type LibraryV2Item = {
  library_entry_id: string | null;
  practice_identity: string | null;
  pinside_group: string | null;
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

  pinside_id: string | null;
  pinside_slug: string | null;

  rulesheet_url: string | null;
  playfield_image_url: string | null;
  videos: LibraryVideo[];

  assets: {
    rulesheet_local_legacy: string | null;
    rulesheet_local_practice: string | null;
    gameinfo_local_legacy: string | null;
    gameinfo_local_practice: string | null;
    playfield_local_legacy: string | null;
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

type LibraryV2 = {
  version: 2;
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
  items: LibraryV2Item[];
};

const SHARED_PINBALL_DIR = path.resolve("../shared/pinball");
const SHARED_PINBALL_DATA_DIR = path.join(SHARED_PINBALL_DIR, "data");
const SHARED_PINBALL_IMAGES_DIR = path.join(SHARED_PINBALL_DIR, "images", "playfields");
const SHARED_PINBALL_RULESHEETS_DIR = path.join(SHARED_PINBALL_DIR, "rulesheets");
const SHARED_PINBALL_GAMEINFO_DIR = path.join(SHARED_PINBALL_DIR, "gameinfo");
const SUPPORTED_PLAYFIELD_EXTENSIONS = [".webp", ".png", ".jpg", ".jpeg"];
const PINSIDE_GROUP_NONE_MARKER = "~";

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

function cleanPinsideGroup(v?: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s || s === PINSIDE_GROUP_NONE_MARKER) return null;
  return s;
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

function deriveLegacySlug(row: RawRow): string | null {
  const pinsideSlug = cleanString(getHeaderValue(row, "pinside_slug"));
  if (pinsideSlug) return pinsideSlug;

  const game = cleanString(getHeaderValue(row, "Game"));
  const variant = cleanString(getHeaderValue(row, "Variant"));
  if (!game) return null;
  return slugify(variant ? `${game} ${variant}` : game);
}

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function findMarkdownLocalPath(dir: string, basename: string | null): string | null {
  if (!basename) return null;
  const filePath = path.join(dir, `${basename}.md`);
  if (!fileExists(filePath)) return null;
  const webDir = path.basename(dir);
  return `/pinball/${webDir}/${basename}.md`;
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

function findCanonicalPlayfieldLocalPath(practiceIdentity: string | null): string | null {
  if (!practiceIdentity) return null;
  const base = `${practiceIdentity}-playfield`;
  return findPlayfieldLocalPath(base);
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

function main() {
  const inputCsvPaths = resolveInputCsvPaths();
  if (!inputCsvPaths.length) {
    throw new Error("No input CSV files found for v2 builder.");
  }

  const outPath = path.join(SHARED_PINBALL_DATA_DIR, "pinball_library_v2.json");
  const items: LibraryV2Item[] = [];
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
      const practiceIdentity = cleanString(getHeaderValue(row, "practice_identity"));
      const legacySlug = deriveLegacySlug(row);
      const rulesheetLegacyBase = legacySlug;
      const gameinfoLegacyBase = legacySlug;
      const rulesheetPracticeBase = practiceIdentity ? `${practiceIdentity}-rulesheet` : null;
      const gameinfoPracticeBase = practiceIdentity ? `${practiceIdentity}-gameinfo` : null;

      const columns: Record<string, string> = {};
      for (const h of headers) columns[h] = String(row[h] ?? "");

      const item: LibraryV2Item = {
        library_entry_id: cleanString(getHeaderValue(row, "library_entry_id")),
        practice_identity: practiceIdentity,
        pinside_group: cleanPinsideGroup(getHeaderValue(row, "pinside_group")),
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

        pinside_id: cleanString(getHeaderValue(row, "pinside_id")),
        pinside_slug: cleanString(getHeaderValue(row, "pinside_slug")),

        rulesheet_url: cleanUrl(getHeaderValue(row, "Rulesheet")),
        playfield_image_url: cleanUrl(getHeaderValue(row, "Playfield Image")),
        videos: buildVideos(row),

        assets: {
          rulesheet_local_legacy: findMarkdownLocalPath(SHARED_PINBALL_RULESHEETS_DIR, rulesheetLegacyBase),
          rulesheet_local_practice: findMarkdownLocalPath(SHARED_PINBALL_RULESHEETS_DIR, rulesheetPracticeBase),
          gameinfo_local_legacy: findMarkdownLocalPath(SHARED_PINBALL_GAMEINFO_DIR, gameinfoLegacyBase),
          gameinfo_local_practice: findMarkdownLocalPath(SHARED_PINBALL_GAMEINFO_DIR, gameinfoPracticeBase),
          playfield_local_legacy: findPlayfieldLocalPath(legacySlug),
          playfield_local_practice: findCanonicalPlayfieldLocalPath(practiceIdentity),
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

  const out: LibraryV2 = {
    version: 2,
    generated_at: new Date().toISOString(),
    source_files: inputCsvPaths.map((p) => path.basename(p)),
    columns: [...allColumns],
    libraries: [...libraryMap.values()].sort((a, b) => {
      if (a.library_type !== b.library_type) return a.library_type.localeCompare(b.library_type);
      return a.library_name.localeCompare(b.library_name);
    }),
    items,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

  console.log(`Wrote ${items.length} items -> ${outPath}`);
  console.log(`Source CSVs: ${inputCsvPaths.join(", ")}`);
  console.log(`Libraries: ${out.libraries.length}`);
}

main();
