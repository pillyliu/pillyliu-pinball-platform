import { fetchPinballText } from "./pinballCache";

export const REDACTED_PLAYERS_PATH = "/pinball/data/redacted_players.csv";
const REDACTION_SALT = "pinball-app-redaction-v1";

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
  0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
  0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
  0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
  0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
  0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
];

export function normalizePlayerName(value: string): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function parseRedactedPlayersCsv(text: string): Set<string> {
  const matrix = parseCsv(text);
  if (!matrix.length) return new Set<string>();

  const header = matrix[0].map((value) => value.trim().toLowerCase());
  const hasHeader =
    header.includes("name") || header.includes("player") || header.includes("player_name");

  const nameIndex =
    header.indexOf("name") >= 0
      ? header.indexOf("name")
      : header.indexOf("player") >= 0
        ? header.indexOf("player")
        : header.indexOf("player_name") >= 0
          ? header.indexOf("player_name")
          : 0;

  const out = new Set<string>();
  const rows = hasHeader ? matrix.slice(1) : matrix;
  for (const row of rows) {
    const normalized = normalizePlayerName(row[nameIndex] ?? "");
    if (normalized) out.add(normalized);
  }
  return out;
}

export async function loadRedactedPlayers(): Promise<Set<string>> {
  const text = await fetchPinballText(REDACTED_PLAYERS_PATH);
  return parseRedactedPlayersCsv(text);
}

export function shouldRedactPlayerName(name: string, redactedPlayers: Set<string>): boolean {
  const normalized = normalizePlayerName(name);
  return !!normalized && redactedPlayers.has(normalized);
}

export function redactDisplayName(name: string): string {
  const normalized = normalizePlayerName(name);
  if (!normalized) return "Redacted";
  const token = sha256Hex(`${REDACTION_SALT}:${normalized}`).slice(0, 6).toUpperCase();
  return `Redacted ${token}`;
}

export function formatPlayerDisplayName(name: string, redactedPlayers: Set<string>): string {
  return shouldRedactPlayerName(name, redactedPlayers) ? redactDisplayName(name) : name;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const digest = sha256(bytes);
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

function sha256(message: Uint8Array): Uint8Array {
  const messageLength = message.length;
  const bitLengthHi = Math.floor((messageLength * 8) / 0x100000000);
  const bitLengthLo = (messageLength * 8) >>> 0;

  const withOne = messageLength + 1;
  const totalLength = (((withOne + 8 + 63) >> 6) << 6) >>> 0;
  const padded = new Uint8Array(totalLength);
  padded.set(message);
  padded[messageLength] = 0x80;

  padded[totalLength - 8] = (bitLengthHi >>> 24) & 0xff;
  padded[totalLength - 7] = (bitLengthHi >>> 16) & 0xff;
  padded[totalLength - 6] = (bitLengthHi >>> 8) & 0xff;
  padded[totalLength - 5] = bitLengthHi & 0xff;
  padded[totalLength - 4] = (bitLengthLo >>> 24) & 0xff;
  padded[totalLength - 3] = (bitLengthLo >>> 16) & 0xff;
  padded[totalLength - 2] = (bitLengthLo >>> 8) & 0xff;
  padded[totalLength - 1] = bitLengthLo & 0xff;

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < totalLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      const j = offset + i * 4;
      w[i] =
        ((padded[j] << 24) | (padded[j + 1] << 16) | (padded[j + 2] << 8) | padded[j + 3]) >>> 0;
    }

    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const words = [h0, h1, h2, h3, h4, h5, h6, h7];
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    out[i * 4] = (word >>> 24) & 0xff;
    out[i * 4 + 1] = (word >>> 16) & 0xff;
    out[i * 4 + 2] = (word >>> 8) & 0xff;
    out[i * 4 + 3] = word & 0xff;
  }
  return out;
}

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}
