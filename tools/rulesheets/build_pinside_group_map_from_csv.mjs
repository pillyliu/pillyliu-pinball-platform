import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(THIS_DIR, "../..");
const DEFAULT_INPUT = path.join(ROOT, "shared", "pinball", "data", "Codex Pinball Library - Current.csv");
const DEFAULT_OUTPUT = path.join(ROOT, "shared", "pinball", "data", "pinside_group_map.json");

function parseArgs(argv) {
  const out = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--input" && argv[i + 1]) out.input = path.resolve(argv[i + 1]);
    if (token === "--output" && argv[i + 1]) out.output = path.resolve(argv[i + 1]);
  }
  return out;
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  if (!lines.length) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const vals = splitCsvLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = vals[idx] ?? "";
    });
    return row;
  });
  return { headers, rows };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const csvText = await fs.readFile(args.input, "utf8");
  const { rows } = parseCsv(csvText);
  const map = {};
  const collisions = [];

  for (const row of rows) {
    const game = String(row["Game"] ?? "").trim();
    const variant = String(row["Variant"] ?? "").trim();
    const pinsideSlug = String(row["pinside_slug"] ?? "").trim();
    if (!game || !variant || !pinsideSlug) continue;

    const existing = map[pinsideSlug];
    if (existing && existing !== game) {
      collisions.push({ pinside_slug: pinsideSlug, existing, next: game });
      continue;
    }
    map[pinsideSlug] = game;
  }

  await fs.mkdir(path.dirname(args.output), { recursive: true });
  await fs.writeFile(args.output, `${JSON.stringify(map, null, 2)}\n`, "utf8");

  console.log(`Input rows: ${rows.length}`);
  console.log(`Mapped slugs with variant -> pinside_group: ${Object.keys(map).length}`);
  console.log(`Collisions: ${collisions.length}`);
  if (collisions.length) {
    console.log("Collision samples:");
    for (const c of collisions.slice(0, 10)) {
      console.log(`  ${c.pinside_slug}: "${c.existing}" vs "${c.next}"`);
    }
  }
  console.log(`Wrote ${args.output}`);
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
