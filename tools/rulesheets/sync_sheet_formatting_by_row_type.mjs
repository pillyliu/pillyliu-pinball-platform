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

const SHEETS = {
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
  codex: {
    name: "Codex",
    spreadsheetId: "1ZzHHFvIsfIZv5ghd4vDXi7G99ILhbgPHk3Lg6SbJFMQ",
    gid: 719219923,
  },
};

function parseArgs(argv) {
  const out = {
    source: "avenue",
    target: "rlm",
    credentialsPath:
      process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_CREDENTIALS_FALLBACK,
    write: true,
    hideTrailingUnused: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === "--source" && argv[i + 1]) out.source = String(argv[i + 1]).trim().toLowerCase();
    if (t === "--target" && argv[i + 1]) out.target = String(argv[i + 1]).trim().toLowerCase();
    if (t === "--credentials" && argv[i + 1]) out.credentialsPath = path.resolve(argv[i + 1]);
    if (t === "--dry-run" || t === "--no-write") out.write = false;
    if (t === "--no-hide-trailing-unused") out.hideTrailingUnused = false;
  }

  if (!(out.source in SHEETS)) {
    throw new Error(`Unknown --source ${out.source}. Valid: ${Object.keys(SHEETS).join(", ")}`);
  }
  if (!(out.target in SHEETS)) {
    throw new Error(`Unknown --target ${out.target}. Valid: ${Object.keys(SHEETS).join(", ")}`);
  }
  if (out.source === out.target) {
    throw new Error("--source and --target must be different");
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

function getHeaderIndex(headers, name) {
  return (headers || []).findIndex((h) => norm(h) === norm(name));
}

function rowIsBlank(row) {
  return !(row || []).some((v) => String(v ?? "").trim());
}

function rowHasGame(row, gameIdx) {
  if (gameIdx < 0) return false;
  const v = String((row || [])[gameIdx] ?? "").trim();
  return Boolean(v) && norm(v) !== "game";
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

function collapseDimensionSegments(items) {
  const out = [];
  let start = null;
  let prev = null;
  let pixelSize = null;
  for (let i = 0; i < items.length; i += 1) {
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
    fields: "spreadsheetId,sheets(properties(sheetId,title,gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)))",
  });
  const title = resolveSheetTitle(meta, cfg.gid);
  const escapedTitle = title.replace(/'/g, "''");

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

function getRowTemplateValues(sheet, rowIndex) {
  return (sheet.rowData[rowIndex] && sheet.rowData[rowIndex].values) || [];
}

function classifyTemplateRows(sourceSheet) {
  const headerRowIndex = findHeaderRow(sourceSheet.rows);
  if (headerRowIndex < 0) throw new Error(`${sourceSheet.name}: Could not find header row containing Game`);

  const gameIdx = getHeaderIndex(sourceSheet.rows[headerRowIndex], "Game");
  let firstDataRowIndex = -1;
  let firstBlankSeparatorRowIndex = -1;

  for (let i = headerRowIndex + 1; i < sourceSheet.rows.length; i += 1) {
    if (firstDataRowIndex < 0 && rowHasGame(sourceSheet.rows[i], gameIdx)) firstDataRowIndex = i;
    if (firstDataRowIndex >= 0 && rowIsBlank(sourceSheet.rows[i])) {
      firstBlankSeparatorRowIndex = i;
      break;
    }
  }
  if (firstDataRowIndex < 0) {
    throw new Error(`${sourceSheet.name}: Could not find a data row after header`);
  }

  return {
    headerRowIndex,
    firstDataRowIndex,
    firstBlankSeparatorRowIndex,
  };
}

function buildRowStylePlan(sourceSheet, targetSheet, sourceTemplate) {
  const targetHeaderRowIndex = findHeaderRow(targetSheet.rows);
  if (targetHeaderRowIndex < 0) throw new Error(`${targetSheet.name}: Could not find header row containing Game`);

  const targetGameIdx = getHeaderIndex(targetSheet.rows[targetHeaderRowIndex], "Game");
  const headerFmt = getRowTemplateValues(sourceSheet, sourceTemplate.headerRowIndex);
  const dataFmt = getRowTemplateValues(sourceSheet, sourceTemplate.firstDataRowIndex);
  const blankFmt =
    sourceTemplate.firstBlankSeparatorRowIndex >= 0
      ? getRowTemplateValues(sourceSheet, sourceTemplate.firstBlankSeparatorRowIndex)
      : dataFmt;

  const headerHeight = sourceSheet.rowMetadata[sourceTemplate.headerRowIndex]?.pixelSize ?? null;
  const dataHeight = sourceSheet.rowMetadata[sourceTemplate.firstDataRowIndex]?.pixelSize ?? null;
  const blankHeight =
    sourceTemplate.firstBlankSeparatorRowIndex >= 0
      ? sourceSheet.rowMetadata[sourceTemplate.firstBlankSeparatorRowIndex]?.pixelSize ?? 10
      : 10;

  const updateRows = [];
  const rowKinds = [];

  for (let r = 0; r < targetSheet.usedRowCount; r += 1) {
    let kind = "prefix";
    let template = [];
    let height = null;

    if (r < targetHeaderRowIndex) {
      const srcIdx = Math.min(r, Math.max(sourceTemplate.headerRowIndex - 1, 0));
      template = getRowTemplateValues(sourceSheet, srcIdx);
      height = sourceSheet.rowMetadata[srcIdx]?.pixelSize ?? null;
    } else if (r === targetHeaderRowIndex) {
      kind = "header";
      template = headerFmt;
      height = headerHeight;
    } else if (rowHasGame(targetSheet.rows[r], targetGameIdx)) {
      kind = "data";
      template = dataFmt;
      height = dataHeight;
    } else if (rowIsBlank(targetSheet.rows[r])) {
      kind = "blank";
      template = blankFmt;
      height = blankHeight;
    } else {
      // Non-empty non-game rows (notes/etc.) should not get separator styling.
      kind = "data";
      template = dataFmt;
      height = dataHeight;
    }

    rowKinds.push({ kind, height });
    const values = [];
    for (let c = 0; c < targetSheet.usedColCount; c += 1) {
      values.push({ userEnteredFormat: cloneUserEnteredFormatSansLink(template[c]?.userEnteredFormat) });
    }
    updateRows.push({ values });
  }

  return {
    targetHeaderRowIndex,
    updateRows,
    rowKinds,
  };
}

function buildRowHeightRequests(targetSheet, rowKinds) {
  const requests = [];
  let start = 0;
  while (start < rowKinds.length) {
    const base = rowKinds[start];
    let end = start + 1;
    while (end < rowKinds.length) {
      const next = rowKinds[end];
      if (next.kind !== base.kind || next.height !== base.height) break;
      end += 1;
    }
    if (base.height != null) {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId: targetSheet.gid,
            dimension: "ROWS",
            startIndex: start,
            endIndex: end,
          },
          properties: { pixelSize: base.height },
          fields: "pixelSize",
        },
      });
    }
    start = end;
  }
  return requests;
}

