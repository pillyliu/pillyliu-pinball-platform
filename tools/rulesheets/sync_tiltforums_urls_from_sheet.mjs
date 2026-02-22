import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const URLS_FILE = path.join(THIS_DIR, "tiltforums_urls.txt");

const DEFAULT_SPREADSHEET_ID = "1nVey1RP36KiHiR2qefsjm6cd8UfRE9RwtsTdCwkJGSA";
const DEFAULT_GID = "2051576512";
const DEFAULT_CREDENTIALS_FALLBACK = path.resolve(
  THIS_DIR,
  "../../../Pinball Scraper/.secrets/google-service-account.json"
);
const REQUIRED_SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

function parseArgs(argv) {
  const out = {
    spreadsheetId: process.env.AVENUE_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID,
    gid: process.env.AVENUE_SPREADSHEET_GID || DEFAULT_GID,
    outFile: URLS_FILE,
    credentialsPath:
      process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_CREDENTIALS_FALLBACK,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--spreadsheet-id" && argv[i + 1]) out.spreadsheetId = argv[i + 1];
    if (token === "--gid" && argv[i + 1]) out.gid = argv[i + 1];
    if (token === "--out" && argv[i + 1]) out.outFile = path.resolve(argv[i + 1]);
    if (token === "--credentials" && argv[i + 1]) {
      out.credentialsPath = path.resolve(argv[i + 1]);
    }
  }

  return out;
}

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeTiltForumsUrl(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) return null;

  let u;
  try {
    u = new URL(text);
  } catch {
    return null;
  }

  if (!/(^|\.)tiltforums\.com$/i.test(u.hostname)) return null;
  if (!/^\/t\/[^/]+\/\d+\/?$/i.test(u.pathname)) return null;

  u.protocol = "https:";
  u.search = "";
  u.hash = "";
  return u.toString().replace(/\/$/, "");
}

async function resolveSheetTitle(sheets, spreadsheetId, gid) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });
  const wantedId = Number(gid);
  const sheet = (meta.data.sheets || []).find(
    (s) => s?.properties?.sheetId === wantedId
  );
  if (!sheet?.properties?.title) {
    throw new Error(`Could not find sheet with gid ${gid} in spreadsheet ${spreadsheetId}`);
  }
  return sheet.properties.title;
}

function indexOfHeader(headers, name) {
  const needle = name.trim().toLowerCase();
  return headers.findIndex((h) => String(h || "").trim().toLowerCase() === needle);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const auth = new google.auth.GoogleAuth({
    keyFile: args.credentialsPath,
    scopes: REQUIRED_SCOPES,
  });
  const sheets = google.sheets({ version: "v4", auth });

  const sheetTitle = await resolveSheetTitle(sheets, args.spreadsheetId, args.gid);
  const range = `'${sheetTitle.replace(/'/g, "''")}'!A:Z`;
  const valuesRes = await sheets.spreadsheets.values.get({
    spreadsheetId: args.spreadsheetId,
    range,
    majorDimension: "ROWS",
  });

  const rows = valuesRes.data.values || [];
  if (!rows.length) throw new Error("No rows returned from sheet.");

  const headers = rows[0];
  const gameIdx = indexOfHeader(headers, "Game");
  const rulesheetIdx = indexOfHeader(headers, "Rulesheet");

  if (gameIdx < 0 || rulesheetIdx < 0) {
    throw new Error('Sheet must include "Game" and "Rulesheet" columns.');
  }

  const seenSlugs = new Set();
  const seenUrls = new Set();
  const lines = [];
  let dropped = 0;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const game = String(row[gameIdx] || "").trim();
    const rulesheet = normalizeTiltForumsUrl(row[rulesheetIdx]);
    if (!game || !rulesheet) continue;

    const slug = slugify(game);
    if (!slug) continue;
    if (seenSlugs.has(slug) || seenUrls.has(rulesheet)) {
      dropped += 1;
      continue;
    }

    seenSlugs.add(slug);
    seenUrls.add(rulesheet);
    lines.push(`${slug},${rulesheet}`);
  }

  await fs.writeFile(args.outFile, `${lines.join("\n")}\n`, "utf8");

  console.log(`Sheet: ${sheetTitle} (gid ${args.gid})`);
  console.log(`Wrote ${lines.length} Tilt Forums entries -> ${args.outFile}`);
  if (dropped > 0) {
    console.log(`Dropped ${dropped} duplicate slug/url rows.`);
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
