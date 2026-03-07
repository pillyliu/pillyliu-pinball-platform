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
const MANUFACTURER_TITLE_PREFIX_EXPANSIONS: Record<string, string> = {
  bof: "barrels-of-fun",
};

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
  const webDir = path.basename(dir);
  if (fileExists(filePath)) return `/pinball/${webDir}/${basename}.md`;

  // Legacy rulesheet aliases may use the old "<legacySlug>-rulesheet.md" form.
  if (webDir === "rulesheets") {
    const altBase = `${basename}-rulesheet`;
    const altPath = path.join(dir, `${altBase}.md`);
    if (fileExists(altPath)) return `/pinball/${webDir}/${altBase}.md`;
  }

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

function findCanonicalPlayfieldLocalPath(practiceIdentity: string | null): string | null {
  if (!practiceIdentity) return null;
  const base = `${practiceIdentity}-playfield`;
  return findPlayfieldLocalPath(base);
}

function findMachineAliasPlayfieldLocalPath(opdbID: string | null): string | null {
  if (!opdbID) return null;
  return findPlayfieldLocalPath(`${opdbID}-playfield`);
}

function pushUnique(values: string[], value: string | null) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return;
  if (!values.includes(trimmed)) values.push(trimmed);
}

function stripSuffixInsensitive(input: string, suffix: string | null): string | null {
  const source = input.trim();
  const sfx = String(suffix ?? "").trim();
  if (!source || !sfx) return null;
  if (!source.toLowerCase().endsWith(sfx.toLowerCase())) return null;
  return source.slice(0, source.length - sfx.length).trim().replace(/[:\-–\s]+$/g, "").trim() || null;
}

function stripLeadingArticle(input: string | null): string | null {
  const source = String(input ?? "").trim();
  if (!source) return null;
  const stripped = source.replace(/^(the|an|a)\s+/i, "").trim();
  return stripped && stripped !== source ? stripped : null;
}

function buildCanonicalTitleSlugCandidates(row: RawRow, legacySlug: string | null): string[] {
  const game = cleanString(getHeaderValue(row, "Game"));
  const variant = cleanString(getHeaderValue(row, "Variant"));
  const titleCandidates: string[] = [];

  pushUnique(titleCandidates, game);
  pushUnique(titleCandidates, variant);
  pushUnique(titleCandidates, stripLeadingArticle(game));
  pushUnique(titleCandidates, stripLeadingArticle(variant));
  if (game && variant) {
    pushUnique(titleCandidates, `${game} ${variant}`);
    pushUnique(titleCandidates, `${game}: ${variant}`);
    pushUnique(titleCandidates, stripSuffixInsensitive(game, variant));
    const colonIdx = game.indexOf(":");
    if (colonIdx > 0) {
      pushUnique(titleCandidates, game.slice(0, colonIdx));
    }
  }

  const slugCandidates: string[] = [];
  for (const title of titleCandidates) {
    pushUnique(slugCandidates, slugify(title));
  }
  pushUnique(slugCandidates, legacySlug);

  const genericSuffixes = [
    "-premium",
    "-pro",
    "-le",
    "-ce",
    "-arcade-edition",
    "-collectors-edition",
    "-collector-edition",
    "-limited-edition",
  ];
  for (const slug of [...slugCandidates]) {
    for (const suffix of genericSuffixes) {
      if (slug.endsWith(suffix)) pushUnique(slugCandidates, slug.slice(0, -suffix.length));
    }
  }

  return slugCandidates.filter(Boolean);
}

function findMetadataCanonicalPlayfieldLocalPath(row: RawRow, legacySlug: string | null): string | null {
  const manufacturer = cleanString(getHeaderValue(row, "Manufacturer"));
  const year = toIntOrNull(getHeaderValue(row, "Year"));
  if (!manufacturer || year == null) return null;

  const manufacturerSlug = slugify(manufacturer);
  const titleSlugCandidates = buildCanonicalTitleSlugCandidates(row, legacySlug);
  for (const titleSlug of titleSlugCandidates) {
    const bases = [`${manufacturerSlug}--${titleSlug}--${year}-playfield`];
    const expandedPrefix = MANUFACTURER_TITLE_PREFIX_EXPANSIONS[manufacturerSlug];
    if (expandedPrefix && !titleSlug.startsWith(`${expandedPrefix}-`)) {
      bases.push(`${manufacturerSlug}--${expandedPrefix}-${titleSlug}--${year}-playfield`);
    }
    for (const base of bases) {
      const hit = findPlayfieldLocalPath(base);
      if (hit) return hit;
    }
  }
  return null;
}

function resolvePracticePlayfieldLocalPath(
  row: RawRow,
  opdbID: string | null,
  practiceIdentity: string | null,
  legacySlug: string | null,
): string | null {
  return (
    findMachineAliasPlayfieldLocalPath(opdbID) ??
    findCanonicalPlayfieldLocalPath(practiceIdentity) ??
    findMetadataCanonicalPlayfieldLocalPath(row, legacySlug)
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

function writeJsonIfChanged(outPath: string, next: LibraryV2) {
  let previousGeneratedAt: string | null = null;
  let previousComparable = "";
  if (fs.existsSync(outPath)) {
    try {
      const previous = JSON.parse(fs.readFileSync(outPath, "utf8")) as Partial<LibraryV2>;
      previousGeneratedAt = typeof previous.generated_at === "string" ? previous.generated_at : null;
      previousComparable = JSON.stringify({ ...previous, generated_at: "__IGNORED__" });
    } catch {
      previousGeneratedAt = null;
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
      const opdbID = cleanString(getHeaderValue(row, "opdb_id"));
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
          playfield_local_practice: resolvePracticePlayfieldLocalPath(row, opdbID, practiceIdentity, legacySlug),
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

  const changed = writeJsonIfChanged(outPath, out);
  console.log(`${changed ? "Wrote" : "Unchanged"} ${items.length} items -> ${outPath}`);
  console.log(`Source CSVs: ${inputCsvPaths.join(", ")}`);
  console.log(`Libraries: ${out.libraries.length}`);
}

main();
