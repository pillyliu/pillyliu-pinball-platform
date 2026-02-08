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
  group?: number | null;
  pos?: number | null;
  bank?: number | null;
};

type SortMode = "location" | "bank" | "alphabetical";

type EnrichedTargetRow = TargetRow & {
  group: number | null;
  pos: number | null;
  bank: number | null;
};

export default function App() {
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [metaRows, setMetaRows] = useState<GameMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("location");

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
    fetchPinballJson<GameMeta[]>("/pinball/data/pinball_library.json")
      .then((data) => setMetaRows(Array.isArray(data) ? data : []))
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

      <Panel className="p-4">
        <div className="flex flex-wrap items-end gap-2">
          <h2 className="text-xl font-bold tracking-tight text-neutral-100">LPL Score Targets by Game</h2>
          <span className="rounded-full border border-neutral-600 bg-neutral-900 px-2.5 py-1 text-xs uppercase tracking-[0.14em] text-neutral-400">
            League Practice Benchmarks
          </span>
        </div>
        <p className="mt-2 max-w-4xl text-sm text-neutral-400">
          Benchmarks are based on historical LPL league results across all seasons where each game appeared.
          For each game, scores are derived from per-bank results using 2nd / 4th / 8th highest averages
          with sample-size adjustments.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border border-emerald-400/80 bg-emerald-400/20" />
            <strong className="text-neutral-300">2nd Highest Avg</strong> - Great game score
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border border-sky-400/80 bg-sky-400/20" />
            <strong className="text-neutral-300">4th Highest Avg</strong> - Main target
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border border-neutral-400/80 bg-neutral-400/20" />
            <strong className="text-neutral-300">8th Highest Avg</strong> - Solid floor
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor="targets-sort-mode" className="text-sm font-medium text-neutral-300">
            Sort by
          </label>
          <div className="relative w-full min-[460px]:w-auto min-[460px]:min-w-[8rem]">
            <select
              id="targets-sort-mode"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className={`${CONTROL_SELECT_CLASS} min-w-[8rem] py-2 text-sm`}
              aria-label="Sort targets table"
            >
              <option value="location">Location (Group, Pos)</option>
              <option value="bank">Bank (then Location)</option>
              <option value="alphabetical">Alphabetical (Game)</option>
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl text-neutral-300">
              ▾
            </span>
          </div>
        </div>
      </Panel>

      <Panel className="p-0 overflow-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-neutral-950">
            <tr className="text-left text-neutral-400 border-b border-neutral-800">
              <th className="py-2 px-4">Game</th>
              <th className="py-2 px-4">Location</th>
              <th className="py-2 px-4">Bank</th>
              <th className="py-2 px-4">2nd Highest Avg</th>
              <th className="py-2 px-4">4th Highest Avg</th>
              <th className="py-2 px-4">8th Highest Avg</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.game} className="border-b border-neutral-800/70 odd:bg-neutral-900/70 even:bg-neutral-950/90 hover:bg-sky-900/25">
                <td className="py-2 px-4 text-neutral-100">{row.game}</td>
                <td className="py-2 px-4 tabular-nums text-neutral-300">{formatLocation(row.group, row.pos)}</td>
                <td className="py-2 px-4 tabular-nums text-neutral-300">{formatBank(row.bank)}</td>
                <td className="py-2 px-4 tabular-nums text-emerald-200 font-medium">{formatNumber(row.secondHighestAvg)}</td>
                <td className="py-2 px-4 tabular-nums text-sky-200">{formatNumber(row.fourthHighestAvg)}</td>
                <td className="py-2 px-4 tabular-nums text-neutral-200/90">{formatNumber(row.eighthHighestAvg)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-neutral-500">
                  No rows. Check CSV path and content.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      <Panel className="p-4">
        <p className="text-xs text-neutral-400">
          <strong className="text-neutral-300">Method:</strong> For each game, scores are grouped by season and bank.
          When a full field played, the 2nd / 4th / 8th highest scores are taken. When about half the league played,
          we use mean(1st &amp; 2nd), 3rd, and 4th. These values are then averaged across all appearances for that game.
        </p>
      </Panel>
    </SiteShell>
  );
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return Math.round(value).toLocaleString();
}

function formatLocation(group: number | null, pos: number | null): string {
  if (!Number.isFinite(group ?? Number.NaN) || !Number.isFinite(pos ?? Number.NaN)) return "-";
  return `${group}:${pos}`;
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
      group: typeof meta?.group === "number" ? meta.group : null,
      pos: typeof meta?.pos === "number" ? meta.pos : null,
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
        compareMaybeNumber(a.pos, b.pos) ||
        alpha(a.game, b.game)
      );
    }

    return (
      compareMaybeNumber(a.group, b.group) ||
      compareMaybeNumber(a.pos, b.pos) ||
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
    map.set(canonical, row);
  }

  for (const [source, target] of Object.entries(NAME_ALIASES)) {
    const canonicalTarget = normalizeGameName(target);
    const meta = map.get(canonicalTarget);
    if (!meta) continue;
    map.set(normalizeGameName(source), meta);
  }

  return map;
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
