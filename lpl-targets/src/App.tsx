import { useEffect, useMemo, useState } from "react";
import { fetchPinballJson, fetchPinballText, prefetchPinballTextAssets } from "../../shared/ui/pinballCache";
import {
  CONTROL_INPUT_CLASS,
  CONTROL_SELECT_CLASS,
  PRIMARY_BUTTON_CLASS,
  Panel,
  SiteShell,
} from "../../shared/ui/siteShell";
import { NAV_LINKS } from "../../shared/ui/navLinks";

const DEFAULT_TARGETS_URL = "/pinball/data/LPL_Targets.csv";

type TargetRow = {
  game: string;
  secondHighestAvg: number;
  fourthHighestAvg: number;
  eighthHighestAvg: number;
};

type GameMeta = {
  name: string;
  location?: string | null;
  group?: number | null;
  position?: number | null;
  bank?: number | null;
  sourceId?: string | null;
  sourceName?: string | null;
};

type LibraryV3Item = {
  game?: string | null;
  area?: string | null;
  group?: number | null;
  position?: number | null;
  bank?: number | null;
  library_id?: string | null;
  sourceId?: string | null;
  library_name?: string | null;
  sourceName?: string | null;
  venue?: string | null;
};

type SortMode = "location" | "bank" | "alphabetical";

type EnrichedTargetRow = TargetRow & {
  location: string | null;
  group: number | null;
  position: number | null;
  bank: number | null;
};

export default function App() {
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [metaRows, setMetaRows] = useState<GameMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("location");
  const [bankFilter, setBankFilter] = useState<number | "all">("all");

  const cfgMode = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("cfg") === "1";
    } catch {
      return false;
    }
  }, []);

  const [dataUrl, setDataUrl] = useState<string>(
    () => localStorage.getItem("targets_csv_url") || DEFAULT_TARGETS_URL
  );

  useEffect(() => {
    prefetchPinballTextAssets(["/pinball/data"]).catch(() => undefined);
  }, []);

  useEffect(() => {
    fetchPinballJson<unknown>("/pinball/data/pinball_library_v3.json")
      .then((data) => setMetaRows(deriveGameMetaRows(data)))
      .catch(() => setMetaRows([]));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const text = await fetchPinballText(dataUrl);
        setRows(parseTargetsCSV(text));
      } catch (e: unknown) {
        setRows([]);
        setError(e instanceof Error ? e.message : "Failed to load targets CSV");
      }
    })();
  }, [dataUrl]);

  function saveUrlAndReload() {
    localStorage.setItem("targets_csv_url", dataUrl);
    setDataUrl(dataUrl);
  }

  const metaByName = useMemo(() => buildMetaByName(metaRows), [metaRows]);
  const sortedRows = useMemo(() => sortRows(rows, metaByName, sortMode), [rows, metaByName, sortMode]);
  const bankOptions = useMemo<number[]>(() => {
    const s = new Set<number>();
    for (const row of sortedRows) {
      if (typeof row.bank === "number" && Number.isFinite(row.bank) && row.bank > 0) s.add(row.bank);
    }
    return Array.from(s).sort((a, b) => a - b);
  }, [sortedRows]);
  const filteredRows = useMemo(
    () =>
      sortedRows.filter(
        (row) => bankFilter === "all" || (typeof row.bank === "number" && row.bank === bankFilter)
      ),
    [sortedRows, bankFilter]
  );

  return (
    <SiteShell
      title="League Targets"
      activeLabel="Targets"
      navItems={NAV_LINKS}
      controls={
        cfgMode ? (
          <div className="flex flex-wrap items-center gap-2 min-w-0 w-full md:w-auto">
            <input
              value={dataUrl}
              onChange={(e) => setDataUrl(e.target.value)}
              placeholder="https://.../targets.csv"
              className={`${CONTROL_INPUT_CLASS} w-full sm:w-auto sm:max-w-[420px] min-w-0`}
            />
            <button onClick={saveUrlAndReload} className={PRIMARY_BUTTON_CLASS}>
              Load URL
            </button>
          </div>
        ) : undefined
      }
    >
      {error && (
        <Panel className="border-red-800 bg-red-900/20 p-3">
          <p className="text-sm text-red-200">{error}</p>
        </Panel>
      )}

      <section className="targets-top-area table-content-inset">
        <div className="targets-top-row">
          <div className="targets-legend flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-400">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full border border-emerald-400/80 bg-emerald-400/20" />
              <strong className="text-neutral-300">2nd Highest</strong> - "Great" game
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full border border-sky-400/80 bg-sky-400/20" />
              <strong className="text-neutral-300">4th Highest</strong> - Main target
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full border border-neutral-400/80 bg-neutral-400/20" />
              <strong className="text-neutral-300">8th Highest</strong> - Solid floor
            </span>
          </div>

          <div className="targets-filters grid w-full grid-cols-2 gap-3 sm:max-w-[30rem]">
            <div className="relative">
              <select
                id="targets-sort-mode"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className={`${CONTROL_SELECT_CLASS} min-w-[8rem]`}
                aria-label="Sort targets table"
              >
                <option value="location">Sort: Location</option>
                <option value="bank">Sort: Bank</option>
                <option value="alphabetical">Sort: A-Z</option>
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl text-neutral-300">
                ▾
              </span>
            </div>
            <div className="relative">
              <select
                value={bankFilter === "all" ? "all" : String(bankFilter)}
                onChange={(e) => {
                  const v = e.target.value;
                  setBankFilter(v === "all" ? "all" : Number(v));
                }}
                className={`${CONTROL_SELECT_CLASS} min-w-[8rem]`}
                aria-label="Filter targets by bank"
              >
                <option value="all">All banks</option>
                {bankOptions.map((b) => (
                  <option key={b} value={String(b)}>
                    Bank {b}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl text-neutral-300">
                ▾
              </span>
            </div>
          </div>
        </div>
      </section>

      <Panel className="table-start-offset p-0 table-scroll-panel">
        <table className="min-w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-neutral-950">
            <tr className="text-left text-neutral-400 border-b border-neutral-800">
              <th className="table-head-cell">Game</th>
              <th className="table-head-cell">Location</th>
              <th className="table-head-cell">Bank</th>
              <th className="table-head-cell">2nd Highest</th>
              <th className="table-head-cell">4th Highest</th>
              <th className="table-head-cell">8th Highest</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr
                key={row.game}
                className="table-body-row"
              >
                <td className="table-body-cell text-neutral-100">{row.game}</td>
                <td className="table-body-cell tabular-nums text-neutral-300">{formatLocation(row.location, row.group, row.position)}</td>
                <td className="table-body-cell tabular-nums text-neutral-300">{formatBank(row.bank)}</td>
                <td className="table-body-cell tabular-nums text-emerald-200 font-medium">{formatNumber(row.secondHighestAvg)}</td>
                <td className="table-body-cell tabular-nums text-sky-200">{formatNumber(row.fourthHighestAvg)}</td>
                <td className="table-body-cell tabular-nums text-neutral-200/90">{formatNumber(row.eighthHighestAvg)}</td>
              </tr>
            ))}
            {!filteredRows.length && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-neutral-500">
                  No rows. Check CSV path and content.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      <section className="table-note table-content-inset">
        <p className="text-sm text-neutral-300">
          Benchmarks are based on historical LPL league results across all seasons where each game appeared. For
          each game, scores are derived from per-bank results using 2nd / 4th / 8th highest averages with
          sample-size adjustments. These values are then averaged across all bank appearances for that game.
        </p>
      </section>
    </SiteShell>
  );
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return Math.round(value).toLocaleString();
}

