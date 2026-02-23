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

const CODEX = {
  spreadsheetId: "1ZzHHFvIsfIZv5ghd4vDXi7G99ILhbgPHk3Lg6SbJFMQ",
};

const AVENUE = {
  spreadsheetId: "1nVey1RP36KiHiR2qefsjm6cd8UfRE9RwtsTdCwkJGSA",
  gid: 2051576512,
};

const VENUE_TAB_TITLES = new Set([
  "Crazy Quarters Arcade",
  "Clubhouse Arcade",
  "Sparks Pinball Museum & Arcade",
  "Pinball Pete's East Lansing",
  "The Avenue Cafe",
  "RLM Amusements",
]);

const DELETE_TAB_TITLES = new Set(["Pinball Pete's Ann Arbor"]);

const VENUE_HEADERS = [
  "library_entry_id",
  "practice_identity",
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

const MANUFACTURER_HEADERS = [
  "practice_identity",
  "Game",
  "Manufacturer",
  "Year",
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
    credentialsPath:
      process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_CREDENTIALS_FALLBACK,
    write: true,
    deleteTabs: true,
    hideTrailingUnused: true,
    tabs: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === "--credentials" && argv[i + 1]) out.credentialsPath = path.resolve(argv[i + 1]);
    if (t === "--dry-run" || t === "--no-write") out.write = false;
    if (t === "--no-delete-tabs") out.deleteTabs = false;
    if (t === "--no-hide-trailing-unused") out.hideTrailingUnused = false;
    if (t === "--tabs" && argv[i + 1]) {
      out.tabs = new Set(
        argv[i + 1]
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      );
    }
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

function cloneUserEnteredFormatSansLink(fmt) {
  const clone = fmt ? JSON.parse(JSON.stringify(fmt)) : {};
  if (clone?.textFormat?.link) delete clone.textFormat.link;
  return clone;
}

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || [];
    if (row.some((v) => norm(v) === "game")) return i;
  }
  return -1;
}

function rowIsBlank(row) {
  return !(row || []).some((v) => String(v ?? "").trim());
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

function resolveSheetTitle(meta, gid) {
  const match = (meta.data.sheets || []).find((s) => s?.properties?.sheetId === Number(gid));
  if (!match?.properties?.title) {
    throw new Error(`Could not find gid ${gid} in spreadsheet ${meta.data.spreadsheetId}`);
  }
  return match.properties.title;
}

function headerIndexMap(headers) {
  const map = new Map();
  headers.forEach((h, idx) => {
    const k = norm(h);
    if (!k) return;
    if (!map.has(k)) map.set(k, idx);
  });
  return map;
}

async function loadSheetByGid(sheetsApi, spreadsheetId, gid) {
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields:
      "spreadsheetId,sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)))",
  });
  const title = resolveSheetTitle(meta, gid);
  return loadSheetByTitle(sheetsApi, spreadsheetId, title, gid);
}

