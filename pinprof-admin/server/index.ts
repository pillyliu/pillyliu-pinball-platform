import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import Database from "better-sqlite3";
import express, { type NextFunction, type Request, type Response } from "express";
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

type MachineAliasRow = {
  opdbMachineId: string;
  slug: string;
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const APP_ROOT = path.resolve(ROOT, "pinprof-admin");
const DIST_DIR = path.join(APP_ROOT, "dist");
const SHARED_PINBALL_DIR = path.join(ROOT, "shared", "pinball");
const SHARED_DATA_DIR = path.join(SHARED_PINBALL_DIR, "data");
const SHARED_RULESHEETS_DIR = path.join(SHARED_PINBALL_DIR, "rulesheets");
const SHARED_GAMEINFO_DIR = path.join(SHARED_PINBALL_DIR, "gameinfo");
const SHARED_PLAYFIELDS_DIR = path.join(SHARED_PINBALL_DIR, "images", "playfields");
const SEED_DB_PATH = path.join(SHARED_DATA_DIR, "pinball_library_seed_v1.sqlite");
const ADMIN_DB_PATH = path.join(SHARED_DATA_DIR, "pinprof_admin_v1.sqlite");
const APPLY_OVERRIDES_SCRIPT = path.join(ROOT, "tools", "pinprof", "apply-admin-overrides.mjs");
const SESSION_COOKIE = "pinprof_admin_session";
const SESSION_SECRET = process.env.PINPROF_SESSION_SECRET ?? "pinprof-dev-secret";
const ADMIN_PASSWORD = process.env.PINPROF_ADMIN_PASSWORD ?? "change-me";
const PASSWORD_CONFIGURED = Boolean(process.env.PINPROF_ADMIN_PASSWORD);
const PORT = Number.parseInt(process.env.PINPROF_ADMIN_PORT ?? "8787", 10);
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
  const relative = normalized.replace(/^\/pinball\/?/, "");
  const fsPath = path.resolve(SHARED_PINBALL_DIR, relative);
  if (!fsPath.startsWith(path.resolve(SHARED_PINBALL_DIR))) return null;
  return fsPath;
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
  const ext = sourceName ? path.extname(sourceName).toLowerCase() : "";
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

function playfieldBaseNameFromWebPath(webPath: string | null): string | null {
  const normalized = cleanString(webPath);
  if (!normalized?.startsWith("/pinball/images/playfields/")) return null;
  const filename = path.basename(normalized);
  const ext = path.extname(filename);
  const stem = ext ? filename.slice(0, -ext.length) : filename;
  return stem.replace(/_(700|1400)$/i, "") || null;
}

async function removeExistingPlayfieldFiles(baseName: string) {
  const entries = await fsp.readdir(SHARED_PLAYFIELDS_DIR, { withFileTypes: true }).catch(() => []);
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(baseName))
      .map((entry) => fsp.rm(path.join(SHARED_PLAYFIELDS_DIR, entry.name), { force: true })),
  );
}

function runApplyOverrides() {
  execFileSync("node", [APPLY_OVERRIDES_SCRIPT], {
    cwd: ROOT,
    stdio: "pipe",
  });
}