function formatLocation(location: string | null, group: number | null, position: number | null): string {
  if (!Number.isFinite(group ?? Number.NaN) || !Number.isFinite(position ?? Number.NaN)) return "-";
  const loc = location?.trim();
  return loc ? `📍 ${loc}:${group}:${position}` : `📍 ${group}:${position}`;
}

function formatBank(bank: number | null): string {
  if (!Number.isFinite(bank ?? Number.NaN) || (bank ?? 0) <= 0) return "-";
  return String(bank);
}

function sortRows(
  rows: TargetRow[],
  metaByName: Map<string, GameMeta>,
  sortMode: SortMode
): EnrichedTargetRow[] {
  const enriched: EnrichedTargetRow[] = rows.map((row) => {
    const meta = metaByName.get(normalizeGameName(row.game));
    return {
      ...row,
      location: typeof meta?.location === "string" && meta.location.trim() ? meta.location.trim() : null,
      group: typeof meta?.group === "number" ? meta.group : null,
      position: typeof meta?.position === "number" ? meta.position : null,
      bank: typeof meta?.bank === "number" ? meta.bank : null,
    };
  });

  enriched.sort((a, b) => {
    if (sortMode === "alphabetical") {
      return alpha(a.game, b.game);
    }

    if (sortMode === "bank") {
      return (
        compareMaybeNumber(a.bank, b.bank) ||
        compareMaybeNumber(a.group, b.group) ||
        compareMaybeNumber(a.position, b.position) ||
        alpha(a.game, b.game)
      );
    }

    return (
      compareMaybeNumber(a.group, b.group) ||
      compareMaybeNumber(a.position, b.position) ||
      alpha(a.game, b.game)
    );
  });

  return enriched;
}

