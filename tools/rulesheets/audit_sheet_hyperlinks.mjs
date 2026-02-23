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
    books: ["avenue", "rlm", "codex"],
    sampleLimit: 5,
    json: false,
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
    if (t === "--sample-limit" && argv[i + 1]) out.sampleLimit = Math.max(1, Number(argv[i + 1]) || 5);
    if (t === "--json") out.json = true;
  }

  const invalid = out.books.filter((b) => !(b in WORKBOOKS));
  if (invalid.length) {
    throw new Error(`Unknown --books: ${invalid.join(", ")} (valid: ${Object.keys(WORKBOOKS).join(", ")})`);
  }

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

async function loadWorkbookSheets(sheetsApi, workbook) {
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId: workbook.spreadsheetId,
    fields: "spreadsheetId,properties(title),sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))",
  });
  let sheets = (meta.data.sheets || []).map((s) => s.properties).filter(Boolean);
  if (workbook.onlySheetIds) {
    sheets = sheets.filter((s) => workbook.onlySheetIds.has(Number(s.sheetId)));
  }
  return { title: meta.data.properties?.title || workbook.name, sheets };
}

async function auditSheet(sheetsApi, spreadsheetId, sheetProps, sampleLimit) {
  const title = sheetProps.title;
  const escapedTitle = escapeSheetTitle(title);

  const valuesRes = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: `'${escapedTitle}'!A:ZZ`,
    majorDimension: "ROWS",
  });
  const rows = valuesRes.data.values || [];
  const usedRowCount = rows.length;
  const usedColCount = rows.reduce((m, row) => Math.max(m, (row || []).length), 0);
  if (!usedRowCount || !usedColCount) {
    return { title, urlCells: 0, mismatches: 0, samples: [], skipped: "empty" };
  }

  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex < 0) {
    return { title, urlCells: 0, mismatches: 0, samples: [], skipped: "no-header" };
  }

  const headerRow = rows[headerRowIndex] || [];
  const linkCols = [];
  for (let c = 0; c < usedColCount; c += 1) {
    if (LINK_HEADERS.has(norm(headerRow[c]))) linkCols.push(c);
  }
  if (!linkCols.length) {
    return { title, urlCells: 0, mismatches: 0, samples: [], skipped: "no-link-columns" };
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
  const gridSheet = (gridRes.data.sheets || [])[0];
  const rowData = (gridSheet?.data || [])[0]?.rowData || [];

  let urlCells = 0;
  let mismatches = 0;
  const samples = [];

  for (let r = headerRowIndex + 1; r < usedRowCount; r += 1) {
    const rowCells = rowData[r]?.values || [];
    for (const c of linkCols) {
      const cell = rowCells[c] || {};
      const text = extractCellText(cell);
      if (!text) continue;
      const target = extractLinkTarget(cell);
      const isUrlText = looksLikeUrl(text);
      if (!isUrlText && !target) continue;
      if (!isUrlText) continue;
      urlCells += 1;
      if (target && target !== text) {
        mismatches += 1;
        if (samples.length < sampleLimit) {
          samples.push({
            a1: `${toA1Column(c)}${r + 1}`,
            header: String(headerRow[c] ?? ""),
            text,
            target,
          });
        }
      }
    }
  }

  return { title, urlCells, mismatches, samples };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const auth = new google.auth.GoogleAuth({
    keyFile: args.credentialsPath,
    scopes: REQUIRED_SCOPES,
  });
  const sheetsApi = google.sheets({ version: "v4", auth });

  const report = { generated_at: new Date().toISOString(), books: {} };

  for (const key of args.books) {
    const workbook = WORKBOOKS[key];
    const meta = await loadWorkbookSheets(sheetsApi, workbook);
    const sheets = meta.sheets.sort((a, b) => (a.index || 0) - (b.index || 0));
    const bookReport = {
      name: workbook.name,
      spreadsheetId: workbook.spreadsheetId,
      workbookTitle: meta.title,
      totals: { sheets: 0, urlCells: 0, mismatches: 0 },
      sheets: [],
    };

    for (const sheetProps of sheets) {
      const sheetReport = await auditSheet(sheetsApi, workbook.spreadsheetId, sheetProps, args.sampleLimit);
      bookReport.totals.sheets += 1;
      bookReport.totals.urlCells += sheetReport.urlCells;
      bookReport.totals.mismatches += sheetReport.mismatches;
      bookReport.sheets.push(sheetReport);
    }

    report.books[key] = bookReport;
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  for (const [key, book] of Object.entries(report.books)) {
    console.log(
      `${key}: sheets=${book.totals.sheets} url_cells=${book.totals.urlCells} mismatches=${book.totals.mismatches}`
    );
    for (const sheet of book.sheets) {
      if (sheet.skipped) continue;
      if (!sheet.mismatches) continue;
      console.log(`  ${sheet.title}: url_cells=${sheet.urlCells} mismatches=${sheet.mismatches}`);
      for (const s of sheet.samples) {
        console.log(`    ${s.a1} [${s.header}] text=${s.text}`);
        console.log(`      target=${s.target}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
