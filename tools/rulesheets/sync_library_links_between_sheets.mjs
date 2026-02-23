import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CREDENTIALS_FALLBACK = path.resolve(
  THIS_DIR,
  "../../../Pinball Scraper/.secrets/google-service-account.json"
);

const SHEETS = {
  avenue: {
    name: "Avenue",
    spreadsheetId: "1nVey1RP36KiHiR2qefsjm6cd8UfRE9RwtsTdCwkJGSA",
    gid: "2051576512",
  },
  rlm: {
    name: "RLM",
    spreadsheetId: "1CZXzpzvhX4uv12hOO-8MT1RVkirBRhDXFMSk02tC24Q",
    gid: "807778067",
  },
  codex: {
    name: "Codex",
    spreadsheetId: "1ZzHHFvIsfIZv5ghd4vDXi7G99ILhbgPHk3Lg6SbJFMQ",
    gid: "719219923",
  },
};

const REQUIRED_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function parseArgs(argv) {
  const out = {
    credentialsPath:
      process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_CREDENTIALS_FALLBACK,
    dryRun: false,
    noSanitize: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--credentials" && argv[i + 1]) out.credentialsPath = path.resolve(argv[i + 1]);
    if (token === "--dry-run") out.dryRun = true;
    if (token === "--no-sanitize") out.noSanitize = true;
  }

  return out;
}

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isLinkHeader(header) {
  const n = norm(header);
  return (
    n === "rulesheet" ||
    n.startsWith("tutorial") ||
    n.startsWith("gameplay") ||
    n.startsWith("competition") ||
    n.startsWith("playfield")
  );
}

function a1Column(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || [];
    if (row.some((v) => norm(v) === "game")) return i;
  }
  return -1;
}

function sanitizeLinkValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return raw;
  if (!/^https?:\/\//i.test(raw)) return raw;

  try {
    const url = new URL(raw);
    let changed = false;
    if (
      url.searchParams.has("utm_source") &&
      url.searchParams.get("utm_source")?.toLowerCase() === "chatgpt.com"
    ) {
      url.searchParams.delete("utm_source");
      changed = true;
    }
    if (!changed) return raw;
    const next = url.toString();
    return next.endsWith("?") ? next.slice(0, -1) : next;
  } catch {
    return raw;
  }
}

async function resolveSheetTitle(sheets, spreadsheetId, gid) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "spreadsheetId,sheets(properties(sheetId,title))",
  });
  const wanted = Number(gid);
  const sheet = (meta.data.sheets || []).find((s) => s?.properties?.sheetId === wanted);
  if (!sheet?.properties?.title) {
    throw new Error(`Could not find sheet gid ${gid} in spreadsheet ${spreadsheetId}`);
  }
  return sheet.properties.title;
}

async function loadSheet(sheetsApi, key, cfg) {
  const title = await resolveSheetTitle(sheetsApi, cfg.spreadsheetId, cfg.gid);
  const escapedTitle = title.replace(/'/g, "''");
  const res = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: cfg.spreadsheetId,
    range: `'${escapedTitle}'!A:ZZ`,
    majorDimension: "ROWS",
  });

  const rows = res.data.values || [];
  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex < 0) {
    throw new Error(`${cfg.name}: Could not find header row containing "Game"`);
  }

  const headers = rows[headerRowIndex] || [];
  const headerMap = new Map();
  headers.forEach((header, idx) => {
    const keyNorm = norm(header);
    if (!keyNorm) return;
    if (!headerMap.has(keyNorm)) headerMap.set(keyNorm, idx);
  });

  const gameIdx = headerMap.get("game");
  if (gameIdx == null) {
    throw new Error(`${cfg.name}: "Game" column not found`);
  }

  const dataRows = [];
  const byGame = new Map();
  for (let r = headerRowIndex + 1; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const game = String(row[gameIdx] ?? "").trim();
    if (!game || norm(game) === "game") continue;
    const rec = { rowIndex0: r, row, game, gameKey: norm(game) };
    dataRows.push(rec);
    if (!byGame.has(rec.gameKey)) byGame.set(rec.gameKey, rec);
  }

  return {
    key,
    ...cfg,
    title,
    escapedTitle,
    rows,
    headerRowIndex,
    headers,
    headerMap,
    dataRows,
    byGame,
  };
}

