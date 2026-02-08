import { useEffect, useMemo, useState } from "react";
import { fetchPinballText, prefetchPinballTextAssets } from "../../shared/ui/pinballCache";
import {
  CONTROL_INPUT_CLASS,
  CONTROL_SELECT_CLASS,
  PRIMARY_BUTTON_CLASS,
  Panel,
  SectionTitle,
  SiteShell,
} from "../../shared/ui/siteShell";
import { NAV_LINKS } from "../../shared/ui/navLinks";

const DEFAULT_DATA_URL = "/pinball/data/LPL_Stats.csv";

type Row = {
  Season: string;
  BankNumber: number;
  Bank: string;
  Player: string;
  Machine: string;
  RawScore: number;
  Points: number;
};

type StatResult = {
  count: number;
  low: number | null;
  lowPlayer: string | null;
  high: number | null;
  highPlayer: string | null;
  mean: number | null;
  median: number | null;
  std: number | null;
};

export default function App() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [season, setSeason] = useState<string>("");
  const [player, setPlayer] = useState<string>("");
  const [bankNumber, setBankNumber] = useState<number | "">("");
  const [machine, setMachine] = useState<string>("");

  const cfgMode = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("cfg") === "1";
    } catch {
      return false;
    }
  }, []);

  const [dataUrl, setDataUrl] = useState<string>(
    () => localStorage.getItem("scores_csv_url") || DEFAULT_DATA_URL
  );

  useEffect(() => {
    prefetchPinballTextAssets(["/pinball/data"]).catch(() => undefined);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const text = await fetchPinballText(dataUrl);
        const parsed = parseScoresCSV(text);
        const latestSeason = getLatestSeason(parsed);
        setRows(parsed);
        setSeason(latestSeason);
        setPlayer("");
        setBankNumber("");
        setMachine("");
      } catch (e: unknown) {
        setRows([]);
        setError(e instanceof Error ? e.message : "Failed to load CSV");
      }
    })();
  }, [dataUrl]);

  const seasons = useMemo(() => unique(rows.map((r) => r.Season)).sort(), [rows]);

  const players = useMemo(
    () =>
      unique(rows.filter((r) => !season || r.Season === season).map((r) => r.Player)).sort(),
    [rows, season]
  );

  const bankNumbers = useMemo(
    () =>
      unique(
        rows
          .filter((r) => (!season || r.Season === season) && (!player || r.Player === player))
          .map((r) => r.BankNumber)
      ).sort((a, b) => a - b),
    [rows, season, player]
  );

  const machines = useMemo(
    () =>
      unique(
        rows
          .filter(
            (r) =>
              (!season || r.Season === season) &&
              (!player || r.Player === player) &&
              (!bankNumber || r.BankNumber === bankNumber)
          )
          .map((r) => r.Machine.trim())
          .filter(Boolean)
      ).sort(),
    [rows, season, player, bankNumber]
  );

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!season || r.Season === season) &&
          (!player || r.Player === player) &&
          (!bankNumber || r.BankNumber === bankNumber) &&
          (!machine || r.Machine.trim() === machine)
      ),
    [rows, season, player, bankNumber, machine]
  );

  const bankScope = useMemo(
    () =>
      rows.filter(
        (r) =>
          !!season &&
          r.Season === season &&
          !!bankNumber &&
          r.BankNumber === bankNumber &&
          !!machine &&
          r.Machine.trim() === machine
      ),
    [rows, season, bankNumber, machine]
  );

  const machineScope = useMemo(
    () => rows.filter((r) => !!machine && r.Machine.trim() === machine),
    [rows, machine]
  );

  const bankStats = useMemo(() => computeStats(bankScope, true), [bankScope]);
  const machineStats = useMemo(() => computeStats(machineScope, false), [machineScope]);

  return (
    <SiteShell
      title="League Stats"
      activeLabel="Stats"
      navItems={NAV_LINKS}
      controls={
        cfgMode ? (
          <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
            <input
              value={dataUrl}
              onChange={(e) => setDataUrl(e.target.value)}
              placeholder="https://.../scores.csv"
              className={`${CONTROL_INPUT_CLASS} w-full min-w-0 sm:max-w-[420px]`}
            />
            <button
              onClick={() => {
                localStorage.setItem("scores_csv_url", dataUrl);
                setDataUrl(dataUrl);
              }}
              className={PRIMARY_BUTTON_CLASS}
            >
              Load URL
            </button>
          </div>
        ) : undefined
      }
    >
      {error && (
        <Panel className="border border-red-800 bg-red-900/20 p-3">
          <p className="text-sm text-red-200">{error}</p>
        </Panel>
      )}

      <Panel className="p-4">
        <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,7fr)] gap-x-3 gap-y-2 lg:grid-cols-4 lg:gap-2">
          <Filter
            label="Season"
            value={season}
            setValue={setSeason}
            opts={seasons}
            clear={[() => setPlayer(""), () => setBankNumber(""), () => setMachine("")]}
          />
          <Filter
            label="Player"
            value={player}
            setValue={setPlayer}
            opts={players}
            clear={[() => setBankNumber(""), () => setMachine("")]}
          />
          <Filter
            label="Bank"
            value={bankNumber}
            setValue={(v) => setBankNumber(Number(v) || "")}
            opts={bankNumbers}
            clear={[() => setMachine("")]}
          />
          <Filter label="Machine" value={machine} setValue={setMachine} opts={machines} />
        </div>
      </Panel>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Panel className="overflow-auto">
          <table className="min-w-full border-collapse text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-10 bg-neutral-950">
              <tr className="border-b border-neutral-800 text-left text-neutral-300">
                <th className="px-4 py-3">Season</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Bank</th>
                <th className="px-4 py-3">Machine</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Points</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr
                  key={`${r.Season}-${r.Player}-${r.BankNumber}-${r.Machine}-${idx}`}
                  className="border-b border-neutral-800/80 odd:bg-neutral-900 even:bg-neutral-950 hover:bg-sky-900/25"
                >
                  <td className="px-4 py-2.5">{seasonNumber(r.Season)}</td>
                  <td className="px-4 py-2.5">{r.Player}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.BankNumber}</td>
                  <td className="px-4 py-2.5">{r.Machine}</td>
                  <td className="px-4 py-2.5 tabular-nums">{formatScore(r.RawScore)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{formatPoints(r.Points)}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                    No rows. Check filters or CSV.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>

        <Panel className="p-4">
          <SectionTitle className="mb-3">Machine Stats</SectionTitle>
          {machine || bankNumber ? (
            <MachineStatsTable
              selectedLabel={`S${seasonNumber(season || "?")} B${bankNumber || "?"}`}
              seasonStats={bankStats}
              allSeasonsStats={machineStats}
            />
          ) : (
            <p className="text-sm text-neutral-500">Select a bank or machine to view detailed stats.</p>
          )}
        </Panel>
      </section>
    </SiteShell>
  );
}