function jsonError(res: Response, status: number, message: string) {
  res.status(status).type("text/plain").send(message);
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
`);

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

const seedDb = new Database(SEED_DB_PATH);
seedDb.exec(`ATTACH DATABASE '${escapeSqlitePath(ADMIN_DB_PATH)}' AS admin`);

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

function getMachineAliases(practiceIdentity: string): MachineAliasRow[] {
  return seedDb.prepare(`
    SELECT
      opdb_machine_id AS opdbMachineId,
      slug,
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

function formatAliasLabel(alias: MachineAliasRow) {
  return [alias.variant, alias.opdbMachineId].filter(Boolean).join(" · ") || alias.opdbMachineId;
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
}

async function importRulesheetFromPath(practiceIdentity: string, sourcePath: string, sourceUrl: string | null, sourceNote: string | null) {
  const resolved = path.resolve(sourcePath);
  const stat = await fsp.stat(resolved).catch(() => null);
  if (!stat?.isFile()) {
    throw new Error(`Rulesheet file not found: ${resolved}`);
  }
  const markdown = await fsp.readFile(resolved, "utf8");
  await saveRulesheetMarkdown(practiceIdentity, markdown, sourceUrl, sourceNote ?? resolved);
}

async function savePlayfield(
  practiceIdentity: string,
  machineAliasId: string | null,
  buffer: Buffer,
  sourceName: string | null,
  contentType: string | null,
  sourceUrl: string | null,
  sourceNote: string | null,
) {
  await ensureDir(SHARED_PLAYFIELDS_DIR);
  const aliases = getMachineAliases(practiceIdentity);
  const existing = getOverrideRecord(practiceIdentity);
  const alias = resolvePlayfieldAlias(practiceIdentity, machineAliasId, aliases, existing);
  const baseName = playfieldBaseName(alias.opdbMachineId);
  const previousBaseName = playfieldBaseNameFromWebPath(existing?.playfield_local_path ?? null);
  if (previousBaseName && previousBaseName !== baseName) {
    await removeExistingPlayfieldFiles(previousBaseName);
  }
  await removeExistingPlayfieldFiles(baseName);

  const ext = inferImageExtension(sourceName, contentType);
  const originalFsPath = path.join(SHARED_PLAYFIELDS_DIR, `${baseName}${ext}`);
  await fsp.writeFile(originalFsPath, buffer);

  const image = sharp(buffer, { failOn: "warning" }).rotate();
  await image.clone().resize({ width: 700, withoutEnlargement: true }).webp({ quality: 84 }).toFile(path.join(SHARED_PLAYFIELDS_DIR, `${baseName}_700.webp`));
  await image.clone().resize({ width: 1400, withoutEnlargement: true }).webp({ quality: 84 }).toFile(path.join(SHARED_PLAYFIELDS_DIR, `${baseName}_1400.webp`));

  upsertOverride(practiceIdentity, {
    opdb_machine_id: alias.opdbMachineId,
    playfield_local_path: `/pinball/images/playfields/${baseName}${ext}`,
    playfield_source_url: sourceUrl,
    playfield_source_note: sourceNote,
  });
}

async function importPlayfieldFromUrl(
  practiceIdentity: string,
  machineAliasId: string | null,
  sourceUrl: string,
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
  await savePlayfield(practiceIdentity, machineAliasId, buffer, sourceUrl, contentType, sourceUrl, sourceNote ?? sourceUrl);
}

async function importPlayfieldFromPath(
  practiceIdentity: string,
  machineAliasId: string | null,
  sourcePath: string,
  sourceUrl: string | null,
  sourceNote: string | null,
) {
  const resolved = path.resolve(sourcePath);
  const stat = await fsp.stat(resolved).catch(() => null);
  if (!stat?.isFile()) {
    throw new Error(`Image file not found: ${resolved}`);
  }
  const buffer = await fsp.readFile(resolved);
  await savePlayfield(practiceIdentity, machineAliasId, buffer, resolved, null, sourceUrl, sourceNote ?? resolved);
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
app.use("/pinball", express.static(SHARED_PINBALL_DIR));

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
  const overriddenMachines = (adminDb.prepare("SELECT COUNT(*) AS total FROM machine_overrides").get() as { total: number }).total;
  const playfieldOverrides = (
    adminDb.prepare("SELECT COUNT(*) AS total FROM machine_overrides WHERE playfield_local_path IS NOT NULL AND trim(playfield_local_path) != ''").get() as {
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
    adminDbPath: ADMIN_DB_PATH,
    seedDbPath: SEED_DB_PATH,
  });
});

