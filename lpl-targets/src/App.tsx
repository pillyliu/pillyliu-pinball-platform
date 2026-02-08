import { useEffect, useMemo, useState } from "react";
import { fetchPinballText, prefetchPinballTextAssets } from "./lib/pinballCache";
import {
  CONTROL_INPUT_CLASS,
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

export default function App() {
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [error, setError] = useState<string | null>(null);

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
      </Panel>

      <Panel className="p-0 overflow-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-neutral-950">
            <tr className="text-left text-neutral-400 border-b border-neutral-800">
              <th className="py-2 px-4">Game</th>
              <th className="py-2 px-4">2nd Highest Avg</th>
              <th className="py-2 px-4">4th Highest Avg</th>
              <th className="py-2 px-4">8th Highest Avg</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.game} className="border-b border-neutral-800/70 odd:bg-neutral-900/70 even:bg-neutral-950/90 hover:bg-sky-900/25">
                <td className="py-2 px-4 text-neutral-100">{row.game}</td>
                <td className="py-2 px-4 tabular-nums text-emerald-200 font-medium">{formatNumber(row.secondHighestAvg)}</td>
                <td className="py-2 px-4 tabular-nums text-sky-200">{formatNumber(row.fourthHighestAvg)}</td>
                <td className="py-2 px-4 tabular-nums text-neutral-200/90">{formatNumber(row.eighthHighestAvg)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-neutral-500">
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
