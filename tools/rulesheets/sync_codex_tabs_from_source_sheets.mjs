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
    gid: 2051576512,
  },
  rlm: {
    name: "RLM",
    spreadsheetId: "1CZXzpzvhX4uv12hOO-8MT1RVkirBRhDXFMSk02tC24Q",
    gid: 807778067,
  },
  codex_avenue: {
    name: "Codex / The Avenue Cafe",
    spreadsheetId: "1ZzHHFvIsfIZv5ghd4vDXi7G99ILhbgPHk3Lg6SbJFMQ",
    gid: 743635169,
  },
  codex_rlm: {
    name: "Codex / RLM Amusements",
    spreadsheetId: "1ZzHHFvIsfIZv5ghd4vDXi7G99ILhbgPHk3Lg6SbJFMQ",
    gid: 170020512,
  },
};

const PAIRS = {
  avenue_to_codex_venue: ["avenue", "codex_avenue"],
  rlm_to_codex_venue: ["rlm", "codex_rlm"],
};

function parseArgs(argv) {
  const out = {
    credentialsPath:
      process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_CREDENTIALS_FALLBACK,
    pairKeys: ["avenue_to_codex_venue", "rlm_to_codex_venue"],
    write: true,
    hideTrailingUnused: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === "--credentials" && argv[i + 1]) out.credentialsPath = path.resolve(argv[i + 1]);
    if (t === "--pairs" && argv[i + 1]) {
      out.pairKeys = argv[i + 1]
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    }
    if (t === "--dry-run" || t === "--no-write") out.write = false;
    if (t === "--no-hide-trailing-unused") out.hideTrailingUnused = false;
  }

  const invalid = out.pairKeys.filter((k) => !(k in PAIRS));
  if (invalid.length) {
    throw new Error(`Unknown pair(s): ${invalid.join(", ")}. Valid: ${Object.keys(PAIRS).join(", ")}`);
  }
  return out;
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

function collapseDimensionSegments(items, limit = items.length) {
  const out = [];
  let start = null;
  let prev = null;
  let pixelSize = null;
  for (let i = 0; i < Math.min(items.length, limit); i += 1) {
    const p = items[i] && Number.isFinite(items[i].pixelSize) ? items[i].pixelSize : null;
    if (p == null) continue;
    if (start == null) {
      start = i;
      prev = i;
      pixelSize = p;
      continue;
    }
    if (i === prev + 1 && p === pixelSize) {
      prev = i;
      continue;
    }
    out.push({ startIndex: start, endIndex: prev + 1, pixelSize });
    start = i;
    prev = i;
    pixelSize = p;
  }
  if (start != null) out.push({ startIndex: start, endIndex: prev + 1, pixelSize });
  return out;
}

function escapeSheetTitle(title) {
  return String(title).replace(/'/g, "''");
}

function cloneUserEnteredFormatSansLink(fmt) {
  const clone = fmt ? JSON.parse(JSON.stringify(fmt)) : {};
  if (clone?.textFormat?.link) delete clone.textFormat.link;
  return clone;
}

function resolveSheetTitle(meta, gid) {
  const match = (meta.data.sheets || []).find((s) => s?.properties?.sheetId === Number(gid));
  if (!match?.properties?.title) {
    throw new Error(`Could not find gid ${gid} in spreadsheet ${meta.data.spreadsheetId}`);
  }
  return match.properties.title;
}

async function loadSheet(sheetsApi, cfg) {
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId: cfg.spreadsheetId,
    fields:
      "spreadsheetId,properties(title),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)))",
  });
  const title = resolveSheetTitle(meta, cfg.gid);
  const escapedTitle = escapeSheetTitle(title);

  const valuesRes = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: cfg.spreadsheetId,
    range: `'${escapedTitle}'!A:ZZ`,
    majorDimension: "ROWS",
  });
  const rows = valuesRes.data.values || [];
  const usedRowCount = rows.length;
  const usedColCount = rows.reduce((m, row) => Math.max(m, (row || []).length), 0);
  const safeCol = toA1Column(Math.max(usedColCount - 1, 0));
  const safeRow = Math.max(usedRowCount, 1);

  const gridRes = await sheetsApi.spreadsheets.get({
    spreadsheetId: cfg.spreadsheetId,
    includeGridData: true,
    ranges: [`'${escapedTitle}'!A1:${safeCol}${safeRow}`],
    fields:
      "sheets(properties(sheetId,title,gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)),data(rowMetadata(pixelSize),columnMetadata(pixelSize),rowData(values(userEnteredFormat))))",
  });
  const gridSheet = (gridRes.data.sheets || [])[0];
  const data = (gridSheet?.data || [])[0] || {};
  const gp = gridSheet?.properties?.gridProperties || {};

  return {
    ...cfg,
    title,
    escapedTitle,
    rows,
    usedRowCount,
    usedColCount,
    totalRowCount: Number(gp.rowCount || 0),
    totalColCount: Number(gp.columnCount || 0),
    frozenRowCount: Number(gp.frozenRowCount || 0),
    frozenColumnCount: Number(gp.frozenColumnCount || 0),
    rowMetadata: data.rowMetadata || [],
    columnMetadata: data.columnMetadata || [],
    rowData: data.rowData || [],
  };
}

function toCsvCompatibleRows(rows, usedColCount) {
  return rows.map((row) => {
    const next = Array.from({ length: usedColCount }, (_, i) => String((row || [])[i] ?? ""));
    while (next.length && next[next.length - 1] === "") next.pop();
    return next;
  });
}

function buildValueRows(sourceSheet) {
  return toCsvCompatibleRows(sourceSheet.rows, sourceSheet.usedColCount);
}