function getOverlayValue(overlays, rowIndex0, colIndex0) {
  const rowMap = overlays.get(rowIndex0);
  return rowMap?.get(colIndex0);
}

function setOverlayValue(overlays, rowIndex0, colIndex0, value) {
  let rowMap = overlays.get(rowIndex0);
  if (!rowMap) {
    rowMap = new Map();
    overlays.set(rowIndex0, rowMap);
  }
  rowMap.set(colIndex0, value);
}

function currentCellValue(sheet, overlays, rowIndex0, colIndex0) {
  const overlay = getOverlayValue(overlays, rowIndex0, colIndex0);
  if (overlay != null) return String(overlay);
  return String((sheet.rows[rowIndex0] || [])[colIndex0] ?? "");
}

function buildLinkColumns(targetSheet, sourceSheet = null) {
  const cols = [];
  for (let i = 0; i < targetSheet.headers.length; i += 1) {
    const header = targetSheet.headers[i];
    if (!isLinkHeader(header)) continue;
    const col = { header, targetIdx: i };
    if (sourceSheet) {
      const sourceIdx = sourceSheet.headerMap.get(norm(header));
      if (sourceIdx == null) continue;
      col.sourceIdx = sourceIdx;
    }
    cols.push(col);
  }
  return cols;
}

function collectSanitizeUpdates(sheet, overlays) {
  const cols = buildLinkColumns(sheet);
  const updates = [];
  const changedGames = new Set();

  for (const rec of sheet.dataRows) {
    for (const col of cols) {
      const cur = currentCellValue(sheet, overlays, rec.rowIndex0, col.targetIdx).trim();
      if (!cur) continue;
      const next = sanitizeLinkValue(cur);
      if (next === cur) continue;
      updates.push({
        type: "sanitize",
        target: sheet.key,
        game: rec.game,
        header: col.header,
        rowIndex0: rec.rowIndex0,
        colIndex0: col.targetIdx,
        oldValue: cur,
        newValue: next,
      });
      setOverlayValue(overlays, rec.rowIndex0, col.targetIdx, next);
      changedGames.add(rec.game);
    }
  }

  return { updates, changedGames: [...changedGames].sort(), columnCount: cols.length };
}

function collectCopyUpdates({ sourceSheet, targetSheet, targetOverlays, label }) {
  const cols = buildLinkColumns(targetSheet, sourceSheet);
  const updates = [];
  const changedGames = new Set();

  for (const targetRec of targetSheet.dataRows) {
    const sourceRec = sourceSheet.byGame.get(targetRec.gameKey);
    if (!sourceRec) continue;

    for (const col of cols) {
      const sourceRaw = String(sourceRec.row[col.sourceIdx] ?? "").trim();
      const sourceVal = sanitizeLinkValue(sourceRaw);
      if (!sourceVal) continue;

      const curVal = currentCellValue(
        targetSheet,
        targetOverlays,
        targetRec.rowIndex0,
        col.targetIdx
      ).trim();

      if (curVal === sourceVal) continue;

      updates.push({
        type: "copy",
        label,
        target: targetSheet.key,
        source: sourceSheet.key,
        game: targetRec.game,
        header: col.header,
        rowIndex0: targetRec.rowIndex0,
        colIndex0: col.targetIdx,
        oldValue: curVal,
        newValue: sourceVal,
      });

      setOverlayValue(targetOverlays, targetRec.rowIndex0, col.targetIdx, sourceVal);
      changedGames.add(targetRec.game);
    }
  }

  return { updates, changedGames: [...changedGames].sort(), columnCount: cols.length };
}

function toValueRanges(sheet, updates) {
  return updates.map((u) => ({
    range: `'${sheet.escapedTitle}'!${a1Column(u.colIndex0)}${u.rowIndex0 + 1}`,
    values: [[u.newValue]],
  }));
}

