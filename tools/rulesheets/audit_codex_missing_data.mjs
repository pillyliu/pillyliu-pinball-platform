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
const VENUE_TAB_TITLES = new Set([
  "Crazy Quarters Arcade",
  "Clubhouse Arcade",
  "Sparks Pinball Museum & Arcade",
  "Pinball Pete's East Lansing",
  "The Avenue Cafe",
  "RLM Amusements",
]);

const VENUE_REQUIRED = ["library_entry_id", "practice_identity", "pinside_id", "pinside_slug", "pinside_group"];
const MANUFACTURER_REQUIRED = ["practice_identity", "pinside_id", "pinside_slug", "pinside_group"];
const LINK_COLUMNS = [
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
    credentialsPath:
      process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_CREDENTIALS_FALLBACK,
    sampleLimit: 5,
    json: false,
    tabs: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === "--credentials" && argv[i + 1]) out.credentialsPath = path.resolve(argv[i + 1]);
    if (t === "--sample-limit" && argv[i + 1]) out.sampleLimit = Math.max(1, Number(argv[i + 1]) || 5);
    if (t === "--json") out.json = true;
    if (t === "--tabs" && argv[i + 1]) {
      out.tabs = new Set(argv[i + 1].split(",").map((v) => v.trim()).filter(Boolean));
    }
  }
  return out;
}

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
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
    if (!k) return;
    if (!m.has(k)) m.set(k, i);
  });
  return m;
}

function rowBlank(row) {
  return !(row || []).some((v) => String(v ?? "").trim());
}

function getCell(row, idx) {
  if (idx == null || idx < 0) return "";
  return String((row || [])[idx] ?? "").trim();
}

function looksLikeVenueTab(title, idxMap) {
  if (VENUE_TAB_TITLES.has(title)) return true;
  return idxMap.has("venue") || idxMap.has("variant");
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
  const sheets = (meta.data.sheets || [])
    .map((s) => s.properties)
    .filter(Boolean)
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .filter((p) => (args.tabs ? args.tabs.has(p.title) : true));

  const report = {
    workbook: meta.data.properties?.title || "Codex",
    spreadsheetId: CODEX_SPREADSHEET_ID,
    generated_at: new Date().toISOString(),
    totals: { tabs: 0, game_rows: 0, venue_tabs: 0, manufacturer_tabs: 0 },
    tabs: [],
  };

  for (const p of sheets) {
    const escapedTitle = String(p.title).replace(/'/g, "''");
    const valuesRes = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: CODEX_SPREADSHEET_ID,
      range: `'${escapedTitle}'!A:ZZ`,
      majorDimension: "ROWS",
    });
    const rows = valuesRes.data.values || [];
    const hr = findHeaderRow(rows);
    if (hr < 0) {
      report.tabs.push({ title: p.title, kind: "unknown", skipped: "no-header" });
      continue;
    }
    const headers = rows[hr] || [];
    const idx = headerIndexMap(headers);
    const kind = looksLikeVenueTab(p.title, idx) ? "venue" : "manufacturer";
    const required = kind === "venue" ? VENUE_REQUIRED : MANUFACTURER_REQUIRED;
    const samples = [];
    const missingByColumn = Object.fromEntries(required.map((c) => [c, 0]));
    const blankLinks = Object.fromEntries(LINK_COLUMNS.map((c) => [c, 0]));
    const hasCol = (name) => idx.has(norm(name));

    let gameRows = 0;
    let rowsWithAnyMissingRequired = 0;
    let rowsMissingAllPinsideCore = 0;

    for (let r = hr + 1; r < rows.length; r += 1) {
      const row = rows[r] || [];
      if (rowBlank(row)) continue;
      const game = getCell(row, idx.get("game"));
      if (!game || norm(game) === "game") continue;
      gameRows += 1;

      let anyMissing = false;
      const rowMissing = {};
      for (const col of required) {
        if (!hasCol(col)) {
          missingByColumn[col] += 1;
          anyMissing = true;
          rowMissing[col] = "(column missing)";
          continue;
        }
        const v = getCell(row, idx.get(norm(col)));
        if (!v) {
          missingByColumn[col] += 1;
          anyMissing = true;
          rowMissing[col] = "";
        }
      }

      const coreCols = ["pinside_id", "pinside_slug", "pinside_group"];
      let missingCoreCount = 0;
      for (const c of coreCols) {
        if (!hasCol(c) || !getCell(row, idx.get(norm(c)))) missingCoreCount += 1;
      }
      if (missingCoreCount === coreCols.length) rowsMissingAllPinsideCore += 1;

      for (const linkCol of LINK_COLUMNS) {
        if (!hasCol(linkCol)) continue;
        if (!getCell(row, idx.get(norm(linkCol)))) blankLinks[linkCol] += 1;
      }

      if (anyMissing) {
        rowsWithAnyMissingRequired += 1;
        if (samples.length < args.sampleLimit) {
          samples.push({
            row: r + 1,
            game,
            manufacturer: getCell(row, idx.get("manufacturer")),
            year: getCell(row, idx.get("year")),
            missing: Object.keys(rowMissing),
          });
        }
      }
    }

    report.totals.tabs += 1;
    report.totals.game_rows += gameRows;
    if (kind === "venue") report.totals.venue_tabs += 1;
    if (kind === "manufacturer") report.totals.manufacturer_tabs += 1;
    report.tabs.push({
      title: p.title,
      kind,
      game_rows: gameRows,
      rows_with_any_missing_required: rowsWithAnyMissingRequired,
      rows_missing_all_pinside_core: rowsMissingAllPinsideCore,
      missing_by_required_column: missingByColumn,
      blank_link_counts: blankLinks,
      samples,
    });
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(
    `${report.workbook}: tabs=${report.totals.tabs} venue_tabs=${report.totals.venue_tabs} manufacturer_tabs=${report.totals.manufacturer_tabs} game_rows=${report.totals.game_rows}`
  );
  for (const t of report.tabs) {
    if (t.skipped) {
      console.log(`${t.title}: skipped (${t.skipped})`);
      continue;
    }
    const reqSummary = Object.entries(t.missing_by_required_column)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    console.log(
      `${t.title} [${t.kind}] rows=${t.game_rows} rows_missing_required=${t.rows_with_any_missing_required} rows_missing_all_pinside_core=${t.rows_missing_all_pinside_core}`
    );
    console.log(`  ${reqSummary}`);
    for (const s of t.samples) {
      console.log(`  r${s.row} ${s.game} (${s.manufacturer} ${s.year}) missing: ${s.missing.join(", ")}`);
    }
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});