async function loadSheetByTitle(sheetsApi, spreadsheetId, title, gid = null) {
  const escapedTitle = escapeSheetTitle(title);
  const valuesRes = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: `'${escapedTitle}'!A:ZZ`,
    majorDimension: "ROWS",
  });
  const rows = valuesRes.data.values || [];
  const usedRowCount = rows.length;
  const usedColCount = rows.reduce((m, row) => Math.max(m, (row || []).length), 0);
  const safeCol = toA1Column(Math.max(usedColCount - 1, 0));
  const safeRow = Math.max(usedRowCount, 1);

  const gridRes = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    includeGridData: true,
    ranges: [`'${escapedTitle}'!A1:${safeCol}${safeRow}`],
    fields:
      "sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)),data(rowMetadata(pixelSize),columnMetadata(pixelSize),rowData(values(userEnteredFormat))))",
  });
  const gridSheet = (gridRes.data.sheets || [])[0];
  const data = (gridSheet?.data || [])[0] || {};
  const gp = gridSheet?.properties?.gridProperties || {};

  return {
    spreadsheetId,
    gid: gid ?? gridSheet?.properties?.sheetId,
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

function buildTransformedRows(sheet, targetHeaders) {
  const hr = findHeaderRow(sheet.rows);
  if (hr < 0) {
    return [targetHeaders];
  }
  const sourceHeaders = sheet.rows[hr] || [];
  const sourceMap = headerIndexMap(sourceHeaders);
  const sourceDataRows = sheet.rows.slice(hr + 1);

  const transformed = sourceDataRows.map((srcRow) =>
    targetHeaders.map((h) => {
      const idx = sourceMap.get(norm(h));
      return idx == null ? "" : String(srcRow[idx] ?? "");
    })
  );

  while (transformed.length && rowIsBlank(transformed[transformed.length - 1])) transformed.pop();
  return [targetHeaders, ...transformed];
}

function getRowTemplateValues(sheet, rowIndex) {
  return (sheet.rowData[rowIndex] && sheet.rowData[rowIndex].values) || [];
}

function findAvenueTemplates(avenueSheet) {
  const hr = findHeaderRow(avenueSheet.rows);
  if (hr < 0) throw new Error("Avenue header row not found");
  let dataRow = -1;
  let blankRow = -1;
  for (let i = hr + 1; i < avenueSheet.rows.length; i += 1) {
    if (dataRow < 0 && !rowIsBlank(avenueSheet.rows[i])) dataRow = i;
    if (dataRow >= 0 && rowIsBlank(avenueSheet.rows[i])) {
      blankRow = i;
      break;
    }
  }
  if (dataRow < 0) dataRow = Math.min(hr + 1, Math.max(0, avenueSheet.rows.length - 1));
  return { headerRow: hr, dataRow, blankRow };
}

function buildAvenueHeaderWidthMap(avenueSheet) {
  const hr = findHeaderRow(avenueSheet.rows);
  if (hr < 0) return new Map();
  const headers = avenueSheet.rows[hr] || [];
  const out = new Map();
  for (let i = 0; i < headers.length; i += 1) {
    const k = norm(headers[i]);
    if (!k) continue;
    const px = avenueSheet.columnMetadata[i]?.pixelSize;
    if (Number.isFinite(px) && !out.has(k)) out.set(k, px);
  }
  return out;
}

function buildFormatRequests({
  targetSheet,
  transformedRows,
  targetHeaders,
  avenueSheet,
  avenueTemplates,
  avenueHeaderWidths,
  manufacturerMode,
  hideTrailingUnused,
}) {
  const usedRowCount = transformedRows.length;
  const usedColCount = targetHeaders.length;
  const requests = [];

  const headerFmt = getRowTemplateValues(avenueSheet, avenueTemplates.headerRow);
  const dataFmt = getRowTemplateValues(avenueSheet, avenueTemplates.dataRow);
  const blankFmt =
    avenueTemplates.blankRow >= 0 ? getRowTemplateValues(avenueSheet, avenueTemplates.blankRow) : dataFmt;
  const headerHeight = avenueSheet.rowMetadata[avenueTemplates.headerRow]?.pixelSize ?? null;
  const dataHeight = avenueSheet.rowMetadata[avenueTemplates.dataRow]?.pixelSize ?? null;
  const blankHeight =
    avenueTemplates.blankRow >= 0 ? avenueSheet.rowMetadata[avenueTemplates.blankRow]?.pixelSize ?? 10 : 10;

  // Freeze settings
  requests.push({
    updateSheetProperties: {
      properties: {
        sheetId: targetSheet.gid,
        gridProperties: {
          frozenRowCount: 1,
          frozenColumnCount: manufacturerMode ? 2 : 11,
        },
      },
      fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
    },
  });

  // Column widths based on Avenue header names
  for (let c = 0; c < targetHeaders.length; c += 1) {
    const header = targetHeaders[c];
    const px = avenueHeaderWidths.get(norm(header));
    if (!Number.isFinite(px)) continue;
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: targetSheet.gid, dimension: "COLUMNS", startIndex: c, endIndex: c + 1 },
        properties: { pixelSize: px },
        fields: "pixelSize",
      },
    });
  }

  // Row heights by row type
  let runStart = 0;
  let runHeight = null;
  for (let r = 0; r < usedRowCount; r += 1) {
    let h = dataHeight;
    if (r === 0) h = headerHeight;
    else if (!manufacturerMode && rowIsBlank(transformedRows[r])) h = blankHeight;
    else if (manufacturerMode && rowIsBlank(transformedRows[r])) h = dataHeight;

    if (runStart === 0 && r === 0) {
      runStart = 0;
      runHeight = h;
      continue;
    }
    if (h !== runHeight) {
      if (runHeight != null) {
        requests.push({
          updateDimensionProperties: {
            range: { sheetId: targetSheet.gid, dimension: "ROWS", startIndex: runStart, endIndex: r },
            properties: { pixelSize: runHeight },
            fields: "pixelSize",
          },
        });
      }
      runStart = r;
      runHeight = h;
    }
  }
  if (usedRowCount > 0 && runHeight != null) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: targetSheet.gid, dimension: "ROWS", startIndex: runStart, endIndex: usedRowCount },
        properties: { pixelSize: runHeight },
        fields: "pixelSize",
      },
    });
  }

  // Cell formatting by row type using Avenue templates
  const rows = [];
  for (let r = 0; r < usedRowCount; r += 1) {
    const template =
      r === 0
        ? headerFmt
        : !manufacturerMode && rowIsBlank(transformedRows[r])
        ? blankFmt
        : dataFmt;
    const values = [];
    for (let c = 0; c < usedColCount; c += 1) {
      values.push({ userEnteredFormat: cloneUserEnteredFormatSansLink(template[c]?.userEnteredFormat) });
    }
    rows.push({ values });
  }
  if (usedRowCount > 0 && usedColCount > 0) {
    requests.push({
      updateCells: {
        range: {
          sheetId: targetSheet.gid,
          startRowIndex: 0,
          endRowIndex: usedRowCount,
          startColumnIndex: 0,
          endColumnIndex: usedColCount,
        },
        rows,
        fields: "userEnteredFormat",
      },
    });
  }

  // Hide only trailing unused rows/cols; unhide used rows/cols
  if (hideTrailingUnused) {
    if (usedRowCount > 0) {
      requests.push({
        updateDimensionProperties: {
          range: { sheetId: targetSheet.gid, dimension: "ROWS", startIndex: 0, endIndex: usedRowCount },
          properties: { hiddenByUser: false },
          fields: "hiddenByUser",
        },
      });
    }
    if (usedColCount > 0) {
      requests.push({
        updateDimensionProperties: {
          range: { sheetId: targetSheet.gid, dimension: "COLUMNS", startIndex: 0, endIndex: usedColCount },
          properties: { hiddenByUser: false },
          fields: "hiddenByUser",
        },
      });
    }
    if (targetSheet.totalRowCount > usedRowCount) {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId: targetSheet.gid,
            dimension: "ROWS",
            startIndex: usedRowCount,
            endIndex: targetSheet.totalRowCount,
          },
          properties: { hiddenByUser: true },
          fields: "hiddenByUser",
        },
      });
    }
    if (targetSheet.totalColCount > usedColCount) {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId: targetSheet.gid,
            dimension: "COLUMNS",
            startIndex: usedColCount,
            endIndex: targetSheet.totalColCount,
          },
          properties: { hiddenByUser: true },
          fields: "hiddenByUser",
        },
      });
    }
  }

  return requests;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const auth = new google.auth.GoogleAuth({
    keyFile: args.credentialsPath,
    scopes: REQUIRED_SCOPES,
  });
  const sheetsApi = google.sheets({ version: "v4", auth });

  const avenueSheet = await loadSheetByGid(sheetsApi, AVENUE.spreadsheetId, AVENUE.gid);
  const avenueTemplates = findAvenueTemplates(avenueSheet);
  const avenueHeaderWidths = buildAvenueHeaderWidthMap(avenueSheet);

  const codexMeta = await sheetsApi.spreadsheets.get({
    spreadsheetId: CODEX.spreadsheetId,
    fields: "sheets(properties(sheetId,title,index))",
  });
  const allSheets = (codexMeta.data.sheets || []).sort((a, b) => (a.properties.index || 0) - (b.properties.index || 0));

  const deleteRequests = [];
  const kept = [];
  for (const s of allSheets) {
    const p = s.properties || {};
    const title = String(p.title || "");
    if (args.tabs && !args.tabs.has(title)) {
      kept.push(p);
      continue;
    }
    if (args.deleteTabs && DELETE_TAB_TITLES.has(title)) {
      deleteRequests.push({ deleteSheet: { sheetId: p.sheetId } });
      continue;
    }
    kept.push(p);
  }
  if (deleteRequests.length) {
    if (args.write) {
      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: CODEX.spreadsheetId,
        requestBody: { requests: deleteRequests },
      });
    }
    console.log(`${args.write ? "Deleted" : "Would delete"} tabs: ${deleteRequests.length}`);
  }

  // Reload metadata after deletion to ensure gids/titles are current.
  const codexMeta2 = await sheetsApi.spreadsheets.get({
    spreadsheetId: CODEX.spreadsheetId,
    fields: "sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)))",
  });

  for (const s of (codexMeta2.data.sheets || []).sort((a, b) => (a.properties.index || 0) - (b.properties.index || 0))) {
    const p = s.properties || {};
    const title = String(p.title || "");
    if (args.tabs && !args.tabs.has(title)) continue;
    if (DELETE_TAB_TITLES.has(title)) continue;

    const manufacturerMode = !VENUE_TAB_TITLES.has(title);
    const targetHeaders = manufacturerMode ? MANUFACTURER_HEADERS : VENUE_HEADERS;
    const sheet = await loadSheetByTitle(sheetsApi, CODEX.spreadsheetId, title, p.sheetId);
    const transformedRows = buildTransformedRows(sheet, targetHeaders);
    const requests = buildFormatRequests({
      targetSheet: sheet,
      transformedRows,
      targetHeaders,
      avenueSheet,
      avenueTemplates,
      avenueHeaderWidths,
      manufacturerMode,
      hideTrailingUnused: args.hideTrailingUnused,
    });

    const endCol = toA1Column(Math.max(targetHeaders.length - 1, 0));
    const endRow = Math.max(transformedRows.length, 1);
    const range = `'${sheet.escapedTitle}'!A1:${endCol}${endRow}`;

    if (args.write) {
      await sheetsApi.spreadsheets.values.clear({
        spreadsheetId: CODEX.spreadsheetId,
        range: `'${sheet.escapedTitle}'!A:ZZ`,
      });
      await sheetsApi.spreadsheets.values.update({
        spreadsheetId: CODEX.spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: transformedRows },
      });
      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: CODEX.spreadsheetId,
        requestBody: { requests },
      });
    }

    console.log(
      `${args.write ? "Formatted" : "Would format"} ${title} | mode=${manufacturerMode ? "manufacturer" : "venue"} | rows=${transformedRows.length} cols=${targetHeaders.length} | requests=${requests.length}`
    );
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