app.get("/api/machines", authRequired, (req, res) => {
  const query = cleanString(req.query.query);
  const page = Math.max(1, cleanInteger(req.query.page) ?? 1);
  const pageSize = Math.min(100, Math.max(1, cleanInteger(req.query.pageSize) ?? 40));
  const offset = (page - 1) * pageSize;
  const like = query ? `%${query}%` : null;
  const whereSql = like
    ? `WHERE m.name LIKE @like OR m.slug LIKE @like OR m.manufacturer_name LIKE @like OR m.practice_identity LIKE @like`
    : "";

  const rows = seedDb
    .prepare(`
      WITH ranked AS (
        SELECT
          m.practice_identity AS practiceIdentity,
          m.opdb_machine_id AS opdbMachineId,
          m.slug AS slug,
          m.name AS name,
          m.variant AS variant,
          m.manufacturer_name AS manufacturer,
          m.year AS year,
          m.playfield_image_large_url AS playfieldImageUrl,
          m.primary_image_large_url AS primaryImageUrl,
          o.playfield_local_path AS playfieldLocalPath,
          o.rulesheet_local_path AS rulesheetLocalPath,
          CASE WHEN a.practice_identity IS NULL THEN 0 ELSE 1 END AS hasAdminOverride,
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
        ${whereSql}
      )
      SELECT
        practiceIdentity,
        opdbMachineId,
        slug,
        name,
        variant,
        manufacturer,
        year,
        playfieldImageUrl,
        primaryImageUrl,
        playfieldLocalPath,
        rulesheetLocalPath,
        hasAdminOverride
      FROM ranked
      WHERE rank_index = 1
      ORDER BY lower(name), lower(coalesce(variant, ''))
      LIMIT @limit OFFSET @offset
    `)
    .all({ like, limit: pageSize, offset }) as Array<MachineRow & { hasAdminOverride: 0 | 1 }>;

  const total = (
    seedDb
      .prepare(`SELECT COUNT(DISTINCT m.practice_identity) AS total FROM machines m ${whereSql}`)
      .get({ like }) as { total: number }
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
      rulesheetLocalPath: row.rulesheetLocalPath,
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
  const playfieldAlias = resolvePlayfieldAlias(practiceIdentity, null, aliases, overrideRecord);
  const effectivePlayfieldLocalPath = row.overridePlayfieldLocalPath ?? row.playfieldLocalPath ?? builtIn?.playfieldLocalPath ?? null;
  const effectivePlayfieldRemoteUrl = row.playfieldImageUrl ?? builtIn?.playfieldImageUrl ?? null;
  const effectiveRulesheetPath = row.overrideRulesheetLocalPath ?? row.rulesheetLocalPath ?? builtIn?.rulesheetLocalPath ?? null;
  const effectiveRulesheetUrl = row.rulesheetSourceUrl ?? builtIn?.rulesheetUrl ?? null;
  const effectiveGameinfoPath = row.gameinfoLocalPath ?? builtIn?.gameinfoLocalPath ?? null;
  const rulesheetContent = await readFileTextIfPresent(effectiveRulesheetPath);
  const gameinfoContent = await readFileTextIfPresent(effectiveGameinfoPath);

  const playfieldAsset =
    effectivePlayfieldLocalPath
      ? {
          effectiveKind: "pillyliu",
          effectiveLabel: assetOriginLabel("pillyliu", row.overridePlayfieldLocalPath ? "override" : "existing library"),
          effectiveUrl: effectivePlayfieldLocalPath,
          targetAliasId: playfieldAlias.opdbMachineId,
          targetAliasLabel: formatAliasLabel(playfieldAlias),
          targetFilename: playfieldBaseName(playfieldAlias.opdbMachineId),
          localPath: effectivePlayfieldLocalPath,
          localSourceUrl: row.playfieldSourceUrl ?? row.playfieldImageUrl ?? builtIn?.playfieldImageUrl ?? null,
          localSourceNote: row.playfieldSourceNote ?? null,
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
            localSourceUrl: null,
            localSourceNote: null,
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
            localSourceUrl: null,
            localSourceNote: null,
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
          effectiveLabel: assetOriginLabel("pillyliu", row.gameinfoLocalPath ? "override/library markdown" : "library markdown"),
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
      playfieldAliasId: playfieldAlias.opdbMachineId,
      playfieldLocalPath: row.overridePlayfieldLocalPath,
      playfieldSourceUrl: row.playfieldSourceUrl ?? "",
      playfieldSourceNote: row.playfieldSourceNote ?? "",
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
      aliases,
      assets: {
        backglass: backglassAsset,
        playfield: playfieldAsset,
        rulesheet: rulesheetAsset,
        gameinfo: gameinfoAsset,
      },
    },
    rulesheetContent,
    gameinfoContent,
  });
});