function buildHideTrailingRequests(targetSheet, hideTrailingUnused) {
  if (!hideTrailingUnused) return [];
  const requests = [];

  const usedRows = targetSheet.usedRowCount;
  const usedCols = targetSheet.usedColCount;
  const totalRows = targetSheet.totalRowCount || usedRows;
  const totalCols = targetSheet.totalColCount || usedCols;

  // Ensure all used dimensions are visible.
  if (usedRows > 0) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: targetSheet.gid, dimension: "ROWS", startIndex: 0, endIndex: usedRows },
        properties: { hiddenByUser: false },
        fields: "hiddenByUser",
      },
    });
  }
  if (usedCols > 0) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: targetSheet.gid, dimension: "COLUMNS", startIndex: 0, endIndex: usedCols },
        properties: { hiddenByUser: false },
        fields: "hiddenByUser",
      },
    });
  }

  // Hide only trailing unused dimensions beyond the used data range.
  if (totalRows > usedRows) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: targetSheet.gid, dimension: "ROWS", startIndex: usedRows, endIndex: totalRows },
        properties: { hiddenByUser: true },
        fields: "hiddenByUser",
      },
    });
  }
  if (totalCols > usedCols) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: targetSheet.gid, dimension: "COLUMNS", startIndex: usedCols, endIndex: totalCols },
        properties: { hiddenByUser: true },
        fields: "hiddenByUser",
      },
    });
  }
  return requests;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceCfg = SHEETS[args.source];
  const targetCfg = SHEETS[args.target];

  const auth = new google.auth.GoogleAuth({
    keyFile: args.credentialsPath,
    scopes: REQUIRED_SCOPES,
  });
  const sheetsApi = google.sheets({ version: "v4", auth });

  const [sourceSheet, targetSheet] = await Promise.all([
    loadSheet(sheetsApi, sourceCfg),
    loadSheet(sheetsApi, targetCfg),
  ]);

  const sourceTemplate = classifyTemplateRows(sourceSheet);
  const plan = buildRowStylePlan(sourceSheet, targetSheet, sourceTemplate);
  const requests = [];

  // Frozen rows/cols from source.
  requests.push({
    updateSheetProperties: {
      properties: {
        sheetId: targetSheet.gid,
        gridProperties: {
          frozenRowCount: 1,
          frozenColumnCount: 11,
        },
      },
      fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
    },
  });

  // Column widths (only for used target columns).
  for (const seg of collapseDimensionSegments(sourceSheet.columnMetadata.slice(0, targetSheet.usedColCount))) {
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId: targetSheet.gid,
          dimension: "COLUMNS",
          startIndex: seg.startIndex,
          endIndex: seg.endIndex,
        },
        properties: { pixelSize: seg.pixelSize },
        fields: "pixelSize",
      },
    });
  }

  requests.push(...buildRowHeightRequests(targetSheet, plan.rowKinds));

  // Cell formatting over used target range only.
  if (targetSheet.usedRowCount > 0 && targetSheet.usedColCount > 0) {
    requests.push({
      updateCells: {
        range: {
          sheetId: targetSheet.gid,
          startRowIndex: 0,
          endRowIndex: targetSheet.usedRowCount,
          startColumnIndex: 0,
          endColumnIndex: targetSheet.usedColCount,
        },
        rows: plan.updateRows,
        fields: "userEnteredFormat",
      },
    });
  }

  requests.push(...buildHideTrailingRequests(targetSheet, args.hideTrailingUnused));

  if (args.write) {
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: targetSheet.spreadsheetId,
      requestBody: { requests },
    });
  }

  console.log(
    `${args.write ? "Updated" : "Prepared"} formatting sync ${sourceSheet.name} -> ${targetSheet.name}`
  );
  console.log(
    `Target used range: rows=${targetSheet.usedRowCount} cols=${targetSheet.usedColCount} (total rows=${targetSheet.totalRowCount} cols=${targetSheet.totalColCount})`
  );
  console.log(
    `Source templates: headerRow=${sourceTemplate.headerRowIndex + 1} dataRow=${sourceTemplate.firstDataRowIndex + 1} separatorRow=${
      sourceTemplate.firstBlankSeparatorRowIndex >= 0 ? sourceTemplate.firstBlankSeparatorRowIndex + 1 : "none"
    }`
  );
  console.log(
    "Rules: format by row type (header/data/blank), not absolute row index; hide trailing unused rows/cols only."
  );
  console.log(`Requests: ${requests.length}`);
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
