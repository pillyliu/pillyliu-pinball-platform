import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CREDENTIALS_FALLBACK = path.resolve(
  THIS_DIR,
  "../../../Pinball Scraper/.secrets/google-service-account.json"
);
const REQUIRED_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const WORKBOOKS = {
  avenue: {
    name: "Avenue",
    spreadsheetId: "1nVey1RP36KiHiR2qefsjm6cd8UfRE9RwtsTdCwkJGSA",
    onlySheetIds: new Set([2051576512]),
  },
  rlm: {
    name: "RLM",
    spreadsheetId: "1CZXzpzvhX4uv12hOO-8MT1RVkirBRhDXFMSk02tC24Q",
    onlySheetIds: new Set([807778067]),
  },
  codex: {
    name: "Codex",
    spreadsheetId: "1ZzHHFvIsfIZv5ghd4vDXi7G99ILhbgPHk3Lg6SbJFMQ",
    onlySheetIds: null,
  },
};

const LINK_HEADERS = new Set([
  "playfield image",
  "rulesheet",
  "tutorial 1",
  "tutorial 2",
  "tutorial 3",
  "tutorial 4",
  "gameplay 1",
  "gameplay 2",
  "gameplay 3",
  "gameplay 4",
  "competition 1",
  "competition 2",
  "competition 3",
  "competition 4",
]);

function parseArgs(argv) {
  const out = {
    credentialsPath:
      process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_CREDENTIALS_FALLBACK,
    books: ["rlm", "codex"],
    write: true,
    sampleLimit: 5,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === "--credentials" && argv[i + 1]) out.credentialsPath = path.resolve(argv[i + 1]);
    if (t === "--books" && argv[i + 1]) {
      out.books = argv[i + 1]
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);
    }
    if (t === "--dry-run" || t === "--no-write") out.write = false;
    if (t === "--sample-limit" && argv[i + 1]) out.sampleLimit = Math.max(1, Number(argv[i + 1]) || 5);
  }
  const invalid = out.books.filter((b) => !(b in WORKBOOKS));
  if (invalid.length) throw new Error(`Unknown --books: ${invalid.join(", ")}`);
  return out;
}

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function toA1Column(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function escapeSheetTitle(title) {
  return String(title).replace(/'/g, "''");
}

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    if ((rows[i] || []).some((v) => norm(v) === "game")) return i;
  }
  return -1;
}

function looksLikeUrl(value) {
  return /^https?:\/\/\S+$/i.test(String(value ?? "").trim());
}

function extractCellText(cell) {
  const s = cell?.userEnteredValue?.stringValue;
  if (typeof s === "string" && s.trim()) return s.trim();
  const formula = cell?.userEnteredValue?.formulaValue;
  if (typeof formula === "string" && formula.trim()) {
    const m = formula.match(/^=HYPERLINK\("([^"]*)","([^"]*)"\)$/i);
    if (m && m[2]) return m[2];
  }
  const f = cell?.formattedValue;
  if (typeof f === "string" && f.trim()) return f.trim();
  return "";
}

function extractLinkTarget(cell) {
  const direct = cell?.hyperlink;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const tfLink = cell?.userEnteredFormat?.textFormat?.link;
  if (typeof tfLink === "string" && tfLink.trim()) return tfLink.trim();
  if (tfLink && typeof tfLink.uri === "string" && tfLink.uri.trim()) return tfLink.uri.trim();
  const runs = Array.isArray(cell?.textFormatRuns) ? cell.textFormatRuns : [];
  for (const run of runs) {
    const link = run?.format?.link;
    if (typeof link === "string" && link.trim()) return link.trim();
    if (link && typeof link.uri === "string" && link.uri.trim()) return link.uri.trim();
  }
  return "";
}

function formulaForUrl(url) {
  const escaped = String(url).replace(/"/g, '""');
  return `=HYPERLINK("${escaped}","${escaped}")`;
}

async function loadWorkbookSheets(sheetsApi, workbook) {
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId: workbook.spreadsheetId,
    fields: "spreadsheetId,properties(title),sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))",
  });
  let sheets = (meta.data.sheets || []).map((s) => s.properties).filter(Boolean);
  if (workbook.onlySheetIds) sheets = sheets.filter((s) => workbook.onlySheetIds.has(Number(s.sheetId)));
  sheets.sort((a, b) => (a.index || 0) - (b.index || 0));
  return { workbookTitle: meta.data.properties?.title || workbook.name, sheets };
}

