// scripts/build_pinball_library.ts
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

type RawRow = {
  Group?: unknown;
  Pos?: unknown;
  Bank?: unknown;

  Game?: unknown;
  Manufacturer?: unknown;
  Year?: unknown;

  "Playfield Image"?: unknown;
  Rulesheet?: unknown;

  Tutorial?: unknown;
  Gameplay?: unknown;
  "Gameplay 2"?: unknown;
  "Tutorial 2"?: unknown;
  "Tutorial 3"?: unknown;

  [key: string]: unknown;
};

type VideoKind = "tutorial" | "gameplay";

type LibraryVideo = {
  kind: VideoKind;
  label: string; // e.g. "Tutorial 1"
  url: string;
};

type LibraryItem = {
  group: number | null;
  pos: number | null;  // new: position within group (physical ordering)
  bank: number | null; // new: current season bank (1-8)

  name: string;
  manufacturer: string | null;
  year: number | null;
  slug: string;

  playfieldImageUrl: string | null; // original URL from sheet
  playfieldLocal: string | null; // hosted path based on mapped extension (or null)
  rulesheetUrl: string | null; // original URL from sheet
  rulesheetLocal: string; // local rulesheet page path

  videos: LibraryVideo[];
};

const SHARED_PINBALL_DIR = path.resolve("../shared/pinball");
const SHARED_PINBALL_DATA_DIR = path.join(SHARED_PINBALL_DIR, "data");
const SHARED_PINBALL_IMAGES_DIR = path.join(SHARED_PINBALL_DIR, "images", "playfields");
const SUPPORTED_PLAYFIELD_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toIntOrNull(v?: unknown): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function cleanUrl(v?: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  // basic sanity: allow http(s)
  if (!/^https?:\/\//i.test(s)) return s; // allow relative if you ever use it
  return s;
}

function buildVideos(row: RawRow): LibraryVideo[] {
  const out: LibraryVideo[] = [];

  const tutorialCols: Array<[keyof RawRow, string]> = [
    ["Tutorial", "Tutorial 1"],
    ["Tutorial 2", "Tutorial 2"],
    ["Tutorial 3", "Tutorial 3"],
  ];

  const gameplayCols: Array<[keyof RawRow, string]> = [
    ["Gameplay", "Gameplay 1"],
    ["Gameplay 2", "Gameplay 2"],
  ];

  for (const [col, label] of tutorialCols) {
    const url = cleanUrl(row[col]);
    if (url) out.push({ kind: "tutorial", label, url });
  }
  for (const [col, label] of gameplayCols) {
    const url = cleanUrl(row[col]);
    if (url) out.push({ kind: "gameplay", label, url });
  }

  return out;
}

function isDuplicateHeaderRow(row: RawRow): boolean {
  return (
    String(row.Group ?? "").trim() === "Group" &&
    String(row.Game ?? "").trim() === "Game" &&
    String(row.Manufacturer ?? "").trim() === "Manufacturer"
  );
}

function isBlankRow(row: RawRow): boolean {
  const game = String(row.Game ?? "").trim();
  const group = String(row.Group ?? "").trim();
  const manufacturer = String(row.Manufacturer ?? "").trim();
  const year = String(row.Year ?? "").trim();
  const pos = String(row.Pos ?? "").trim();
  const bank = String(row.Bank ?? "").trim();
  return !game && !group && !manufacturer && !year && !pos && !bank;
}

function hostedPlayfieldPath(slug: string): string | null {
  for (const ext of SUPPORTED_PLAYFIELD_EXTENSIONS) {
    const candidate = path.join(SHARED_PINBALL_IMAGES_DIR, `${slug}${ext}`);
    if (fs.existsSync(candidate)) {
      return `/pinball/images/playfields/${slug}${ext}`;
    }
  }
  return null;
}

function resolveCsvPath(): string {
  // CLI usage:
  //   tsx scripts/build_pinball_library.ts "../shared/pinball/data/Avenue Pinball - Current.csv"
  const arg = process.argv[2];
  if (arg) return path.resolve(arg);

  // Preferred default (new Google export name)
  const preferred = path.join(SHARED_PINBALL_DATA_DIR, "Avenue Pinball - Current.csv");
  if (fs.existsSync(preferred)) return preferred;

  // Backward-compatible fallback
  return path.join(SHARED_PINBALL_DATA_DIR, "pinball_library.csv");
}

function main() {
  const csvPath = resolveCsvPath();
  const outPath = path.join(SHARED_PINBALL_DATA_DIR, "pinball_library.json");

  if (!fs.existsSync(csvPath)) {
    throw new Error(`Missing CSV at: ${csvPath}`);
  }

  const csvText = fs.readFileSync(csvPath, "utf8");

  const parsed = Papa.parse<RawRow>(csvText, {
    header: true,
    skipEmptyLines: false,
  });

  if (parsed.errors?.length) {
    console.error(parsed.errors);
    throw new Error("CSV parse errors detected. Fix CSV or adjust parser.");
  }

  const rawRows = (parsed.data ?? []) as RawRow[];

  const items: LibraryItem[] = [];
  const slugCounts = new Map<string, number>();

  for (const row of rawRows) {
    if (!row) continue;
    if (isBlankRow(row)) continue;
    if (isDuplicateHeaderRow(row)) continue;

    const name = String(row.Game ?? "").trim();
    if (!name) continue;

    const baseSlug = slugify(name);
    const count = (slugCounts.get(baseSlug) ?? 0) + 1;
    slugCounts.set(baseSlug, count);
    const slug = count === 1 ? baseSlug : `${baseSlug}-${count}`;

    const group = toIntOrNull(row.Group);
    const pos = toIntOrNull(row.Pos);
    const bank = toIntOrNull(row.Bank);

    const manufacturer = String(row.Manufacturer ?? "").trim() || null;
    const year = toIntOrNull(row.Year);

    const playfieldImageUrl = cleanUrl(row["Playfield Image"]);
    const rulesheetUrl = cleanUrl(row.Rulesheet);

    items.push({
      group,
      pos,
      bank,
      name,
      manufacturer,
      year,
      slug,
      playfieldImageUrl,
      playfieldLocal: hostedPlayfieldPath(slug),
      rulesheetUrl,
      rulesheetLocal: `/pinball/rulesheets/${slug}.md`,
      videos: buildVideos(row),
    });
  }

  // Sort: group asc, then pos asc (within group), then name to stabilize
  items.sort((a, b) => {
    const ga = a.group ?? 9999;
    const gb = b.group ?? 9999;
    if (ga !== gb) return ga - gb;

    const pa = a.pos ?? 9999;
    const pb = b.pos ?? 9999;
    if (pa !== pb) return pa - pb;

    return a.name.localeCompare(b.name);
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(items, null, 2), "utf8");

  console.log(`Read CSV -> ${csvPath}`);
  console.log(`Wrote ${items.length} items -> ${outPath}`);
}

main();
