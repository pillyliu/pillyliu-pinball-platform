import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import Database from "better-sqlite3";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import sharp from "sharp";

type MachineRow = {
  practiceIdentity: string;
  opdbMachineId: string | null;
  opdbGroupId: string | null;
  slug: string;
  name: string;
  variant: string | null;
  manufacturer: string | null;
  year: number | null;
  playfieldImageUrl: string | null;
  primaryImageUrl: string | null;
  playfieldLocalPath: string | null;
  rulesheetLocalPath: string | null;
  builtInRulesheetLocalPath?: string | null;
  builtInGameinfoLocalPath?: string | null;
  nameOverride: string | null;
  variantOverride: string | null;
  manufacturerOverride: string | null;
  yearOverride: number | null;
  overridePlayfieldLocalPath: string | null;
  playfieldSourceUrl: string | null;
  playfieldSourceNote: string | null;
  overrideRulesheetLocalPath: string | null;
  rulesheetSourceUrl: string | null;
  rulesheetSourceNote: string | null;
  gameinfoLocalPath: string | null;
  notes: string | null;
  updatedAt: string | null;
};

type FilterPayload = {
  manufacturers: string[];
  manufacturerGroups: Array<{
    label: string;
    manufacturers: string[];
  }>;
};

type BuiltInGameRow = {
  sourceId: string | null;
  sourceName: string | null;
  sourceType: string | null;
  playfieldImageUrl: string | null;
  playfieldLocalPath: string | null;
  playfieldSourceLabel: string | null;
  gameinfoLocalPath: string | null;
  rulesheetLocalPath: string | null;
  rulesheetUrl: string | null;
};

type MachineMembershipRow = {
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
  name: string;
  variant: string | null;
  manufacturer: string | null;
  year: number | null;
  slug: string | null;
  primaryImageUrl: string | null;
  primaryImageLargeUrl: string | null;
  playfieldImageUrl: string | null;
  playfieldLocalPath: string | null;
  playfieldSourceLabel: string | null;
  gameinfoLocalPath: string | null;
  rulesheetLocalPath: string | null;
  rulesheetUrl: string | null;
};

type MembershipVideoRow = {
  libraryEntryId: string;
  kind: string;
  label: string;
  url: string;
  priority: number;
};

type MembershipRulesheetLinkRow = {
  libraryEntryId: string;
  label: string;
  url: string;
  priority: number;
};

type MachineVideoLinkRow = {
  practiceIdentity: string;
  provider: string;
  kind: string;
  label: string;
  url: string;
  priority: number;
};

type MachineRulesheetLinkRow = {
  practiceIdentity: string;
  provider: string;
  label: string;
  url: string;
  priority: number;
};

type AdminVideoOverrideRecord = {
  video_override_id: number;
  practice_identity: string;
  kind: string;
  label: string;
  url: string;
  priority: number;
  created_at: string;
  updated_at: string;
};

type AdminVideoAssetRecord = {
  video_asset_id: number;
  opdb_id: string;
  provider: string;
  kind: string;
  label: string;
  url: string;
  priority: number;
  is_hidden: number;
  is_active: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type AdminRulesheetAssetRecord = {
  rulesheet_asset_id: number;
  opdb_id: string;
  provider: string;
  label: string;
  url: string | null;
  local_path: string | null;
  source_url: string | null;
  note: string | null;
  priority: number;
  is_hidden: number;
  is_active: number;
  created_at: string;
  updated_at: string;
};

type AdminGameinfoAssetRecord = {
  gameinfo_asset_id: number;
  opdb_id: string;
  provider: string;
  label: string;
  local_path: string | null;
  priority: number;
  is_hidden: number;
  is_active: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type ControlBoardRow = {
  practiceIdentity: string;
  opdbMachineId: string | null;
  opdbGroupId: string | null;
  slug: string;
  name: string;
  variant: string | null;
  manufacturer: string | null;
  year: number | null;
  primaryImageUrl: string | null;
  playfieldImageUrl: string | null;
  libraryEntryId: string | null;
  sourceId: string | null;
  sourceName: string | null;
  sourceType: string | null;
  area: string | null;
  areaOrder: number | null;
  groupNumber: number | null;
  position: number | null;
  bank: number | null;
  membershipCount: number;
  membershipPlayfieldImageUrl: string | null;
  membershipRulesheetUrl: string | null;
  membershipRulesheetLocalPath: string | null;
  membershipGameinfoLocalPath: string | null;
  hasOpdbPlayfield: 0 | 1;
  hasOpdbBackglass: 0 | 1;
  hasBuiltInPlayfield: 0 | 1;
  hasBuiltInRulesheet: 0 | 1;
  hasBuiltInGameinfo: 0 | 1;
  hasAdminOverride: 0 | 1;
  hasAdminPlayfield: 0 | 1;
  hasAdminRulesheet: 0 | 1;
  hasAdminGameinfo: 0 | 1;
  builtInVideoCount: number;
  builtInTutorialCount: number;
  builtInGameplayCount: number;
  builtInCompetitionCount: number;
  catalogVideoCount: number;
  catalogTutorialCount: number;
  catalogGameplayCount: number;
  catalogCompetitionCount: number;
  overrideVideoCount: number;
  overrideTutorialCount: number;
  overrideGameplayCount: number;
  overrideCompetitionCount: number;
  builtInRulesheetLinkCount: number;
  catalogRulesheetLinkCount: number;
  overrideRulesheetLinkCount: number;
};

type MachineAliasRow = {
  opdbMachineId: string;
  slug: string;
  name: string;
  variant: string | null;
  primaryImageUrl: string | null;
  playfieldImageUrl: string | null;
  updatedAt: string | null;
};

type OverrideRecord = {
  practice_identity: string;
  opdb_machine_id: string | null;
  slug: string | null;
  name_override: string | null;
  variant_override: string | null;
  manufacturer_override: string | null;
  year_override: number | null;
  playfield_local_path: string | null;
  playfield_source_url: string | null;
  playfield_source_note: string | null;
  rulesheet_local_path: string | null;
  rulesheet_source_url: string | null;
  rulesheet_source_note: string | null;
  gameinfo_local_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type PlayfieldAssetRecord = {
  playfield_asset_id: number;
  practice_identity: string;
  source_opdb_machine_id: string;
  covered_alias_ids_json: string;
  playfield_local_path: string | null;
  playfield_original_local_path: string | null;
  playfield_reference_local_path: string | null;
  playfield_source_url: string | null;
  playfield_source_page_url: string | null;
  playfield_source_page_snapshot_path: string | null;
  playfield_source_note: string | null;
  playfield_web_local_path_1400: string | null;
  playfield_web_local_path_700: string | null;
  playfield_mask_polygon_json: string | null;
  created_at: string;
  updated_at: string;
};

type PlayfieldMaskPoint = {
  x: number;
  y: number;
};

type ActivityRecord = {
  activity_id: number;
  practice_identity: string;
  action_type: string;
  summary: string;
  details_json: string | null;
  created_at: string;
};

type VenueEntryOverrideRecord = {
  library_entry_id: string;
  source_id: string;
  source_name: string;
  source_type: string;
  practice_identity: string | null;
  opdb_id: string | null;
  area: string | null;
  area_order: number | null;
  group_number: number | null;
  position: number | null;
  bank: number | null;
  name: string;
  variant: string | null;
  manufacturer: string | null;
  year: number | null;
  playfield_image_url: string | null;
  rulesheet_url: string | null;
  tutorial_links_json: string;
  gameplay_links_json: string;
  competition_links_json: string;
  created_at: string;
  updated_at: string;
};

type VenueEntryEditPayload = {
  area: string | null;
  areaOrder: number | null;
  groupNumber: number | null;
  position: number | null;
  bank: number | null;
  name: string;
  variant: string | null;
  manufacturer: string | null;
  year: number | null;
  playfieldImageUrl: string | null;
  rulesheetUrl: string | null;
  tutorialLinks: string[];
  gameplayLinks: string[];
  competitionLinks: string[];
};

type VenueSourceMeta = {
  sourceId: string;
  sourceName: string;
  venueLocation: string | null;
  pmLocationId: string | null;
};

type WorkspaceStateRecord = {
  workspace_key: string;
  note_text: string | null;
  updated_at: string;
};

type PinsidePhotoBrowserSessionState = {
  child: ChildProcess | null;
  practiceIdentity: string;
  searchTerm: string;
  searchMode: "machine-key" | "machine-slug" | "game-search";
  machineKey: string | null;
  machineSlug: string | null;
  resolvedBy: string | null;
  machineSlugCandidates: string[];
  viewerUrl: string;
  logPath: string;
  manifestPath: string;
  stateFilePath: string;
  host: string;
  port: number;
  launchedAt: string;
  status: "starting" | "running" | "exited" | "failed";
  exitCode: number | null;
  signal: NodeJS.Signals | null;
};

type PinsideSavedFinalRecord = {
  adId: string;
  adTitle: string | null;
  adUrl: string | null;
  photoIndex: number | null;
  filename: string | null;
  previewUrl: string | null;
  fullUrl: string | null;
  originalUrl: string | null;
  selectedAt: string | null;
  savedAt: string | null;
};

type PinsideAuditLookupEntry = {
  game: string;
  variant: string | null;
  manufacturer: string | null;
  year: string | null;
  pinsideId: string;
  pinsideSlug: string | null;
  pinsideGroup: string | null;
  sourceFile: string | null;
};

type PinsideAuditLookupIndex = {
  byFingerprint: Map<string, PinsideAuditLookupEntry[]>;
};

type PinsideLaunchTarget = {
  searchTerm: string;
  gameQuery: string;
  expectedTitle: string;
  expectedManufacturer: string | null;
  expectedYear: string | null;
  searchMode: "machine-key" | "machine-slug" | "game-search";
  machineKey: string | null;
  machineSlug: string | null;
  resolvedBy: string | null;
  machineSlugCandidates: string[];
};

type PinballLayoutMode = "workspace" | "legacy";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function cleanEnvPath(value: string | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? path.resolve(trimmed) : null;
}

function pathExists(candidate: string): boolean {
  return fs.existsSync(candidate);
}

function normalizeRulesheetAssetUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.host.toLowerCase().replace(/^www\./, "");
    const scheme = parsed.protocol === "http:" || parsed.protocol === "https:" ? "https:" : parsed.protocol;
    const pathname = parsed.pathname || "/";
    return `${scheme}//${host}${pathname}`;
  } catch {
    return rawUrl.trim();
  }
}

function isGeneratedRulesheetProviderUrl(rawUrl: string): boolean {
  const normalized = normalizeRulesheetAssetUrl(rawUrl).toLowerCase();
  return (
    normalized.includes("tiltforums.com/") ||
    normalized.includes("pinballprimer.github.io/") ||
    normalized.includes("pinballprimer.com/") ||
    normalized.includes("pinball.org/") ||
    normalized.includes("silverballmania.com/") ||
    normalized.includes("flippers.be/")
  );
}

function firstExistingPath(candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const normalized = cleanEnvPath(candidate ?? undefined);
    if (normalized && pathExists(normalized)) {
      return normalized;
    }
  }
  return null;
}

function resolveWorkspaceRoot(appRoot: string): string {
  const configured = cleanEnvPath(process.env.PINPROF_ADMIN_WORKSPACE_ROOT);
  if (configured) return configured;
  const candidates = [path.resolve(path.join(appRoot, "../..")), path.resolve(path.join(appRoot, ".."))];
  return (
    candidates.find((candidate) =>
      [
        path.join(candidate, "workspace"),
        path.join(candidate, "shared", "pinball"),
        path.join(candidate, "scripts"),
        path.join(candidate, "tools"),
      ].some((probe) => pathExists(probe)),
    ) ?? candidates[0]
  );
}

function resolveLegacyWebsiteRoot(root: string): string {
  const configured = cleanEnvPath(process.env.PINPROF_ADMIN_LEGACY_WEBSITE_ROOT);
  if (configured) return configured;
  if (pathExists(path.join(root, "shared", "pinball"))) {
    return root;
  }
  return path.resolve(path.join(root, "../Pillyliu Pinball Website"));
}

const APP_ROOT = path.resolve(process.env.PINPROF_ADMIN_APP_ROOT ?? path.join(__dirname, ".."));
const ROOT = resolveWorkspaceRoot(APP_ROOT);
const LEGACY_WEBSITE_ROOT = resolveLegacyWebsiteRoot(ROOT);
const DIST_DIR = path.join(APP_ROOT, "dist");
const WORKSPACE_DIR = path.join(ROOT, "workspace");
const SHARED_PINBALL_DIR_OVERRIDE = cleanEnvPath(process.env.PINPROF_ADMIN_SHARED_PINBALL_DIR);
const LEGACY_SHARED_PINBALL_DIR = path.join(ROOT, "shared", "pinball");
const PINBALL_LAYOUT_MODE: PinballLayoutMode =
  SHARED_PINBALL_DIR_OVERRIDE || (!pathExists(WORKSPACE_DIR) && pathExists(LEGACY_SHARED_PINBALL_DIR))
    ? "legacy"
    : "workspace";
const SHARED_PINBALL_DIR = path.resolve(SHARED_PINBALL_DIR_OVERRIDE ?? LEGACY_SHARED_PINBALL_DIR);
const SOURCE_DATA_DIR =
  PINBALL_LAYOUT_MODE === "workspace" ? path.join(WORKSPACE_DIR, "data", "source") : path.join(SHARED_PINBALL_DIR, "data");
const PUBLISHED_DATA_DIR =
  PINBALL_LAYOUT_MODE === "workspace" ? path.join(WORKSPACE_DIR, "data", "published") : path.join(SHARED_PINBALL_DIR, "data");
const MANIFESTS_DIR =
  PINBALL_LAYOUT_MODE === "workspace" ? path.join(WORKSPACE_DIR, "manifests") : SHARED_PINBALL_DIR;
const SHARED_DATA_DIR = PINBALL_LAYOUT_MODE === "workspace" ? path.join(WORKSPACE_DIR, "db") : path.join(SHARED_PINBALL_DIR, "data");
const LEGACY_SHARED_DATA_DIR = path.join(LEGACY_WEBSITE_ROOT, "shared", "pinball", "data");
const PUBLISHED_DATA_DEPLOY_MIRROR_DIR =
  PINBALL_LAYOUT_MODE === "workspace" && path.resolve(LEGACY_SHARED_DATA_DIR) !== path.resolve(PUBLISHED_DATA_DIR)
    ? LEGACY_SHARED_DATA_DIR
    : null;
const SHARED_RULESHEETS_DIR =
  PINBALL_LAYOUT_MODE === "workspace"
    ? path.join(WORKSPACE_DIR, "assets", "rulesheets")
    : path.join(SHARED_PINBALL_DIR, "rulesheets");
const SHARED_GAMEINFO_DIR =
  PINBALL_LAYOUT_MODE === "workspace" ? path.join(WORKSPACE_DIR, "assets", "gameinfo") : path.join(SHARED_PINBALL_DIR, "gameinfo");
const SHARED_PLAYFIELDS_DIR =
  PINBALL_LAYOUT_MODE === "workspace"
    ? path.join(WORKSPACE_DIR, "assets", "playfields")
    : path.join(SHARED_PINBALL_DIR, "images", "playfields");
const LEGACY_SHARED_PLAYFIELDS_DIR = path.join(LEGACY_WEBSITE_ROOT, "shared", "pinball", "images", "playfields");
const PLAYFIELD_DEPLOY_MIRROR_DIR =
  PINBALL_LAYOUT_MODE === "workspace" && path.resolve(LEGACY_SHARED_PLAYFIELDS_DIR) !== path.resolve(SHARED_PLAYFIELDS_DIR)
    ? LEGACY_SHARED_PLAYFIELDS_DIR
    : null;
const PLAYFIELD_SOURCE_ROOT_DIR = path.join(WORKSPACE_DIR, "assets", "playfield_sources");
const PLAYFIELD_SOURCE_ORIGINALS_DIR = path.join(PLAYFIELD_SOURCE_ROOT_DIR, "originals");
const PLAYFIELD_SOURCE_REFERENCES_DIR = path.join(PLAYFIELD_SOURCE_ROOT_DIR, "references");
const SHARED_BACKGLASSES_DIR =
  PINBALL_LAYOUT_MODE === "workspace"
    ? path.join(WORKSPACE_DIR, "assets", "backglasses")
    : path.join(SHARED_PINBALL_DIR, "images", "backglasses");
const SEED_DB_PATH = path.join(SHARED_DATA_DIR, "pinball_library_seed_v1.sqlite");
const ADMIN_DB_PATH = path.join(SHARED_DATA_DIR, "pinprof_admin_v1.sqlite");
const APPLY_OVERRIDES_SCRIPT =
  cleanEnvPath(process.env.PINPROF_ADMIN_APPLY_OVERRIDES_SCRIPT) ??
  firstExistingPath([
    path.join(ROOT, "scripts", "publish", "apply-admin-overrides.mjs"),
    path.join(ROOT, "tools", "pinprof", "apply-admin-overrides.mjs"),
    path.join(LEGACY_WEBSITE_ROOT, "tools", "pinprof", "apply-admin-overrides.mjs"),
  ]) ??
  path.join(ROOT, "scripts", "publish", "apply-admin-overrides.mjs");
const EXPORT_LIBRARY_SEED_OVERRIDES_SCRIPT =
  cleanEnvPath(process.env.PINPROF_ADMIN_EXPORT_LIBRARY_SEED_OVERRIDES_SCRIPT) ??
  firstExistingPath([
    path.join(ROOT, "scripts", "publish", "export_library_seed_overrides.py"),
    path.join(ROOT, "tools", "pinprof", "export_library_seed_overrides.py"),
    path.join(LEGACY_WEBSITE_ROOT, "tools", "pinprof", "export_library_seed_overrides.py"),
  ]) ??
  path.join(ROOT, "scripts", "publish", "export_library_seed_overrides.py");
const PINBALL_WEB_PATH_MAPPINGS = [
  { prefix: "/pinball/images/playfields/", dir: SHARED_PLAYFIELDS_DIR },
  { prefix: "/pinball/images/backglasses/", dir: SHARED_BACKGLASSES_DIR },
  { prefix: "/pinball/rulesheets/", dir: SHARED_RULESHEETS_DIR },
  { prefix: "/pinball/gameinfo/", dir: SHARED_GAMEINFO_DIR },
];
const PINBALL_ROOT_FILE_CANDIDATES = {
  "cache-manifest.json": [path.join(PUBLISHED_DATA_DIR, "cache-manifest.json"), path.join(MANIFESTS_DIR, "cache-manifest.json")],
  "cache-update-log.json": [
    path.join(PUBLISHED_DATA_DIR, "cache-update-log.json"),
    path.join(MANIFESTS_DIR, "cache-update-log.json"),
  ],
} as const;
const DEPLOY_MIRRORED_PUBLISHED_DATA_FILES = ["pinball_library_seed_overrides_v1.json"] as const;
const DEPLOY_MIRRORED_SQLITE_FILES = ["pinprof_admin_v1.sqlite", "pinball_library_seed_v1.sqlite"] as const;
const SESSION_COOKIE = "pinprof_admin_session";
const SESSION_SECRET = process.env.PINPROF_SESSION_SECRET ?? "pinprof-dev-secret";
const ADMIN_PASSWORD = process.env.PINPROF_ADMIN_PASSWORD ?? "change-me";
const PASSWORD_CONFIGURED = Boolean(process.env.PINPROF_ADMIN_PASSWORD);
const PORT = Number.parseInt(process.env.PINPROF_ADMIN_PORT ?? "8787", 10);
const SUPPORTED_PLAYFIELD_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"] as const;
const PLAYFIELD_WEBP_QUALITY = 90;
const PLAYFIELD_WEBP_1400_QUALITY = 85;
const PLAYFIELD_WEBP_700_QUALITY = 75;
const PLAYFIELD_TRIM_THRESHOLD = 18;
const PLAYFIELD_MASK_POINT_MIN = 0;
const PLAYFIELD_MASK_POINT_MAX = 1;
const ALLOWED_VIDEO_KINDS = ["tutorial", "gameplay", "competition"] as const;
const CONTROL_BOARD_STATUS_FILTERS = [
  "used_in_app",
  "has_override",
  "missing_playfield",
  "missing_backglass",
  "missing_rulesheet",
  "missing_videos",
] as const;
const PINSIDE_BROWSER_SCRIPT =
  cleanEnvPath(process.env.PINPROF_ADMIN_PINSIDE_BROWSER_SCRIPT) ??
  firstExistingPath([
    path.join(ROOT, "scripts", "search", "pinside_photo_browser.py"),
    path.join(LEGACY_WEBSITE_ROOT, "scripts", "search", "pinside_photo_browser.py"),
  ]) ??
  path.join(ROOT, "scripts", "search", "pinside_photo_browser.py");
const PINSIDE_LINK_AUDIT_REPORT_PATH =
  firstExistingPath([
    path.join(PUBLISHED_DATA_DIR, "pinside_link_audit_report.json"),
    path.join(MANIFESTS_DIR, "pinside_link_audit_report.json"),
  ]) ?? path.join(PUBLISHED_DATA_DIR, "pinside_link_audit_report.json");
const PINSIDE_BROWSER_HOST = process.env.PINPROF_ADMIN_PINSIDE_HOST ?? "127.0.0.1";
const PINSIDE_BROWSER_PORT = Math.max(1024, Number.parseInt(process.env.PINPROF_ADMIN_PINSIDE_PORT ?? "8765", 10) || 8765);
const PINSIDE_BROWSER_DISCOVERY_LIMIT = Math.max(
  0,
  Number.parseInt(process.env.PINPROF_ADMIN_PINSIDE_DISCOVERY_LIMIT ?? "0", 10) || 0,
);
const PINSIDE_BROWSER_INITIAL_AD_LIMIT = Math.max(
  1,
  Number.parseInt(process.env.PINPROF_ADMIN_PINSIDE_INITIAL_AD_LIMIT ?? "1", 10) || 1,
);
const PINSIDE_BROWSER_STARTUP_TARGET_LIMIT = Math.max(
  1,
  Number.parseInt(process.env.PINPROF_ADMIN_PINSIDE_STARTUP_TARGET_LIMIT ?? "20", 10) || 20,
);
const PINSIDE_BROWSER_PREFETCH_WINDOW = Math.max(
  1,
  Number.parseInt(process.env.PINPROF_ADMIN_PINSIDE_PREFETCH_WINDOW ?? "5", 10) || 5,
);
const PINSIDE_BROWSER_LOGIN_WAIT_SECONDS = Math.max(
  8,
  Number.parseInt(process.env.PINPROF_ADMIN_PINSIDE_LOGIN_WAIT_SECONDS ?? "8", 10) || 8,
);
const PINSIDE_BROWSER_PYTHON_BIN = process.env.PINPROF_ADMIN_PYTHON_BIN ?? "python3";
const PINSIDE_BROWSER_PREFER_HEADLESS = /^(1|true|yes)$/i.test(process.env.PINPROF_ADMIN_PINSIDE_PREFER_HEADLESS ?? "");
const PINSIDE_BROWSER_FORCE_HEADED = /^(1|true|yes)$/i.test(process.env.PINPROF_ADMIN_PINSIDE_FORCE_HEADED ?? "");
const PINSIDE_BROWSER_ALLOW_VISIBLE_RETRY = /^(1|true|yes)$/i.test(process.env.PINPROF_ADMIN_PINSIDE_ALLOW_VISIBLE_RETRY ?? "1");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function nowIso(): string {
  return new Date().toISOString();
}

function cleanString(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function cleanInteger(value: unknown): number | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const num = Number.parseInt(trimmed, 10);
  return Number.isFinite(num) ? num : null;
}

function normalizePinsideOriginalUrl(value: unknown): string | null {
  const trimmed = cleanString(value);
  if (!trimmed) return null;
  if (/^https?:\/\/o\.pinside\.com\//i.test(trimmed)) {
    return trimmed;
  }

  const pathValue = trimmed.replace(/^\/+/, "");
  const originalAssetPathPattern = /^[0-9a-f]{1,3}(?:\/[0-9a-f]{1,3}){2,}\/[^?#]+\.(?:jpe?g|png|webp|gif|bmp|avif)$/i;
  if (originalAssetPathPattern.test(pathValue)) {
    return `https://o.pinside.com/${pathValue}`;
  }

  try {
    const parsed = new URL(trimmed, "https://pinside.com");
    const archivePrefix = "/pinball/market/classifieds/archive/";
    if (/(^|\.)pinside\.com$/i.test(parsed.hostname) && parsed.pathname.startsWith(archivePrefix)) {
      const suffix = parsed.pathname.slice(archivePrefix.length).replace(/^\/+/, "");
      if (originalAssetPathPattern.test(suffix)) {
        return `https://o.pinside.com/${suffix}`;
      }
    }
    return parsed.href;
  } catch {
    return trimmed;
  }
}

function normalizeHttpUrl(value: unknown, label: string): string {
  const trimmed = cleanString(value);
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`${label} must use http or https.`);
    }
    return parsed.toString();
  } catch (error) {
    if (error instanceof Error && error.message.includes("must use http or https")) {
      throw error;
    }
    throw new Error(`${label} must be a valid http(s) URL.`);
  }
}

function normalizeOptionalHttpUrl(value: unknown, label: string): string | null {
  const trimmed = cleanString(value);
  return trimmed ? normalizeHttpUrl(trimmed, label) : null;
}

function normalizeVideoKind(value: unknown, contextLabel: string): (typeof ALLOWED_VIDEO_KINDS)[number] {
  const normalized = cleanString(value)?.toLowerCase();
  if (!normalized) {
    throw new Error(`${contextLabel} is required.`);
  }
  if (!ALLOWED_VIDEO_KINDS.includes(normalized as (typeof ALLOWED_VIDEO_KINDS)[number])) {
    throw new Error(`${contextLabel} must be tutorial, gameplay, or competition.`);
  }
  return normalized as (typeof ALLOWED_VIDEO_KINDS)[number];
}

function parseQueryStringList(value: unknown): string[] {
  const rawItems = Array.isArray(value) ? value : value == null ? [] : [value];
  return Array.from(
    new Set(
      rawItems
        .flatMap((item) => String(item ?? "").split(","))
        .map((item) => cleanString(item))
        .filter((item): item is string => Boolean(item)),
    ),
  );
}

function parseControlBoardStatusFilters(value: unknown): Array<(typeof CONTROL_BOARD_STATUS_FILTERS)[number]> {
  const valid = new Set<string>(CONTROL_BOARD_STATUS_FILTERS);
  return parseQueryStringList(value).filter(
    (item): item is (typeof CONTROL_BOARD_STATUS_FILTERS)[number] => valid.has(item),
  );
}

function buildControlBoardStatusClauses(statuses: Array<(typeof CONTROL_BOARD_STATUS_FILTERS)[number]>) {
  return statuses.map((status) => {
    if (status === "used_in_app") {
      return `coalesce(mc.membershipCount, 0) > 0`;
    }
    if (status === "has_override") {
      return `(mo.practice_identity IS NOT NULL OR coalesce(apc.playfieldAssetCount, 0) > 0 OR coalesce(ovc.overrideVideoCount, 0) > 0)`;
    }
    if (status === "missing_playfield") {
      return `
        coalesce(apc.playfieldAssetCount, 0) = 0
        AND (b.playfield_local_path IS NULL OR trim(b.playfield_local_path) = '')
        AND (c.playfieldImageUrl IS NULL OR trim(c.playfieldImageUrl) = '')
      `;
    }
    if (status === "missing_backglass") {
      return `(c.primaryImageUrl IS NULL OR trim(c.primaryImageUrl) = '')`;
    }
    if (status === "missing_rulesheet") {
      return `
        (mo.rulesheet_local_path IS NULL OR trim(mo.rulesheet_local_path) = '')
        AND (b.rulesheet_local_path IS NULL OR trim(b.rulesheet_local_path) = '')
        AND (b.rulesheet_url IS NULL OR trim(b.rulesheet_url) = '')
        AND coalesce(mrc.builtInRulesheetLinkCount, 0) = 0
        AND coalesce(crc.catalogRulesheetLinkCount, 0) = 0
        AND coalesce(orc.overrideRulesheetLinkCount, 0) = 0
      `;
    }
    return `
      coalesce(mvc.builtInVideoCount, 0) = 0
      AND coalesce(cvc.catalogVideoCount, 0) = 0
      AND coalesce(ovc.overrideVideoCount, 0) = 0
    `;
  });
}

