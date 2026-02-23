import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(THIS_DIR, "../..");
const DEFAULT_CREDENTIALS_FALLBACK = path.resolve(
  THIS_DIR,
  "../../../Pinball Scraper/.secrets/google-service-account.json"
);
const REQUIRED_SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

const CODEX_SPREADSHEET_ID = "1ZzHHFvIsfIZv5ghd4vDXi7G99ILhbgPHk3Lg6SbJFMQ";
const DEFAULT_OUTPUT_JSON = path.join(ROOT, "shared", "pinball", "data", "codex_missing_group_fetch_targets.json");
const DEFAULT_GROUP_MAP_JSON = path.join(ROOT, "shared", "pinball", "data", "pinside_group_map.json");

function parseArgs(argv) {
  const out = {
    credentialsPath:
      process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_CREDENTIALS_FALLBACK,
    outputJson: DEFAULT_OUTPUT_JSON,
    pinsideGroupMapPath: DEFAULT_GROUP_MAP_JSON,
    includeMappedNone: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === "--credentials" && argv[i + 1]) out.credentialsPath = path.resolve(argv[i + 1]);
    if (t === "--output-json" && argv[i + 1]) out.outputJson = path.resolve(argv[i + 1]);
    if (t === "--pinside-group-map" && argv[i + 1]) out.pinsideGroupMapPath = path.resolve(argv[i + 1]);
    if (t === "--include-mapped-none") out.includeMappedNone = true;
  }
  return out;
}

function norm(v) {
  return String(v ?? "").trim().toLowerCase();
}

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    if ((rows[i] || []).some((v) => norm(v) === "game")) return i;
  }
  return -1;
}

function rowBlank(row) {
  return !(row || []).some((v) => String(v ?? "").trim());
}

function getCell(row, idx) {
  if (idx == null || idx < 0) return "";
  return String((row || [])[idx] ?? "").trim();
}

async function loadGroupMap(filePath) {
  try {
    const raw = JSON.parse(await fs.readFile(filePath, "utf8"));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const groupMap = await loadGroupMap(args.pinsideGroupMapPath);

  const auth = new google.auth.GoogleAuth({
    keyFile: args.credentialsPath,
    scopes: REQUIRED_SCOPES,
  });
  const sheetsApi = google.sheets({ version: "v4", auth });

  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId: CODEX_SPREADSHEET_ID,
    fields: "properties(title),sheets(properties(sheetId,title,index))",
  });
  const tabs = (meta.data.sheets || [])
    .map((s) => s.properties)
    .filter(Boolean)
    .sort((a, b) => (a.index || 0) - (b.index || 0));

  const bySlug = new Map();
  const perTab = [];

  for (const tab of tabs) {
    const escapedTitle = String(tab.title).replace(/'/g, "''");
    const valuesRes = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: CODEX_SPREADSHEET_ID,
      range: `'${escapedTitle}'!A:ZZ`,
      majorDimension: "ROWS",
    });
    const rows = valuesRes.data.values || [];
    const hr = findHeaderRow(rows);
    if (hr < 0) continue;
    const headers = rows[hr] || [];
    const idx = new Map(headers.map((h, i) => [norm(h), i]));

    const slugIdx = idx.get("pinside_slug");
    const groupIdx = idx.get("pinside_group");
    const gameIdx = idx.get("game");
    if (slugIdx == null || groupIdx == null || gameIdx == null) continue;

    let missingWithSlug = 0;
    let addedTargets = 0;
    for (let r = hr + 1; r < rows.length; r += 1) {
      const row = rows[r] || [];
      if (rowBlank(row)) continue;
      const game = getCell(row, gameIdx);
      if (!game || norm(game) === "game") continue;
      const slug = getCell(row, slugIdx);
      const group = getCell(row, groupIdx);
      if (!slug || group) continue;
      missingWithSlug += 1;

      const mapped = String(groupMap[slug] ?? "").trim();
      if (mapped && (!args.includeMappedNone || mapped !== "~")) continue;

      if (!bySlug.has(slug)) {
        bySlug.set(slug, {
          slug,
          pinside_slug: slug,
          game,
          variant: getCell(row, idx.get("variant")) || null,
          manufacturer: getCell(row, idx.get("manufacturer")) || null,
          year: getCell(row, idx.get("year")) || null,
          _examples: [{ tab: tab.title, row: r + 1 }],
        });
        addedTargets += 1;
      } else {
        bySlug.get(slug)._examples.push({ tab: tab.title, row: r + 1 });
      }
    }
    perTab.push({ title: tab.title, missing_with_slug: missingWithSlug, unique_targets_added: addedTargets });
  }

  const items = [...bySlug.values()]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((x) => {
      const { _examples, ...rest } = x;
      return rest;
    });

  const payload = {
    generated_at: new Date().toISOString(),
    workbook: meta.data.properties?.title || "Codex Pinball Library",
    spreadsheetId: CODEX_SPREADSHEET_ID,
    total_unique_slugs: items.length,
    items,
    per_tab: perTab,
  };

  await fs.mkdir(path.dirname(args.outputJson), { recursive: true });
  await fs.writeFile(args.outputJson, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Wrote ${items.length} unique slugs to ${args.outputJson}`);
  for (const t of perTab) {
    if (!t.missing_with_slug) continue;
    console.log(`  ${t.title}: missing_with_slug=${t.missing_with_slug} unique_targets_added=${t.unique_targets_added}`);
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