function printPassSummary(name, result, limit = 12) {
  console.log(`\n${name}`);
  console.log(`  link columns considered: ${result.columnCount}`);
  console.log(`  updates: ${result.updates.length}`);
  console.log(`  games changed: ${result.changedGames.length}`);
  for (const u of result.updates.slice(0, limit)) {
    console.log(`  - ${u.game} | ${u.header}`);
    console.log(`    old: ${u.oldValue}`);
    console.log(`    new: ${u.newValue}`);
  }
  if (result.updates.length > limit) {
    console.log(`  ... ${result.updates.length - limit} more`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const auth = new google.auth.GoogleAuth({
    keyFile: args.credentialsPath,
    scopes: REQUIRED_SCOPES,
  });
  const sheetsApi = google.sheets({ version: "v4", auth });

  const [avenue, rlm, codex] = await Promise.all([
    loadSheet(sheetsApi, "avenue", SHEETS.avenue),
    loadSheet(sheetsApi, "rlm", SHEETS.rlm),
    loadSheet(sheetsApi, "codex", SHEETS.codex),
  ]);

  const overlays = {
    avenue: new Map(),
    rlm: new Map(),
    codex: new Map(),
  };

  const sanitizePasses = args.noSanitize
    ? []
    : [
        { name: "sanitize avenue", sheet: avenue, result: collectSanitizeUpdates(avenue, overlays.avenue) },
        { name: "sanitize rlm", sheet: rlm, result: collectSanitizeUpdates(rlm, overlays.rlm) },
        { name: "sanitize codex", sheet: codex, result: collectSanitizeUpdates(codex, overlays.codex) },
      ];

  const passAvenueToRlm = collectCopyUpdates({
    sourceSheet: avenue,
    targetSheet: rlm,
    targetOverlays: overlays.rlm,
    label: "avenue->rlm",
  });
  const passAvenueToCodex = collectCopyUpdates({
    sourceSheet: avenue,
    targetSheet: codex,
    targetOverlays: overlays.codex,
    label: "avenue->codex",
  });
  const passRlmToCodex = collectCopyUpdates({
    sourceSheet: rlm,
    targetSheet: codex,
    targetOverlays: overlays.codex,
    label: "rlm->codex",
  });

  for (const pass of sanitizePasses) printPassSummary(pass.name, pass.result, 10);
  printPassSummary("avenue->rlm", passAvenueToRlm, 15);
  printPassSummary("avenue->codex", passAvenueToCodex, 15);
  printPassSummary("rlm->codex", passRlmToCodex, 15);

  const updatesByTarget = {
    avenue: [
      ...sanitizePasses.filter((p) => p.sheet.key === "avenue").flatMap((p) => p.result.updates),
    ],
    rlm: [
      ...sanitizePasses.filter((p) => p.sheet.key === "rlm").flatMap((p) => p.result.updates),
      ...passAvenueToRlm.updates,
    ],
    codex: [
      ...sanitizePasses.filter((p) => p.sheet.key === "codex").flatMap((p) => p.result.updates),
      ...passAvenueToCodex.updates,
      ...passRlmToCodex.updates,
    ],
  };

  const totalUpdates =
    updatesByTarget.avenue.length + updatesByTarget.rlm.length + updatesByTarget.codex.length;

  if (args.dryRun) {
    console.log(`\nDry run only. Total pending cell updates: ${totalUpdates}`);
    return;
  }

  if (totalUpdates === 0) {
    console.log("\nNo updates to apply.");
    return;
  }

  const targetSheets = { avenue, rlm, codex };
  for (const targetKey of ["avenue", "rlm", "codex"]) {
    const updates = updatesByTarget[targetKey];
    if (!updates.length) continue;
    const sheet = targetSheets[targetKey];
    await sheetsApi.spreadsheets.values.batchUpdate({
      spreadsheetId: sheet.spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: toValueRanges(sheet, updates),
      },
    });
    console.log(`Applied ${updates.length} updates to ${sheet.name}`);
  }

  console.log(`\nDone. Total cell updates applied: ${totalUpdates}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