function Filter({
  label,
  value,
  setValue,
  opts,
  clear = [],
}: {
  label: string;
  value: string | number | "";
  setValue: (v: string) => void;
  opts: Array<string | number>;
  clear?: Array<() => void>;
}) {
  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    clear.forEach((setClear) => setClear());
    setValue(event.target.value);
  }

  return (
    <div className="min-w-0 w-full">
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          style={{ minWidth: 0 }}
          className={`${CONTROL_SELECT_CLASS} min-w-0 w-full max-w-full`}
        >
          <option value="">{formatAllFilterOption(label)}</option>
          {opts.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {formatFilterOption(label, opt)}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl text-neutral-300">
          ▾
        </span>
      </div>
    </div>
  );
}

function formatFilterValue(label: string, value: string | number): string {
  if (label === "Season") return seasonNumber(String(value));
  return String(value);
}

function formatFilterOption(label: string, value: string | number): string {
  const formatted = formatFilterValue(label, value);
  if (label === "Season") return `S${formatted}`;
  if (label === "Bank") return `B${formatted}`;
  if (label === "Player" || label === "Machine") return formatted;
  return `${label}: ${formatted}`;
}

function formatAllFilterOption(label: string): string {
  if (label === "Season") return "S: All";
  if (label === "Bank") return "B: All";
  return `${label}: All`;
}

function seasonNumber(season: string): string {
  const match = season.match(/\d+/);
  return match ? match[0] : season;
}