function normalizeLooseText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePinsideVariant(value: unknown): string {
  const normalized = normalizeLooseText(value)
    .replace(/\blimited edition\b/g, "le")
    .replace(/\bcollector'?s edition\b/g, "ce")
    .replace(/\bcollectors edition\b/g, "ce")
    .trim();
  if (!normalized) return "";
  if (/\bpro\b/.test(normalized)) return "pro";
  if (/\bpremium\b/.test(normalized)) return "premium";
  if (/\ble\b/.test(normalized)) return "le";
  if (/\bce\b/.test(normalized)) return "ce";
  if (/\bse\b/.test(normalized)) return "se";
  if (/\bgold\b/.test(normalized)) return "gold";
  return normalized;
}

function normalizePinsideManufacturer(value: unknown): string {
  let normalized = normalizeLooseText(value);
  if (normalized === "pb") return "pinball brothers";
  if (normalized === "jjp") return "jersey jack pinball";
  normalized = normalized
    .replace(/\bllc\b/g, "")
    .replace(/\bpinball inc\b/g, "")
    .replace(/\binc\b/g, "")
    .replace(/\bcompany\b/g, "")
    .replace(/\bco\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized === "stern pinball") return "stern";
  if (normalized === "chicago gaming company") return "chicago gaming";
  if (normalized === "spooky pinball") return "spooky";
  return normalized;
}

function buildPinsideFingerprint(
  name: string | null | undefined,
  variant: string | null | undefined,
  manufacturer: string | null | undefined,
  year: string | number | null | undefined,
): string {
  const normalizedName = normalizeLooseText(name);
  if (!normalizedName) return "";
  const normalizedVariant = normalizePinsideVariant(variant);
  const normalizedManufacturer = normalizePinsideManufacturer(manufacturer);
  const normalizedYear = cleanString(year)?.trim() ?? "";
  return [normalizedName, normalizedVariant, normalizedManufacturer, normalizedYear].join("|");
}

function buildSlugCandidates(
  slug: string | null | undefined,
  manufacturer: string | null | undefined,
  fallbackTitle: string | null | undefined,
  fallbackVariant: string | null | undefined,
  fallbackYear: string | number | null | undefined,
): string[] {
  const candidates = new Set<string>();
  const manufacturerSlug = normalizeLooseText(manufacturer).replace(/\s+/g, "-");
  const titleSlug = normalizeLooseText(fallbackTitle).replace(/\s+/g, "-");
  const variantSlug = normalizePinsideVariant(fallbackVariant);
  const yearSlug = fallbackYear == null ? "" : String(fallbackYear).trim();

  const addSlug = (value: string | null | undefined) => {
    const normalized = cleanString(value)?.toLowerCase();
    if (!normalized) return;
    candidates.add(normalized);
    const withoutYear = normalized.replace(/-\d{4}$/, "");
    if (withoutYear) candidates.add(withoutYear);
    if (manufacturerSlug) {
      const manufacturerPrefix = `${manufacturerSlug}-`;
      if (normalized.startsWith(manufacturerPrefix)) {
        candidates.add(normalized.slice(manufacturerPrefix.length));
      }
      if (withoutYear.startsWith(manufacturerPrefix)) {
        candidates.add(withoutYear.slice(manufacturerPrefix.length));
      }
    }
  };

  addSlug(slug);
  if (titleSlug) {
    if (manufacturerSlug && yearSlug) {
      addSlug(`${manufacturerSlug}-${titleSlug}-${yearSlug}`);
      if (variantSlug) {
        addSlug(`${manufacturerSlug}-${titleSlug}-${variantSlug}-${yearSlug}`);
      }
    }
    if (yearSlug) {
      addSlug(`${titleSlug}-${yearSlug}`);
      if (variantSlug) {
        addSlug(`${titleSlug}-${variantSlug}-${yearSlug}`);
      }
    }
    addSlug(titleSlug);
    if (variantSlug) {
      addSlug(`${titleSlug}-${variantSlug}`);
    }
    if (manufacturerSlug) {
      addSlug(`${manufacturerSlug}-${titleSlug}`);
      if (variantSlug) {
        addSlug(`${manufacturerSlug}-${titleSlug}-${variantSlug}`);
      }
    }
  }

  return Array.from(candidates)
    .filter(Boolean)
    .sort((left, right) => {
      const score = (value: string) => {
        let result = value.split("-").length;
        if (titleSlug && value.includes(titleSlug)) result += 8;
        if (manufacturerSlug && value.includes(manufacturerSlug)) result += 5;
        if (yearSlug && value.includes(yearSlug)) result += 5;
        if (variantSlug && value.includes(variantSlug)) result += 3;
        if (titleSlug && value === titleSlug) result -= 12;
        return result;
      };
      return score(right) - score(left);
    });
}

function readJsonFileSafe(filePath: string | null): unknown {
  if (!filePath || !pathExists(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function loadPinsideAuditLookupIndex(): PinsideAuditLookupIndex {
  const index: PinsideAuditLookupIndex = {
    byFingerprint: new Map<string, PinsideAuditLookupEntry[]>(),
  };
  const raw = readJsonFileSafe(PINSIDE_LINK_AUDIT_REPORT_PATH) as
    | {
        results?: Array<{
          source_file?: string;
          sheet?: {
            game?: string;
            variant?: string;
            manufacturer?: string;
            year?: string;
          };
          resolved?: {
            pinside_id?: string;
            pinside_slug?: string;
            pinside_group?: string;
          } | null;
        }>;
      }
    | null;
  for (const result of raw?.results ?? []) {
    const pinsideId = cleanString(result.resolved?.pinside_id);
    const game = cleanString(result.sheet?.game);
    if (!pinsideId || !game) continue;
    const entry: PinsideAuditLookupEntry = {
      game,
      variant: cleanString(result.sheet?.variant),
      manufacturer: cleanString(result.sheet?.manufacturer),
      year: cleanString(result.sheet?.year),
      pinsideId,
      pinsideSlug: cleanString(result.resolved?.pinside_slug),
      pinsideGroup: cleanString(result.resolved?.pinside_group),
      sourceFile: cleanString(result.source_file),
    };
    const fingerprint = buildPinsideFingerprint(entry.game, entry.variant, entry.manufacturer, entry.year);
    if (!fingerprint) continue;
    const existing = index.byFingerprint.get(fingerprint) ?? [];
    existing.push(entry);
    index.byFingerprint.set(fingerprint, existing);
  }
  return index;
}

const PINSIDE_AUDIT_LOOKUP_INDEX = loadPinsideAuditLookupIndex();

function escapeSqlitePath(value: string): string {
  return value.replace(/'/g, "''");
}

function createSessionToken() {
  const payload = JSON.stringify({ issuedAt: nowIso() });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(value: string | undefined): boolean {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  if (expected.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function toPinballFsPath(webPath: string | null): string | null {
  const normalized = String(webPath ?? "").trim();
  if (!normalized.startsWith("/pinball/")) return null;
  const alternatePlayfieldWebpPath = normalized.startsWith("/pinball/images/playfields/")
    ? normalized.replace(/(\/pinball\/images\/playfields\/.+?)(?:_(700|1400))?\.[A-Za-z0-9]+$/i, "$1.webp")
    : null;
  if (PINBALL_LAYOUT_MODE === "legacy") {
    const relative = normalized.replace(/^\/pinball\/?/, "");
    const fsPath = path.resolve(SHARED_PINBALL_DIR, relative);
    if (!fsPath.startsWith(path.resolve(SHARED_PINBALL_DIR))) return null;
    if (fs.existsSync(fsPath) || !alternatePlayfieldWebpPath || alternatePlayfieldWebpPath === normalized) return fsPath;
    const altRelative = alternatePlayfieldWebpPath.replace(/^\/pinball\/?/, "");
    const altFsPath = path.resolve(SHARED_PINBALL_DIR, altRelative);
    return altFsPath.startsWith(path.resolve(SHARED_PINBALL_DIR)) ? altFsPath : fsPath;
  }
  for (const mapping of PINBALL_WEB_PATH_MAPPINGS) {
    if (!normalized.startsWith(mapping.prefix)) continue;
    const relative = normalized.slice(mapping.prefix.length);
    const fsPath = path.resolve(mapping.dir, relative);
    if (!fsPath.startsWith(path.resolve(mapping.dir))) return null;
    if (fs.existsSync(fsPath) || !alternatePlayfieldWebpPath || alternatePlayfieldWebpPath === normalized) return fsPath;
    if (!alternatePlayfieldWebpPath.startsWith(mapping.prefix)) return fsPath;
    const altRelative = alternatePlayfieldWebpPath.slice(mapping.prefix.length);
    const altFsPath = path.resolve(mapping.dir, altRelative);
    return altFsPath.startsWith(path.resolve(mapping.dir)) ? altFsPath : fsPath;
  }
  return null;
}

function inferImageExtension(sourceName: string | null, contentType: string | null): string {
  const contentMap: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
  };
  const fromType = contentType ? contentMap[contentType.toLowerCase()] : null;
  if (fromType) return fromType;
  let extSource = cleanString(sourceName) ?? "";
  if (/^https?:\/\//i.test(extSource)) {
    try {
      extSource = new URL(extSource).pathname;
    } catch {
      extSource = cleanString(sourceName) ?? "";
    }
  }
  const ext = extSource ? path.extname(extSource).toLowerCase() : "";
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(ext)) {
    return ext === ".jpeg" ? ".jpg" : ext;
  }
  return ".jpg";
}

async function ensureDir(dir: string) {
  await fsp.mkdir(dir, { recursive: true });
}

function playfieldBaseName(aliasId: string) {
  return `${aliasId}-playfield`;
}

function practicePlayfieldBaseName(practiceIdentity: string) {
  return `${practiceIdentity}-playfield`;
}

function playfieldBaseNameFromWebPath(webPath: string | null): string | null {
  const normalized = cleanString(webPath);
  if (!normalized?.startsWith("/pinball/images/playfields/")) return null;
  const filename = path.basename(normalized);
  const ext = path.extname(filename);
  const stem = ext ? filename.slice(0, -ext.length) : filename;
  return stem.replace(/_(700|1400)$/i, "") || null;
}

function normalizeAliasIds(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => cleanString(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function stringifyCoveredAliasIds(aliasIds: string[]): string {
  return JSON.stringify(normalizeAliasIds(aliasIds));
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

function scorePlayfieldSourceMatch(requestedOpdbId: string | null, sourceOpdbId: string | null) {
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

function findExistingPlayfieldWebPath(baseName: string): string | null {
  for (const ext of SUPPORTED_PLAYFIELD_EXTENSIONS) {
    const fsPath = path.join(SHARED_PLAYFIELDS_DIR, `${baseName}${ext}`);
    if (fs.existsSync(fsPath)) {
      return `/pinball/images/playfields/${baseName}${ext}`;
    }
  }
  return null;
}

function buildPlayfieldAssetPaths(baseName: string, sourceExtension = ".jpg") {
  return {
    publishedFsPath: path.join(SHARED_PLAYFIELDS_DIR, `${baseName}.webp`),
    publishedWebPath: `/pinball/images/playfields/${baseName}.webp`,
    published1400FsPath: path.join(SHARED_PLAYFIELDS_DIR, `${baseName}_1400.webp`),
    published1400WebPath: `/pinball/images/playfields/${baseName}_1400.webp`,
    published700FsPath: path.join(SHARED_PLAYFIELDS_DIR, `${baseName}_700.webp`),
    published700WebPath: `/pinball/images/playfields/${baseName}_700.webp`,
    originalFsPath: path.join(PLAYFIELD_SOURCE_ORIGINALS_DIR, `${baseName}.original${sourceExtension}`),
    referenceFsPath: path.join(PLAYFIELD_SOURCE_REFERENCES_DIR, `${baseName}.source.json`),
    sourcePageSnapshotFsPath: path.join(PLAYFIELD_SOURCE_REFERENCES_DIR, `${baseName}.ad.html`),
  };
}

function playfieldSourceExtension(originalPath: string | null) {
  const normalized = cleanString(originalPath);
  const ext = normalized ? path.extname(normalized).toLowerCase() : "";
  return ext && SUPPORTED_PLAYFIELD_EXTENSIONS.includes(ext as (typeof SUPPORTED_PLAYFIELD_EXTENSIONS)[number]) ? ext : ".jpg";
}

function parsePlayfieldMaskPolygonJson(value: string | null): PlayfieldMaskPoint[] | null {
  const normalized = cleanString(value);
  if (!normalized) return null;
  try {
    const parsed = JSON.parse(normalized);
    if (!Array.isArray(parsed)) return null;
    const points = parsed.flatMap((point) => {
      if (!point || typeof point !== "object") return [];
      const x = Number((point as { x?: unknown }).x);
      const y = Number((point as { y?: unknown }).y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
      return [{
        x: Math.max(PLAYFIELD_MASK_POINT_MIN, Math.min(PLAYFIELD_MASK_POINT_MAX, x)),
        y: Math.max(PLAYFIELD_MASK_POINT_MIN, Math.min(PLAYFIELD_MASK_POINT_MAX, y)),
      }];
    });
    return points.length >= 3 ? points : null;
  } catch {
    return null;
  }
}

function normalizePlayfieldMaskPoints(value: unknown): PlayfieldMaskPoint[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) {
    throw new Error("Mask polygon must be an array of points.");
  }
  if (!value.length) return null;
  const points = value.map((point, index) => {
    if (!point || typeof point !== "object") {
      throw new Error(`Mask point ${index + 1} is invalid.`);
    }
    const x = Number((point as { x?: unknown }).x);
    const y = Number((point as { y?: unknown }).y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`Mask point ${index + 1} must include numeric x and y.`);
    }
    if (x < PLAYFIELD_MASK_POINT_MIN || x > PLAYFIELD_MASK_POINT_MAX || y < PLAYFIELD_MASK_POINT_MIN || y > PLAYFIELD_MASK_POINT_MAX) {
      throw new Error(`Mask point ${index + 1} must stay within the editor border range.`);
    }
    return { x, y };
  });
  if (points.length < 3) {
    throw new Error("Mask polygon needs at least 3 points.");
  }
  return points;
}

function stringifyPlayfieldMaskPoints(points: PlayfieldMaskPoint[] | null): string | null {
  return points?.length ? JSON.stringify(points) : null;
}

function buildPlayfieldMaskSvg(points: PlayfieldMaskPoint[], width: number, height: number) {
  const polygon = points
    .map((point) => `${(point.x * width).toFixed(2)},${(point.y * height).toFixed(2)}`)
    .join(" ");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><polygon points="${polygon}" fill="white"/></svg>`,
    "utf8",
  );
}

function buildPlayfieldMaskCropBounds(points: PlayfieldMaskPoint[], width: number, height: number) {
  const xs = points.map((point) => Math.max(0, Math.min(1, point.x)) * width);
  const ys = points.map((point) => Math.max(0, Math.min(1, point.y)) * height);
  const left = Math.max(0, Math.min(width - 1, Math.floor(Math.min(...xs))));
  const top = Math.max(0, Math.min(height - 1, Math.floor(Math.min(...ys))));
  const right = Math.max(left + 1, Math.min(width, Math.ceil(Math.max(...xs))));
  const bottom = Math.max(top + 1, Math.min(height, Math.ceil(Math.max(...ys))));
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

async function removePrefixedFiles(dir: string, prefix: string) {
  const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(prefix))
      .map((entry) => fsp.rm(path.join(dir, entry.name), { force: true })),
  );
}

async function removeExistingPlayfieldFiles(baseName: string) {
  await Promise.all([
    removePrefixedFiles(SHARED_PLAYFIELDS_DIR, baseName),
    removePrefixedFiles(PLAYFIELD_SOURCE_ORIGINALS_DIR, baseName),
    removePrefixedFiles(PLAYFIELD_SOURCE_REFERENCES_DIR, baseName),
  ]);
}

async function syncPublishedPlayfieldFamilyToDeployMirror(
  baseName: string,
  assetPaths: Pick<
    ReturnType<typeof buildPlayfieldAssetPaths>,
    "publishedFsPath" | "published1400FsPath" | "published700FsPath"
  >,
) {
  if (!PLAYFIELD_DEPLOY_MIRROR_DIR) return;

  await ensureDir(PLAYFIELD_DEPLOY_MIRROR_DIR);

  const targetFiles = [
    assetPaths.publishedFsPath,
    assetPaths.published1400FsPath,
    assetPaths.published700FsPath,
  ].map((sourcePath) => ({
    sourcePath,
    fileName: path.basename(sourcePath),
    targetPath: path.join(PLAYFIELD_DEPLOY_MIRROR_DIR, path.basename(sourcePath)),
  }));

  await Promise.all(
    targetFiles.map(({ sourcePath, targetPath }) => fsp.copyFile(sourcePath, targetPath)),
  );

  const keep = new Set(targetFiles.map(({ fileName }) => fileName));
  const entries = await fsp.readdir(PLAYFIELD_DEPLOY_MIRROR_DIR, { withFileTypes: true }).catch(() => []);
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(baseName) && !keep.has(entry.name))
      .map((entry) => fsp.rm(path.join(PLAYFIELD_DEPLOY_MIRROR_DIR, entry.name), { force: true })),
  );
}

async function renamePrefixedFiles(dir: string, currentBase: string, nextBase: string) {
  const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
  const family = entries.filter((entry) => entry.isFile() && entry.name.startsWith(currentBase));
  if (!family.length) return;

  const conflicts = family.filter((entry) => fs.existsSync(path.join(dir, entry.name.replace(currentBase, nextBase))));
  if (conflicts.length) {
    throw new Error(`Cannot rename ${currentBase} to ${nextBase}; destination files already exist.`);
  }

  for (const entry of family) {
    const nextName = entry.name.replace(currentBase, nextBase);
    await fsp.rename(path.join(dir, entry.name), path.join(dir, nextName));
  }
}

async function writePlayfieldReferencePackage(
  baseName: string,
  input: {
    originalFsPath: string;
    referenceFsPath: string;
    sourcePageSnapshotFsPath: string;
    sourceUrl: string | null;
    sourcePageUrl: string | null;
    sourceNote: string | null;
    sourceName: string | null;
    contentType: string | null;
    publishedWebPath: string;
    published1400WebPath: string;
    published700WebPath: string;
    maskPoints: PlayfieldMaskPoint[] | null;
  },
) {
  let snapshotPath: string | null = null;
  let snapshotStatus = "not-requested";
  let snapshotError: string | null = null;

  if (input.sourcePageUrl) {
    snapshotStatus = "requested";
    try {
      const response = await fetch(input.sourcePageUrl, {
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "User-Agent": "pinprof-admin/1.0",
        },
      });
      if (!response.ok) {
        throw new Error(`Snapshot fetch failed with ${response.status}`);
      }
      const html = await response.text();
      await fsp.writeFile(input.sourcePageSnapshotFsPath, html, "utf8");
      snapshotPath = input.sourcePageSnapshotFsPath;
      snapshotStatus = "saved";
    } catch (error) {
      snapshotStatus = "failed";
      snapshotError = error instanceof Error ? error.message : "Unknown snapshot error";
    }
  }

  const referencePayload = {
    baseName,
    importedAt: nowIso(),
    originalLocalPath: input.originalFsPath,
    sourceName: input.sourceName,
    contentType: input.contentType,
    sourceUrl: input.sourceUrl,
    sourcePageUrl: input.sourcePageUrl,
    sourceNote: input.sourceNote,
    published: {
      highRes: input.publishedWebPath,
      width1400: input.published1400WebPath,
      width700: input.published700WebPath,
    },
    maskPolygon: input.maskPoints,
    sourcePageSnapshot: {
      status: snapshotStatus,
      localPath: snapshotPath,
      error: snapshotError,
    },
  };

  await fsp.writeFile(input.referenceFsPath, `${JSON.stringify(referencePayload, null, 2)}\n`, "utf8");
  return {
    referencePath: input.referenceFsPath,
    snapshotPath,
  };
}

function resolvePlayfieldEditorFsPath(asset: PlayfieldAssetRecord | null): string | null {
  if (!asset) return null;
  const originalFsPath = cleanString(asset.playfield_original_local_path);
  if (originalFsPath && fs.existsSync(originalFsPath)) {
    return originalFsPath;
  }
  const publishedFsPath = toPinballFsPath(asset.playfield_local_path);
  if (publishedFsPath && fs.existsSync(publishedFsPath)) {
    return publishedFsPath;
  }
  return null;
}

async function publishPlayfieldDerivatives(
  buffer: Buffer,
  assetPaths: ReturnType<typeof buildPlayfieldAssetPaths>,
  maskPoints: PlayfieldMaskPoint[] | null,
) {
  const rotatedBuffer = await sharp(buffer, { failOn: "warning" }).rotate().toBuffer();
  const metadata = await sharp(rotatedBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Could not determine image dimensions for playfield processing.");
  }

  let image = sharp(rotatedBuffer).ensureAlpha();
  if (maskPoints?.length) {
    image = image.composite([
      {
        input: buildPlayfieldMaskSvg(maskPoints, metadata.width, metadata.height),
        blend: "dest-in",
      },
    ]);
  }

  const maskedBuffer = await image.png().toBuffer();
  const compositedBuffer = await sharp({
    create: {
      width: metadata.width,
      height: metadata.height,
      channels: 4,
      background: "#000000",
    },
  })
    .composite([{ input: maskedBuffer }])
    .png()
    .toBuffer();

  let flattened = sharp(compositedBuffer);

  if (maskPoints?.length) {
    flattened = flattened.extract(buildPlayfieldMaskCropBounds(maskPoints, metadata.width, metadata.height));
  } else {
    flattened = flattened.trim({ threshold: PLAYFIELD_TRIM_THRESHOLD });
  }

  const flattenedBuffer = await flattened.removeAlpha().toColourspace("srgb").png().toBuffer();

  await sharp(flattenedBuffer)
    .webp({ quality: PLAYFIELD_WEBP_QUALITY })
    .toFile(assetPaths.publishedFsPath);
  await sharp(flattenedBuffer)
    .resize({ width: 1400, withoutEnlargement: true })
    .webp({ quality: PLAYFIELD_WEBP_1400_QUALITY })
    .toFile(assetPaths.published1400FsPath);
  await sharp(flattenedBuffer)
    .resize({ width: 700, withoutEnlargement: true })
    .webp({ quality: PLAYFIELD_WEBP_700_QUALITY })
    .toFile(assetPaths.published700FsPath);
}

function runApplyOverrides() {
  if (!pathExists(APPLY_OVERRIDES_SCRIPT)) {
    throw new Error(`Apply overrides script not found: ${APPLY_OVERRIDES_SCRIPT}`);
  }
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PINPROF_ADMIN_WORKSPACE_ROOT: ROOT,
  };
  if (PINBALL_LAYOUT_MODE === "legacy" || SHARED_PINBALL_DIR_OVERRIDE) {
    childEnv.PINPROF_ADMIN_SHARED_PINBALL_DIR = SHARED_PINBALL_DIR;
  } else {
    delete childEnv.PINPROF_ADMIN_SHARED_PINBALL_DIR;
  }
  execFileSync("node", [APPLY_OVERRIDES_SCRIPT], {
    cwd: ROOT,
    stdio: "pipe",
    env: childEnv,
  });
  if (pathExists(EXPORT_LIBRARY_SEED_OVERRIDES_SCRIPT)) {
    execFileSync(PINSIDE_BROWSER_PYTHON_BIN, [EXPORT_LIBRARY_SEED_OVERRIDES_SCRIPT], {
      cwd: ROOT,
      stdio: "pipe",
      env: childEnv,
    });
  }
  checkpointWorkspaceSqliteFiles();
  syncPublishedDataFilesToDeployMirror();
}

function checkpointWorkspaceSqliteFiles() {
  try {
    adminDb.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    // Ignore checkpoint failures and fall back to best-effort file mirroring.
  }

  for (const dbPath of [SEED_DB_PATH]) {
    if (!pathExists(dbPath)) continue;
    try {
      const checkpointDb = new Database(dbPath);
      checkpointDb.pragma("wal_checkpoint(TRUNCATE)");
      checkpointDb.close();
    } catch {
      // Ignore checkpoint failures and continue mirroring what we can.
    }
  }
}

function syncPublishedDataFilesToDeployMirror() {
  if (!PUBLISHED_DATA_DEPLOY_MIRROR_DIR) return;
  fs.mkdirSync(PUBLISHED_DATA_DEPLOY_MIRROR_DIR, { recursive: true });
  for (const fileName of DEPLOY_MIRRORED_PUBLISHED_DATA_FILES) {
    const sourcePath = path.join(PUBLISHED_DATA_DIR, fileName);
    if (!pathExists(sourcePath)) continue;
    fs.copyFileSync(sourcePath, path.join(PUBLISHED_DATA_DEPLOY_MIRROR_DIR, fileName));
  }
  for (const fileName of DEPLOY_MIRRORED_SQLITE_FILES) {
    const sourcePath = path.join(SHARED_DATA_DIR, fileName);
    const targetPath = path.join(PUBLISHED_DATA_DEPLOY_MIRROR_DIR, fileName);
    if (!pathExists(sourcePath)) continue;
    fs.copyFileSync(sourcePath, targetPath);
    for (const suffix of ["-shm", "-wal"]) {
      const transientTarget = `${targetPath}${suffix}`;
      if (pathExists(transientTarget)) {
        fs.rmSync(transientTarget, { force: true });
      }
    }
  }
}

function jsonError(res: Response, status: number, message: string) {
  res.status(status).type("text/plain").send(message);
}

function sendFirstExistingFile(res: Response, candidates: readonly string[]) {
  const match = candidates.find((candidate) => pathExists(candidate));
  if (!match) {
    res.status(404).end();
    return;
  }
  res.sendFile(match);
}

function mountPinballStatic(app: Express) {
  if (PINBALL_LAYOUT_MODE === "legacy") {
    app.use("/pinball", express.static(SHARED_PINBALL_DIR));
    return;
  }

  app.use("/pinball/images/playfields", express.static(SHARED_PLAYFIELDS_DIR));
  app.use("/pinball/images/backglasses", express.static(SHARED_BACKGLASSES_DIR));
  app.use("/pinball/rulesheets", express.static(SHARED_RULESHEETS_DIR));
  app.use("/pinball/gameinfo", express.static(SHARED_GAMEINFO_DIR));
  app.use("/pinball/data", express.static(PUBLISHED_DATA_DIR));
  app.use("/pinball/data", express.static(SOURCE_DATA_DIR));
  app.get("/pinball/cache-manifest.json", (_req, res) => {
    sendFirstExistingFile(res, PINBALL_ROOT_FILE_CANDIDATES["cache-manifest.json"]);
  });
  app.get("/pinball/cache-update-log.json", (_req, res) => {
    sendFirstExistingFile(res, PINBALL_ROOT_FILE_CANDIDATES["cache-update-log.json"]);
  });
}

function loadManufacturerFilterPayload(): FilterPayload {
  const rows = seedDb
    .prepare(`
      SELECT
        trim(name) AS manufacturer,
        is_modern AS isModern,
        game_count AS gameCount
      FROM manufacturers
      WHERE name IS NOT NULL AND trim(name) != ''
      ORDER BY sort_bucket ASC, COALESCE(featured_rank, 9999) ASC, sort_name ASC
    `)
    .all() as Array<{ manufacturer: string; isModern: 0 | 1; gameCount: number }>;

  const classics = rows
    .filter((row) => !row.isModern)
    .sort((left, right) => {
      if (left.gameCount !== right.gameCount) return right.gameCount - left.gameCount;
      return left.manufacturer.localeCompare(right.manufacturer, undefined, { sensitivity: "base" });
    })
    .slice(0, 20)
    .map((row) => row.manufacturer);
  const classicSet = new Set(classics);

  const manufacturerGroups = [
    {
      label: "Modern",
      manufacturers: rows.filter((row) => Boolean(row.isModern)).map((row) => row.manufacturer),
    },
    {
      label: "Classics",
      manufacturers: classics,
    },
    {
      label: "Other",
      manufacturers: rows.filter((row) => !row.isModern && !classicSet.has(row.manufacturer)).map((row) => row.manufacturer),
    },
  ].filter((group) => group.manufacturers.length > 0);

  return {
    manufacturers: manufacturerGroups.flatMap((group) => group.manufacturers),
    manufacturerGroups,
  };
}

await ensureDir(SHARED_DATA_DIR);

const adminDb = new Database(ADMIN_DB_PATH);
adminDb.pragma("journal_mode = WAL");
adminDb.exec(`
  CREATE TABLE IF NOT EXISTS machine_overrides (
    practice_identity TEXT PRIMARY KEY,
    opdb_machine_id TEXT,
    slug TEXT,
    name_override TEXT,
    variant_override TEXT,
    manufacturer_override TEXT,
    year_override INTEGER,
    playfield_local_path TEXT,
    playfield_source_url TEXT,
    playfield_source_note TEXT,
    rulesheet_local_path TEXT,
    rulesheet_source_url TEXT,
    rulesheet_source_note TEXT,
    gameinfo_local_path TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS playfield_assets (
    playfield_asset_id INTEGER PRIMARY KEY AUTOINCREMENT,
    practice_identity TEXT NOT NULL,
    source_opdb_machine_id TEXT NOT NULL,
    covered_alias_ids_json TEXT NOT NULL,
    playfield_local_path TEXT,
    playfield_original_local_path TEXT,
    playfield_reference_local_path TEXT,
    playfield_source_url TEXT,
    playfield_source_page_url TEXT,
    playfield_source_page_snapshot_path TEXT,
    playfield_source_note TEXT,
    playfield_web_local_path_1400 TEXT,
    playfield_web_local_path_700 TEXT,
    playfield_mask_polygon_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(practice_identity, source_opdb_machine_id)
  );
  CREATE INDEX IF NOT EXISTS idx_playfield_assets_practice ON playfield_assets(practice_identity);
  CREATE TABLE IF NOT EXISTS machine_video_overrides (
    video_override_id INTEGER PRIMARY KEY AUTOINCREMENT,
    practice_identity TEXT NOT NULL,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    priority INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_machine_video_overrides_practice_priority
    ON machine_video_overrides(practice_identity, priority, video_override_id);
  CREATE TABLE IF NOT EXISTS video_assets (
    video_asset_id INTEGER PRIMARY KEY AUTOINCREMENT,
    opdb_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    priority INTEGER NOT NULL,
    is_hidden INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(opdb_id, provider, kind, url)
  );
  CREATE INDEX IF NOT EXISTS idx_video_assets_opdb_provider
    ON video_assets(opdb_id, provider, kind, is_active, is_hidden, priority, video_asset_id);
  CREATE TABLE IF NOT EXISTS rulesheet_assets (
    rulesheet_asset_id INTEGER PRIMARY KEY AUTOINCREMENT,
    opdb_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    label TEXT NOT NULL,
    url TEXT,
    local_path TEXT,
    source_url TEXT,
    note TEXT,
    priority INTEGER NOT NULL,
    is_hidden INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_rulesheet_assets_opdb_provider
    ON rulesheet_assets(opdb_id, provider, is_active, is_hidden, priority, rulesheet_asset_id);
  CREATE TABLE IF NOT EXISTS gameinfo_assets (
    gameinfo_asset_id INTEGER PRIMARY KEY AUTOINCREMENT,
    opdb_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    label TEXT NOT NULL,
    local_path TEXT,
    priority INTEGER NOT NULL,
    is_hidden INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_gameinfo_assets_opdb_provider
    ON gameinfo_assets(opdb_id, provider, is_active, is_hidden, priority, gameinfo_asset_id);
  CREATE TABLE IF NOT EXISTS venue_entry_overrides (
    library_entry_id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    practice_identity TEXT,
    opdb_id TEXT,
    area TEXT,
    area_order INTEGER,
    group_number INTEGER,
    position INTEGER,
    bank INTEGER,
    name TEXT NOT NULL,
    variant TEXT,
    manufacturer TEXT,
    year INTEGER,
    playfield_image_url TEXT,
    rulesheet_url TEXT,
    tutorial_links_json TEXT NOT NULL,
    gameplay_links_json TEXT NOT NULL,
    competition_links_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_venue_entry_overrides_source ON venue_entry_overrides(source_id, updated_at DESC);
  CREATE TABLE IF NOT EXISTS venue_layout_assets (
    library_entry_id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    practice_identity TEXT,
    opdb_id TEXT,
    area TEXT,
    area_order INTEGER,
    group_number INTEGER,
    position INTEGER,
    bank INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_venue_layout_assets_source ON venue_layout_assets(source_id, updated_at DESC);
  CREATE TABLE IF NOT EXISTS activity_log (
    activity_id INTEGER PRIMARY KEY AUTOINCREMENT,
    practice_identity TEXT NOT NULL,
    action_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    details_json TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_activity_log_practice_created ON activity_log(practice_identity, created_at DESC);
  CREATE TABLE IF NOT EXISTS workspace_state (
    workspace_key TEXT PRIMARY KEY,
    note_text TEXT,
    updated_at TEXT NOT NULL
  );
`);

function ensureSqliteColumns(
  db: Database.Database,
  tableName: string,
  columns: Array<{ name: string; definition: string }>,
) {
  const existingColumns = new Set(
    (db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map((row) => row.name),
  );
  for (const column of columns) {
    if (existingColumns.has(column.name)) continue;
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.definition}`);
  }
}

ensureSqliteColumns(adminDb, "playfield_assets", [
  { name: "playfield_original_local_path", definition: "TEXT" },
  { name: "playfield_reference_local_path", definition: "TEXT" },
  { name: "playfield_source_page_url", definition: "TEXT" },
  { name: "playfield_source_page_snapshot_path", definition: "TEXT" },
  { name: "playfield_web_local_path_1400", definition: "TEXT" },
  { name: "playfield_web_local_path_700", definition: "TEXT" },
  { name: "playfield_mask_polygon_json", definition: "TEXT" },
]);

const adminCount = (adminDb.prepare("SELECT COUNT(*) AS total FROM machine_overrides").get() as { total: number }).total;
if (adminCount === 0 && fs.existsSync(SEED_DB_PATH)) {
  const bootstrapSeed = new Database(SEED_DB_PATH, { readonly: true });
  const existing = bootstrapSeed
    .prepare(`
      SELECT
        o.practice_identity AS practice_identity,
        m.opdb_machine_id AS opdb_machine_id,
        m.slug AS slug,
        o.name_override AS name_override,
        o.variant_override AS variant_override,
        o.manufacturer_override AS manufacturer_override,
        o.year_override AS year_override,
        o.playfield_local_path AS playfield_local_path,
        o.playfield_source_url AS playfield_source_url,
        '' AS playfield_source_note,
        o.rulesheet_local_path AS rulesheet_local_path,
        '' AS rulesheet_source_url,
        '' AS rulesheet_source_note,
        o.gameinfo_local_path AS gameinfo_local_path,
        '' AS notes
      FROM overrides o
      LEFT JOIN machines m ON m.practice_identity = o.practice_identity
    `)
    .all() as Array<Omit<OverrideRecord, "created_at" | "updated_at">>;
  const deduped = Array.from(
    new Map(existing.map((row) => [row.practice_identity, row])).values(),
  );
  const insert = adminDb.prepare(`
    INSERT INTO machine_overrides (
      practice_identity,
      opdb_machine_id,
      slug,
      name_override,
      variant_override,
      manufacturer_override,
      year_override,
      playfield_local_path,
      playfield_source_url,
      playfield_source_note,
      rulesheet_local_path,
      rulesheet_source_url,
      rulesheet_source_note,
      gameinfo_local_path,
      notes,
      created_at,
      updated_at
    ) VALUES (
      @practice_identity,
      @opdb_machine_id,
      @slug,
      @name_override,
      @variant_override,
      @manufacturer_override,
      @year_override,
      @playfield_local_path,
      @playfield_source_url,
      @playfield_source_note,
      @rulesheet_local_path,
      @rulesheet_source_url,
      @rulesheet_source_note,
      @gameinfo_local_path,
      @notes,
      @created_at,
      @updated_at
    )
    ON CONFLICT(practice_identity) DO UPDATE SET
      opdb_machine_id=excluded.opdb_machine_id,
      slug=excluded.slug,
      name_override=excluded.name_override,
      variant_override=excluded.variant_override,
      manufacturer_override=excluded.manufacturer_override,
      year_override=excluded.year_override,
      playfield_local_path=excluded.playfield_local_path,
      playfield_source_url=excluded.playfield_source_url,
      playfield_source_note=excluded.playfield_source_note,
      rulesheet_local_path=excluded.rulesheet_local_path,
      rulesheet_source_url=excluded.rulesheet_source_url,
      rulesheet_source_note=excluded.rulesheet_source_note,
      gameinfo_local_path=excluded.gameinfo_local_path,
      notes=excluded.notes,
      updated_at=excluded.updated_at
  `);
  const timestamp = nowIso();
  const transaction = adminDb.transaction((rows: Array<Omit<OverrideRecord, "created_at" | "updated_at">>) => {
    for (const row of rows) {
      insert.run({
        ...row,
        created_at: timestamp,
        updated_at: timestamp,
      });
    }
  });
  transaction(deduped);
  bootstrapSeed.close();
}

const adminVideoOverrideCount = (
  adminDb.prepare("SELECT COUNT(*) AS total FROM machine_video_overrides").get() as { total: number }
).total;
if (adminVideoOverrideCount === 0 && fs.existsSync(SEED_DB_PATH)) {
  const bootstrapSeed = new Database(SEED_DB_PATH, { readonly: true });
  const hasSeedVideoOverrides = bootstrapSeed
    .prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = 'override_videos'
    `)
    .get() as { name: string } | undefined;
  if (hasSeedVideoOverrides) {
    const existing = bootstrapSeed
      .prepare(`
        SELECT
          practice_identity,
          kind,
          label,
          url,
          priority
        FROM override_videos
        ORDER BY practice_identity, priority, lower(label)
      `)
      .all() as Array<Omit<AdminVideoOverrideRecord, "video_override_id" | "created_at" | "updated_at">>;
    const insert = adminDb.prepare(`
      INSERT INTO machine_video_overrides (
        practice_identity,
        kind,
        label,
        url,
        priority,
        created_at,
        updated_at
      ) VALUES (
        @practice_identity,
        @kind,
        @label,
        @url,
        @priority,
        @created_at,
        @updated_at
      )
    `);
    const timestamp = nowIso();
    const transaction = adminDb.transaction((rows: Array<Omit<AdminVideoOverrideRecord, "video_override_id" | "created_at" | "updated_at">>) => {
      for (const row of rows) {
        insert.run({
          ...row,
          created_at: timestamp,
          updated_at: timestamp,
        });
      }
    });
    transaction(existing);
  }
  bootstrapSeed.close();
}

const adminVideoAssetCount = (adminDb.prepare("SELECT COUNT(*) AS total FROM video_assets").get() as { total: number }).total;
if (adminVideoAssetCount === 0) {
  const existing = adminDb
    .prepare(`
      SELECT
        practice_identity,
        kind,
        label,
        url,
        priority
      FROM machine_video_overrides
      ORDER BY practice_identity, priority, lower(label)
    `)
    .all() as Array<Omit<AdminVideoAssetRecord, "video_asset_id" | "opdb_id" | "provider" | "is_hidden" | "is_active" | "note" | "created_at" | "updated_at"> & { practice_identity: string }>;
  if (existing.length) {
    const insert = adminDb.prepare(`
      INSERT INTO video_assets (
        opdb_id,
        provider,
        kind,
        label,
        url,
        priority,
        is_hidden,
        is_active,
        note,
        created_at,
        updated_at
      ) VALUES (
        @opdb_id,
        'pinprof',
        @kind,
        @label,
        @url,
        @priority,
        0,
        1,
        NULL,
        @created_at,
        @updated_at
      )
      ON CONFLICT(opdb_id, provider, kind, url) DO UPDATE SET
        label=excluded.label,
        priority=excluded.priority,
        updated_at=excluded.updated_at
    `);
    const timestamp = nowIso();
    const transaction = adminDb.transaction((rows: typeof existing) => {
      for (const row of rows) {
        insert.run({
          opdb_id: row.practice_identity,
          kind: row.kind,
          label: row.label,
          url: row.url,
          priority: row.priority,
          created_at: timestamp,
          updated_at: timestamp,
        });
      }
    });
    transaction(existing);
  }
}

const adminRulesheetAssetCount = (adminDb.prepare("SELECT COUNT(*) AS total FROM rulesheet_assets").get() as { total: number }).total;
if (adminRulesheetAssetCount === 0) {
  const timestamp = nowIso();
  const insert = adminDb.prepare(`
    INSERT INTO rulesheet_assets (
      opdb_id,
      provider,
      label,
      url,
      local_path,
      source_url,
      note,
      priority,
      is_hidden,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      @opdb_id,
      'pinprof',
      @label,
      @url,
      @local_path,
      @source_url,
      @note,
      @priority,
      0,
      1,
      @created_at,
      @updated_at
    )
  `);
  const existingOverrideRulesheetRows = fs.existsSync(SEED_DB_PATH)
    ? (() => {
        const bootstrapSeed = new Database(SEED_DB_PATH, { readonly: true });
        try {
          const hasSeedRulesheetOverrides = bootstrapSeed
            .prepare(`
              SELECT name
              FROM sqlite_master
              WHERE type = 'table' AND name = 'override_rulesheet_links'
            `)
            .get() as { name: string } | undefined;
          if (!hasSeedRulesheetOverrides) return [] as Array<{ practice_identity: string; label: string; url: string; priority: number }>;
          return bootstrapSeed
            .prepare(`
              SELECT
                practice_identity,
                label,
                url,
                priority
              FROM override_rulesheet_links
              ORDER BY practice_identity, priority, lower(label)
            `)
            .all() as Array<{ practice_identity: string; label: string; url: string; priority: number }>;
        } finally {
          bootstrapSeed.close();
        }
      })()
    : [];
  const localRulesheetCurationsPath = path.join(PUBLISHED_DATA_DIR, "local_rulesheet_curations_v1.json");
  const curatedLocalRecords = pathExists(localRulesheetCurationsPath)
    ? ((JSON.parse(fs.readFileSync(localRulesheetCurationsPath, "utf8")) as { records?: Array<{ practice_identity?: string; local_path?: string; notes?: string }> }).records ?? [])
    : [];
  const machineRulesheetRows = adminDb
    .prepare(`
      SELECT
        practice_identity,
        rulesheet_local_path,
        rulesheet_source_url,
        rulesheet_source_note
      FROM machine_overrides
    `)
    .all() as Array<{ practice_identity: string; rulesheet_local_path: string | null; rulesheet_source_url: string | null; rulesheet_source_note: string | null }>;
  const deduped = new Map<string, { opdb_id: string; label: string; url: string | null; local_path: string | null; source_url: string | null; note: string | null; priority: number; created_at: string; updated_at: string }>();
  for (const row of machineRulesheetRows) {
    const opdbId = cleanString(row.practice_identity);
    const localPath = cleanString(row.rulesheet_local_path);
    const sourceUrl = cleanString(row.rulesheet_source_url);
    if (!opdbId) continue;
    if (localPath) {
      deduped.set(`local:${opdbId}:${localPath}`, {
        opdb_id: opdbId,
        label: "Rulesheet (PinProf)",
        url: null,
        local_path: localPath,
        source_url: sourceUrl,
        note: cleanString(row.rulesheet_source_note),
        priority: 0,
        created_at: timestamp,
        updated_at: timestamp,
      });
    } else if (sourceUrl && !isGeneratedRulesheetProviderUrl(sourceUrl)) {
      const normalizedUrl = normalizeRulesheetAssetUrl(sourceUrl);
      deduped.set(`url:${opdbId}:${normalizedUrl}`, {
        opdb_id: opdbId,
        label: "Rulesheet (PinProf)",
        url: normalizedUrl,
        local_path: null,
        source_url: normalizedUrl,
        note: cleanString(row.rulesheet_source_note),
        priority: 0,
        created_at: timestamp,
        updated_at: timestamp,
      });
    }
  }
  for (const row of curatedLocalRecords) {
    const opdbId = cleanString(row.practice_identity);
    const localPath = cleanString(row.local_path);
    if (!opdbId || !localPath) continue;
    deduped.set(`local:${opdbId}:${localPath}`, {
      opdb_id: opdbId,
      label: "Rulesheet (PinProf)",
      url: null,
      local_path: localPath,
      source_url: null,
      note: cleanString(row.notes),
      priority: 0,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }
  for (const row of existingOverrideRulesheetRows) {
    const opdbId = cleanString(row.practice_identity);
    const url = cleanString(row.url);
    if (!opdbId || !url || isGeneratedRulesheetProviderUrl(url)) continue;
    const normalizedUrl = normalizeRulesheetAssetUrl(url);
    deduped.set(`url:${opdbId}:${normalizedUrl}`, {
      opdb_id: opdbId,
      label: cleanString(row.label) ?? "Rulesheet (PinProf)",
      url: normalizedUrl,
      local_path: null,
      source_url: normalizedUrl,
      note: null,
      priority: row.priority ?? 0,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }
  const transaction = adminDb.transaction((rows: Array<{ opdb_id: string; label: string; url: string | null; local_path: string | null; source_url: string | null; note: string | null; priority: number; created_at: string; updated_at: string }>) => {
    for (const row of rows) {
      insert.run(row);
    }
  });
  transaction(Array.from(deduped.values()).sort((a, b) => a.opdb_id.localeCompare(b.opdb_id) || a.priority - b.priority));
}

const seedDb = new Database(SEED_DB_PATH);
seedDb.exec(`ATTACH DATABASE '${escapeSqlitePath(ADMIN_DB_PATH)}' AS admin`);
let pinsidePhotoBrowserSession: PinsidePhotoBrowserSessionState | null = null;

function getMachineRow(practiceIdentity: string): MachineRow | null {
  const row = seedDb
    .prepare(`
      WITH ranked AS (
        SELECT
          m.practice_identity AS practiceIdentity,
          m.opdb_machine_id AS opdbMachineId,
          m.opdb_group_id AS opdbGroupId,
          m.slug AS slug,
          m.name AS name,
          m.variant AS variant,
          m.manufacturer_name AS manufacturer,
          m.year AS year,
          m.playfield_image_large_url AS playfieldImageUrl,
          m.primary_image_large_url AS primaryImageUrl,
          o.playfield_local_path AS playfieldLocalPath,
          o.rulesheet_local_path AS rulesheetLocalPath,
          a.name_override AS nameOverride,
          a.variant_override AS variantOverride,
          a.manufacturer_override AS manufacturerOverride,
          a.year_override AS yearOverride,
          a.playfield_local_path AS overridePlayfieldLocalPath,
          a.playfield_source_url AS playfieldSourceUrl,
          a.playfield_source_note AS playfieldSourceNote,
          a.rulesheet_local_path AS overrideRulesheetLocalPath,
          a.rulesheet_source_url AS rulesheetSourceUrl,
          a.rulesheet_source_note AS rulesheetSourceNote,
          a.gameinfo_local_path AS gameinfoLocalPath,
          a.notes AS notes,
          a.updated_at AS updatedAt,
          ROW_NUMBER() OVER (
            PARTITION BY m.practice_identity
            ORDER BY
              CASE WHEN m.variant IS NULL OR trim(m.variant) = '' THEN 0 ELSE 1 END,
              lower(coalesce(m.variant, '')),
              lower(m.opdb_machine_id)
          ) AS rank_index
        FROM machines m
        LEFT JOIN overrides o ON o.practice_identity = m.practice_identity
        LEFT JOIN admin.machine_overrides a ON a.practice_identity = m.practice_identity
        WHERE m.practice_identity = ?
      )
      SELECT * FROM ranked WHERE rank_index = 1
    `)
    .get(practiceIdentity) as MachineRow | undefined;
  return row ?? null;
}

function getOverrideRecord(practiceIdentity: string): OverrideRecord | null {
  const row = adminDb
    .prepare("SELECT * FROM machine_overrides WHERE practice_identity = ?")
    .get(practiceIdentity) as OverrideRecord | undefined;
  return row ?? null;
}

function getBuiltInGameRow(practiceIdentity: string): BuiltInGameRow | null {
  const row = seedDb.prepare(`
    SELECT
      source_id AS sourceId,
      source_name AS sourceName,
      source_type AS sourceType,
      playfield_image_url AS playfieldImageUrl,
      playfield_local_path AS playfieldLocalPath,
      playfield_source_label AS playfieldSourceLabel,
      gameinfo_local_path AS gameinfoLocalPath,
      rulesheet_local_path AS rulesheetLocalPath,
      rulesheet_url AS rulesheetUrl
    FROM built_in_games
    WHERE practice_identity = ?
    ORDER BY lower(coalesce(variant, '')), lower(library_entry_id)
    LIMIT 1
  `).get(practiceIdentity) as BuiltInGameRow | undefined;
  return row ?? null;
}

function sqlPlaceholders(count: number) {
  return Array.from({ length: count }, () => "?").join(", ");
}

function getMachineMembershipRows(practiceIdentity: string): MachineMembershipRow[] {
  return seedDb.prepare(`
    SELECT
      library_entry_id AS libraryEntryId,
      source_id AS sourceId,
      source_name AS sourceName,
      source_type AS sourceType,
      practice_identity AS practiceIdentity,
      opdb_id AS opdbId,
      area,
      area_order AS areaOrder,
      group_number AS groupNumber,
      position,
      bank,
      name,
      variant,
      manufacturer,
      year,
      slug,
      primary_image_url AS primaryImageUrl,
      primary_image_large_url AS primaryImageLargeUrl,
      playfield_image_url AS playfieldImageUrl,
      playfield_local_path AS playfieldLocalPath,
      playfield_source_label AS playfieldSourceLabel,
      gameinfo_local_path AS gameinfoLocalPath,
      rulesheet_local_path AS rulesheetLocalPath,
      rulesheet_url AS rulesheetUrl
    FROM built_in_games
    WHERE practice_identity = ?
    ORDER BY
      lower(source_name),
      area_order IS NULL,
      area_order,
      group_number IS NULL,
      group_number,
      position IS NULL,
      position,
      lower(library_entry_id)
  `).all(practiceIdentity) as MachineMembershipRow[];
}

function getBuiltInVideoRowsByMembership(libraryEntryIds: string[]) {
  if (!libraryEntryIds.length) return new Map<string, MembershipVideoRow[]>();
  const rows = seedDb.prepare(`
    SELECT
      library_entry_id AS libraryEntryId,
      kind,
      label,
      url,
      priority
    FROM built_in_videos
    WHERE library_entry_id IN (${sqlPlaceholders(libraryEntryIds.length)})
    ORDER BY lower(library_entry_id), lower(kind), priority, lower(label)
  `).all(...libraryEntryIds) as MembershipVideoRow[];
  const grouped = new Map<string, MembershipVideoRow[]>();
  for (const row of rows) {
    const existing = grouped.get(row.libraryEntryId) ?? [];
    existing.push(row);
    grouped.set(row.libraryEntryId, existing);
  }
  return grouped;
}

function getBuiltInRulesheetRowsByMembership(libraryEntryIds: string[]) {
  if (!libraryEntryIds.length) return new Map<string, MembershipRulesheetLinkRow[]>();
  const rows = seedDb.prepare(`
    SELECT
      library_entry_id AS libraryEntryId,
      label,
      url,
      priority
    FROM built_in_rulesheet_links
    WHERE library_entry_id IN (${sqlPlaceholders(libraryEntryIds.length)})
    ORDER BY lower(library_entry_id), priority, lower(label)
  `).all(...libraryEntryIds) as MembershipRulesheetLinkRow[];
  const grouped = new Map<string, MembershipRulesheetLinkRow[]>();
  for (const row of rows) {
    const existing = grouped.get(row.libraryEntryId) ?? [];
    existing.push(row);
    grouped.set(row.libraryEntryId, existing);
  }
  return grouped;
}

function getVenueEntryOverrideRecords() {
  return adminDb
    .prepare(`
      SELECT *
      FROM venue_entry_overrides
      ORDER BY datetime(updated_at) DESC, lower(source_name), lower(name), lower(library_entry_id)
    `)
    .all() as VenueEntryOverrideRecord[];
}

function parseStoredVenueUrlArray(value: string | null) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => cleanString(entry))
      .filter((entry): entry is string => Boolean(entry));
  } catch {
    return [];
  }
}

function normalizeVenueUrlSlots(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  if (value.length > 4) {
    throw new Error(`${label} can have at most 4 links.`);
  }
  const normalized: string[] = [];
  value.forEach((entry, index) => {
    const trimmed = cleanString(entry);
    if (!trimmed) return;
    normalized.push(normalizeHttpUrl(trimmed, `${label} ${index + 1}`));
  });
  return normalized;
}

function serializeVenueUrlSlots(value: string[]) {
  return JSON.stringify(value);
}

function readPublishedVenueSourceMetadata() {
  const out = new Map<string, VenueSourceMeta>();
  const publishedLibraryPath = path.join(PUBLISHED_DATA_DIR, "pinball_library_v3.json");
  if (!pathExists(publishedLibraryPath)) {
    return out;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(publishedLibraryPath, "utf8")) as {
      items?: Array<Record<string, unknown>>;
    };
    for (const item of raw.items ?? []) {
      const sourceId = cleanString(item.library_id) ?? cleanString(item.source_id);
      const sourceName = cleanString(item.library_name) ?? cleanString(item.venue);
      if (!sourceId || !sourceName || out.has(sourceId)) continue;
      out.set(sourceId, {
        sourceId,
        sourceName,
        venueLocation: cleanString(item.venue_location),
        pmLocationId: cleanString(item.pm_location_id),
      });
    }
  } catch {
    return out;
  }

  return out;
}

function getAllVenueMembershipRows() {
  return seedDb.prepare(`
    SELECT
      library_entry_id AS libraryEntryId,
      source_id AS sourceId,
      source_name AS sourceName,
      source_type AS sourceType,
      practice_identity AS practiceIdentity,
      opdb_id AS opdbId,
      area,
      area_order AS areaOrder,
      group_number AS groupNumber,
      position,
      bank,
      name,
      variant,
      manufacturer,
      year,
      slug,
      primary_image_url AS primaryImageUrl,
      primary_image_large_url AS primaryImageLargeUrl,
      playfield_image_url AS playfieldImageUrl,
      playfield_local_path AS playfieldLocalPath,
      playfield_source_label AS playfieldSourceLabel,
      gameinfo_local_path AS gameinfoLocalPath,
      rulesheet_local_path AS rulesheetLocalPath,
      rulesheet_url AS rulesheetUrl
    FROM built_in_games
    WHERE source_type = 'venue'
    ORDER BY
      lower(source_name),
      area_order IS NULL,
      area_order,
      group_number IS NULL,
      group_number,
      position IS NULL,
      position,
      lower(name),
      lower(coalesce(variant, '')),
      lower(library_entry_id)
  `).all() as MachineMembershipRow[];
}

function getVenueStudioBaseComparableRow(libraryEntryId: string) {
  const row = seedDb.prepare(`
    SELECT
      library_entry_id AS libraryEntryId,
      source_id AS sourceId,
      source_name AS sourceName,
      source_type AS sourceType,
      practice_identity AS practiceIdentity,
      opdb_id AS opdbId,
      area,
      area_order AS areaOrder,
      group_number AS groupNumber,
      position,
      bank,
      name,
      variant,
      manufacturer,
      year,
      slug,
      primary_image_url AS primaryImageUrl,
      primary_image_large_url AS primaryImageLargeUrl,
      playfield_image_url AS playfieldImageUrl,
      playfield_local_path AS playfieldLocalPath,
      playfield_source_label AS playfieldSourceLabel,
      gameinfo_local_path AS gameinfoLocalPath,
      rulesheet_local_path AS rulesheetLocalPath,
      rulesheet_url AS rulesheetUrl
    FROM built_in_games
    WHERE library_entry_id = ?
    LIMIT 1
  `).get(libraryEntryId) as MachineMembershipRow | undefined;
  if (!row) return null;

  const builtInVideos = getBuiltInVideoRowsByMembership([libraryEntryId]).get(libraryEntryId) ?? [];
  const builtInRulesheetLinks = dedupeRulesheetLinks(
    (getBuiltInRulesheetRowsByMembership([libraryEntryId]).get(libraryEntryId) ?? []).map((item) => ({
      label: item.label,
      url: item.url,
      priority: item.priority,
    })),
  );

  return {
    ...row,
    links: {
      playfieldImageUrl: cleanString(row.playfieldImageUrl),
      rulesheetUrl: cleanString(row.rulesheetUrl) ?? builtInRulesheetLinks[0]?.url ?? null,
      tutorial: builtInVideos.filter((item) => item.kind === "tutorial").map((item) => item.url),
      gameplay: builtInVideos.filter((item) => item.kind === "gameplay").map((item) => item.url),
      competition: builtInVideos.filter((item) => item.kind === "competition").map((item) => item.url),
    },
  };
}

function getCanonicalAssetMap() {
  const rows = seedDb.prepare(`
    WITH canonical AS (
      SELECT
        practiceIdentity,
        primaryImageUrl,
        playfieldImageUrl
      FROM (
        SELECT
          m.practice_identity AS practiceIdentity,
          m.primary_image_large_url AS primaryImageUrl,
          m.playfield_image_large_url AS playfieldImageUrl,
          ROW_NUMBER() OVER (
            PARTITION BY m.practice_identity
            ORDER BY
              CASE WHEN m.variant IS NULL OR trim(m.variant) = '' THEN 0 ELSE 1 END,
              lower(coalesce(m.variant, '')),
              lower(m.opdb_machine_id)
          ) AS rank_index
        FROM machines m
      )
      WHERE rank_index = 1
    )
    SELECT practiceIdentity, primaryImageUrl, playfieldImageUrl
    FROM canonical
  `).all() as Array<{ practiceIdentity: string; primaryImageUrl: string | null; playfieldImageUrl: string | null }>;
  return new Map(rows.map((row) => [row.practiceIdentity, row] as const));
}

function getCountMap(
  db: Database.Database,
  sql: string,
) {
  const rows = db.prepare(sql).all() as Array<{ practiceIdentity: string; count: number }>;
  return new Map(rows.map((row) => [row.practiceIdentity, row.count] as const));
}

function getMachineOverrideMap() {
  const rows = adminDb.prepare(`
    SELECT
      practice_identity AS practiceIdentity,
      rulesheet_local_path AS rulesheetLocalPath,
      gameinfo_local_path AS gameinfoLocalPath
    FROM machine_overrides
  `).all() as Array<{ practiceIdentity: string; rulesheetLocalPath: string | null; gameinfoLocalPath: string | null }>;
  return new Map(rows.map((row) => [row.practiceIdentity, row] as const));
}

function getVenueStudioRows() {
  const sourceMeta = readPublishedVenueSourceMetadata();
  const baseRows = getAllVenueMembershipRows();
  const overrideMap = new Map(getVenueEntryOverrideRecords().map((row) => [row.library_entry_id, row] as const));
  const libraryEntryIds = baseRows.map((row) => row.libraryEntryId);
  const builtInVideosByMembership = getBuiltInVideoRowsByMembership(libraryEntryIds);
  const builtInRulesheetsByMembership = getBuiltInRulesheetRowsByMembership(libraryEntryIds);
  const canonicalMap = getCanonicalAssetMap();
  const machineOverrideMap = getMachineOverrideMap();
  const adminPlayfieldCounts = getCountMap(
    adminDb,
    `
      SELECT
        practice_identity AS practiceIdentity,
        COUNT(*) AS count
      FROM playfield_assets
      WHERE playfield_local_path IS NOT NULL AND trim(playfield_local_path) != ''
      GROUP BY practice_identity
    `,
  );
  const catalogVideoCounts = getCountMap(
    seedDb,
    `
      SELECT
        practice_identity AS practiceIdentity,
        COUNT(*) AS count
      FROM catalog_video_links
      GROUP BY practice_identity
    `,
  );
  const overrideVideoCounts = getCountMap(
    adminDb,
    `
      SELECT
        opdb_id AS practiceIdentity,
        COUNT(*) AS count
      FROM video_assets
      WHERE provider = 'pinprof'
        AND is_active = 1
        AND is_hidden = 0
      GROUP BY opdb_id
    `,
  );
  const catalogRulesheetCounts = getCountMap(
    seedDb,
    `
      SELECT
        practice_identity AS practiceIdentity,
        COUNT(*) AS count
      FROM catalog_rulesheet_links
      GROUP BY practice_identity
    `,
  );
  const overrideRulesheetCounts = getCountMap(
    adminDb,
    `
      SELECT
        opdb_id AS practiceIdentity,
        COUNT(*) AS count
      FROM rulesheet_assets
      WHERE provider = 'pinprof'
        AND is_active = 1
        AND is_hidden = 0
        AND url IS NOT NULL
        AND trim(url) != ''
      GROUP BY opdb_id
    `,
  );

  return baseRows.map((row) => {
    const override = overrideMap.get(row.libraryEntryId) ?? null;
    const builtInVideos = builtInVideosByMembership.get(row.libraryEntryId) ?? [];
    const builtInRulesheetLinks = dedupeRulesheetLinks(
      (builtInRulesheetsByMembership.get(row.libraryEntryId) ?? []).map((item) => ({
        label: item.label,
        url: item.url,
        priority: item.priority,
      })),
    );
    const tutorialLinks = override
      ? parseStoredVenueUrlArray(override.tutorial_links_json)
      : builtInVideos.filter((item) => item.kind === "tutorial").map((item) => item.url);
    const gameplayLinks = override
      ? parseStoredVenueUrlArray(override.gameplay_links_json)
      : builtInVideos.filter((item) => item.kind === "gameplay").map((item) => item.url);
    const competitionLinks = override
      ? parseStoredVenueUrlArray(override.competition_links_json)
      : builtInVideos.filter((item) => item.kind === "competition").map((item) => item.url);
    const machineMeta = row.practiceIdentity ? canonicalMap.get(row.practiceIdentity) ?? null : null;
    const machineOverride = row.practiceIdentity ? machineOverrideMap.get(row.practiceIdentity) ?? null : null;
    const effectivePlayfieldImageUrl = override ? cleanString(override.playfield_image_url) : cleanString(row.playfieldImageUrl);
    const effectiveRulesheetUrl =
      override != null
        ? cleanString(override.rulesheet_url)
        : cleanString(row.rulesheetUrl) ?? builtInRulesheetLinks[0]?.url ?? null;
    const hasAnyVenueVideo = tutorialLinks.length + gameplayLinks.length + competitionLinks.length > 0;
    const hasEffectivePlayfield =
      Boolean(effectivePlayfieldImageUrl) ||
      Boolean(cleanString(row.playfieldLocalPath)) ||
      Boolean(adminPlayfieldCounts.get(row.practiceIdentity ?? "") ?? 0) ||
      Boolean(machineMeta?.playfieldImageUrl);
    const hasEffectiveRulesheet =
      Boolean(effectiveRulesheetUrl) ||
      Boolean(cleanString(row.rulesheetLocalPath)) ||
      Boolean(machineOverride?.rulesheetLocalPath) ||
      builtInRulesheetLinks.length > 0 ||
      Boolean(catalogRulesheetCounts.get(row.practiceIdentity ?? "") ?? 0) ||
      Boolean(overrideRulesheetCounts.get(row.practiceIdentity ?? "") ?? 0);
    const hasEffectiveGameinfo = Boolean(cleanString(row.gameinfoLocalPath)) || Boolean(machineOverride?.gameinfoLocalPath);
    const needsAttention = !hasEffectivePlayfield || !hasEffectiveRulesheet || !hasAnyVenueVideo;
    const meta = sourceMeta.get(row.sourceId) ?? {
      sourceId: row.sourceId,
      sourceName: row.sourceName,
      venueLocation: null,
      pmLocationId: null,
    };

    return {
      libraryEntryId: row.libraryEntryId,
      sourceId: row.sourceId,
      sourceName: row.sourceName,
      sourceType: row.sourceType,
      venueLocation: meta.venueLocation,
      pmLocationId: meta.pmLocationId,
      practiceIdentity: row.practiceIdentity,
      opdbId: row.opdbId,
      slug: row.slug,
      name: override?.name ?? row.name,
      variant: override?.variant ?? row.variant,
      manufacturer: override?.manufacturer ?? row.manufacturer,
      year: override?.year ?? row.year,
      area: override?.area ?? row.area,
      areaOrder: override?.area_order ?? row.areaOrder,
      groupNumber: override?.group_number ?? row.groupNumber,
      position: override?.position ?? row.position,
      bank: override?.bank ?? row.bank,
      links: {
        playfieldImageUrl: effectivePlayfieldImageUrl,
        rulesheetUrl: effectiveRulesheetUrl,
        tutorial: tutorialLinks,
        gameplay: gameplayLinks,
        competition: competitionLinks,
      },
      assets: {
        builtInPlayfieldLocalPath: row.playfieldLocalPath,
        builtInRulesheetLocalPath: row.rulesheetLocalPath,
        builtInGameinfoLocalPath: row.gameinfoLocalPath,
        builtInRulesheetLinks: builtInRulesheetLinks.map((item) => item.url),
        canonicalPlayfieldUrl: machineMeta?.playfieldImageUrl ?? null,
        canonicalBackglassUrl: machineMeta?.primaryImageUrl ?? null,
        primaryImageUrl: row.primaryImageLargeUrl ?? row.primaryImageUrl,
        adminPlayfieldCount: adminPlayfieldCounts.get(row.practiceIdentity ?? "") ?? 0,
        adminHasRulesheet: Boolean(machineOverride?.rulesheetLocalPath),
        adminHasGameinfo: Boolean(machineOverride?.gameinfoLocalPath),
        catalogVideoCount: catalogVideoCounts.get(row.practiceIdentity ?? "") ?? 0,
        overrideVideoCount: overrideVideoCounts.get(row.practiceIdentity ?? "") ?? 0,
        catalogRulesheetCount: catalogRulesheetCounts.get(row.practiceIdentity ?? "") ?? 0,
        overrideRulesheetCount: overrideRulesheetCounts.get(row.practiceIdentity ?? "") ?? 0,
      },
      flags: {
        isEdited: Boolean(override),
        needsAttention,
        hasVenuePlayfield: Boolean(effectivePlayfieldImageUrl),
        hasVenueRulesheet: Boolean(effectiveRulesheetUrl),
        hasVenueVideos: hasAnyVenueVideo,
        hasEffectivePlayfield,
        hasEffectiveRulesheet,
        hasEffectiveGameinfo,
      },
      updatedAt: override?.updated_at ?? null,
    };
  });
}

function getVenueStudioSnapshot() {
  const rows = getVenueStudioRows();
  const sourceMap = rows.reduce((map, row) => {
      const existing = map.get(row.sourceId) ?? {
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        sourceType: row.sourceType,
        venueLocation: row.venueLocation,
        pmLocationId: row.pmLocationId,
        rowCount: 0,
        editedRows: 0,
        needsAttentionRows: 0,
        missingPlayfieldRows: 0,
        missingRulesheetRows: 0,
        zeroVideoRows: 0,
      };
      existing.rowCount += 1;
      if (row.flags.isEdited) existing.editedRows += 1;
      if (row.flags.needsAttention) existing.needsAttentionRows += 1;
      if (!row.flags.hasEffectivePlayfield) existing.missingPlayfieldRows += 1;
      if (!row.flags.hasEffectiveRulesheet) existing.missingRulesheetRows += 1;
      if (!row.flags.hasVenueVideos) existing.zeroVideoRows += 1;
      map.set(row.sourceId, existing);
      return map;
    }, new Map<string, {
      sourceId: string;
      sourceName: string;
      sourceType: string;
      venueLocation: string | null;
      pmLocationId: string | null;
      rowCount: number;
      editedRows: number;
      needsAttentionRows: number;
      missingPlayfieldRows: number;
      missingRulesheetRows: number;
      zeroVideoRows: number;
    }>());
  const sources = Array.from(sourceMap.values()).sort((left, right) =>
    left.sourceName.localeCompare(right.sourceName, undefined, { sensitivity: "base" }),
  );

  return { sources, rows };
}

function parseVenueEntryEditPayload(body: unknown): VenueEntryEditPayload {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const name = cleanString(value.name);
  if (!name) {
    throw new Error("Game name is required.");
  }

  const year = cleanInteger(value.year);
  if (year != null && (year < 1930 || year > 2100)) {
    throw new Error("Year must be between 1930 and 2100.");
  }

  return {
    area: cleanString(value.area),
    areaOrder: cleanInteger(value.areaOrder),
    groupNumber: cleanInteger(value.groupNumber),
    position: cleanInteger(value.position),
    bank: cleanInteger(value.bank),
    name,
    variant: cleanString(value.variant),
    manufacturer: cleanString(value.manufacturer),
    year,
    playfieldImageUrl: normalizeOptionalHttpUrl(value.playfieldImageUrl, "Playfield image URL"),
    rulesheetUrl: normalizeOptionalHttpUrl(value.rulesheetUrl, "Rulesheet URL"),
    tutorialLinks: normalizeVenueUrlSlots(value.tutorialLinks ?? [], "Tutorial links"),
    gameplayLinks: normalizeVenueUrlSlots(value.gameplayLinks ?? [], "Gameplay links"),
    competitionLinks: normalizeVenueUrlSlots(value.competitionLinks ?? [], "Competition links"),
  };
}

function upsertVenueEntryOverride(libraryEntryId: string, patch: VenueEntryEditPayload) {
  const base = getVenueStudioBaseComparableRow(libraryEntryId);
  if (!base) {
    throw new Error(`Unknown venue row: ${libraryEntryId}`);
  }

  const existing = adminDb
    .prepare("SELECT * FROM venue_entry_overrides WHERE library_entry_id = ?")
    .get(libraryEntryId) as VenueEntryOverrideRecord | undefined;

  const comparableBase = {
    area: base.area,
    areaOrder: base.areaOrder,
    groupNumber: base.groupNumber,
    position: base.position,
    bank: base.bank,
    name: base.name,
    variant: base.variant,
    manufacturer: base.manufacturer,
    year: base.year,
    playfieldImageUrl: base.links.playfieldImageUrl,
    rulesheetUrl: base.links.rulesheetUrl,
    tutorialLinks: base.links.tutorial,
    gameplayLinks: base.links.gameplay,
    competitionLinks: base.links.competition,
  };

  const matchesBase =
    comparableBase.area === patch.area &&
    comparableBase.areaOrder === patch.areaOrder &&
    comparableBase.groupNumber === patch.groupNumber &&
    comparableBase.position === patch.position &&
    comparableBase.bank === patch.bank &&
    comparableBase.name === patch.name &&
    comparableBase.variant === patch.variant &&
    comparableBase.manufacturer === patch.manufacturer &&
    comparableBase.year === patch.year &&
    comparableBase.playfieldImageUrl === patch.playfieldImageUrl &&
    comparableBase.rulesheetUrl === patch.rulesheetUrl &&
    JSON.stringify(comparableBase.tutorialLinks) === JSON.stringify(patch.tutorialLinks) &&
    JSON.stringify(comparableBase.gameplayLinks) === JSON.stringify(patch.gameplayLinks) &&
    JSON.stringify(comparableBase.competitionLinks) === JSON.stringify(patch.competitionLinks);

  if (matchesBase) {
    adminDb.prepare("DELETE FROM venue_entry_overrides WHERE library_entry_id = ?").run(libraryEntryId);
    return { row: base, reset: true };
  }

  const next: VenueEntryOverrideRecord = {
    library_entry_id: libraryEntryId,
    source_id: base.sourceId,
    source_name: base.sourceName,
    source_type: base.sourceType,
    practice_identity: base.practiceIdentity,
    opdb_id: base.opdbId,
    area: patch.area,
    area_order: patch.areaOrder,
    group_number: patch.groupNumber,
    position: patch.position,
    bank: patch.bank,
    name: patch.name,
    variant: patch.variant,
    manufacturer: patch.manufacturer,
    year: patch.year,
    playfield_image_url: patch.playfieldImageUrl,
    rulesheet_url: patch.rulesheetUrl,
    tutorial_links_json: serializeVenueUrlSlots(patch.tutorialLinks),
    gameplay_links_json: serializeVenueUrlSlots(patch.gameplayLinks),
    competition_links_json: serializeVenueUrlSlots(patch.competitionLinks),
    created_at: existing?.created_at ?? nowIso(),
    updated_at: nowIso(),
  };

  adminDb.prepare(`
    INSERT INTO venue_entry_overrides (
      library_entry_id,
      source_id,
      source_name,
      source_type,
      practice_identity,
      opdb_id,
      area,
      area_order,
      group_number,
      position,
      bank,
      name,
      variant,
      manufacturer,
      year,
      playfield_image_url,
      rulesheet_url,
      tutorial_links_json,
      gameplay_links_json,
      competition_links_json,
      created_at,
      updated_at
    ) VALUES (
      @library_entry_id,
      @source_id,
      @source_name,
      @source_type,
      @practice_identity,
      @opdb_id,
      @area,
      @area_order,
      @group_number,
      @position,
      @bank,
      @name,
      @variant,
      @manufacturer,
      @year,
      @playfield_image_url,
      @rulesheet_url,
      @tutorial_links_json,
      @gameplay_links_json,
      @competition_links_json,
      @created_at,
      @updated_at
    )
    ON CONFLICT(library_entry_id) DO UPDATE SET
      source_id=excluded.source_id,
      source_name=excluded.source_name,
      source_type=excluded.source_type,
      practice_identity=excluded.practice_identity,
      opdb_id=excluded.opdb_id,
      area=excluded.area,
      area_order=excluded.area_order,
      group_number=excluded.group_number,
      position=excluded.position,
      bank=excluded.bank,
      name=excluded.name,
      variant=excluded.variant,
      manufacturer=excluded.manufacturer,
      year=excluded.year,
      playfield_image_url=excluded.playfield_image_url,
      rulesheet_url=excluded.rulesheet_url,
      tutorial_links_json=excluded.tutorial_links_json,
      gameplay_links_json=excluded.gameplay_links_json,
      competition_links_json=excluded.competition_links_json,
      updated_at=excluded.updated_at
  `).run(next);
  syncVenueLayoutAsset(libraryEntryId);

  return { row: next, reset: false };
}

function syncVenueLayoutAsset(libraryEntryId: string) {
  const base = getVenueStudioBaseComparableRow(libraryEntryId);
  if (!base || base.sourceType !== "venue" || !base.sourceId || !base.opdbId) {
    adminDb.prepare("DELETE FROM venue_layout_assets WHERE library_entry_id = ?").run(libraryEntryId);
    return;
  }

  const override = adminDb
    .prepare("SELECT * FROM venue_entry_overrides WHERE library_entry_id = ?")
    .get(libraryEntryId) as VenueEntryOverrideRecord | undefined;
  const existing = adminDb
    .prepare("SELECT created_at FROM venue_layout_assets WHERE library_entry_id = ?")
    .get(libraryEntryId) as { created_at: string } | undefined;
  const now = nowIso();

  adminDb.prepare(`
    INSERT INTO venue_layout_assets (
      library_entry_id,
      source_id,
      source_name,
      source_type,
      practice_identity,
      opdb_id,
      area,
      area_order,
      group_number,
      position,
      bank,
      created_at,
      updated_at
    ) VALUES (
      @library_entry_id,
      @source_id,
      @source_name,
      @source_type,
      @practice_identity,
      @opdb_id,
      @area,
      @area_order,
      @group_number,
      @position,
      @bank,
      @created_at,
      @updated_at
    )
    ON CONFLICT(library_entry_id) DO UPDATE SET
      source_id=excluded.source_id,
      source_name=excluded.source_name,
      source_type=excluded.source_type,
      practice_identity=excluded.practice_identity,
      opdb_id=excluded.opdb_id,
      area=excluded.area,
      area_order=excluded.area_order,
      group_number=excluded.group_number,
      position=excluded.position,
      bank=excluded.bank,
      updated_at=excluded.updated_at
  `).run({
    library_entry_id: libraryEntryId,
    source_id: base.sourceId,
    source_name: base.sourceName,
    source_type: base.sourceType,
    practice_identity: base.practiceIdentity,
    opdb_id: base.opdbId,
    area: override?.area ?? base.area,
    area_order: override?.area_order ?? base.areaOrder,
    group_number: override?.group_number ?? base.groupNumber,
    position: override?.position ?? base.position,
    bank: override?.bank ?? base.bank,
    created_at: existing?.created_at ?? override?.created_at ?? now,
    updated_at: override?.updated_at ?? now,
  });
}

function deleteVenueEntryOverride(libraryEntryId: string) {
  adminDb.prepare("DELETE FROM venue_entry_overrides WHERE library_entry_id = ?").run(libraryEntryId);
  syncVenueLayoutAsset(libraryEntryId);
}

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function buildVenueStudioCsv(sourceId: string) {
  const snapshot = getVenueStudioSnapshot();
  const source = snapshot.sources.find((item) => item.sourceId === sourceId);
  if (!source) {
    throw new Error(`Unknown venue source: ${sourceId}`);
  }
  const rows = snapshot.rows.filter((row) => row.sourceId === sourceId);
  const headers = [
    "library_entry_id",
    "practice_identity",
    "opdb_id",
    "Venue",
    "PM_location_id",
    "Venue Location",
    "Area",
    "AreaOrder",
    "Group",
    "Position",
    "Bank",
    "Game",
    "Variant",
    "Manufacturer",
    "Year",
    "Playfield Image",
    "Rulesheet",
    "Tutorial 1",
    "Tutorial 2",
    "Tutorial 3",
    "Tutorial 4",
    "Gameplay 1",
    "Gameplay 2",
    "Gameplay 3",
    "Gameplay 4",
    "Competition 1",
    "Competition 2",
    "Competition 3",
    "Competition 4",
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.libraryEntryId,
        row.practiceIdentity,
        row.opdbId,
        row.sourceName,
        row.pmLocationId,
        row.venueLocation,
        row.area,
        row.areaOrder,
        row.groupNumber,
        row.position,
        row.bank,
        row.name,
        row.variant,
        row.manufacturer,
        row.year,
        row.links.playfieldImageUrl,
        row.links.rulesheetUrl,
        row.links.tutorial[0] ?? null,
        row.links.tutorial[1] ?? null,
        row.links.tutorial[2] ?? null,
        row.links.tutorial[3] ?? null,
        row.links.gameplay[0] ?? null,
        row.links.gameplay[1] ?? null,
        row.links.gameplay[2] ?? null,
        row.links.gameplay[3] ?? null,
        row.links.competition[0] ?? null,
        row.links.competition[1] ?? null,
        row.links.competition[2] ?? null,
        row.links.competition[3] ?? null,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];

  return {
    fileName: `${source.sourceName.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "venue"}.csv`,
    csv: `${lines.join("\n")}\n`,
  };
}

function getCatalogVideoLinks(practiceIdentity: string): MachineVideoLinkRow[] {
  return seedDb.prepare(`
    SELECT
      practice_identity AS practiceIdentity,
      provider,
      kind,
      label,
      url,
      priority
    FROM catalog_video_links
    WHERE practice_identity = ?
    ORDER BY lower(provider), lower(kind), priority, lower(label)
  `).all(practiceIdentity) as MachineVideoLinkRow[];
}

function getOverrideVideoLinks(practiceIdentity: string): MachineVideoLinkRow[] {
  const assetRows = adminDb.prepare(`
    SELECT
      opdb_id AS practiceIdentity,
      'pinprof' AS provider,
      kind,
      label,
      url,
      priority
    FROM video_assets
    WHERE opdb_id = ?
      AND provider = 'pinprof'
      AND is_active = 1
      AND is_hidden = 0
    ORDER BY priority, lower(kind), lower(label)
  `).all(practiceIdentity) as MachineVideoLinkRow[];
  if (assetRows.length) return assetRows;
  return adminDb.prepare(`
    SELECT
      practice_identity AS practiceIdentity,
      'override' AS provider,
      kind,
      label,
      url,
      priority
    FROM machine_video_overrides
    WHERE practice_identity = ?
    ORDER BY priority, lower(kind), lower(label)
  `).all(practiceIdentity) as MachineVideoLinkRow[];
}

function getCatalogRulesheetLinks(practiceIdentity: string): MachineRulesheetLinkRow[] {
  return seedDb.prepare(`
    SELECT
      practice_identity AS practiceIdentity,
      provider,
      label,
      url,
      priority
    FROM catalog_rulesheet_links
    WHERE practice_identity = ?
    ORDER BY lower(provider), priority, lower(label)
  `).all(practiceIdentity) as MachineRulesheetLinkRow[];
}

function getOverrideRulesheetLinks(practiceIdentity: string): MachineRulesheetLinkRow[] {
  const assetRows = adminDb.prepare(`
    SELECT
      opdb_id AS practiceIdentity,
      'pinprof' AS provider,
      label,
      url,
      priority
    FROM rulesheet_assets
    WHERE opdb_id = ?
      AND provider = 'pinprof'
      AND is_active = 1
      AND is_hidden = 0
      AND url IS NOT NULL
      AND trim(url) != ''
    ORDER BY priority, lower(label)
  `).all(practiceIdentity) as MachineRulesheetLinkRow[];
  if (assetRows.length) return assetRows;
  return seedDb.prepare(`
    SELECT
      practice_identity AS practiceIdentity,
      'override' AS provider,
      label,
      url,
      priority
    FROM override_rulesheet_links
    WHERE practice_identity = ?
    ORDER BY priority, lower(label)
  `).all(practiceIdentity) as MachineRulesheetLinkRow[];
}

function getGameinfoAssetRecord(practiceIdentity: string): AdminGameinfoAssetRecord | null {
  return (
    adminDb.prepare(`
      SELECT
        gameinfo_asset_id,
        opdb_id,
        provider,
        label,
        local_path,
        priority,
        is_hidden,
        is_active,
        note,
        created_at,
        updated_at
      FROM gameinfo_assets
      WHERE opdb_id = ?
        AND provider = 'pinprof'
        AND is_active = 1
        AND is_hidden = 0
        AND local_path IS NOT NULL
        AND trim(local_path) != ''
      ORDER BY priority, lower(local_path)
      LIMIT 1
    `).get(practiceIdentity) as AdminGameinfoAssetRecord | undefined
  ) ?? null;
}

function dedupeRulesheetLinks(links: Array<{ label: string; url: string; priority: number }>) {
  const seen = new Set<string>();
  const deduped: Array<{ label: string; url: string; priority: number }> = [];
  for (const link of links) {
    const url = cleanString(link.url);
    const label = cleanString(link.label);
    if (!url || !label) continue;
    const key = `${label}::${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ label, url, priority: link.priority });
  }
  return deduped.sort((left, right) => left.priority - right.priority || left.label.localeCompare(right.label));
}

function getMachineAliases(practiceIdentity: string): MachineAliasRow[] {
  return seedDb.prepare(`
    SELECT
      opdb_machine_id AS opdbMachineId,
      slug,
      name,
      variant,
      primary_image_large_url AS primaryImageUrl,
      playfield_image_large_url AS playfieldImageUrl,
      updated_at AS updatedAt
    FROM machines
    WHERE practice_identity = ?
    ORDER BY
      CASE WHEN variant IS NULL OR trim(variant) = '' THEN 0 ELSE 1 END,
      lower(coalesce(variant, '')),
      lower(opdb_machine_id)
  `).all(practiceIdentity) as MachineAliasRow[];
}

bootstrapLegacyPlayfieldAssets();
bootstrapLegacyGameinfoAssets();

function getPlayfieldAssetRecords(practiceIdentity: string): PlayfieldAssetRecord[] {
  return adminDb
    .prepare(`
      SELECT
        playfield_asset_id,
        practice_identity,
        source_opdb_machine_id,
        covered_alias_ids_json,
        playfield_local_path,
        playfield_original_local_path,
        playfield_reference_local_path,
        playfield_source_url,
        playfield_source_page_url,
        playfield_source_page_snapshot_path,
        playfield_source_note,
        playfield_web_local_path_1400,
        playfield_web_local_path_700,
        playfield_mask_polygon_json,
        created_at,
        updated_at
      FROM playfield_assets
      WHERE practice_identity = ?
      ORDER BY datetime(updated_at) DESC, lower(source_opdb_machine_id)
    `)
    .all(practiceIdentity) as PlayfieldAssetRecord[];
}

function resolvePlayfieldAssetForAlias(practiceIdentity: string, aliasId: string | null, assets?: PlayfieldAssetRecord[]) {
  const requestedAliasId = cleanString(aliasId);
  if (!requestedAliasId) return null;
  const rows = assets ?? getPlayfieldAssetRecords(practiceIdentity);
  let best: { score: number; row: PlayfieldAssetRecord } | null = null;
  for (const row of rows) {
    const fsPath = toPinballFsPath(row.playfield_local_path);
    if (!fsPath || !fs.existsSync(fsPath)) continue;
    const score = scorePlayfieldSourceMatch(requestedAliasId, row.source_opdb_machine_id);
    if (score < 0) continue;
    if (!best || score > best.score) {
      best = { score, row };
    }
  }
  return best?.row ?? null;
}

function pickPrimaryPlayfieldAsset(practiceIdentity: string, assets?: PlayfieldAssetRecord[]) {
  const rows = assets ?? getPlayfieldAssetRecords(practiceIdentity);
  if (!rows.length) return null;
  const preferredAlias = resolvePlayfieldAlias(practiceIdentity, null, undefined, getOverrideRecord(practiceIdentity));
  return (
    resolvePlayfieldAssetForAlias(practiceIdentity, preferredAlias.opdbMachineId, rows) ??
    rows[0]
  );
}

function syncLegacyPlayfieldOverride(practiceIdentity: string, assetRows?: PlayfieldAssetRecord[]) {
  const primary = pickPrimaryPlayfieldAsset(practiceIdentity, assetRows);
  if (!primary) return;
  upsertOverride(practiceIdentity, {
    opdb_machine_id: primary.source_opdb_machine_id,
    playfield_local_path: primary.playfield_local_path,
    playfield_source_url: primary.playfield_source_url,
    playfield_source_note: primary.playfield_source_note,
  });
}

function bootstrapLegacyGameinfoAssets() {
  const legacyRows = adminDb
    .prepare(`
      SELECT practice_identity, gameinfo_local_path, created_at, updated_at
      FROM machine_overrides
      WHERE gameinfo_local_path IS NOT NULL AND trim(gameinfo_local_path) != ''
    `)
    .all() as Array<{ practice_identity: string; gameinfo_local_path: string; created_at: string; updated_at: string }>;

  if (!legacyRows.length) return;

  const hasRows = (
    adminDb.prepare("SELECT COUNT(*) AS total FROM gameinfo_assets").get() as { total: number }
  ).total;
  if (hasRows > 0) return;

  const insert = adminDb.prepare(`
    INSERT INTO gameinfo_assets (
      opdb_id,
      provider,
      label,
      local_path,
      priority,
      is_hidden,
      is_active,
      note,
      created_at,
      updated_at
    ) VALUES (?, 'pinprof', 'Game Info (PinProf)', ?, 0, 0, 1, NULL, ?, ?)
  `);
  const transaction = adminDb.transaction((rows: typeof legacyRows) => {
    for (const row of rows) {
      insert.run(row.practice_identity, row.gameinfo_local_path, row.created_at, row.updated_at);
    }
  });

  transaction(legacyRows);
}

function bootstrapLegacyPlayfieldAssets() {
  const legacyRows = adminDb
    .prepare(`
      SELECT *
      FROM machine_overrides
      WHERE playfield_local_path IS NOT NULL AND trim(playfield_local_path) != ''
    `)
    .all() as OverrideRecord[];

  if (!legacyRows.length) return;

  const hasRows = (
    adminDb.prepare("SELECT COUNT(*) AS total FROM playfield_assets").get() as { total: number }
  ).total;
  if (hasRows > 0) return;

  const insert = adminDb.prepare(`
    INSERT INTO playfield_assets (
      practice_identity,
      source_opdb_machine_id,
      covered_alias_ids_json,
      playfield_local_path,
      playfield_original_local_path,
      playfield_reference_local_path,
      playfield_source_url,
      playfield_source_page_url,
      playfield_source_page_snapshot_path,
      playfield_source_note,
      playfield_web_local_path_1400,
      playfield_web_local_path_700,
      playfield_mask_polygon_json,
      created_at,
      updated_at
    ) VALUES (
      @practice_identity,
      @source_opdb_machine_id,
      @covered_alias_ids_json,
      @playfield_local_path,
      @playfield_original_local_path,
      @playfield_reference_local_path,
      @playfield_source_url,
      @playfield_source_page_url,
      @playfield_source_page_snapshot_path,
      @playfield_source_note,
      @playfield_web_local_path_1400,
      @playfield_web_local_path_700,
      @playfield_mask_polygon_json,
      @created_at,
      @updated_at
    )
    ON CONFLICT(practice_identity, source_opdb_machine_id) DO UPDATE SET
      covered_alias_ids_json=excluded.covered_alias_ids_json,
      playfield_local_path=excluded.playfield_local_path,
      playfield_original_local_path=excluded.playfield_original_local_path,
      playfield_reference_local_path=excluded.playfield_reference_local_path,
      playfield_source_url=excluded.playfield_source_url,
      playfield_source_page_url=excluded.playfield_source_page_url,
      playfield_source_page_snapshot_path=excluded.playfield_source_page_snapshot_path,
      playfield_source_note=excluded.playfield_source_note,
      playfield_web_local_path_1400=excluded.playfield_web_local_path_1400,
      playfield_web_local_path_700=excluded.playfield_web_local_path_700,
      playfield_mask_polygon_json=excluded.playfield_mask_polygon_json,
      updated_at=excluded.updated_at
  `);

  const transaction = adminDb.transaction((rows: OverrideRecord[]) => {
    for (const row of rows) {
      const aliases = getMachineAliases(row.practice_identity);
      if (!aliases.length) continue;
      const sourceAlias = resolvePlayfieldAlias(row.practice_identity, row.opdb_machine_id, aliases, row);
      insert.run({
        practice_identity: row.practice_identity,
        source_opdb_machine_id: sourceAlias.opdbMachineId,
        covered_alias_ids_json: stringifyCoveredAliasIds([sourceAlias.opdbMachineId]),
        playfield_local_path: row.playfield_local_path,
        playfield_original_local_path: null,
        playfield_reference_local_path: null,
        playfield_source_url: row.playfield_source_url,
        playfield_source_page_url: null,
        playfield_source_page_snapshot_path: null,
        playfield_source_note: row.playfield_source_note,
        playfield_web_local_path_1400: null,
        playfield_web_local_path_700: null,
        playfield_mask_polygon_json: null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }
  });

  transaction(legacyRows);
}

async function renameExistingPlayfieldFiles(currentBase: string, nextBase: string) {
  if (currentBase === nextBase) return;
  await renamePrefixedFiles(SHARED_PLAYFIELDS_DIR, currentBase, nextBase);
  if (PLAYFIELD_DEPLOY_MIRROR_DIR) {
    await renamePrefixedFiles(PLAYFIELD_DEPLOY_MIRROR_DIR, currentBase, nextBase);
  }
  await renamePrefixedFiles(PLAYFIELD_SOURCE_ORIGINALS_DIR, currentBase, nextBase);
  await renamePrefixedFiles(PLAYFIELD_SOURCE_REFERENCES_DIR, currentBase, nextBase);
}

async function ensureExistingPlayfieldPath(practiceIdentity: string, sourceAliasId: string, existingPath: string | null) {
  const aliasBase = playfieldBaseName(sourceAliasId);
  const directAliasPath = findExistingPlayfieldWebPath(aliasBase);
  if (directAliasPath) return directAliasPath;

  const currentBase = playfieldBaseNameFromWebPath(existingPath) ?? practicePlayfieldBaseName(practiceIdentity);
  const currentPath = findExistingPlayfieldWebPath(currentBase);
  if (!currentPath) {
    throw new Error(`No local playfield file found for ${sourceAliasId}. Upload or import one first.`);
  }
  await renameExistingPlayfieldFiles(currentBase, aliasBase);
  return findExistingPlayfieldWebPath(aliasBase);
}

function upsertPlayfieldAssetRecord(
  practiceIdentity: string,
  sourceAliasId: string,
  patch: Pick<
    PlayfieldAssetRecord,
    | "playfield_local_path"
    | "playfield_original_local_path"
    | "playfield_reference_local_path"
    | "playfield_source_url"
    | "playfield_source_page_url"
    | "playfield_source_page_snapshot_path"
    | "playfield_source_note"
    | "playfield_web_local_path_1400"
    | "playfield_web_local_path_700"
    | "playfield_mask_polygon_json"
  >,
) {
  const existing = adminDb
    .prepare(`
      SELECT *
      FROM playfield_assets
      WHERE practice_identity = ? AND source_opdb_machine_id = ?
    `)
    .get(practiceIdentity, sourceAliasId) as PlayfieldAssetRecord | undefined;
  const now = nowIso();

  adminDb
    .prepare(`
      INSERT INTO playfield_assets (
        practice_identity,
        source_opdb_machine_id,
        covered_alias_ids_json,
        playfield_local_path,
        playfield_original_local_path,
        playfield_reference_local_path,
        playfield_source_url,
        playfield_source_page_url,
        playfield_source_page_snapshot_path,
        playfield_source_note,
        playfield_web_local_path_1400,
        playfield_web_local_path_700,
        playfield_mask_polygon_json,
        created_at,
        updated_at
      ) VALUES (
        @practice_identity,
        @source_opdb_machine_id,
        @covered_alias_ids_json,
        @playfield_local_path,
        @playfield_original_local_path,
        @playfield_reference_local_path,
        @playfield_source_url,
        @playfield_source_page_url,
        @playfield_source_page_snapshot_path,
        @playfield_source_note,
        @playfield_web_local_path_1400,
        @playfield_web_local_path_700,
        @playfield_mask_polygon_json,
        @created_at,
        @updated_at
      )
      ON CONFLICT(practice_identity, source_opdb_machine_id) DO UPDATE SET
        covered_alias_ids_json=excluded.covered_alias_ids_json,
        playfield_local_path=excluded.playfield_local_path,
        playfield_original_local_path=excluded.playfield_original_local_path,
        playfield_reference_local_path=excluded.playfield_reference_local_path,
        playfield_source_url=excluded.playfield_source_url,
        playfield_source_page_url=excluded.playfield_source_page_url,
        playfield_source_page_snapshot_path=excluded.playfield_source_page_snapshot_path,
        playfield_source_note=excluded.playfield_source_note,
        playfield_web_local_path_1400=excluded.playfield_web_local_path_1400,
        playfield_web_local_path_700=excluded.playfield_web_local_path_700,
        playfield_mask_polygon_json=excluded.playfield_mask_polygon_json,
        updated_at=excluded.updated_at
    `)
    .run({
      practice_identity: practiceIdentity,
      source_opdb_machine_id: sourceAliasId,
      covered_alias_ids_json: stringifyCoveredAliasIds([sourceAliasId]),
      playfield_local_path: patch.playfield_local_path,
      playfield_original_local_path: patch.playfield_original_local_path,
      playfield_reference_local_path: patch.playfield_reference_local_path,
      playfield_source_url: patch.playfield_source_url,
      playfield_source_page_url: patch.playfield_source_page_url,
      playfield_source_page_snapshot_path: patch.playfield_source_page_snapshot_path,
      playfield_source_note: patch.playfield_source_note,
      playfield_web_local_path_1400: patch.playfield_web_local_path_1400,
      playfield_web_local_path_700: patch.playfield_web_local_path_700,
      playfield_mask_polygon_json: patch.playfield_mask_polygon_json,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });

  syncLegacyPlayfieldOverride(practiceIdentity, getPlayfieldAssetRecords(practiceIdentity));
}

function reassignPlayfieldAssetRecord(
  playfieldAssetId: number,
  sourceAliasId: string,
  patch: Pick<
    PlayfieldAssetRecord,
    | "playfield_local_path"
    | "playfield_original_local_path"
    | "playfield_reference_local_path"
    | "playfield_source_url"
    | "playfield_source_page_url"
    | "playfield_source_page_snapshot_path"
    | "playfield_source_note"
    | "playfield_web_local_path_1400"
    | "playfield_web_local_path_700"
    | "playfield_mask_polygon_json"
  >,
) {
  adminDb
    .prepare(`
      UPDATE playfield_assets
      SET
        source_opdb_machine_id = ?,
        covered_alias_ids_json = ?,
        playfield_local_path = ?,
        playfield_original_local_path = ?,
        playfield_reference_local_path = ?,
        playfield_source_url = ?,
        playfield_source_page_url = ?,
        playfield_source_page_snapshot_path = ?,
        playfield_source_note = ?,
        playfield_web_local_path_1400 = ?,
        playfield_web_local_path_700 = ?,
        playfield_mask_polygon_json = ?,
        updated_at = ?
      WHERE playfield_asset_id = ?
    `)
    .run(
      sourceAliasId,
      stringifyCoveredAliasIds([sourceAliasId]),
      patch.playfield_local_path,
      patch.playfield_original_local_path,
      patch.playfield_reference_local_path,
      patch.playfield_source_url,
      patch.playfield_source_page_url,
      patch.playfield_source_page_snapshot_path,
      patch.playfield_source_note,
      patch.playfield_web_local_path_1400,
      patch.playfield_web_local_path_700,
      patch.playfield_mask_polygon_json,
      nowIso(),
      playfieldAssetId,
    );
}

function formatAliasLabel(alias: MachineAliasRow) {
  return [alias.opdbMachineId, cleanString(alias.variant) ?? cleanString(alias.name)].filter(Boolean).join(" · ") || alias.opdbMachineId;
}

function recordActivity(
  practiceIdentity: string,
  actionType: string,
  summary: string,
  details?: Record<string, string | null | undefined>,
) {
  const normalizedDetails = Object.fromEntries(
    Object.entries(details ?? {}).flatMap(([label, value]) => {
      const normalized = cleanString(value);
      return normalized ? [[label, normalized]] : [];
    }),
  );

  adminDb
    .prepare(`
      INSERT INTO activity_log (
        practice_identity,
        action_type,
        summary,
        details_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?)
    `)
    .run(
      practiceIdentity,
      actionType,
      summary,
      Object.keys(normalizedDetails).length ? JSON.stringify(normalizedDetails) : null,
      nowIso(),
    );
}

function getActivityRecords(practiceIdentity: string, limit = 30): ActivityRecord[] {
  return adminDb
    .prepare(`
      SELECT
        activity_id,
        practice_identity,
        action_type,
        summary,
        details_json,
        created_at
      FROM activity_log
      WHERE practice_identity = ?
      ORDER BY datetime(created_at) DESC, activity_id DESC
      LIMIT ?
    `)
    .all(practiceIdentity, limit) as ActivityRecord[];
}

function buildActivityPayload(practiceIdentity: string) {
  return getActivityRecords(practiceIdentity).map((row) => {
    let details: Array<{ label: string; value: string }> = [];
    if (row.details_json) {
      try {
        const parsed = JSON.parse(row.details_json) as Record<string, unknown>;
        details = Object.entries(parsed)
          .map(([label, value]) => [label, cleanString(value)] as const)
          .filter((entry): entry is [string, string] => Boolean(entry[1]))
          .map(([label, value]) => ({ label, value }));
      } catch {
        details = [];
      }
    }
    return {
      activityId: row.activity_id,
      actionType: row.action_type,
      summary: row.summary,
      details,
      createdAt: row.created_at,
    };
  });
}

function findPinsideAuditMatch(
  name: string | null | undefined,
  variant: string | null | undefined,
  manufacturer: string | null | undefined,
  year: string | number | null | undefined,
): PinsideAuditLookupEntry | null {
  const fingerprint = buildPinsideFingerprint(name, variant, manufacturer, year);
  if (!fingerprint) return null;
  const matches = PINSIDE_AUDIT_LOOKUP_INDEX.byFingerprint.get(fingerprint) ?? [];
  const deduped = Array.from(new Map(matches.map((entry) => [entry.pinsideId, entry])).values());
  return deduped.length === 1 ? deduped[0] : null;
}

function buildPinsideSearchTerm(machine: MachineRow) {
  const title = cleanString(machine.nameOverride) ?? machine.name;
  const manufacturer = cleanString(machine.manufacturerOverride) ?? machine.manufacturer;
  const year = machine.yearOverride ?? machine.year;
  const normalizedTitle = cleanString(title) ?? "";
  const isWeakTitle = normalizedTitle.length <= 4 || !/[a-z]/i.test(normalizedTitle) || /^\d+$/.test(normalizedTitle);
  if (isWeakTitle) {
    return [manufacturer, normalizedTitle, year == null ? null : String(year)].filter(Boolean).join(" ");
  }
  return normalizedTitle;
}

function resolvePinsideLaunchTarget(machine: MachineRow, memberships: MachineMembershipRow[]): PinsideLaunchTarget {
  const searchTerm = buildPinsideSearchTerm(machine) || machine.name;
  const title = cleanString(machine.nameOverride) ?? machine.name;
  const variant = cleanString(machine.variantOverride) ?? machine.variant;
  const manufacturer = cleanString(machine.manufacturerOverride) ?? machine.manufacturer;
  const year = machine.yearOverride ?? machine.year;
  const expectedYear = year == null ? null : String(year);
  const gameQuery = [title, variant].filter(Boolean).join(" ") || searchTerm;

  for (const membership of memberships) {
    const match = findPinsideAuditMatch(membership.name, membership.variant, membership.manufacturer, membership.year);
    if (match) {
      return {
        searchTerm,
        gameQuery,
        expectedTitle: title,
        expectedManufacturer: manufacturer,
        expectedYear,
        searchMode: "machine-key",
        machineKey: match.pinsideId,
        machineSlug: match.pinsideSlug,
        resolvedBy: match.sourceFile ? `audit:${match.sourceFile}` : "audit",
        machineSlugCandidates: [],
      };
    }
  }

  const machineMatch = findPinsideAuditMatch(title, variant, manufacturer, year);
  if (machineMatch) {
    return {
      searchTerm,
      gameQuery,
      expectedTitle: title,
      expectedManufacturer: manufacturer,
      expectedYear,
      searchMode: "machine-key",
      machineKey: machineMatch.pinsideId,
      machineSlug: machineMatch.pinsideSlug,
      resolvedBy: machineMatch.sourceFile ? `audit:${machineMatch.sourceFile}` : "audit",
      machineSlugCandidates: [],
    };
  }

  const slugCandidates = new Set<string>();
  for (const membership of memberships) {
    for (const slug of buildSlugCandidates(membership.slug, membership.manufacturer, membership.name, membership.variant, membership.year)) {
      slugCandidates.add(slug);
    }
  }
  for (const slug of buildSlugCandidates(machine.slug, manufacturer, title, variant, expectedYear)) {
    slugCandidates.add(slug);
  }

  const machineSlugCandidates = Array.from(slugCandidates).slice(0, 8);
  if (machineSlugCandidates.length > 0) {
    return {
      searchTerm,
      gameQuery,
      expectedTitle: title,
      expectedManufacturer: manufacturer,
      expectedYear,
      searchMode: "machine-slug",
      machineKey: null,
      machineSlug: machineSlugCandidates[0],
      resolvedBy: "slug-candidate",
      machineSlugCandidates,
    };
  }

  return {
    searchTerm,
    gameQuery,
    expectedTitle: title,
    expectedManufacturer: manufacturer,
    expectedYear,
    searchMode: "game-search",
    machineKey: null,
    machineSlug: null,
    resolvedBy: null,
    machineSlugCandidates: [],
  };
}

function readRecentLogLines(logPath: string | null, limit = 8): string[] {
  if (!logPath || !pathExists(logPath)) return [];
  try {
    const text = fs.readFileSync(logPath, "utf8");
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-limit);
  } catch {
    return [];
  }
}

function readLatestPinsideSavedFinal(session: PinsidePhotoBrowserSessionState | null): PinsideSavedFinalRecord | null {
  if (!session?.manifestPath) return null;
  const savesPath = path.join(path.dirname(session.manifestPath), "saved.json");
  if (!pathExists(savesPath)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(savesPath, "utf8")) as { saves?: Array<Record<string, unknown>> };
    const saves = Array.isArray(payload.saves) ? payload.saves : [];
    if (!saves.length) return null;
    const latest = saves
      .slice()
      .sort((left, right) => {
        const leftValue = Date.parse(cleanString(left.savedAt) ?? "") || 0;
        const rightValue = Date.parse(cleanString(right.savedAt) ?? "") || 0;
        return rightValue - leftValue;
      })[0];
    if (!latest) return null;
    return {
      adId: cleanString(latest.adId) ?? "",
      adTitle: cleanString(latest.adTitle),
      adUrl: cleanString(latest.adUrl),
      photoIndex: cleanInteger(latest.photoIndex),
      filename: cleanString(latest.filename),
      previewUrl: cleanString(latest.previewUrl),
      fullUrl: cleanString(latest.fullUrl),
      originalUrl: normalizePinsideOriginalUrl(latest.originalUrl),
      selectedAt: cleanString(latest.selectedAt),
      savedAt: cleanString(latest.savedAt),
    };
  } catch {
    return null;
  }
}

function serializePinsidePhotoBrowserSession(session: PinsidePhotoBrowserSessionState | null) {
  if (!session) {
    return {
      active: false,
      status: "idle",
      practiceIdentity: null,
      searchTerm: null,
      searchMode: null,
      machineKey: null,
      machineSlug: null,
      resolvedBy: null,
      machineSlugCandidates: [],
      viewerUrl: `http://${PINSIDE_BROWSER_HOST}:${PINSIDE_BROWSER_PORT}/`,
      logPath: null,
      manifestPath: null,
      stateFilePath: null,
      launchedAt: null,
      exitCode: null,
      signal: null,
      latestSavedFinal: null,
      recentLogLines: [],
    };
  }

  const active = session.child !== null && session.exitCode == null && session.signal == null && session.status !== "failed";
  const recentLogLines = readRecentLogLines(session.logPath);
  const latestSavedFinal = readLatestPinsideSavedFinal(session);
  return {
    active,
    status: session.status,
    practiceIdentity: session.practiceIdentity,
    searchTerm: session.searchTerm,
    searchMode: session.searchMode,
    machineKey: session.machineKey,
    machineSlug: session.machineSlug,
    resolvedBy: session.resolvedBy,
    machineSlugCandidates: session.machineSlugCandidates,
    viewerUrl: session.viewerUrl,
    logPath: session.logPath,
    manifestPath: session.manifestPath,
    stateFilePath: session.stateFilePath,
    launchedAt: session.launchedAt,
    exitCode: session.exitCode,
    signal: session.signal,
    latestSavedFinal,
    recentLogLines,
  };
}

function stopPinsidePhotoBrowserSession() {
  if (!pinsidePhotoBrowserSession?.child) return;
  try {
    pinsidePhotoBrowserSession.child.kill("SIGTERM");
  } catch {
    // Ignore failed cleanup if the child already exited.
  }
}

function terminatePinsidePhotoBrowserSession() {
  const previousSession = pinsidePhotoBrowserSession;
  stopPinsidePhotoBrowserSession();
  stopDetachedPinsideViewerProcesses();

  if (!previousSession) {
    pinsidePhotoBrowserSession = null;
    return serializePinsidePhotoBrowserSession(null);
  }

  pinsidePhotoBrowserSession = {
    ...previousSession,
    child: null,
    status: "exited",
    exitCode: previousSession.exitCode ?? 0,
    signal: previousSession.signal ?? "SIGTERM",
  };
  return serializePinsidePhotoBrowserSession(pinsidePhotoBrowserSession);
}

function stopDetachedPinsideViewerProcesses() {
  const searchPatterns = [
    `${path.basename(PINSIDE_BROWSER_SCRIPT)} serve --host ${PINSIDE_BROWSER_HOST} --port ${PINSIDE_BROWSER_PORT}`,
    `${path.basename(PINSIDE_BROWSER_SCRIPT)} launch --host ${PINSIDE_BROWSER_HOST} --port ${PINSIDE_BROWSER_PORT}`,
  ];
  for (const searchPattern of searchPatterns) {
    try {
      execFileSync("pkill", ["-f", searchPattern], { stdio: "ignore" });
    } catch {
      // Ignore when there is no matching detached process.
    }
  }
  try {
    const listeningPids = execFileSync("lsof", ["-tiTCP:" + String(PINSIDE_BROWSER_PORT), "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
    for (const pid of listeningPids) {
      try {
        process.kill(Number(pid), "SIGTERM");
      } catch {
        // Ignore processes that already exited.
      }
    }
  } catch {
    // Ignore when no process is listening on the viewer port.
  }
}

function launchPinsidePhotoBrowser(practiceIdentity: string) {
  const machine = getMachineRow(practiceIdentity);
  if (!machine) {
    throw new Error(`Unknown machine: ${practiceIdentity}`);
  }
  if (!pathExists(PINSIDE_BROWSER_SCRIPT)) {
    throw new Error(`Pinside photo browser script not found: ${PINSIDE_BROWSER_SCRIPT}`);
  }

  stopPinsidePhotoBrowserSession();
  stopDetachedPinsideViewerProcesses();

  const memberships = getMachineMembershipRows(practiceIdentity);
  const launchTarget = resolvePinsideLaunchTarget(machine, memberships);
  const searchTerm = launchTarget.searchTerm;
  const viewerUrl = `http://${PINSIDE_BROWSER_HOST}:${PINSIDE_BROWSER_PORT}/`;
  const manifestDir = path.join(MANIFESTS_DIR, "pinside_photo_browser");
  const manifestPath = path.join(manifestDir, "manifest.json");
  const picksPath = path.join(manifestDir, "picks.json");
  const savesPath = path.join(manifestDir, "saved.json");
  const stateFilePath = path.join(manifestDir, "playwright_state.json");
  const logDir = path.join(WORKSPACE_DIR, "cache");
  const logPath = path.join(logDir, "pinside_photo_browser.log");
  const hasSavedPlaywrightState = pathExists(stateFilePath);
  const shouldLaunchHeadless = hasSavedPlaywrightState && PINSIDE_BROWSER_PREFER_HEADLESS && !PINSIDE_BROWSER_FORCE_HEADED;
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(picksPath, JSON.stringify({ savedAt: nowIso(), picks: [] }, null, 2), "utf8");
  fs.writeFileSync(savesPath, JSON.stringify({ savedAt: nowIso(), saves: [] }, null, 2), "utf8");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: nowIso(),
        sourceMode: "pending",
        sourceGame: launchTarget.searchTerm,
        sourceMachineKey: launchTarget.machineKey,
        sourceMachineSlug: launchTarget.machineSlug,
        sourceMachineSlugCandidates: launchTarget.machineSlugCandidates,
        practiceIdentity,
        pending: true,
        ads: [],
      },
      null,
      2,
    ),
    "utf8",
  );
  const logFd = fs.openSync(logPath, "w");
  const childArgs = [
    PINSIDE_BROWSER_SCRIPT,
    "launch",
    "--game",
    launchTarget.gameQuery,
    "--result-limit",
    String(PINSIDE_BROWSER_DISCOVERY_LIMIT),
    "--initial-ad-limit",
    String(PINSIDE_BROWSER_INITIAL_AD_LIMIT),
    "--startup-target-limit",
    String(PINSIDE_BROWSER_STARTUP_TARGET_LIMIT),
    "--prefetch-window",
    String(PINSIDE_BROWSER_PREFETCH_WINDOW),
    "--host",
    PINSIDE_BROWSER_HOST,
    "--port",
    String(PINSIDE_BROWSER_PORT),
    "--manifest",
    manifestPath,
    "--state-file",
    stateFilePath,
  ];
  if (launchTarget.expectedTitle) {
    childArgs.push("--expected-title", launchTarget.expectedTitle);
  }
  if (launchTarget.expectedManufacturer) {
    childArgs.push("--expected-manufacturer", launchTarget.expectedManufacturer);
  }
  if (launchTarget.expectedYear) {
    childArgs.push("--expected-year", launchTarget.expectedYear);
  }
  if (shouldLaunchHeadless) {
    childArgs.push("--headless");
    if (PINSIDE_BROWSER_ALLOW_VISIBLE_RETRY) {
      childArgs.push("--allow-visible-retry");
    }
  } else if (!hasSavedPlaywrightState) {
    childArgs.push("--pause-for-login", "--login-wait-seconds", String(PINSIDE_BROWSER_LOGIN_WAIT_SECONDS));
  }
  if (launchTarget.machineKey) {
    childArgs.push("--machine-key", launchTarget.machineKey);
  }
  for (const machineSlug of launchTarget.machineSlugCandidates) {
    childArgs.push("--machine-slug", machineSlug);
  }
  const child = spawn(
    PINSIDE_BROWSER_PYTHON_BIN,
    childArgs,
    {
      cwd: ROOT,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
      stdio: ["ignore", logFd, logFd],
    },
  );

  const session: PinsidePhotoBrowserSessionState = {
    child,
    practiceIdentity,
    searchTerm,
    searchMode: launchTarget.searchMode,
    machineKey: launchTarget.machineKey,
    machineSlug: launchTarget.machineSlug,
    resolvedBy: launchTarget.resolvedBy,
    machineSlugCandidates: launchTarget.machineSlugCandidates,
    viewerUrl,
    logPath,
    manifestPath,
    stateFilePath,
    host: PINSIDE_BROWSER_HOST,
    port: PINSIDE_BROWSER_PORT,
    launchedAt: nowIso(),
    status: "starting",
    exitCode: null,
    signal: null,
  };
  pinsidePhotoBrowserSession = session;

  child.once("spawn", () => {
    if (pinsidePhotoBrowserSession === session) {
      pinsidePhotoBrowserSession = {
        ...session,
        child,
        status: "running",
      };
    }
  });

  child.once("error", () => {
    try {
      fs.closeSync(logFd);
    } catch {
      // Ignore close failures.
    }
    if (pinsidePhotoBrowserSession === session) {
      pinsidePhotoBrowserSession = {
        ...session,
        child: null,
        status: "failed",
      };
    }
  });

  child.once("exit", (code, signal) => {
    try {
      fs.closeSync(logFd);
    } catch {
      // Ignore close failures.
    }
    if (pinsidePhotoBrowserSession === session) {
      pinsidePhotoBrowserSession = {
        ...session,
        child: null,
        status: code === 0 ? "exited" : "failed",
        exitCode: code,
        signal,
      };
    }
  });

  return serializePinsidePhotoBrowserSession(session);
}

function getWorkspaceNote(workspaceKey: string): WorkspaceStateRecord | null {
  const row = adminDb
    .prepare(`
      SELECT workspace_key, note_text, updated_at
      FROM workspace_state
      WHERE workspace_key = ?
    `)
    .get(workspaceKey) as WorkspaceStateRecord | undefined;
  return row ?? null;
}

function saveWorkspaceNote(workspaceKey: string, noteText: string | null) {
  adminDb
    .prepare(`
      INSERT INTO workspace_state (
        workspace_key,
        note_text,
        updated_at
      ) VALUES (?, ?, ?)
      ON CONFLICT(workspace_key) DO UPDATE SET
        note_text = excluded.note_text,
        updated_at = excluded.updated_at
    `)
    .run(workspaceKey, noteText, nowIso());
}

function buildGlobalActivityPayload(limit = 40) {
  const rows = adminDb
    .prepare(`
      SELECT
        activity_id,
        practice_identity,
        action_type,
        summary,
        details_json,
        created_at
      FROM activity_log
      ORDER BY datetime(created_at) DESC, activity_id DESC
      LIMIT ?
    `)
    .all(limit) as ActivityRecord[];

  return rows.map((row) => {
    const machine = getMachineRow(row.practice_identity);
    let details: Array<{ label: string; value: string }> = [];
    if (row.details_json) {
      try {
        const parsed = JSON.parse(row.details_json) as Record<string, unknown>;
        details = Object.entries(parsed)
          .map(([label, value]) => [label, cleanString(value)] as const)
          .filter((entry): entry is [string, string] => Boolean(entry[1]))
          .map(([label, value]) => ({ label, value }));
      } catch {
        details = [];
      }
    }

    return {
      activityId: row.activity_id,
      practiceIdentity: row.practice_identity,
      machineTitle: machine ? [machine.name, machine.variant].filter(Boolean).join(" • ") : row.practice_identity,
      actionType: row.action_type,
      summary: row.summary,
      details,
      createdAt: row.created_at,
    };
  });
}

function resolvePlayfieldAlias(practiceIdentity: string, requestedAliasId?: string | null, aliases?: MachineAliasRow[], existing?: OverrideRecord | null) {
  const candidates = aliases ?? getMachineAliases(practiceIdentity);
  if (!candidates.length) {
    throw new Error(`No OPDB aliases found for ${practiceIdentity}`);
  }

  const requested = cleanString(requestedAliasId);
  if (requested) {
    const matched = candidates.find((alias) => alias.opdbMachineId === requested);
    if (!matched) {
      throw new Error(`Alias ${requested} does not belong to ${practiceIdentity}`);
    }
    return matched;
  }

  const existingAliasId = cleanString(existing?.opdb_machine_id);
  if (existingAliasId) {
    const matched = candidates.find((alias) => alias.opdbMachineId === existingAliasId);
    if (matched) return matched;
  }

  return candidates[0];
}

function assetOriginLabel(kind: "opdb" | "pillyliu" | "external" | "missing", detail?: string | null): string {
  if (kind === "opdb") return detail ? `OPDB · ${detail}` : "OPDB";
  if (kind === "pillyliu") return detail ? `Pillyliu local · ${detail}` : "Pillyliu local";
  if (kind === "external") return detail ? `External source · ${detail}` : "External source";
  return detail ? `Missing · ${detail}` : "Missing";
}

function isMeaningfulOverride(row: OverrideRecord): boolean {
  return [
    row.name_override,
    row.variant_override,
    row.manufacturer_override,
    row.year_override,
    row.playfield_local_path,
    row.playfield_source_url,
    row.playfield_source_note,
    row.rulesheet_local_path,
    row.rulesheet_source_url,
    row.rulesheet_source_note,
    row.gameinfo_local_path,
    row.notes,
  ].some((value) => {
    if (typeof value === "number") return true;
    return Boolean(String(value ?? "").trim());
  });
}

function upsertOverride(practiceIdentity: string, patch: Partial<OverrideRecord>) {
  const machine = getMachineRow(practiceIdentity);
  if (!machine) {
    throw new Error(`Unknown machine: ${practiceIdentity}`);
  }

  const existing = getOverrideRecord(practiceIdentity);
  const next: OverrideRecord = {
    practice_identity: practiceIdentity,
    opdb_machine_id: existing?.opdb_machine_id ?? machine.opdbMachineId,
    slug: existing?.slug ?? machine.slug,
    name_override: existing?.name_override ?? null,
    variant_override: existing?.variant_override ?? null,
    manufacturer_override: existing?.manufacturer_override ?? null,
    year_override: existing?.year_override ?? null,
    playfield_local_path: existing?.playfield_local_path ?? null,
    playfield_source_url: existing?.playfield_source_url ?? null,
    playfield_source_note: existing?.playfield_source_note ?? null,
    rulesheet_local_path: existing?.rulesheet_local_path ?? null,
    rulesheet_source_url: existing?.rulesheet_source_url ?? null,
    rulesheet_source_note: existing?.rulesheet_source_note ?? null,
    gameinfo_local_path: existing?.gameinfo_local_path ?? null,
    notes: existing?.notes ?? null,
    created_at: existing?.created_at ?? nowIso(),
    updated_at: nowIso(),
    ...patch,
  };

  if (!isMeaningfulOverride(next)) {
    adminDb.prepare("DELETE FROM machine_overrides WHERE practice_identity = ?").run(practiceIdentity);
    runApplyOverrides();
    return;
  }

  adminDb
    .prepare(`
      INSERT INTO machine_overrides (
        practice_identity,
        opdb_machine_id,
        slug,
        name_override,
        variant_override,
        manufacturer_override,
        year_override,
        playfield_local_path,
        playfield_source_url,
        playfield_source_note,
        rulesheet_local_path,
        rulesheet_source_url,
        rulesheet_source_note,
        gameinfo_local_path,
        notes,
        created_at,
        updated_at
      ) VALUES (
        @practice_identity,
        @opdb_machine_id,
        @slug,
        @name_override,
        @variant_override,
        @manufacturer_override,
        @year_override,
        @playfield_local_path,
        @playfield_source_url,
        @playfield_source_note,
        @rulesheet_local_path,
        @rulesheet_source_url,
        @rulesheet_source_note,
        @gameinfo_local_path,
        @notes,
        @created_at,
        @updated_at
      )
      ON CONFLICT(practice_identity) DO UPDATE SET
        opdb_machine_id=excluded.opdb_machine_id,
        slug=excluded.slug,
        name_override=excluded.name_override,
        variant_override=excluded.variant_override,
        manufacturer_override=excluded.manufacturer_override,
        year_override=excluded.year_override,
        playfield_local_path=excluded.playfield_local_path,
        playfield_source_url=excluded.playfield_source_url,
        playfield_source_note=excluded.playfield_source_note,
        rulesheet_local_path=excluded.rulesheet_local_path,
        rulesheet_source_url=excluded.rulesheet_source_url,
        rulesheet_source_note=excluded.rulesheet_source_note,
        gameinfo_local_path=excluded.gameinfo_local_path,
        notes=excluded.notes,
        updated_at=excluded.updated_at
    `)
    .run(next);
  runApplyOverrides();
}

function parseVideoOverrideRows(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("Videos payload must be an array.");
  }

  const normalized: Array<Pick<AdminVideoOverrideRecord, "kind" | "label" | "url" | "priority">> = [];
  value.forEach((entry, index) => {
    const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const kindInput = cleanString(row.kind);
    const labelInput = cleanString(row.label);
    const urlInput = cleanString(row.url);

    if (!kindInput && !labelInput && !urlInput) {
      return;
    }

    const rowNumber = index + 1;
    const kind = normalizeVideoKind(kindInput, `Video row ${rowNumber} kind`);
    const label = cleanString(labelInput);
    if (!label) {
      throw new Error(`Video row ${rowNumber} label is required.`);
    }
    const url = normalizeHttpUrl(urlInput, `Video row ${rowNumber} URL`);

    normalized.push({
      kind,
      label,
      url,
      priority: normalized.length,
    });
  });

  return normalized;
}

function replaceVideoOverrides(practiceIdentity: string, rows: Array<Pick<AdminVideoOverrideRecord, "kind" | "label" | "url" | "priority">>) {
  const machine = getMachineRow(practiceIdentity);
  if (!machine) {
    throw new Error(`Unknown machine: ${practiceIdentity}`);
  }

  const removeExisting = adminDb.prepare("DELETE FROM video_assets WHERE opdb_id = ? AND provider = 'pinprof'");
  const insert = adminDb.prepare(`
    INSERT INTO video_assets (
      opdb_id,
      provider,
      kind,
      label,
      url,
      priority,
      is_hidden,
      is_active,
      note,
      created_at,
      updated_at
    ) VALUES (?, 'pinprof', ?, ?, ?, ?, 0, 1, NULL, ?, ?)
  `);
  const transaction = adminDb.transaction((nextRows: Array<Pick<AdminVideoOverrideRecord, "kind" | "label" | "url" | "priority">>) => {
    removeExisting.run(practiceIdentity);
    const timestamp = nowIso();
    for (const row of nextRows) {
      insert.run(practiceIdentity, row.kind, row.label, row.url, row.priority, timestamp, timestamp);
    }
  });

  transaction(rows);
  runApplyOverrides();
}

function syncPinprofRulesheetAssets(practiceIdentity: string) {
  const override = getOverrideRecord(practiceIdentity);
  const removeExisting = adminDb.prepare("DELETE FROM rulesheet_assets WHERE opdb_id = ? AND provider = 'pinprof'");
  const insert = adminDb.prepare(`
    INSERT INTO rulesheet_assets (
      opdb_id,
      provider,
      label,
      url,
      local_path,
      source_url,
      note,
      priority,
      is_hidden,
      is_active,
      created_at,
      updated_at
    ) VALUES (?, 'pinprof', ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
  `);
  const timestamp = nowIso();
  const localPath = cleanString(override?.rulesheet_local_path);
  const sourceUrl = cleanString(override?.rulesheet_source_url);
  const sourceNote = cleanString(override?.rulesheet_source_note);

  const transaction = adminDb.transaction(() => {
    removeExisting.run(practiceIdentity);
    if (localPath) {
      insert.run(practiceIdentity, "Rulesheet (PinProf)", null, localPath, sourceUrl, sourceNote, 0, timestamp, timestamp);
      return;
    }
    if (sourceUrl && !isGeneratedRulesheetProviderUrl(sourceUrl)) {
      const normalizedUrl = normalizeRulesheetAssetUrl(sourceUrl);
      insert.run(practiceIdentity, "Rulesheet (PinProf)", normalizedUrl, null, normalizedUrl, sourceNote, 0, timestamp, timestamp);
    }
  });
  transaction();
  runApplyOverrides();
}

function syncPinprofGameinfoAssets(practiceIdentity: string) {
  const override = getOverrideRecord(practiceIdentity);
  const removeExisting = adminDb.prepare("DELETE FROM gameinfo_assets WHERE opdb_id = ? AND provider = 'pinprof'");
  const insert = adminDb.prepare(`
    INSERT INTO gameinfo_assets (
      opdb_id,
      provider,
      label,
      local_path,
      priority,
      is_hidden,
      is_active,
      note,
      created_at,
      updated_at
    ) VALUES (?, 'pinprof', 'Game Info (PinProf)', ?, 0, 0, 1, NULL, ?, ?)
  `);
  const timestamp = nowIso();
  const localPath = cleanString(override?.gameinfo_local_path);

  const transaction = adminDb.transaction(() => {
    removeExisting.run(practiceIdentity);
    if (localPath) {
      insert.run(practiceIdentity, localPath, timestamp, timestamp);
    }
  });
  transaction();
  runApplyOverrides();
}

async function readFileTextIfPresent(webPath: string | null): Promise<string> {
  const fsPath = toPinballFsPath(webPath);
  if (!fsPath) return "";
  return fsp.readFile(fsPath, "utf8").catch(() => "");
}

async function saveRulesheetMarkdown(practiceIdentity: string, markdown: string, sourceUrl: string | null, sourceNote: string | null) {
  const normalized = markdown.trim();
  if (!normalized) {
    throw new Error("Rulesheet markdown cannot be empty.");
  }

  await ensureDir(SHARED_RULESHEETS_DIR);
  const filename = `${practiceIdentity}-rulesheet.md`;
  const fsPath = path.join(SHARED_RULESHEETS_DIR, filename);
  await fsp.writeFile(fsPath, normalized.endsWith("\n") ? normalized : `${normalized}\n`, "utf8");
  upsertOverride(practiceIdentity, {
    rulesheet_local_path: `/pinball/rulesheets/${filename}`,
    rulesheet_source_url: sourceUrl,
    rulesheet_source_note: sourceNote,
  });
  syncPinprofRulesheetAssets(practiceIdentity);
  return {
    localPath: `/pinball/rulesheets/${filename}`,
  };
}

async function importRulesheetFromPath(practiceIdentity: string, sourcePath: string, sourceUrl: string | null, sourceNote: string | null) {
  const resolved = path.resolve(sourcePath);
  const stat = await fsp.stat(resolved).catch(() => null);
  if (!stat?.isFile()) {
    throw new Error(`Rulesheet file not found: ${resolved}`);
  }
  const markdown = await fsp.readFile(resolved, "utf8");
  const result = await saveRulesheetMarkdown(practiceIdentity, markdown, sourceUrl, sourceNote ?? resolved);
  return {
    ...result,
    sourcePath: resolved,
  };
}

async function saveGameinfoMarkdown(practiceIdentity: string, markdown: string) {
  const normalized = markdown.trim();
  if (!normalized) {
    throw new Error("Game info markdown cannot be empty.");
  }

  await ensureDir(SHARED_GAMEINFO_DIR);
  const filename = `${practiceIdentity}-gameinfo.md`;
  const fsPath = path.join(SHARED_GAMEINFO_DIR, filename);
  await fsp.writeFile(fsPath, normalized.endsWith("\n") ? normalized : `${normalized}\n`, "utf8");
  upsertOverride(practiceIdentity, {
    gameinfo_local_path: `/pinball/gameinfo/${filename}`,
  });
  syncPinprofGameinfoAssets(practiceIdentity);
  return {
    localPath: `/pinball/gameinfo/${filename}`,
  };
}

async function importGameinfoFromPath(practiceIdentity: string, sourcePath: string) {
  const resolved = path.resolve(sourcePath);
  const stat = await fsp.stat(resolved).catch(() => null);
  if (!stat?.isFile()) {
    throw new Error(`Game info file not found: ${resolved}`);
  }
  const markdown = await fsp.readFile(resolved, "utf8");
  const result = await saveGameinfoMarkdown(practiceIdentity, markdown);
  return {
    ...result,
    sourcePath: resolved,
  };
}

async function savePlayfield(
  practiceIdentity: string,
  machineAliasId: string | null,
  buffer: Buffer,
  sourceName: string | null,
  contentType: string | null,
  sourceUrl: string | null,
  sourcePageUrl: string | null,
  sourceNote: string | null,
  maskPoints: PlayfieldMaskPoint[] | null = null,
) {
  await Promise.all([
    ensureDir(SHARED_PLAYFIELDS_DIR),
    ensureDir(PLAYFIELD_SOURCE_ORIGINALS_DIR),
    ensureDir(PLAYFIELD_SOURCE_REFERENCES_DIR),
  ]);
  const aliases = getMachineAliases(practiceIdentity);
  const alias = resolvePlayfieldAlias(practiceIdentity, machineAliasId, aliases, getOverrideRecord(practiceIdentity));
  const baseName = playfieldBaseName(alias.opdbMachineId);
  await removeExistingPlayfieldFiles(baseName);

  const ext = inferImageExtension(sourceName, contentType);
  const assetPaths = buildPlayfieldAssetPaths(baseName, ext);
  await fsp.writeFile(assetPaths.originalFsPath, buffer);
  await publishPlayfieldDerivatives(buffer, assetPaths, maskPoints);
  await syncPublishedPlayfieldFamilyToDeployMirror(baseName, assetPaths);

  const referencePackage = await writePlayfieldReferencePackage(baseName, {
    originalFsPath: assetPaths.originalFsPath,
    referenceFsPath: assetPaths.referenceFsPath,
    sourcePageSnapshotFsPath: assetPaths.sourcePageSnapshotFsPath,
    sourceUrl,
    sourcePageUrl,
    sourceNote,
    sourceName,
    contentType,
    publishedWebPath: assetPaths.publishedWebPath,
    published1400WebPath: assetPaths.published1400WebPath,
    published700WebPath: assetPaths.published700WebPath,
    maskPoints,
  });

  upsertPlayfieldAssetRecord(practiceIdentity, alias.opdbMachineId, {
    playfield_local_path: assetPaths.publishedWebPath,
    playfield_original_local_path: assetPaths.originalFsPath,
    playfield_reference_local_path: referencePackage.referencePath,
    playfield_source_url: sourceUrl,
    playfield_source_page_url: sourcePageUrl,
    playfield_source_page_snapshot_path: referencePackage.snapshotPath,
    playfield_source_note: sourceNote,
    playfield_web_local_path_1400: assetPaths.published1400WebPath,
    playfield_web_local_path_700: assetPaths.published700WebPath,
    playfield_mask_polygon_json: stringifyPlayfieldMaskPoints(maskPoints),
  });
  runApplyOverrides();
  return {
    sourceAliasId: alias.opdbMachineId,
    sourceAliasLabel: formatAliasLabel(alias),
    localPath: assetPaths.publishedWebPath,
  };
}

async function importPlayfieldFromUrl(
  practiceIdentity: string,
  machineAliasId: string | null,
  sourceUrl: string,
  sourcePageUrl: string | null,
  sourceNote: string | null,
) {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Image download failed with ${response.status}`);
  }
  const contentType = response.headers.get("content-type");
  if (contentType && !contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`Remote content is not an image: ${contentType}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return savePlayfield(practiceIdentity, machineAliasId, buffer, sourceUrl, contentType, sourceUrl, sourcePageUrl, sourceNote ?? sourceUrl);
}

async function importPlayfieldFromPath(
  practiceIdentity: string,
  machineAliasId: string | null,
  sourcePath: string,
  sourceUrl: string | null,
  sourcePageUrl: string | null,
  sourceNote: string | null,
) {
  const resolved = path.resolve(sourcePath);
  const stat = await fsp.stat(resolved).catch(() => null);
  if (!stat?.isFile()) {
    throw new Error(`Image file not found: ${resolved}`);
  }
  const buffer = await fsp.readFile(resolved);
  const result = await savePlayfield(
    practiceIdentity,
    machineAliasId,
    buffer,
    resolved,
    null,
    sourceUrl,
    sourcePageUrl,
    sourceNote ?? resolved,
  );
  return {
    ...result,
    sourcePath: resolved,
  };
}

async function savePlayfieldMask(
  practiceIdentity: string,
  machineAliasId: string | null,
  maskPoints: PlayfieldMaskPoint[] | null,
) {
  const aliases = getMachineAliases(practiceIdentity);
  const alias = resolvePlayfieldAlias(practiceIdentity, machineAliasId, aliases, getOverrideRecord(practiceIdentity));
  const asset =
    getPlayfieldAssetRecords(practiceIdentity).find((row) => row.source_opdb_machine_id === alias.opdbMachineId) ??
    resolvePlayfieldAssetForAlias(practiceIdentity, alias.opdbMachineId);
  if (!asset) {
    throw new Error("Import or upload a playfield before saving a polygon mask.");
  }

  const sourceFsPath = resolvePlayfieldEditorFsPath(asset);
  if (!sourceFsPath) {
    throw new Error("No original playfield source file is available for mask editing.");
  }

  await Promise.all([
    ensureDir(SHARED_PLAYFIELDS_DIR),
    ensureDir(PLAYFIELD_SOURCE_ORIGINALS_DIR),
    ensureDir(PLAYFIELD_SOURCE_REFERENCES_DIR),
  ]);

  const baseName = playfieldBaseName(alias.opdbMachineId);
  const assetPaths = buildPlayfieldAssetPaths(baseName, playfieldSourceExtension(asset.playfield_original_local_path));
  const buffer = await fsp.readFile(sourceFsPath);
  await publishPlayfieldDerivatives(buffer, assetPaths, maskPoints);
  await syncPublishedPlayfieldFamilyToDeployMirror(baseName, assetPaths);
  const referencePackage = await writePlayfieldReferencePackage(baseName, {
    originalFsPath: asset.playfield_original_local_path ?? sourceFsPath,
    referenceFsPath: assetPaths.referenceFsPath,
    sourcePageSnapshotFsPath: assetPaths.sourcePageSnapshotFsPath,
    sourceUrl: asset.playfield_source_url,
    sourcePageUrl: asset.playfield_source_page_url,
    sourceNote: asset.playfield_source_note,
    sourceName: path.basename(sourceFsPath),
    contentType: null,
    publishedWebPath: assetPaths.publishedWebPath,
    published1400WebPath: assetPaths.published1400WebPath,
    published700WebPath: assetPaths.published700WebPath,
    maskPoints,
  });

  upsertPlayfieldAssetRecord(practiceIdentity, alias.opdbMachineId, {
    playfield_local_path: assetPaths.publishedWebPath,
    playfield_original_local_path: asset.playfield_original_local_path ?? sourceFsPath,
    playfield_reference_local_path: referencePackage.referencePath,
    playfield_source_url: asset.playfield_source_url,
    playfield_source_page_url: asset.playfield_source_page_url,
    playfield_source_page_snapshot_path: referencePackage.snapshotPath ?? asset.playfield_source_page_snapshot_path,
    playfield_source_note: asset.playfield_source_note,
    playfield_web_local_path_1400: assetPaths.published1400WebPath,
    playfield_web_local_path_700: assetPaths.published700WebPath,
    playfield_mask_polygon_json: stringifyPlayfieldMaskPoints(maskPoints),
  });
  runApplyOverrides();

  return {
    sourceAliasId: alias.opdbMachineId,
    sourceAliasLabel: formatAliasLabel(alias),
    localPath: assetPaths.publishedWebPath,
    maskPoints,
  };
}

async function savePlayfieldCoverage(
  practiceIdentity: string,
  machineAliasId: string | null,
  sourceUrl: string | null,
  sourcePageUrl: string | null,
  sourceNote: string | null,
) {
  const aliases = getMachineAliases(practiceIdentity);
  const alias = resolvePlayfieldAlias(practiceIdentity, machineAliasId, aliases, getOverrideRecord(practiceIdentity));
  const existingAsset = getPlayfieldAssetRecords(practiceIdentity).find((row) => row.source_opdb_machine_id === alias.opdbMachineId) ?? null;
  const fallbackAsset = existingAsset ?? resolvePlayfieldAssetForAlias(practiceIdentity, alias.opdbMachineId);
  const localPath = await ensureExistingPlayfieldPath(
    practiceIdentity,
    alias.opdbMachineId,
    fallbackAsset?.playfield_local_path ?? null,
  );
  const reboundPaths = buildPlayfieldAssetPaths(
    playfieldBaseName(alias.opdbMachineId),
    playfieldSourceExtension(existingAsset?.playfield_original_local_path ?? fallbackAsset?.playfield_original_local_path ?? null),
  );
  const reboundOriginalLocalPath = fs.existsSync(reboundPaths.originalFsPath) ? reboundPaths.originalFsPath : null;
  const reboundReferenceLocalPath = fs.existsSync(reboundPaths.referenceFsPath) ? reboundPaths.referenceFsPath : null;
  const reboundSourcePageSnapshotPath = fs.existsSync(reboundPaths.sourcePageSnapshotFsPath)
    ? reboundPaths.sourcePageSnapshotFsPath
    : null;
  const rebound1400LocalPath = fs.existsSync(reboundPaths.published1400FsPath) ? reboundPaths.published1400WebPath : null;
  const rebound700LocalPath = fs.existsSync(reboundPaths.published700FsPath) ? reboundPaths.published700WebPath : null;
  if (!existingAsset && fallbackAsset && fallbackAsset.source_opdb_machine_id !== alias.opdbMachineId) {
    reassignPlayfieldAssetRecord(fallbackAsset.playfield_asset_id, alias.opdbMachineId, {
      playfield_local_path: localPath,
      playfield_original_local_path: reboundOriginalLocalPath,
      playfield_reference_local_path: reboundReferenceLocalPath,
      playfield_source_url: sourceUrl ?? fallbackAsset.playfield_source_url ?? null,
      playfield_source_page_url: sourcePageUrl ?? fallbackAsset.playfield_source_page_url ?? null,
      playfield_source_page_snapshot_path: reboundSourcePageSnapshotPath,
      playfield_source_note: sourceNote ?? fallbackAsset.playfield_source_note ?? null,
      playfield_web_local_path_1400: rebound1400LocalPath,
      playfield_web_local_path_700: rebound700LocalPath,
      playfield_mask_polygon_json: fallbackAsset.playfield_mask_polygon_json,
    });
    syncLegacyPlayfieldOverride(practiceIdentity, getPlayfieldAssetRecords(practiceIdentity));
    return {
      sourceAliasId: alias.opdbMachineId,
      sourceAliasLabel: formatAliasLabel(alias),
      localPath,
    };
  }
  upsertPlayfieldAssetRecord(practiceIdentity, alias.opdbMachineId, {
    playfield_local_path: localPath,
    playfield_original_local_path: reboundOriginalLocalPath,
    playfield_reference_local_path: reboundReferenceLocalPath,
    playfield_source_url: sourceUrl ?? existingAsset?.playfield_source_url ?? fallbackAsset?.playfield_source_url ?? null,
    playfield_source_page_url:
      sourcePageUrl ?? existingAsset?.playfield_source_page_url ?? fallbackAsset?.playfield_source_page_url ?? null,
    playfield_source_page_snapshot_path: reboundSourcePageSnapshotPath,
    playfield_source_note: sourceNote ?? existingAsset?.playfield_source_note ?? fallbackAsset?.playfield_source_note ?? null,
    playfield_web_local_path_1400: rebound1400LocalPath,
    playfield_web_local_path_700: rebound700LocalPath,
    playfield_mask_polygon_json: existingAsset?.playfield_mask_polygon_json ?? fallbackAsset?.playfield_mask_polygon_json ?? null,
  });
  return {
    sourceAliasId: alias.opdbMachineId,
    sourceAliasLabel: formatAliasLabel(alias),
    localPath,
  };
}

function buildPlayfieldAssetPayloads(practiceIdentity: string, aliases: MachineAliasRow[]) {
  const aliasMap = new Map(aliases.map((alias) => [alias.opdbMachineId, alias]));
  return getPlayfieldAssetRecords(practiceIdentity).map((row) => {
    const sourceAlias = aliasMap.get(row.source_opdb_machine_id);
    return {
      playfieldAssetId: row.playfield_asset_id,
      sourceAliasId: row.source_opdb_machine_id,
      sourceAliasLabel: sourceAlias ? formatAliasLabel(sourceAlias) : row.source_opdb_machine_id,
      localPath: row.playfield_local_path,
      originalLocalPath: row.playfield_original_local_path,
      referenceLocalPath: row.playfield_reference_local_path,
      sourceUrl: row.playfield_source_url,
      sourcePageUrl: row.playfield_source_page_url,
      sourcePageSnapshotPath: row.playfield_source_page_snapshot_path,
      sourceNote: row.playfield_source_note,
      web1400LocalPath: row.playfield_web_local_path_1400,
      web700LocalPath: row.playfield_web_local_path_700,
      maskPolygonPoints: parsePlayfieldMaskPolygonJson(row.playfield_mask_polygon_json),
      updatedAt: row.updated_at,
    };
  });
}

function authRequired(req: Request, res: Response, next: NextFunction) {
  if (verifySessionToken(req.cookies[SESSION_COOKIE])) {
    next();
    return;
  }
  jsonError(res, 401, "Authentication required.");
}

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: "12mb" }));
mountPinballStatic(app);

app.get("/api/session", (_req, res) => {
  res.json({
    authenticated: verifySessionToken(_req.cookies[SESSION_COOKIE]),
    passwordConfigured: PASSWORD_CONFIGURED,
  });
});

app.post("/api/login", (req, res) => {
  const password = cleanString(req.body?.password);
  if (!password || password !== ADMIN_PASSWORD) {
    jsonError(res, 401, "Invalid password.");
    return;
  }
  res.cookie(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });
  res.json({ authenticated: true, passwordConfigured: PASSWORD_CONFIGURED });
});

app.post("/api/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.status(204).end();
});

app.get("/api/summary", authRequired, (_req, res) => {
  const totalMachines = (
    seedDb.prepare("SELECT COUNT(DISTINCT practice_identity) AS total FROM machines").get() as { total: number }
  ).total;
  const totalOpdbRows = (seedDb.prepare("SELECT COUNT(*) AS total FROM machines").get() as { total: number }).total;
  const overriddenMachines = (
    adminDb
      .prepare(`
        SELECT COUNT(DISTINCT practice_identity) AS total
        FROM (
          SELECT practice_identity FROM machine_overrides
          UNION ALL
          SELECT practice_identity FROM playfield_assets
          UNION ALL
          SELECT opdb_id AS practice_identity
          FROM gameinfo_assets
          WHERE provider = 'pinprof'
            AND is_active = 1
            AND is_hidden = 0
          UNION ALL
          SELECT opdb_id AS practice_identity
          FROM video_assets
          WHERE provider = 'pinprof'
            AND is_active = 1
            AND is_hidden = 0
        )
      `)
      .get() as { total: number }
  ).total;
  const playfieldOverrides = (
    adminDb.prepare("SELECT COUNT(*) AS total FROM playfield_assets WHERE playfield_local_path IS NOT NULL AND trim(playfield_local_path) != ''").get() as {
      total: number;
    }
  ).total;
  const rulesheetOverrides = (
    adminDb.prepare("SELECT COUNT(*) AS total FROM machine_overrides WHERE rulesheet_local_path IS NOT NULL AND trim(rulesheet_local_path) != ''").get() as {
      total: number;
    }
  ).total;
  res.json({
    totalMachines,
    totalOpdbRows,
    overriddenMachines,
    playfieldOverrides,
    rulesheetOverrides,
    pinballLayoutMode: PINBALL_LAYOUT_MODE,
    adminDbPath: ADMIN_DB_PATH,
    seedDbPath: SEED_DB_PATH,
    playfieldsDir: SHARED_PLAYFIELDS_DIR,
    rulesheetsDir: SHARED_RULESHEETS_DIR,
    applyOverridesScript: APPLY_OVERRIDES_SCRIPT,
  });
});

app.get("/api/filters", authRequired, (_req, res) => {
  res.json(loadManufacturerFilterPayload());
});

app.get("/api/workspace/import-notes", authRequired, (_req, res) => {
  const row = getWorkspaceNote("import_notes");
  res.json({
    notes: row?.note_text ?? "",
    updatedAt: row?.updated_at ?? null,
  });
});

app.put("/api/workspace/import-notes", authRequired, (req, res) => {
  try {
    const notes = cleanString(req.body?.notes);
    saveWorkspaceNote("import_notes", notes);
    res.json({ ok: true });
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to save import notes.");
  }
});

app.get("/api/activity", authRequired, (req, res) => {
  const limit = Math.min(100, Math.max(1, cleanInteger(req.query.limit) ?? 40));
  res.json({
    items: buildGlobalActivityPayload(limit),
  });
});

app.get("/api/tools/pinside-photo-browser", authRequired, (_req, res) => {
  res.json(serializePinsidePhotoBrowserSession(pinsidePhotoBrowserSession));
});

app.post("/api/tools/pinside-photo-browser/stop", authRequired, (_req, res) => {
  try {
    const session = terminatePinsidePhotoBrowserSession();
    res.json(session);
  } catch (error) {
    jsonError(res, 500, error instanceof Error ? error.message : "Failed to stop archived playfields.");
  }
});

app.post("/api/machines/:practiceIdentity/pinside-photo-browser/launch", authRequired, (req, res) => {
  try {
    const practiceIdentity = String(req.params.practiceIdentity);
    const session = launchPinsidePhotoBrowser(practiceIdentity);
    recordActivity(practiceIdentity, "pinside_browser_launched", "Launched archived Pinside photo browser.", {
      searchTerm: session.searchTerm,
      searchMode: session.searchMode,
      machineKey: session.machineKey,
      machineSlug: session.machineSlug,
      resolvedBy: session.resolvedBy,
      viewerUrl: session.viewerUrl,
    });
    res.json(session);
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to launch Pinside photo browser.");
  }
});

app.get("/api/venue-studio", authRequired, (_req, res) => {
  res.json(getVenueStudioSnapshot());
});

app.put("/api/venue-studio/entries/:libraryEntryId", authRequired, (req, res) => {
  try {
    const libraryEntryId = String(req.params.libraryEntryId);
    const payload = parseVenueEntryEditPayload(req.body);
    const base = getVenueStudioBaseComparableRow(libraryEntryId);
    if (!base) {
      jsonError(res, 404, "Venue row not found.");
      return;
    }

    const result = upsertVenueEntryOverride(libraryEntryId, payload);
    if (base.practiceIdentity) {
      recordActivity(
        base.practiceIdentity,
        result.reset ? "venue_row_reset" : "venue_row_updated",
        result.reset
          ? `Reset ${base.sourceName} venue row for ${base.name}.`
          : `Updated ${base.sourceName} venue row for ${payload.name}.`,
        {
          source: base.sourceName,
          libraryEntryId,
          slot: [payload.area ? `A${payload.area}` : null, payload.groupNumber != null ? `G${payload.groupNumber}` : null, payload.position != null ? `P${payload.position}` : null, payload.bank != null ? `B${payload.bank}` : null]
            .filter(Boolean)
            .join(" · "),
        },
      );
    }

    const snapshot = getVenueStudioSnapshot();
    const item = snapshot.rows.find((row) => row.libraryEntryId === libraryEntryId);
    res.json({ item, reset: result.reset });
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to save venue row.");
  }
});

app.delete("/api/venue-studio/entries/:libraryEntryId", authRequired, (req, res) => {
  try {
    const libraryEntryId = String(req.params.libraryEntryId);
    const base = getVenueStudioBaseComparableRow(libraryEntryId);
    if (!base) {
      jsonError(res, 404, "Venue row not found.");
      return;
    }
    deleteVenueEntryOverride(libraryEntryId);
    if (base.practiceIdentity) {
      recordActivity(base.practiceIdentity, "venue_row_reset", `Reset ${base.sourceName} venue row for ${base.name}.`, {
        source: base.sourceName,
        libraryEntryId,
      });
    }
    res.status(204).end();
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to reset venue row.");
  }
});

app.get("/api/venue-studio/export/:sourceId.csv", authRequired, (req, res) => {
  try {
    const sourceId = String(req.params.sourceId);
    const payload = buildVenueStudioCsv(sourceId);
    res
      .status(200)
      .type("text/csv")
      .setHeader("Content-Disposition", `attachment; filename="${payload.fileName}"`)
      .send(payload.csv);
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to export venue CSV.");
  }
});

app.get("/api/control-board", authRequired, (req, res) => {
  const query = cleanString(req.query.query);
  const manufacturer = cleanString(req.query.manufacturer);
  const sourceName = cleanString(req.query.sourceName);
  const statuses = parseControlBoardStatusFilters(req.query.status);
  const sort = cleanString(req.query.sort);
  const page = Math.max(1, cleanInteger(req.query.page) ?? 1);
  const pageSize = Math.min(250, Math.max(1, cleanInteger(req.query.pageSize) ?? 50));
  const offset = (page - 1) * pageSize;
  const like = query ? `%${query}%` : null;
  const whereClauses: string[] = [];
  if (like) {
    whereClauses.push(
      `(
        c.name LIKE @like
        OR c.slug LIKE @like
        OR c.manufacturer LIKE @like
        OR c.practiceIdentity LIKE @like
        OR c.opdbGroupId LIKE @like
        OR coalesce(b.source_name, '') LIKE @like
        OR coalesce(b.area, '') LIKE @like
      )`,
    );
  }
  if (manufacturer) {
    whereClauses.push(`c.manufacturer = @manufacturer`);
  }
  if (sourceName) {
    whereClauses.push(`b.source_name = @sourceName`);
  }
  whereClauses.push(...buildControlBoardStatusClauses(statuses));
  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const orderSql =
    sort === "year_asc"
      ? `
        ORDER BY
          c.year IS NULL,
          c.year ASC,
          lower(c.manufacturer),
          lower(c.name),
          lower(coalesce(c.variant, '')),
          lower(coalesce(b.source_name, '')),
          b.area_order IS NULL,
          b.area_order,
          b.group_number IS NULL,
          b.group_number,
          b.position IS NULL,
          b.position
      `
      : sort === "year_desc"
        ? `
          ORDER BY
            c.year IS NULL,
            c.year DESC,
            lower(c.manufacturer),
            lower(c.name),
            lower(coalesce(c.variant, '')),
            lower(coalesce(b.source_name, '')),
            b.area_order IS NULL,
            b.area_order,
            b.group_number IS NULL,
            b.group_number,
            b.position IS NULL,
            b.position
        `
        : sort === "source_position"
          ? `
            ORDER BY
              lower(coalesce(b.source_name, '')),
              b.area_order IS NULL,
              b.area_order,
              b.group_number IS NULL,
              b.group_number,
              b.position IS NULL,
              b.position,
              lower(c.name),
              lower(coalesce(c.variant, ''))
          `
          : `
            ORDER BY
              lower(c.manufacturer),
              lower(c.name),
              lower(coalesce(c.variant, '')),
              c.year IS NULL,
              c.year DESC,
              lower(coalesce(b.source_name, '')),
              b.area_order IS NULL,
              b.area_order,
              b.group_number IS NULL,
              b.group_number,
              b.position IS NULL,
              b.position
          `;

  const withSql = `
    WITH canonical AS (
      SELECT
        practiceIdentity,
        opdbMachineId,
        opdbGroupId,
        slug,
        name,
        variant,
        manufacturer,
        year,
        primaryImageUrl,
        playfieldImageUrl
      FROM (
        SELECT
          m.practice_identity AS practiceIdentity,
          m.opdb_machine_id AS opdbMachineId,
          m.opdb_group_id AS opdbGroupId,
          m.slug AS slug,
          m.name AS name,
          m.variant AS variant,
          m.manufacturer_name AS manufacturer,
          m.year AS year,
          m.primary_image_large_url AS primaryImageUrl,
          m.playfield_image_large_url AS playfieldImageUrl,
          ROW_NUMBER() OVER (
            PARTITION BY m.practice_identity
            ORDER BY
              CASE WHEN m.variant IS NULL OR trim(m.variant) = '' THEN 0 ELSE 1 END,
              lower(coalesce(m.variant, '')),
              lower(m.opdb_machine_id)
          ) AS rank_index
        FROM machines m
      )
      WHERE rank_index = 1
    ),
    membership_counts AS (
      SELECT practice_identity, COUNT(*) AS membershipCount
      FROM built_in_games
      GROUP BY practice_identity
    ),
    membership_video_counts AS (
      SELECT
        library_entry_id,
        COUNT(*) AS builtInVideoCount,
        SUM(CASE WHEN kind = 'tutorial' THEN 1 ELSE 0 END) AS builtInTutorialCount,
        SUM(CASE WHEN kind = 'gameplay' THEN 1 ELSE 0 END) AS builtInGameplayCount,
        SUM(CASE WHEN kind = 'competition' THEN 1 ELSE 0 END) AS builtInCompetitionCount
      FROM built_in_videos
      GROUP BY library_entry_id
    ),
    catalog_video_counts AS (
      SELECT
        practice_identity,
        COUNT(*) AS catalogVideoCount,
        SUM(CASE WHEN kind = 'tutorial' THEN 1 ELSE 0 END) AS catalogTutorialCount,
        SUM(CASE WHEN kind = 'gameplay' THEN 1 ELSE 0 END) AS catalogGameplayCount,
        SUM(CASE WHEN kind = 'competition' THEN 1 ELSE 0 END) AS catalogCompetitionCount
      FROM catalog_video_links
      GROUP BY practice_identity
    ),
    override_video_counts AS (
      SELECT
        opdb_id AS practice_identity,
        COUNT(*) AS overrideVideoCount,
        SUM(CASE WHEN kind = 'tutorial' THEN 1 ELSE 0 END) AS overrideTutorialCount,
        SUM(CASE WHEN kind = 'gameplay' THEN 1 ELSE 0 END) AS overrideGameplayCount,
        SUM(CASE WHEN kind = 'competition' THEN 1 ELSE 0 END) AS overrideCompetitionCount
      FROM admin.video_assets
      WHERE provider = 'pinprof'
        AND is_active = 1
        AND is_hidden = 0
      GROUP BY opdb_id
    ),
    membership_rulesheet_counts AS (
      SELECT
        library_entry_id,
        COUNT(*) AS builtInRulesheetLinkCount
      FROM built_in_rulesheet_links
      GROUP BY library_entry_id
    ),
    catalog_rulesheet_counts AS (
      SELECT
        practice_identity,
        COUNT(*) AS catalogRulesheetLinkCount
      FROM catalog_rulesheet_links
      GROUP BY practice_identity
    ),
    override_rulesheet_counts AS (
      SELECT
        opdb_id AS practice_identity,
        COUNT(*) AS overrideRulesheetLinkCount
      FROM admin.rulesheet_assets
      WHERE provider = 'pinprof'
        AND is_active = 1
        AND is_hidden = 0
        AND url IS NOT NULL
        AND trim(url) != ''
      GROUP BY opdb_id
    ),
    admin_playfield_counts AS (
      SELECT
        practice_identity,
        COUNT(*) AS playfieldAssetCount
      FROM admin.playfield_assets
      WHERE playfield_local_path IS NOT NULL AND trim(playfield_local_path) != ''
      GROUP BY practice_identity
    )
  `;
  const fromSql = `
    FROM canonical c
    LEFT JOIN built_in_games b ON b.practice_identity = c.practiceIdentity
    LEFT JOIN membership_counts mc ON mc.practice_identity = c.practiceIdentity
    LEFT JOIN membership_video_counts mvc ON mvc.library_entry_id = b.library_entry_id
    LEFT JOIN catalog_video_counts cvc ON cvc.practice_identity = c.practiceIdentity
    LEFT JOIN override_video_counts ovc ON ovc.practice_identity = c.practiceIdentity
    LEFT JOIN membership_rulesheet_counts mrc ON mrc.library_entry_id = b.library_entry_id
    LEFT JOIN catalog_rulesheet_counts crc ON crc.practice_identity = c.practiceIdentity
    LEFT JOIN override_rulesheet_counts orc ON orc.practice_identity = c.practiceIdentity
    LEFT JOIN admin.machine_overrides mo ON mo.practice_identity = c.practiceIdentity
    LEFT JOIN admin_playfield_counts apc ON apc.practice_identity = c.practiceIdentity
  `;
  const selectSql = `
    SELECT
      c.practiceIdentity,
      c.opdbMachineId,
      c.opdbGroupId,
      c.slug,
      c.name,
      c.variant,
      c.manufacturer,
      c.year,
      c.primaryImageUrl,
      c.playfieldImageUrl,
      b.library_entry_id AS libraryEntryId,
      b.source_id AS sourceId,
      b.source_name AS sourceName,
      b.source_type AS sourceType,
      b.area AS area,
      b.area_order AS areaOrder,
      b.group_number AS groupNumber,
      b.position AS position,
      b.bank AS bank,
      coalesce(mc.membershipCount, 0) AS membershipCount,
      b.playfield_image_url AS membershipPlayfieldImageUrl,
      b.rulesheet_url AS membershipRulesheetUrl,
      b.rulesheet_local_path AS membershipRulesheetLocalPath,
      b.gameinfo_local_path AS membershipGameinfoLocalPath,
      CASE WHEN c.playfieldImageUrl IS NULL OR trim(c.playfieldImageUrl) = '' THEN 0 ELSE 1 END AS hasOpdbPlayfield,
      CASE WHEN c.primaryImageUrl IS NULL OR trim(c.primaryImageUrl) = '' THEN 0 ELSE 1 END AS hasOpdbBackglass,
      CASE WHEN b.playfield_local_path IS NULL OR trim(b.playfield_local_path) = '' THEN 0 ELSE 1 END AS hasBuiltInPlayfield,
      CASE WHEN b.rulesheet_local_path IS NULL OR trim(b.rulesheet_local_path) = '' THEN 0 ELSE 1 END AS hasBuiltInRulesheet,
      CASE WHEN b.gameinfo_local_path IS NULL OR trim(b.gameinfo_local_path) = '' THEN 0 ELSE 1 END AS hasBuiltInGameinfo,
      CASE
        WHEN mo.practice_identity IS NOT NULL OR coalesce(apc.playfieldAssetCount, 0) > 0 OR coalesce(ovc.overrideVideoCount, 0) > 0
        THEN 1
        ELSE 0
      END AS hasAdminOverride,
      CASE WHEN coalesce(apc.playfieldAssetCount, 0) > 0 THEN 1 ELSE 0 END AS hasAdminPlayfield,
      CASE WHEN mo.rulesheet_local_path IS NULL OR trim(mo.rulesheet_local_path) = '' THEN 0 ELSE 1 END AS hasAdminRulesheet,
      CASE WHEN mo.gameinfo_local_path IS NULL OR trim(mo.gameinfo_local_path) = '' THEN 0 ELSE 1 END AS hasAdminGameinfo,
      coalesce(mvc.builtInVideoCount, 0) AS builtInVideoCount,
      coalesce(mvc.builtInTutorialCount, 0) AS builtInTutorialCount,
      coalesce(mvc.builtInGameplayCount, 0) AS builtInGameplayCount,
      coalesce(mvc.builtInCompetitionCount, 0) AS builtInCompetitionCount,
      coalesce(cvc.catalogVideoCount, 0) AS catalogVideoCount,
      coalesce(cvc.catalogTutorialCount, 0) AS catalogTutorialCount,
      coalesce(cvc.catalogGameplayCount, 0) AS catalogGameplayCount,
      coalesce(cvc.catalogCompetitionCount, 0) AS catalogCompetitionCount,
      coalesce(ovc.overrideVideoCount, 0) AS overrideVideoCount,
      coalesce(ovc.overrideTutorialCount, 0) AS overrideTutorialCount,
      coalesce(ovc.overrideGameplayCount, 0) AS overrideGameplayCount,
      coalesce(ovc.overrideCompetitionCount, 0) AS overrideCompetitionCount,
      coalesce(mrc.builtInRulesheetLinkCount, 0) AS builtInRulesheetLinkCount,
      coalesce(crc.catalogRulesheetLinkCount, 0) AS catalogRulesheetLinkCount,
      coalesce(orc.overrideRulesheetLinkCount, 0) AS overrideRulesheetLinkCount
  `;

  const rows = seedDb.prepare(`
    ${withSql}
    ${selectSql}
    ${fromSql}
    ${whereSql}
    ${orderSql}
    LIMIT @limit OFFSET @offset
  `).all({
    like,
    manufacturer,
    sourceName,
    limit: pageSize,
    offset,
  }) as ControlBoardRow[];

  const total = (
    seedDb.prepare(`
      ${withSql}
      SELECT COUNT(*) AS total
      ${fromSql}
      ${whereSql}
    `).get({ like, manufacturer, sourceName }) as { total: number }
  ).total;

  res.json({
    items: rows.map((row) => ({
      practiceIdentity: row.practiceIdentity,
      opdbMachineId: row.opdbMachineId,
      opdbGroupId: row.opdbGroupId,
      slug: row.slug,
      name: row.name,
      variant: row.variant,
      manufacturer: row.manufacturer,
      year: row.year,
      primaryImageUrl: row.primaryImageUrl,
      playfieldImageUrl: row.playfieldImageUrl,
      membership: {
        libraryEntryId: row.libraryEntryId,
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        sourceType: row.sourceType,
        area: row.area,
        areaOrder: row.areaOrder,
        groupNumber: row.groupNumber,
        position: row.position,
        bank: row.bank,
        count: row.membershipCount,
        playfieldImageUrl: row.membershipPlayfieldImageUrl,
        rulesheetUrl: row.membershipRulesheetUrl,
      },
      coverage: {
        hasOpdbPlayfield: row.hasOpdbPlayfield === 1,
        hasOpdbBackglass: row.hasOpdbBackglass === 1,
        hasBuiltInPlayfield: row.hasBuiltInPlayfield === 1,
        hasBuiltInRulesheet: row.hasBuiltInRulesheet === 1,
        hasBuiltInGameinfo: row.hasBuiltInGameinfo === 1,
        hasAdminOverride: row.hasAdminOverride === 1,
        hasAdminPlayfield: row.hasAdminPlayfield === 1,
        hasAdminRulesheet: row.hasAdminRulesheet === 1,
        hasAdminGameinfo: row.hasAdminGameinfo === 1,
        hasEffectivePlayfield: row.hasAdminPlayfield === 1 || row.hasBuiltInPlayfield === 1 || row.hasOpdbPlayfield === 1,
        hasEffectiveBackglass: row.hasOpdbBackglass === 1,
        hasEffectiveRulesheet:
          row.hasAdminRulesheet === 1 ||
          row.hasBuiltInRulesheet === 1 ||
          Boolean(cleanString(row.membershipRulesheetUrl)) ||
          row.catalogRulesheetLinkCount > 0 ||
          row.overrideRulesheetLinkCount > 0 ||
          row.builtInRulesheetLinkCount > 0,
        hasEffectiveGameinfo: row.hasAdminGameinfo === 1 || row.hasBuiltInGameinfo === 1,
      },
      videos: {
        builtInCount: row.builtInVideoCount,
        catalogCount: row.catalogVideoCount,
        overrideCount: row.overrideVideoCount,
        tutorialCount: row.builtInTutorialCount + row.catalogTutorialCount + row.overrideTutorialCount,
        gameplayCount: row.builtInGameplayCount + row.catalogGameplayCount + row.overrideGameplayCount,
        competitionCount: row.builtInCompetitionCount + row.catalogCompetitionCount + row.overrideCompetitionCount,
      },
      rulesheets: {
        builtInCount: row.builtInRulesheetLinkCount + (cleanString(row.membershipRulesheetUrl) ? 1 : 0),
        catalogCount: row.catalogRulesheetLinkCount,
        overrideCount: row.overrideRulesheetLinkCount,
      },
    })),
    total,
    page,
    pageSize,
  });
});

app.get("/api/machines", authRequired, (req, res) => {
  const query = cleanString(req.query.query);
  const manufacturer = cleanString(req.query.manufacturer);
  const sort = cleanString(req.query.sort);
  const page = Math.max(1, cleanInteger(req.query.page) ?? 1);
  const pageSize = Math.min(100, Math.max(1, cleanInteger(req.query.pageSize) ?? 20));
  const offset = (page - 1) * pageSize;
  const like = query ? `%${query}%` : null;
  const whereClauses: string[] = [];
  if (like) {
    whereClauses.push(
      `(m.name LIKE @like OR m.slug LIKE @like OR m.manufacturer_name LIKE @like OR m.practice_identity LIKE @like OR m.opdb_group_id LIKE @like)`,
    );
  }
  if (manufacturer) {
    whereClauses.push(`m.manufacturer_name = @manufacturer`);
  }
  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const orderSql =
    sort === "year_asc"
      ? "ORDER BY year IS NULL, year ASC, lower(name), lower(coalesce(variant, ''))"
      : sort === "year_desc"
        ? "ORDER BY year IS NULL, year DESC, lower(name), lower(coalesce(variant, ''))"
        : "ORDER BY lower(name), lower(coalesce(variant, ''))";

  const rows = seedDb
    .prepare(`
      WITH ranked AS (
        SELECT
          m.practice_identity AS practiceIdentity,
          m.opdb_machine_id AS opdbMachineId,
          m.opdb_group_id AS opdbGroupId,
          m.slug AS slug,
          m.name AS name,
          m.variant AS variant,
          m.manufacturer_name AS manufacturer,
          m.year AS year,
          m.playfield_image_large_url AS playfieldImageUrl,
          m.primary_image_large_url AS primaryImageUrl,
          o.playfield_local_path AS playfieldLocalPath,
          o.rulesheet_local_path AS rulesheetLocalPath,
          o.gameinfo_local_path AS gameinfoLocalPath,
          b.rulesheet_local_path AS builtInRulesheetLocalPath,
          b.gameinfo_local_path AS builtInGameinfoLocalPath,
          CASE
            WHEN a.practice_identity IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM admin.playfield_assets pa
               WHERE pa.practice_identity = m.practice_identity
             )
            THEN 0
            ELSE 1
          END AS hasAdminOverride,
          ROW_NUMBER() OVER (
            PARTITION BY m.practice_identity
            ORDER BY
              CASE WHEN m.variant IS NULL OR trim(m.variant) = '' THEN 0 ELSE 1 END,
              lower(coalesce(m.variant, '')),
              lower(m.opdb_machine_id)
          ) AS rank_index
        FROM machines m
        LEFT JOIN overrides o ON o.practice_identity = m.practice_identity
        LEFT JOIN admin.machine_overrides a ON a.practice_identity = m.practice_identity
        LEFT JOIN (
          SELECT
            practice_identity,
            rulesheet_local_path,
            gameinfo_local_path,
            ROW_NUMBER() OVER (
              PARTITION BY practice_identity
              ORDER BY lower(coalesce(variant, '')), lower(library_entry_id)
            ) AS built_in_rank_index
          FROM built_in_games
        ) b ON b.practice_identity = m.practice_identity AND b.built_in_rank_index = 1
        ${whereSql}
      )
      SELECT
        practiceIdentity,
        opdbMachineId,
        opdbGroupId,
        slug,
        name,
        variant,
        manufacturer,
        year,
        playfieldImageUrl,
        primaryImageUrl,
        playfieldLocalPath,
        rulesheetLocalPath,
        gameinfoLocalPath,
        builtInRulesheetLocalPath,
        builtInGameinfoLocalPath,
        hasAdminOverride
      FROM ranked
      WHERE rank_index = 1
      ${orderSql}
      LIMIT @limit OFFSET @offset
    `)
    .all({ like, manufacturer, limit: pageSize, offset }) as Array<MachineRow & { hasAdminOverride: 0 | 1 }>;

  const total = (
    seedDb
      .prepare(`SELECT COUNT(DISTINCT m.practice_identity) AS total FROM machines m ${whereSql}`)
      .get({ like, manufacturer }) as { total: number }
  ).total;

  res.json({
    items: rows.map((row) => ({
      practiceIdentity: row.practiceIdentity,
      opdbMachineId: row.opdbMachineId,
      slug: row.slug,
      name: row.name,
      variant: row.variant,
      manufacturer: row.manufacturer,
      year: row.year,
      playfieldImageUrl: row.playfieldImageUrl,
      primaryImageUrl: row.primaryImageUrl,
      playfieldLocalPath: row.playfieldLocalPath,
      rulesheetLocalPath: row.rulesheetLocalPath ?? row.builtInRulesheetLocalPath ?? null,
      gameinfoLocalPath: row.gameinfoLocalPath ?? row.builtInGameinfoLocalPath ?? null,
      hasAdminOverride: row.hasAdminOverride === 1,
    })),
    total,
    page,
    pageSize,
  });
});

app.get("/api/machines/:practiceIdentity", authRequired, async (req, res) => {
  const practiceIdentity = String(req.params.practiceIdentity);
  const row = getMachineRow(practiceIdentity);
  if (!row) {
    jsonError(res, 404, `Machine not found: ${practiceIdentity}`);
    return;
  }

  const builtIn = getBuiltInGameRow(practiceIdentity);
  const aliases = getMachineAliases(practiceIdentity);
  const overrideRecord = getOverrideRecord(practiceIdentity);
  const gameinfoAssetRecord = getGameinfoAssetRecord(practiceIdentity);
  const playfieldAlias = resolvePlayfieldAlias(practiceIdentity, null, aliases, overrideRecord);
  const playfieldAssets = buildPlayfieldAssetPayloads(practiceIdentity, aliases);
  const resolvedPlayfieldAssetRecord = resolvePlayfieldAssetForAlias(practiceIdentity, playfieldAlias.opdbMachineId);
  const resolvedPlayfieldAsset =
    resolvedPlayfieldAssetRecord
      ? playfieldAssets.find((asset) => asset.sourceAliasId === resolvedPlayfieldAssetRecord.source_opdb_machine_id) ?? null
      : null;
  const effectivePlayfieldLocalPath =
    resolvedPlayfieldAsset?.localPath ?? row.overridePlayfieldLocalPath ?? row.playfieldLocalPath ?? builtIn?.playfieldLocalPath ?? null;
  const effectivePlayfieldRemoteUrl = row.playfieldImageUrl ?? builtIn?.playfieldImageUrl ?? null;
  const effectiveRulesheetPath = row.overrideRulesheetLocalPath ?? row.rulesheetLocalPath ?? builtIn?.rulesheetLocalPath ?? null;
  const effectiveRulesheetUrl = row.rulesheetSourceUrl ?? builtIn?.rulesheetUrl ?? null;
  const effectiveGameinfoPath = gameinfoAssetRecord?.local_path ?? row.gameinfoLocalPath ?? builtIn?.gameinfoLocalPath ?? null;
  const rulesheetContent = await readFileTextIfPresent(effectiveRulesheetPath);
  const gameinfoContent = await readFileTextIfPresent(effectiveGameinfoPath);
  const memberships = getMachineMembershipRows(practiceIdentity);
  const membershipIds = memberships.map((membership) => membership.libraryEntryId);
  const builtInVideosByMembership = getBuiltInVideoRowsByMembership(membershipIds);
  const builtInRulesheetsByMembership = getBuiltInRulesheetRowsByMembership(membershipIds);
  const membershipPayload = memberships.map((membership) => {
    const builtInVideoLinks = builtInVideosByMembership.get(membership.libraryEntryId) ?? [];
    const builtInRulesheetLinks = dedupeRulesheetLinks([
      ...(membership.rulesheetUrl
        ? [{ label: "Rulesheet", url: membership.rulesheetUrl, priority: -1 }]
        : []),
      ...(builtInRulesheetsByMembership.get(membership.libraryEntryId) ?? []),
    ]);
    return {
      libraryEntryId: membership.libraryEntryId,
      sourceId: membership.sourceId,
      sourceName: membership.sourceName,
      sourceType: membership.sourceType,
      practiceIdentity: membership.practiceIdentity,
      opdbId: membership.opdbId,
      area: membership.area,
      areaOrder: membership.areaOrder,
      groupNumber: membership.groupNumber,
      position: membership.position,
      bank: membership.bank,
      name: membership.name,
      variant: membership.variant,
      manufacturer: membership.manufacturer,
      year: membership.year,
      slug: membership.slug,
      primaryImageUrl: membership.primaryImageUrl,
      primaryImageLargeUrl: membership.primaryImageLargeUrl,
      playfieldImageUrl: membership.playfieldImageUrl,
      playfieldLocalPath: membership.playfieldLocalPath,
      playfieldSourceLabel: membership.playfieldSourceLabel,
      rulesheetLocalPath: membership.rulesheetLocalPath,
      gameinfoLocalPath: membership.gameinfoLocalPath,
      builtInVideoLinks,
      builtInRulesheetLinks,
    };
  });
  const catalogVideoLinks = getCatalogVideoLinks(practiceIdentity);
  const overrideVideoLinks = getOverrideVideoLinks(practiceIdentity);
  const catalogRulesheetLinks = getCatalogRulesheetLinks(practiceIdentity);
  const overrideRulesheetLinks = getOverrideRulesheetLinks(practiceIdentity);

  const playfieldAsset =
    effectivePlayfieldLocalPath
        ? {
            effectiveKind: "pillyliu",
            effectiveLabel: assetOriginLabel(
              "pillyliu",
              resolvedPlayfieldAsset
                ? `local source ${resolvedPlayfieldAsset.sourceAliasLabel}`
                : row.overridePlayfieldLocalPath
                  ? "override"
                  : "existing library",
            ),
          effectiveUrl: effectivePlayfieldLocalPath,
          targetAliasId: playfieldAlias.opdbMachineId,
          targetAliasLabel: formatAliasLabel(playfieldAlias),
          targetFilename: playfieldBaseName(playfieldAlias.opdbMachineId),
          localPath: effectivePlayfieldLocalPath,
          localOriginalPath: resolvedPlayfieldAsset?.originalLocalPath ?? null,
          localReferencePath: resolvedPlayfieldAsset?.referenceLocalPath ?? null,
          localSourceUrl: resolvedPlayfieldAsset?.sourceUrl ?? row.playfieldSourceUrl ?? row.playfieldImageUrl ?? builtIn?.playfieldImageUrl ?? null,
          localSourcePageUrl: resolvedPlayfieldAsset?.sourcePageUrl ?? null,
          localSourcePageSnapshotPath: resolvedPlayfieldAsset?.sourcePageSnapshotPath ?? null,
          localSourceNote: resolvedPlayfieldAsset?.sourceNote ?? row.playfieldSourceNote ?? null,
          localWeb1400Path: resolvedPlayfieldAsset?.web1400LocalPath ?? null,
          localWeb700Path: resolvedPlayfieldAsset?.web700LocalPath ?? null,
          localMaskPolygonPoints: resolvedPlayfieldAsset?.maskPolygonPoints ?? null,
          fallbackOpdbUrl: row.playfieldImageUrl ?? null,
        }
      : effectivePlayfieldRemoteUrl
        ? {
            effectiveKind: "opdb",
            effectiveLabel: assetOriginLabel("opdb", "playfield image"),
            effectiveUrl: effectivePlayfieldRemoteUrl,
            targetAliasId: playfieldAlias.opdbMachineId,
            targetAliasLabel: formatAliasLabel(playfieldAlias),
            targetFilename: playfieldBaseName(playfieldAlias.opdbMachineId),
            localPath: null,
            localOriginalPath: null,
            localReferencePath: null,
            localSourceUrl: null,
            localSourcePageUrl: null,
            localSourcePageSnapshotPath: null,
            localSourceNote: null,
            localWeb1400Path: null,
            localWeb700Path: null,
            localMaskPolygonPoints: null,
            fallbackOpdbUrl: effectivePlayfieldRemoteUrl,
          }
        : {
            effectiveKind: "missing",
            effectiveLabel: assetOriginLabel("missing", "no playfield image"),
            effectiveUrl: null,
            targetAliasId: playfieldAlias.opdbMachineId,
            targetAliasLabel: formatAliasLabel(playfieldAlias),
            targetFilename: playfieldBaseName(playfieldAlias.opdbMachineId),
            localPath: null,
            localOriginalPath: null,
            localReferencePath: null,
            localSourceUrl: null,
            localSourcePageUrl: null,
            localSourcePageSnapshotPath: null,
            localSourceNote: null,
            localWeb1400Path: null,
            localWeb700Path: null,
            localMaskPolygonPoints: null,
            fallbackOpdbUrl: null,
          };

  const backglassAsset =
    row.primaryImageUrl
      ? {
          effectiveKind: "opdb",
          effectiveLabel: assetOriginLabel("opdb", "primary/backglass image"),
          effectiveUrl: row.primaryImageUrl,
          fallbackOpdbUrl: row.primaryImageUrl,
        }
      : {
          effectiveKind: "missing",
          effectiveLabel: assetOriginLabel("missing", "no backglass image"),
          effectiveUrl: null,
          fallbackOpdbUrl: null,
        };

  const rulesheetAsset =
    effectiveRulesheetPath
      ? {
          effectiveKind: "pillyliu",
          effectiveLabel: assetOriginLabel("pillyliu", row.overrideRulesheetLocalPath ? "override markdown" : "library markdown"),
          effectiveUrl: effectiveRulesheetPath,
          localPath: effectiveRulesheetPath,
          sourceUrl: effectiveRulesheetUrl,
          sourceNote: row.rulesheetSourceNote ?? null,
        }
      : effectiveRulesheetUrl
        ? {
            effectiveKind: "external",
            effectiveLabel: assetOriginLabel("external", "linked rulesheet"),
            effectiveUrl: effectiveRulesheetUrl,
            localPath: null,
            sourceUrl: effectiveRulesheetUrl,
            sourceNote: row.rulesheetSourceNote ?? null,
          }
        : {
            effectiveKind: "missing",
            effectiveLabel: assetOriginLabel("missing", "no rulesheet"),
            effectiveUrl: null,
            localPath: null,
            sourceUrl: null,
            sourceNote: null,
          };

  const gameinfoAsset =
    effectiveGameinfoPath
      ? {
          effectiveKind: "pillyliu",
          effectiveLabel: assetOriginLabel(
            "pillyliu",
            gameinfoAssetRecord?.local_path ? "game info asset markdown" : row.gameinfoLocalPath ? "override/library markdown" : "library markdown",
          ),
          effectiveUrl: effectiveGameinfoPath,
          localPath: effectiveGameinfoPath,
        }
      : {
          effectiveKind: "missing",
          effectiveLabel: assetOriginLabel("missing", "no game info"),
          effectiveUrl: null,
          localPath: null,
        };

  res.json({
    machine: {
      practiceIdentity: row.practiceIdentity,
      opdbMachineId: row.opdbMachineId,
      opdbGroupId: row.opdbGroupId,
      slug: row.slug,
      name: row.name,
      variant: row.variant,
      manufacturer: row.manufacturer,
      year: row.year,
      playfieldImageUrl: row.playfieldImageUrl,
      primaryImageUrl: row.primaryImageUrl,
      playfieldLocalPath: row.playfieldLocalPath,
      rulesheetLocalPath: row.rulesheetLocalPath,
    },
    override: {
      nameOverride: row.nameOverride ?? "",
      variantOverride: row.variantOverride ?? "",
      manufacturerOverride: row.manufacturerOverride ?? "",
      yearOverride: row.yearOverride == null ? "" : String(row.yearOverride),
      playfieldAliasId: resolvedPlayfieldAsset?.sourceAliasId ?? playfieldAlias.opdbMachineId,
      playfieldLocalPath: resolvedPlayfieldAsset?.localPath ?? row.overridePlayfieldLocalPath,
      playfieldSourceUrl: resolvedPlayfieldAsset?.sourceUrl ?? row.playfieldSourceUrl ?? "",
      playfieldSourcePageUrl: resolvedPlayfieldAsset?.sourcePageUrl ?? "",
      playfieldSourceNote: resolvedPlayfieldAsset?.sourceNote ?? row.playfieldSourceNote ?? "",
      rulesheetLocalPath: row.overrideRulesheetLocalPath,
      rulesheetSourceUrl: row.rulesheetSourceUrl ?? "",
      rulesheetSourceNote: row.rulesheetSourceNote ?? "",
      gameinfoLocalPath: row.gameinfoLocalPath,
      notes: row.notes ?? "",
      updatedAt: row.updatedAt,
    },
    sources: {
      builtIn: {
        sourceId: builtIn?.sourceId ?? null,
        sourceName: builtIn?.sourceName ?? null,
        sourceType: builtIn?.sourceType ?? null,
      },
      aliases: aliases.map((alias) => ({
        opdbMachineId: alias.opdbMachineId,
        label: formatAliasLabel(alias),
        slug: alias.slug,
        name: alias.name,
        variant: alias.variant,
        primaryImageUrl: alias.primaryImageUrl,
        playfieldImageUrl: alias.playfieldImageUrl,
        updatedAt: alias.updatedAt,
      })),
      playfieldAssets,
      assets: {
        backglass: backglassAsset,
        playfield: playfieldAsset,
        rulesheet: rulesheetAsset,
        gameinfo: gameinfoAsset,
      },
    },
    rulesheetContent,
    gameinfoContent,
    memberships: membershipPayload,
    links: {
      catalogVideos: catalogVideoLinks,
      overrideVideos: overrideVideoLinks,
      catalogRulesheetLinks,
      overrideRulesheetLinks,
    },
    activity: buildActivityPayload(practiceIdentity),
  });
});

app.put("/api/machines/:practiceIdentity/override", authRequired, (req, res) => {
  try {
    const practiceIdentity = String(req.params.practiceIdentity);
    upsertOverride(practiceIdentity, {
      name_override: cleanString(req.body?.nameOverride),
      variant_override: cleanString(req.body?.variantOverride),
      manufacturer_override: cleanString(req.body?.manufacturerOverride),
      year_override: cleanInteger(req.body?.yearOverride),
      rulesheet_source_url: cleanString(req.body?.rulesheetSourceUrl),
      rulesheet_source_note: cleanString(req.body?.rulesheetSourceNote),
      notes: cleanString(req.body?.notes),
    });
    syncPinprofRulesheetAssets(practiceIdentity);
    recordActivity(practiceIdentity, "metadata_saved", "Saved machine metadata overrides.", {
      name: cleanString(req.body?.nameOverride),
      variant: cleanString(req.body?.variantOverride),
      manufacturer: cleanString(req.body?.manufacturerOverride),
      year: cleanString(req.body?.yearOverride),
    });
    res.json({ ok: true });
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to save override.");
  }
});

app.put("/api/machines/:practiceIdentity/videos", authRequired, (req, res) => {
  try {
    const practiceIdentity = String(req.params.practiceIdentity);
    const rows = parseVideoOverrideRows(req.body?.videos);
    replaceVideoOverrides(practiceIdentity, rows);
    recordActivity(
      practiceIdentity,
      "video_overrides_saved",
      rows.length ? "Saved manual video overrides." : "Cleared manual video overrides.",
      {
        count: String(rows.length),
        kinds: Array.from(new Set(rows.map((row) => row.kind))).join(", "),
      },
    );
    res.json({ ok: true });
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to save video overrides.");
  }
});

app.put("/api/machines/:practiceIdentity/notes", authRequired, (req, res) => {
  try {
    const practiceIdentity = String(req.params.practiceIdentity);
    const notes = cleanString(req.body?.notes);
    upsertOverride(practiceIdentity, { notes });
    recordActivity(practiceIdentity, "notes_saved", "Saved work notes / to-do list.", {
      preview: notes?.slice(0, 140) ?? null,
    });
    res.json({ ok: true });
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to save notes.");
  }
});

app.post("/api/machines/:practiceIdentity/rulesheet/save", authRequired, async (req, res) => {
  try {
    const practiceIdentity = String(req.params.practiceIdentity);
    const result = await saveRulesheetMarkdown(
      practiceIdentity,
      String(req.body?.markdown ?? ""),
      cleanString(req.body?.sourceUrl),
      cleanString(req.body?.sourceNote),
    );
    recordActivity(practiceIdentity, "rulesheet_saved", "Saved rulesheet markdown.", {
      path: result.localPath,
      sourceUrl: cleanString(req.body?.sourceUrl),
      sourceNote: cleanString(req.body?.sourceNote),
    });
    res.json({ ok: true });
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to save rulesheet.");
  }
});

app.post("/api/machines/:practiceIdentity/rulesheet/import-path", authRequired, async (req, res) => {
  try {
    const sourcePath = cleanString(req.body?.sourcePath);
    if (!sourcePath) {
      throw new Error("Local rulesheet path is required.");
    }
    const practiceIdentity = String(req.params.practiceIdentity);
    const result = await importRulesheetFromPath(
      practiceIdentity,
      sourcePath,
      cleanString(req.body?.sourceUrl),
      cleanString(req.body?.sourceNote),
    );
    recordActivity(practiceIdentity, "rulesheet_imported", "Imported rulesheet from local file.", {
      sourcePath: result.sourcePath,
      savedPath: result.localPath,
      sourceUrl: cleanString(req.body?.sourceUrl),
      sourceNote: cleanString(req.body?.sourceNote),
    });
    res.json({ ok: true });
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to import rulesheet.");
  }
});

app.post("/api/machines/:practiceIdentity/gameinfo/save", authRequired, async (req, res) => {
  try {
    const practiceIdentity = String(req.params.practiceIdentity);
    const result = await saveGameinfoMarkdown(practiceIdentity, String(req.body?.markdown ?? ""));
    recordActivity(practiceIdentity, "gameinfo_saved", "Saved game info markdown.", {
      path: result.localPath,
    });
    res.json({ ok: true });
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to save game info.");
  }
});

app.post("/api/machines/:practiceIdentity/gameinfo/import-path", authRequired, async (req, res) => {
  try {
    const sourcePath = cleanString(req.body?.sourcePath);
    if (!sourcePath) {
      throw new Error("Local game info path is required.");
    }
    const practiceIdentity = String(req.params.practiceIdentity);
    const result = await importGameinfoFromPath(practiceIdentity, sourcePath);
    recordActivity(practiceIdentity, "gameinfo_imported", "Imported game info from local file.", {
      sourcePath: result.sourcePath,
      savedPath: result.localPath,
    });
    res.json({ ok: true });
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to import game info.");
  }
});

app.post("/api/machines/:practiceIdentity/playfield/import-url", authRequired, async (req, res) => {
  try {
    const practiceIdentity = String(req.params.practiceIdentity);
    const sourceUrl = normalizeHttpUrl(req.body?.sourceUrl, "Remote image URL");
    if (!sourceUrl) {
      throw new Error("Remote image URL is required.");
    }
    const sourcePageUrl = normalizeOptionalHttpUrl(req.body?.sourcePageUrl, "Source ad URL");
    const sourceAliasId = cleanString(req.body?.machineAliasId ?? req.body?.playfieldAliasId);
    const result = await importPlayfieldFromUrl(
      practiceIdentity,
      sourceAliasId,
      sourceUrl,
      sourcePageUrl,
      cleanString(req.body?.sourceNote),
    );
    recordActivity(practiceIdentity, "playfield_imported", "Imported playfield from remote URL.", {
      alias: result.sourceAliasLabel,
      savedPath: result.localPath,
      sourceUrl,
      sourcePageUrl,
      sourceNote: cleanString(req.body?.sourceNote),
    });
    res.json({ ok: true });
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to import playfield from URL.");
  }
});

app.post("/api/machines/:practiceIdentity/playfield/import-path", authRequired, async (req, res) => {
  try {
    const practiceIdentity = String(req.params.practiceIdentity);
    const sourcePath = cleanString(req.body?.sourcePath);
    if (!sourcePath) {
      throw new Error("Local image path is required.");
    }
    const sourceUrl = normalizeOptionalHttpUrl(req.body?.sourceUrl, "Source image URL");
    const sourcePageUrl = normalizeOptionalHttpUrl(req.body?.sourcePageUrl, "Source ad URL");
    const sourceAliasId = cleanString(req.body?.machineAliasId ?? req.body?.playfieldAliasId);
    const result = await importPlayfieldFromPath(
      practiceIdentity,
      sourceAliasId,
      sourcePath,
      sourceUrl,
      sourcePageUrl,
      cleanString(req.body?.sourceNote),
    );
    recordActivity(practiceIdentity, "playfield_imported", "Imported playfield from local file.", {
      alias: result.sourceAliasLabel,
      sourcePath: result.sourcePath,
      savedPath: result.localPath,
      sourceUrl,
      sourcePageUrl,
      sourceNote: cleanString(req.body?.sourceNote),
    });
    res.json({ ok: true });
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to import playfield from local file.");
  }
});

app.post("/api/machines/:practiceIdentity/playfield/upload", authRequired, upload.single("image"), async (req, res) => {
  try {
    const practiceIdentity = String(req.params.practiceIdentity);
    if (!req.file?.buffer) {
      throw new Error("No image uploaded.");
    }
    const sourceUrl = normalizeOptionalHttpUrl(req.body?.sourceUrl, "Source image URL");
    const sourcePageUrl = normalizeOptionalHttpUrl(req.body?.sourcePageUrl, "Source ad URL");
    const sourceAliasId = cleanString(req.body?.machineAliasId ?? req.body?.playfieldAliasId);
    const result = await savePlayfield(
      practiceIdentity,
      sourceAliasId,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      sourceUrl,
      sourcePageUrl,
      cleanString(req.body?.sourceNote) ?? req.file.originalname,
    );
    recordActivity(practiceIdentity, "playfield_uploaded", "Uploaded playfield from browser.", {
      alias: result.sourceAliasLabel,
      uploadedFile: req.file.originalname,
      savedPath: result.localPath,
      sourceUrl,
      sourcePageUrl,
      sourceNote: cleanString(req.body?.sourceNote) ?? req.file.originalname,
    });
    res.json({ ok: true });
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to upload playfield.");
  }
});

app.get("/api/machines/:practiceIdentity/playfield/editor-source", authRequired, async (req, res) => {
  try {
    const practiceIdentity = String(req.params.practiceIdentity);
    const sourceAliasId = cleanString(req.query.machineAliasId ?? req.query.playfieldAliasId);
    const aliases = getMachineAliases(practiceIdentity);
    const alias = resolvePlayfieldAlias(practiceIdentity, sourceAliasId, aliases, getOverrideRecord(practiceIdentity));
    const asset =
      getPlayfieldAssetRecords(practiceIdentity).find((row) => row.source_opdb_machine_id === alias.opdbMachineId) ??
      resolvePlayfieldAssetForAlias(practiceIdentity, alias.opdbMachineId);
    const fsPath = resolvePlayfieldEditorFsPath(asset);
    if (!fsPath) {
      throw new Error("No local playfield source file available for editor.");
    }
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(fsPath);
  } catch (error) {
    jsonError(res, 404, error instanceof Error ? error.message : "Playfield editor source not found.");
  }
});

app.put("/api/machines/:practiceIdentity/playfield/mask", authRequired, async (req, res) => {
  try {
    const practiceIdentity = String(req.params.practiceIdentity);
    const sourceAliasId = cleanString(req.body?.machineAliasId ?? req.body?.playfieldAliasId);
    const maskPoints = normalizePlayfieldMaskPoints(req.body?.maskPolygonPoints);
    const result = await savePlayfieldMask(practiceIdentity, sourceAliasId, maskPoints);
    recordActivity(
      practiceIdentity,
      "playfield_mask_saved",
      maskPoints?.length ? "Saved polygon playfield mask." : "Cleared polygon playfield mask.",
      {
        alias: result.sourceAliasLabel,
        savedPath: result.localPath,
        pointCount: maskPoints ? String(maskPoints.length) : "0",
      },
    );
    res.json({ ok: true });
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to save playfield mask.");
  }
});

app.put("/api/machines/:practiceIdentity/playfield/coverage", authRequired, async (req, res) => {
  try {
    const practiceIdentity = String(req.params.practiceIdentity);
    const sourceAliasId = cleanString(req.body?.machineAliasId ?? req.body?.playfieldAliasId);
    if (!sourceAliasId) {
      throw new Error("A source alias is required.");
    }
    const sourceUrl = normalizeOptionalHttpUrl(req.body?.sourceUrl, "Source image URL");
    const sourcePageUrl = normalizeOptionalHttpUrl(req.body?.sourcePageUrl, "Source ad URL");
    const result = await savePlayfieldCoverage(
      practiceIdentity,
      sourceAliasId,
      sourceUrl,
      sourcePageUrl,
      cleanString(req.body?.sourceNote),
    );
    recordActivity(practiceIdentity, "playfield_rebound", "Rebound existing playfield to a source alias.", {
      alias: result.sourceAliasLabel,
      savedPath: result.localPath,
      sourceUrl,
      sourcePageUrl,
      sourceNote: cleanString(req.body?.sourceNote),
    });
    res.json({ ok: true });
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to bind playfield source alias.");
  }
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api\/|\/pinball\/).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

stopDetachedPinsideViewerProcesses();

app.listen(PORT, () => {
  process.stdout.write(`PinProf admin listening on http://localhost:${PORT}\n`);
  if (!PASSWORD_CONFIGURED) {
    process.stdout.write("Warning: PINPROF_ADMIN_PASSWORD is not set. Using the local default 'change-me'.\n");
  }
});