async function scanSheet(sheetsApi, spreadsheetId, sheetProps, sampleLimit) {
  const escapedTitle = escapeSheetTitle(sheetProps.title);
  const valuesRes = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: `'${escapedTitle}'!A:ZZ`,
    majorDimension: "ROWS",
  });
  const rows = valuesRes.data.values || [];
  const usedRowCount = rows.length;
  const usedColCount = rows.reduce((m, row) => Math.max(m, (row || []).length), 0);
  if (!usedRowCount || !usedColCount) {
    return { title: sheetProps.title, updates: [], urlCells: 0, mismatches: 0, samples: [], skipped: "empty" };
  }
  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex < 0) {
    return { title: sheetProps.title, updates: [], urlCells: 0, mismatches: 0, samples: [], skipped: "no-header" };
  }
  const headerRow = rows[headerRowIndex] || [];
  const linkCols = [];
  for (let c = 0; c < usedColCount; c += 1) {
    if (LINK_HEADERS.has(norm(headerRow[c]))) linkCols.push(c);
  }
  if (!linkCols.length) {
    return { title: sheetProps.title, updates: [], urlCells: 0, mismatches: 0, samples: [], skipped: "no-link-columns" };
  }

  const safeCol = toA1Column(Math.max(usedColCount - 1, 0));
  const safeRow = Math.max(usedRowCount, 1);
  const gridRes = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    includeGridData: true,
    ranges: [`'${escapedTitle}'!A1:${safeCol}${safeRow}`],
    fields:
      "sheets(data(rowData(values(userEnteredValue,formattedValue,hyperlink,userEnteredFormat(textFormat(link)),textFormatRuns(format(link))))))",
  });
  const rowData = (gridRes.data.sheets || [])[0]?.data?.[0]?.rowData || [];

  let urlCells = 0;
  let mismatches = 0;
  const updates = [];
  const samples = [];

  for (let r = headerRowIndex + 1; r < usedRowCount; r += 1) {
    const rowCells = rowData[r]?.values || [];
    for (const c of linkCols) {
      const cell = rowCells[c] || {};
      const text = extractCellText(cell);
      if (!looksLikeUrl(text)) continue;
      urlCells += 1;
      const target = extractLinkTarget(cell);
      if (!target || target === text) continue;
      mismatches += 1;
      const a1 = `${toA1Column(c)}${r + 1}`;
      updates.push({
        range: `'${escapedTitle}'!${a1}`,
        values: [[formulaForUrl(text)]],
      });
      if (samples.length < sampleLimit) {
        samples.push({ a1, header: String(headerRow[c] ?? ""), text, target });
      }
    }
  }

  return { title: sheetProps.title, updates, urlCells, mismatches, samples };
}

async function applyUpdates(sheetsApi, spreadsheetId, updates) {
  const chunkSize = 200;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await sheetsApi.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: chunk,
      },
    });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const auth = new google.auth.GoogleAuth({
    keyFile: args.credentialsPath,
    scopes: REQUIRED_SCOPES,
  });
  const sheetsApi = google.sheets({ version: "v4", auth });

  for (const key of args.books) {
    const workbook = WORKBOOKS[key];
    const { workbookTitle, sheets } = await loadWorkbookSheets(sheetsApi, workbook);
    let totalUrlCells = 0;
    let totalMismatches = 0;
    let totalRepairs = 0;
    console.log(`${workbook.name} (${workbookTitle})`);

    for (const sheetProps of sheets) {
      const result = await scanSheet(sheetsApi, workbook.spreadsheetId, sheetProps, args.sampleLimit);
      totalUrlCells += result.urlCells;
      totalMismatches += result.mismatches;
      if (result.skipped) continue;
      if (result.mismatches === 0) {
        console.log(`  ${result.title}: url_cells=${result.urlCells} mismatches=0`);
        continue;
      }
      if (args.write) await applyUpdates(sheetsApi, workbook.spreadsheetId, result.updates);
      totalRepairs += result.updates.length;
      console.log(
        `  ${result.title}: url_cells=${result.urlCells} mismatches=${result.mismatches} repaired=${args.write ? result.updates.length : 0}`
      );
      for (const s of result.samples) {
        console.log(`    ${s.a1} [${s.header}] text=${s.text}`);
        console.log(`      target=${s.target}`);
      }
    }

    console.log(
      `  Summary: url_cells=${totalUrlCells} mismatches=${totalMismatches} ${args.write ? `repaired=${totalRepairs}` : ""}`.trim()
    );
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});