function MachineStatsTable({
  selectedLabel,
  seasonStats,
  allSeasonsStats,
}: {
  selectedLabel: string;
  seasonStats: StatResult;
  allSeasonsStats: StatResult;
}) {
  const rows: Array<{
    label: string;
    tone?: "high" | "low" | "mid";
    seasonValue: string | number;
    seasonSub?: string | null;
    allValue: string | number;
    allSub?: string | null;
  }> = [
    {
      label: "High",
      tone: "high",
      seasonValue: formatScore(seasonStats.high),
      seasonSub: seasonStats.highPlayer,
      allValue: formatScore(allSeasonsStats.high),
      allSub: allSeasonsStats.highPlayer,
    },
    {
      label: "Low",
      tone: "low",
      seasonValue: formatScore(seasonStats.low),
      seasonSub: seasonStats.lowPlayer,
      allValue: formatScore(allSeasonsStats.low),
      allSub: allSeasonsStats.lowPlayer,
    },
    {
      label: "Avg",
      tone: "mid",
      seasonValue: formatScore(seasonStats.mean),
      allValue: formatScore(allSeasonsStats.mean),
    },
    {
      label: "Med",
      tone: "mid",
      seasonValue: formatScore(seasonStats.median),
      allValue: formatScore(allSeasonsStats.median),
    },
    {
      label: "Std",
      seasonValue: formatScore(seasonStats.std),
      allValue: formatScore(allSeasonsStats.std),
    },
    {
      label: "Count",
      seasonValue: seasonStats.count.toLocaleString(),
      allValue: allSeasonsStats.count.toLocaleString(),
    },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950/70">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
            <th className="w-[24%] px-3 py-2.5 font-medium sm:px-4" />
            <th className="w-[38%] px-3 py-2.5 font-medium sm:px-4">{selectedLabel}</th>
            <th className="w-[38%] px-3 py-2.5 font-medium sm:px-4">All Seasons</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="align-top odd:bg-neutral-900/45">
              <td className="px-3 py-2.5 text-neutral-300 sm:px-4">{row.label}</td>
              <StatValueCell value={row.seasonValue} sub={row.seasonSub} tone={row.tone} />
              <StatValueCell value={row.allValue} sub={row.allSub} tone={row.tone} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatValueCell({
  value,
  sub,
  tone,
}: {
  value: string | number;
  sub?: string | null;
  tone?: "high" | "low" | "mid";
}) {
  const toneClass =
    tone === "high"
      ? "text-emerald-300"
      : tone === "low"
        ? "text-red-300"
        : tone === "mid"
          ? "text-sky-300"
          : "text-neutral-200";

  return (
    <td className={`px-3 py-2.5 tabular-nums ${toneClass} sm:px-4`}>
      <div>{value}</div>
      {sub ? <div className="text-xs text-neutral-500">{sub}</div> : null}
    </td>
  );
}

function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

function seasonSortValue(season: string): number {
  const match = season.match(/\d+/);
  return match ? Number(match[0]) : Number.NEGATIVE_INFINITY;
}

function getLatestSeason(rows: Row[]): string {
  const seasons = unique(rows.map((row) => row.Season).filter(Boolean));
  if (!seasons.length) return "";
  return seasons.sort((a, b) => seasonSortValue(b) - seasonSortValue(a) || b.localeCompare(a))[0];
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function shortSeason(season: string): string {
  const match = season.match(/\d+/);
  return match ? `S${match[0]}` : season;
}

function formatScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "-";
  return Math.round(value).toLocaleString();
}

function formatPoints(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return Math.round(value).toString();
}

function computeStats(scope: Row[], bankMode: boolean): StatResult {
  const values = scope.map((row) => row.RawScore).filter((n) => Number.isFinite(n) && n > 0);
  if (!values.length) {
    return {
      count: 0,
      low: null,
      lowPlayer: null,
      high: null,
      highPlayer: null,
      mean: null,
      median: null,
      std: null,
    };
  }

  const count = values.length;
  const low = Math.min(...values);
  const high = Math.max(...values);

  const lowRow = scope.find((row) => row.RawScore === low) ?? null;
  const highRow = scope.find((row) => row.RawScore === high) ?? null;

  const lowPlayer = lowRow
    ? bankMode
      ? lowRow.Player
      : `${lowRow.Player} (${shortSeason(lowRow.Season)})`
    : null;

  const highPlayer = highRow
    ? bankMode
      ? highRow.Player
      : `${highRow.Player} (${shortSeason(highRow.Season)})`
    : null;

  const mean = values.reduce((sum, n) => sum + n, 0) / count;
  const sorted = [...values].sort((a, b) => a - b);
  const median =
    count % 2 === 1 ? sorted[(count - 1) / 2] : (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
  const variance = values.reduce((sum, n) => sum + (n - mean) ** 2, 0) / count;
  const std = Math.sqrt(variance);

  return { count, low, lowPlayer, high, highPlayer, mean, median, std };
}

function parseScoresCSV(text: string): Row[] {
  const matrix = parseCsv(text);
  if (!matrix.length) return [];

  const headers = matrix[0].map((h) => h.trim());
  const body = matrix.slice(1);

  const index = (name: string) => headers.indexOf(name);
  const required = ["Season", "BankNumber", "Bank", "Player", "Machine", "RawScore", "Points"];
  for (const column of required) {
    if (index(column) === -1) {
      throw new Error(`Scores CSV missing column: ${column}`);
    }
  }

  return body
    .filter((row) => row.length === headers.length)
    .map((row) => ({
      Season: normalizeText(row[index("Season")]),
      BankNumber: Number(normalizeText(row[index("BankNumber")])) || 0,
      Bank: normalizeText(row[index("Bank")]),
      Player: normalizeText(row[index("Player")]),
      Machine: normalizeText(row[index("Machine")]),
      RawScore: Number(normalizeText(row[index("RawScore")]).replace(/,/g, "")) || 0,
      Points: Number(normalizeText(row[index("Points")])) || 0,
    }));
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