function buildMetaByName(rows: GameMeta[]): Map<string, GameMeta> {
  const map = new Map<string, GameMeta>();
  for (const row of rows) {
    const canonical = normalizeGameName(row.name ?? "");
    if (!canonical) continue;
    const existing = map.get(canonical);
    if (!existing || isPreferredMeta(row, existing)) {
      map.set(canonical, row);
    }
  }

  for (const [source, target] of Object.entries(NAME_ALIASES)) {
    const canonicalTarget = normalizeGameName(target);
    const meta = map.get(canonicalTarget);
    if (!meta) continue;
    map.set(normalizeGameName(source), meta);
  }

  return map;
}

function deriveGameMetaRows(raw: unknown): GameMeta[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || Number((raw as { version?: unknown }).version ?? 0) < 3) {
    return [];
  }

  const items = Array.isArray((raw as { items?: unknown[] }).items) ? (raw as { items: unknown[] }).items : [];
  const rows: GameMeta[] = [];
  for (const item of items) {
    const row = (item ?? {}) as LibraryV3Item;
    const name = String(row.game ?? "").trim();
    if (!name) continue;
    const sourceId = String(row.library_id ?? row.sourceId ?? "").trim() || null;
    const sourceName = String(row.library_name ?? row.sourceName ?? row.venue ?? "").trim() || null;
    if (!isAvenueSource(sourceId, sourceName)) continue;
    rows.push({
      name,
      location: String(row.area ?? "").trim() || null,
      group: typeof row.group === "number" ? row.group : null,
      position: typeof row.position === "number" ? row.position : null,
      bank: typeof row.bank === "number" ? row.bank : null,
      sourceId,
      sourceName,
    });
  }
  return rows;
}

function isPreferredMeta(candidate: GameMeta, current: GameMeta): boolean {
  return metaScore(candidate) > metaScore(current);
}

function metaScore(meta: GameMeta): number {
  let score = 0;
  if (isAvenueSource(meta.sourceId, meta.sourceName)) score += 1000;
  if (typeof meta.bank === "number" && Number.isFinite(meta.bank) && meta.bank > 0) score += 100;
  if (typeof meta.location === "string" && meta.location.trim()) score += 10;
  if (typeof meta.group === "number" && Number.isFinite(meta.group)) score += 5;
  if (typeof meta.position === "number" && Number.isFinite(meta.position)) score += 5;
  return score;
}

function isAvenueSource(sourceId?: string | null, sourceName?: string | null): boolean {
  const normalizedId = String(sourceId ?? "").trim().toLowerCase();
  if (normalizedId === "venue--the-avenue-cafe") return true;

  const normalizedName = String(sourceName ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  return normalizedName === "the avenue cafe" || normalizedName === "the avenue";
}

const NAME_ALIASES: Record<string, string> = {
  "Uncanny X-Men": "The Uncanny X-Men",
  "Jurassic Park (Stern 2019)": "Jurassic Park",
  "Star Wars (2017)": "Star Wars",
  "James Bond": "James Bond 007",
  "Indiana Jones": "Indiana Jones: The Pinball Adventure",
  "Dungeons and Dragons": "Dungeons & Dragons: The Tyrant's Eye",
  "The Getaway": "The Getaway: High Speed II",
  "Attack From Mars": "Attack from Mars",
  Tron: "Tron: Legacy",
  TMNT: "Teenage Mutant Ninja Turtles",
  "Fall of the Empire": "Star Wars: Fall of the Empire",
};

function normalizeGameName(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compareMaybeNumber(a: number | null, b: number | null): number {
  const left = typeof a === "number" && Number.isFinite(a) ? a : Number.MAX_SAFE_INTEGER;
  const right = typeof b === "number" && Number.isFinite(b) ? b : Number.MAX_SAFE_INTEGER;
  return left - right;
}

function alpha(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function parseTargetsCSV(text: string): TargetRow[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const body = rows.slice(1);

  const required = ["game", "second_highest_avg", "fourth_highest_avg", "eighth_highest_avg"];
  for (const column of required) {
    if (!headers.includes(column)) {
      throw new Error(`Targets CSV missing column: ${column}`);
    }
  }

  return body
    .filter((row) => row.length === headers.length)
    .map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((h, i) => {
        record[h] = row[i] ?? "";
      });

      return {
        game: record.game?.trim() ?? "",
        secondHighestAvg: parseNumber(record.second_highest_avg),
        fourthHighestAvg: parseNumber(record.fourth_highest_avg),
        eighthHighestAvg: parseNumber(record.eighth_highest_avg),
      };
    })
    .filter((r) => r.game);
}

function parseNumber(value: string): number {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
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
