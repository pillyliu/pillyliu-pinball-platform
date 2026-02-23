import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARED = path.join(ROOT, "shared", "pinball");
const DATA_JSON = path.join(SHARED, "data", "pinball_library_v2.json");
const RULESHEETS_DIR = path.join(SHARED, "rulesheets");
const GAMEINFO_DIR = path.join(SHARED, "gameinfo");
const PLAYFIELDS_DIR = path.join(SHARED, "images", "playfields");
const PLAYFIELD_EXTS = [".webp", ".png", ".jpg", ".jpeg"];
const VARIANT_SUFFIXES = [
  "pro",
  "premium",
  "le",
  "limited-edition",
  "collectors-edition",
  "arcade-edition",
];

function parseArgs(argv) {
  const out = {
    dryRun: false,
    jsonPath: DATA_JSON,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--dry-run") out.dryRun = true;
    if (token === "--json" && argv[i + 1]) out.jsonPath = path.resolve(argv[i + 1]);
  }
  return out;
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function hashFile(p) {
  const buf = await fs.readFile(p);
  return crypto.createHash("sha1").update(buf).digest("hex");
}

async function copyIfMissing(src, dest, counters, dryRun) {
  if (!(await pathExists(src))) {
    counters.missingSource += 1;
    return { status: "missing-source" };
  }

  if (await pathExists(dest)) {
    const [a, b] = await Promise.all([hashFile(src), hashFile(dest)]);
    if (a === b) {
      counters.alreadyMatching += 1;
      return { status: "already-matching" };
    }
    counters.conflicts += 1;
    return { status: "conflict" };
  }

  if (!dryRun) {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
  counters.copied += 1;
  return { status: "copied" };
}

async function findExistingPlayfieldVariants(baseSlug) {
  const matches = [];
  for (const ext of PLAYFIELD_EXTS) {
    const names = [`${baseSlug}${ext}`, `${baseSlug}_700${ext}`, `${baseSlug}_1400${ext}`];
    for (const name of names) {
      const full = path.join(PLAYFIELDS_DIR, name);
      if (fssync.existsSync(full)) matches.push(full);
    }
  }
  return matches;
}

function familySlugFromPracticeIdentity(practiceIdentity) {
  const parts = String(practiceIdentity ?? "").trim().split("--");
  if (parts.length < 3) return null;
  return parts.slice(1, -1).join("--") || null;
}

function devariantizeSlug(slug) {
  let current = String(slug ?? "").trim().toLowerCase();
  if (!current) return null;
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of VARIANT_SUFFIXES) {
      const token = `-${suffix}`;
      if (current.endsWith(token)) {
        current = current.slice(0, -token.length);
        changed = true;
      }
    }
  }
  return current || null;
}

function slugifyText(value) {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return raw || null;
}

function legacySlugCandidatesForGroup(practiceIdentity, groupItems) {
  const candidates = new Set();
  const familySlug = familySlugFromPracticeIdentity(practiceIdentity);
  if (familySlug) candidates.add(familySlug);

  for (const item of groupItems) {
    const slug = String(item.pinside_slug ?? "").trim();
    if (!slug) continue;
    candidates.add(slug);
    const devariantized = devariantizeSlug(slug);
    if (devariantized) candidates.add(devariantized);
  }

  for (const item of groupItems) {
    const gameSlug = slugifyText(item.game);
    if (gameSlug) candidates.add(gameSlug);
  }

  return [...candidates].filter(Boolean);
}

function targetPlayfieldName(practiceIdentity, srcFilename) {
  const ext = path.extname(srcFilename);
  const stem = srcFilename.slice(0, -ext.length);
  const match = stem.match(/^(.*?)(_(700|1400))?$/);
  const suffix = match?.[2] ?? "";
  return `${practiceIdentity}-playfield${suffix}${ext}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = await fs.readFile(args.jsonPath, "utf8");
  const data = JSON.parse(raw);
  const items = Array.isArray(data?.items) ? data.items : [];

  const byPractice = new Map();
  for (const item of items) {
    const pid = String(item.practice_identity ?? "").trim();
    const slug = String(item.pinside_slug ?? "").trim();
    if (!pid || !slug) continue;
    const arr = byPractice.get(pid) ?? [];
    arr.push(item);
    byPractice.set(pid, arr);
  }

  const counters = {
    rulesheets: { copied: 0, missingSource: 0, alreadyMatching: 0, conflicts: 0 },
    gameinfo: { copied: 0, missingSource: 0, alreadyMatching: 0, conflicts: 0 },
    playfields: { copied: 0, missingSource: 0, alreadyMatching: 0, conflicts: 0 },
  };
  const conflictSamples = [];

  for (const [practiceIdentity, groupItems] of byPractice.entries()) {
    const legacySlugs = legacySlugCandidatesForGroup(practiceIdentity, groupItems);

    for (const legacySlug of legacySlugs) {
      const src = path.join(RULESHEETS_DIR, `${legacySlug}.md`);
      const dest = path.join(RULESHEETS_DIR, `${practiceIdentity}-rulesheet.md`);
      const result = await copyIfMissing(src, dest, counters.rulesheets, args.dryRun);
      if (result.status === "conflict" && conflictSamples.length < 10) {
        conflictSamples.push({ type: "rulesheet", practiceIdentity, legacySlug, src: path.basename(src), dest: path.basename(dest) });
      }
    }

    for (const legacySlug of legacySlugs) {
      const src = path.join(GAMEINFO_DIR, `${legacySlug}.md`);
      const dest = path.join(GAMEINFO_DIR, `${practiceIdentity}-gameinfo.md`);
      const result = await copyIfMissing(src, dest, counters.gameinfo, args.dryRun);
      if (result.status === "conflict" && conflictSamples.length < 10) {
        conflictSamples.push({ type: "gameinfo", practiceIdentity, legacySlug, src: path.basename(src), dest: path.basename(dest) });
      }
    }

    for (const legacySlug of legacySlugs) {
      const srcFiles = await findExistingPlayfieldVariants(legacySlug);
      if (!srcFiles.length) {
        counters.playfields.missingSource += 1;
        continue;
      }
      for (const src of srcFiles) {
        const dest = path.join(
          PLAYFIELDS_DIR,
          targetPlayfieldName(practiceIdentity, path.basename(src))
        );
        const result = await copyIfMissing(src, dest, counters.playfields, args.dryRun);
        if (result.status === "conflict" && conflictSamples.length < 10) {
          conflictSamples.push({
            type: "playfield",
            practiceIdentity,
            legacySlug,
            src: path.basename(src),
            dest: path.basename(dest),
          });
        }
      }
    }
  }

  console.log(`Mode: ${args.dryRun ? "dry-run" : "write"}`);
  console.log(`Practice identities: ${byPractice.size}`);
  for (const [label, c] of Object.entries(counters)) {
    console.log(
      `${label}: copied=${c.copied} alreadyMatching=${c.alreadyMatching} missingSource=${c.missingSource} conflicts=${c.conflicts}`
    );
  }
  if (conflictSamples.length) {
    console.log("Conflict samples:");
    for (const sample of conflictSamples) {
      console.log(`  ${sample.type}: ${sample.practiceIdentity} <- ${sample.legacySlug} (${sample.src} -> ${sample.dest})`);
    }
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