function buildFormatRows(sourceSheet) {
  const out = [];
  for (let r = 0; r < sourceSheet.usedRowCount; r += 1) {
    const srcValues = sourceSheet.rowData[r]?.values || [];
    const values = [];
    for (let c = 0; c < sourceSheet.usedColCount; c += 1) {
      values.push({ userEnteredFormat: cloneUserEnteredFormatSansLink(srcValues[c]?.userEnteredFormat) });
    }
    out.push({ values });
  }
  return out;
}

function buildHideTrailingRequests(targetSheet, sourceSheet, hideTrailingUnused) {
  if (!hideTrailingUnused) return [];
  const usedRows = sourceSheet.usedRowCount;
  const usedCols = sourceSheet.usedColCount;
  const totalRows = targetSheet.totalRowCount || usedRows;
  const totalCols = targetSheet.totalColCount || usedCols;
  const reqs = [];

  if (usedRows > 0) {
    reqs.push({
      updateDimensionProperties: {
        range: { sheetId: targetSheet.gid, dimension: "ROWS", startIndex: 0, endIndex: Math.min(usedRows, totalRows) },
        properties: { hiddenByUser: false },
        fields: "hiddenByUser",
      },
    });
  }
  if (usedCols > 0) {
    reqs.push({
      updateDimensionProperties: {
        range: {
          sheetId: targetSheet.gid,
          dimension: "COLUMNS",
          startIndex: 0,
          endIndex: Math.min(usedCols, totalCols),
        },
        properties: { hiddenByUser: false },
        fields: "hiddenByUser",
      },
    });
  }
  if (totalRows > usedRows) {
    reqs.push({
      updateDimensionProperties: {
        range: { sheetId: targetSheet.gid, dimension: "ROWS", startIndex: usedRows, endIndex: totalRows },
        properties: { hiddenByUser: true },
        fields: "hiddenByUser",
      },
    });
  }
  if (totalCols > usedCols) {
    reqs.push({
      updateDimensionProperties: {
        range: { sheetId: targetSheet.gid, dimension: "COLUMNS", startIndex: usedCols, endIndex: totalCols },
        properties: { hiddenByUser: true },
        fields: "hiddenByUser",
      },
    });
  }
  return reqs;
}

async function syncPair(sheetsApi, sourceSheet, targetSheet, { write, hideTrailingUnused }) {
  const valueRows = buildValueRows(sourceSheet);
  const endCol = toA1Column(Math.max(sourceSheet.usedColCount - 1, 0));
  const endRow = Math.max(valueRows.length, 1);
  const targetRange = `'${targetSheet.escapedTitle}'!A1:${endCol}${endRow}`;

  const requests = [];

  const isCodexVenueTarget =
    targetSheet.spreadsheetId === CODEX_SPREADSHEET_ID &&
    (targetSheet.title === "The Avenue Cafe" || targetSheet.title === "RLM Amusements");
  const frozenRowCount = 1;
  const frozenColumnCount = isCodexVenueTarget ? 11 : sourceSheet.frozenColumnCount;

  requests.push({
    updateSheetProperties: {
      properties: {
        sheetId: targetSheet.gid,
        gridProperties: {
          frozenRowCount,
          frozenColumnCount,
        },
      },
      fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
    },
  });

  for (const seg of collapseDimensionSegments(sourceSheet.columnMetadata, sourceSheet.usedColCount)) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: targetSheet.gid, dimension: "COLUMNS", startIndex: seg.startIndex, endIndex: seg.endIndex },
        properties: { pixelSize: seg.pixelSize },
        fields: "pixelSize",
      },
    });
  }

  for (const seg of collapseDimensionSegments(sourceSheet.rowMetadata, sourceSheet.usedRowCount)) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: targetSheet.gid, dimension: "ROWS", startIndex: seg.startIndex, endIndex: seg.endIndex },
        properties: { pixelSize: seg.pixelSize },
        fields: "pixelSize",
      },
    });
  }

  if (sourceSheet.usedRowCount > 0 && sourceSheet.usedColCount > 0) {
    requests.push({
      updateCells: {
        range: {
          sheetId: targetSheet.gid,
          startRowIndex: 0,
          endRowIndex: sourceSheet.usedRowCount,
          startColumnIndex: 0,
          endColumnIndex: sourceSheet.usedColCount,
        },
        rows: buildFormatRows(sourceSheet),
        fields: "userEnteredFormat",
      },
    });
  }

  requests.push(...buildHideTrailingRequests(targetSheet, sourceSheet, hideTrailingUnused));

  if (write) {
    await sheetsApi.spreadsheets.values.clear({
      spreadsheetId: targetSheet.spreadsheetId,
      range: `'${targetSheet.escapedTitle}'!A:ZZ`,
    });
    await sheetsApi.spreadsheets.values.update({
      spreadsheetId: targetSheet.spreadsheetId,
      range: targetRange,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: valueRows },
    });
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: targetSheet.spreadsheetId,
      requestBody: { requests },
    });
  }

  console.log(
    `${write ? "Updated" : "Prepared"} ${targetSheet.name} from ${sourceSheet.name} | values=${sourceSheet.usedRowCount}x${sourceSheet.usedColCount} | requests=${requests.length}`
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const auth = new google.auth.GoogleAuth({
    keyFile: args.credentialsPath,
    scopes: REQUIRED_SCOPES,
  });
  const sheetsApi = google.sheets({ version: "v4", auth });

  for (const pairKey of args.pairKeys) {
    const [srcKey, dstKey] = PAIRS[pairKey];
    const [sourceSheet, targetSheet] = await Promise.all([
      loadSheet(sheetsApi, WORKBOOKS[srcKey]),
      loadSheet(sheetsApi, WORKBOOKS[dstKey]),
    ]);
    await syncPair(sheetsApi, sourceSheet, targetSheet, args);
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