app.put("/api/machines/:practiceIdentity/override", authRequired, (req, res) => {
  try {
    const practiceIdentity = String(req.params.practiceIdentity);
    const playfieldAlias = resolvePlayfieldAlias(
      practiceIdentity,
      cleanString(req.body?.playfieldAliasId),
      undefined,
      getOverrideRecord(practiceIdentity),
    );
    upsertOverride(String(req.params.practiceIdentity), {
      opdb_machine_id: playfieldAlias.opdbMachineId,
      name_override: cleanString(req.body?.nameOverride),
      variant_override: cleanString(req.body?.variantOverride),
      manufacturer_override: cleanString(req.body?.manufacturerOverride),
      year_override: cleanInteger(req.body?.yearOverride),
      playfield_source_url: cleanString(req.body?.playfieldSourceUrl),
      playfield_source_note: cleanString(req.body?.playfieldSourceNote),
      rulesheet_source_url: cleanString(req.body?.rulesheetSourceUrl),
      rulesheet_source_note: cleanString(req.body?.rulesheetSourceNote),
      notes: cleanString(req.body?.notes),
    });
    res.json({ ok: true });
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to save override.");
  }
});

app.post("/api/machines/:practiceIdentity/rulesheet/save", authRequired, async (req, res) => {
  try {
    await saveRulesheetMarkdown(
      String(req.params.practiceIdentity),
      String(req.body?.markdown ?? ""),
      cleanString(req.body?.sourceUrl),
      cleanString(req.body?.sourceNote),
    );
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
    await importRulesheetFromPath(
      String(req.params.practiceIdentity),
      sourcePath,
      cleanString(req.body?.sourceUrl),
      cleanString(req.body?.sourceNote),
    );
    res.json({ ok: true });
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to import rulesheet.");
  }
});

app.post("/api/machines/:practiceIdentity/playfield/import-url", authRequired, async (req, res) => {
  try {
    const practiceIdentity = String(req.params.practiceIdentity);
    const sourceUrl = cleanString(req.body?.sourceUrl);
    if (!sourceUrl) {
      throw new Error("Remote image URL is required.");
    }
    await importPlayfieldFromUrl(
      practiceIdentity,
      cleanString(req.body?.machineAliasId ?? req.body?.playfieldAliasId),
      sourceUrl,
      cleanString(req.body?.sourceNote),
    );
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
    await importPlayfieldFromPath(
      practiceIdentity,
      cleanString(req.body?.machineAliasId ?? req.body?.playfieldAliasId),
      sourcePath,
      cleanString(req.body?.sourceUrl),
      cleanString(req.body?.sourceNote),
    );
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
    await savePlayfield(
      practiceIdentity,
      cleanString(req.body?.machineAliasId ?? req.body?.playfieldAliasId),
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      cleanString(req.body?.sourceUrl),
      cleanString(req.body?.sourceNote) ?? req.file.originalname,
    );
    res.json({ ok: true });
  } catch (error) {
    jsonError(res, 400, error instanceof Error ? error.message : "Failed to upload playfield.");
  }
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api\/|\/pinball\/).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

app.listen(PORT, () => {
  process.stdout.write(`PinProf admin listening on http://localhost:${PORT}\n`);
  if (!PASSWORD_CONFIGURED) {
    process.stdout.write("Warning: PINPROF_ADMIN_PASSWORD is not set. Using the local default 'change-me'.\n");
  }
});
