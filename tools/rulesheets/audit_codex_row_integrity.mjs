import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CREDENTIALS_FALLBACK = path.resolve(
  THIS_DIR,
  "../../../Pinball Scraper/.secrets/google-service-account.json"
);
const REQUIRED_SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
const CODEX_SPREADSHEET_ID = "1ZzHHFvIsfIZv5ghd4vDXi7G99ILhbgPHk3Lg6SbJFMQ";

const CHECK_COLUMNS = [
  "practice_identity",
  "library_entry_id",
  "pinside_id",
  "pinside_slug",
  "pinside_group",
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

function parseArgs(argv) {
  const out = {
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_CREDENTIALS_FALLBACK,
    sampleLimit: 20,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === "--credentials" && argv[i + 1]) out.credentialsPath = path.resolve(argv[i + 1]);
    if (t === "--sample-limit" && argv[i + 1]) out.sampleLimit = Math.max(1, Number(argv[i + 1]) || 20);
  }
  return out;
}

function norm(v) {
  return String(v ?? "").trim().toLowerCase();
}

function normLoose(v) {
  return norm(v).replace(/&/g, "and").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(v) {
  return new Set(normLoose(v).split(" ").filter(Boolean));
}

function overlap(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  let c = 0;
  for (const t of A) if (B.has(t)) c += 1;
  return c;
}

function jaccard(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  if (!A.size || !B.size) return 0;
  let i = 0;
  for (const t of A) if (B.has(t)) i += 1;
  return i / new Set([...A, ...B]).size;
}

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    if ((rows[i] || []).some((v) => norm(v) === "game")) return i;
  }
  return -1;
}

function headerIndexMap(headers) {
  const m = new Map();
  (headers || []).forEach((h, i) => {
    const k = norm(h);
    if (k && !m.has(k)) m.set(k, i);
  });
  return m;
}

function getCell(row, idx) {
  if (idx == null || idx < 0) return "";
  return String((row || [])[idx] ?? "").trim();
}

function rowBlank(row) {
  return !(row || []).some((v) => String(v ?? "").trim());
}

function looksLikeUrl(v) {
  return /^https?:\/\//i.test(String(v ?? "").trim());
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const auth = new google.auth.GoogleAuth({
    keyFile: args.credentialsPath,
    scopes: REQUIRED_SCOPES,
  });
  const sheetsApi = google.sheets({ version: "v4", auth });

  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId: CODEX_SPREADSHEET_ID,
    fields: "properties(title),sheets(properties(sheetId,title,index))",
  });
  const tabs = (meta.data.sheets || []).map((s) => s.properties).filter(Boolean).sort((a, b) => (a.index || 0) - (b.index || 0));

  let spilloverCount = 0;
  let mismatchCount = 0;
  const spillSamples = [];
  const mismatchSamples = [];

  for (const tab of tabs) {
    const escaped = String(tab.title).replace(/'/g, "''");
    const valuesRes = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: CODEX_SPREADSHEET_ID,
      range: `'${escaped}'!A:ZZ`,
      majorDimension: "ROWS",
    });
    const rows = valuesRes.data.values || [];
    const hr = findHeaderRow(rows);
    if (hr < 0) continue;
    const idx = headerIndexMap(rows[hr] || []);
    const gameIdx = idx.get("game");
    const groupIdx = idx.get("pinside_group");
    const slugIdx = idx.get("pinside_slug");
    const pidIdx = idx.get("practice_identity");

    for (let r = hr + 1; r < rows.length; r += 1) {
      const row = rows[r] || [];
      if (rowBlank(row)) continue;
      const game = getCell(row, gameIdx);

      if (!game) {
        const populated = [];
        for (const h of CHECK_COLUMNS) {
          const v = getCell(row, idx.get(norm(h)));
          if (v) populated.push(h);
        }
        if (populated.length) {
          spilloverCount += 1;
          if (spillSamples.length < args.sampleLimit) {
            spillSamples.push({ tab: tab.title, row: r + 1, populated });
          }
        }
        continue;
      }

      const slug = getCell(row, slugIdx);
      const group = getCell(row, groupIdx);
      const pid = getCell(row, pidIdx);
      const basis = group && group !== "~" ? group : slug;
      if (!basis) continue;
      const sim = Math.max(jaccard(game, basis), overlap(game, basis) > 0 ? 0.4 : 0);
      const ol = overlap(game, basis);

      // Skip obvious generic/URL-only weirdness.
      if (looksLikeUrl(basis)) continue;
      if (ol === 0 && sim < 0.2) {
        mismatchCount += 1;
        if (mismatchSamples.length < args.sampleLimit) {
          mismatchSamples.push({
            tab: tab.title,
            row: r + 1,
            game,
            pinside_group: group,
            pinside_slug: slug,
            practice_identity: pid,
          });
        }
      }
    }
  }

  console.log(`Codex row integrity audit`);
  console.log(`  spillover_rows_blank_game_with_data=${spilloverCount}`);
  for (const s of spillSamples) {
    console.log(`    ${s.tab} r${s.row}: blank Game but populated ${s.populated.join(", ")}`);
  }
  console.log(`  suspicious_game_vs_pinside_mismatch_rows=${mismatchCount}`);
  for (const s of mismatchSamples) {
    console.log(
      `    ${s.tab} r${s.row}: game=${s.game} | group=${s.pinside_group || "-"} | slug=${s.pinside_slug || "-"}`
    );
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});

