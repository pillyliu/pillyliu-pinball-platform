import { useEffect, useMemo, useRef, useState } from "react";
import { fetchPinballText, prefetchPinballTextAssets } from "./lib/pinballCache";
import {
    CONTROL_INPUT_CLASS,
    CONTROL_SELECT_CLASS,
    PRIMARY_BUTTON_CLASS,
    Panel,
    SectionTitle,
    SiteShell,
} from "./components/ui";

/**
 * Pinball Scores Viewer — full-width table; always shows stats panel
 */

const DEFAULT_DATA_URL = "/pinball/data/LPL_Stats.csv";
const EM = " \u2014 ";
const NDASH = " \u2013 ";
const NAV_LINKS = [
    { href: "https://pillyliu.com/", label: "Home" },
    { href: "https://pillyliu.com/lpl_library/", label: "Library" },
    { href: "https://pillyliu.com/lpl_stats/", label: "Stats" },
    { href: "https://pillyliu.com/lpl_standings/", label: "Standings" },
    { href: "https://pillyliu.com/lpl_targets/", label: "Targets" },
];

export default function App() {
    const [rows, setRows] = useState<Row[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [season, setSeason] = useState<string>("");
    const [player, setPlayer] = useState<string>("");
    const [bankNumber, setBankNumber] = useState<number | "">("");
    const [machine, setMachine] = useState<string>("");

    const cfgMode = useMemo(() => {
        try { return new URLSearchParams(window.location.search).get("cfg") === "1"; }
        catch { return false; }
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
                setRows(parsed);
                setSeason(""); setPlayer(""); setBankNumber(""); setMachine("");
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Failed to load CSV");
            }
        })();
    }, [dataUrl]);

    const seasons = useMemo(() => uniq(rows.map(r => r.Season)).sort(), [rows]);
    const players = useMemo(
        () => uniq(rows.filter(r => !season || r.Season === season).map(r => r.Player)).sort(),
        [rows, season]
    );
    const bankNumbers = useMemo(
        () => uniq(rows.filter(r =>
            (!season || r.Season === season) &&
            (!player || r.Player === player)
        ).map(r => r.BankNumber)).sort((a, b) => Number(a) - Number(b)),
        [rows, season, player]
    );
    const machines = useMemo(
        () => uniq(rows.filter(r =>
            (!season || r.Season === season) &&
            (!player || r.Player === player) &&
            (!bankNumber || r.BankNumber === bankNumber)
        ).map(r => (r.Machine || "").trim())).filter(Boolean).sort(),
        [rows, season, player, bankNumber]
    );

    const filtered = useMemo(() => rows.filter(r =>
        (!season || r.Season === season) &&
        (!player || r.Player === player) &&
        (!bankNumber || r.BankNumber === bankNumber) &&
        (!machine || (r.Machine || "").trim() === machine)
    ), [rows, season, player, bankNumber, machine]);

    const bankScope = useMemo(() => rows.filter(r =>
        !!season && r.Season === season &&
        !!bankNumber && r.BankNumber === bankNumber &&
        !!machine && (r.Machine || "").trim() === machine
    ), [rows, season, bankNumber, machine]);

    const histScope = useMemo(() => rows.filter(r =>
        !!machine && (r.Machine || "").trim() === machine
    ), [rows, machine]);

    const bankStats = useMemo(() => computeStats(bankScope, true), [bankScope]);
    const histStats = useMemo(() => computeStats(histScope, false), [histScope]);

    const tableScrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        tableScrollRef.current?.scrollTo({ left: 0 });
    }, [season, player, bankNumber, machine, filtered.length]);

    return (
        <SiteShell
            title="League Stats"
            activeLabel="Stats"
            navItems={NAV_LINKS}
            controls={
                cfgMode ? (
                    <div className="flex flex-wrap items-center gap-2 min-w-0 w-full md:w-auto">
                        <input
                            value={dataUrl}
                            onChange={e => setDataUrl(e.target.value)}
                            placeholder="https://.../scores.csv"
                            className={`${CONTROL_INPUT_CLASS} w-full sm:w-auto sm:max-w-[420px] min-w-0`}
                        />
                        <button
                            onClick={() => { localStorage.setItem("scores_csv_url", dataUrl); setDataUrl(dataUrl); }}
                            className={PRIMARY_BUTTON_CLASS}
                        >
                            Load URL
                        </button>
                    </div>
                ) : undefined
            }
        >
            {error && (
                <Panel className="border-red-800 bg-red-900/20 p-3">
                    <p className="text-red-200 text-sm">{error}</p>
                </Panel>
            )}

            <Panel className="p-4">
                <SectionTitle className="mb-3">Filters</SectionTitle>
                <div className="grid xl:grid-cols-4 sm:grid-cols-2 gap-3">
                    <Filter label="Season" value={season} setValue={setSeason} opts={seasons} clear={[setPlayer, setBankNumber, setMachine]} />
                    <Filter label="Player" value={player} setValue={setPlayer} opts={players} clear={[setBankNumber, setMachine]} />
                    <Filter label="Bank" value={bankNumber} setValue={v => setBankNumber(Number(v) || "")} opts={bankNumbers} clear={[setMachine]} />
                    <Filter label="Machine" value={machine} setValue={setMachine} opts={machines} />
                </div>
            </Panel>

            <section className="grid xl:grid-cols-[2fr_1fr] gap-6">
                <Panel className="p-0 overflow-x-auto overflow-y-auto ios-scroller" >
                    <div ref={tableScrollRef} className="block min-w-full">
                        <table className="min-w-full text-sm border-collapse whitespace-nowrap">
                            <thead className="bg-neutral-950 sticky top-0">
                                <tr className="text-left text-neutral-400 border-b border-neutral-800">
                                    <th className="py-2 px-4">Season</th>
                                    <th className="py-2 px-4">Player</th>
                                    <th className="py-2 px-4">Bank #</th>
                                    <th className="py-2 px-4">Bank Name</th>
                                    <th className="py-2 px-4">Machine</th>
                                    <th className="py-2 px-4">Score</th>
                                    <th className="py-2 px-4">Points</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((r, i) => (
                                    <tr key={`${r.Season}-${r.Player}-${i}`} className="border-b border-neutral-800/70 hover:bg-neutral-900/40">
                                        <td className="py-2 px-4">{r.Season}</td>
                                        <td className="py-2 px-4">{r.Player}</td>
                                        <td className="py-2 px-4">{r.BankNumber}</td>
                                        <td className="py-2 px-4">{r.Bank}</td>
                                        <td className="py-2 px-4">{r.Machine}</td>
                                        <td className="py-2 px-4 tabular-nums">{formatScore(r.RawScore)}</td>
                                        <td className="py-2 px-4 tabular-nums">{formatPoints(r.Points)}</td>
                                    </tr>
                                ))}
                                {!filtered.length && (
                                    <tr>
                                        <td colSpan={7} className="py-6 px-4 text-center text-neutral-500">
                                            {"No rows"}{EM}{"check filters or CSV."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Panel>

                <Panel className="p-4 overflow-auto ios-scroller">
                    <SectionTitle className="mb-2">Machine Stats</SectionTitle>
                    {machine || bankNumber ? (
                        <>
                            <StatsSection
                                title="Selected Bank"
                                stats={bankStats}
                                label={`${season || "Season"}${NDASH}Bank ${bankNumber || "?"}`}
                            />
                            <StatsSection
                                title="Historical (All Seasons)"
                                stats={histStats}
                                label="All Seasons"
                            />
                        </>
                    ) : (
                        <p className="text-neutral-500 text-sm">Select a bank or machine to view detailed stats.</p>
                    )}
                </Panel>
            </section>
        </SiteShell>
    );
}

/* ===== Small reusable Filter component ===== */
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
    opts: (string | number)[];
    clear?: React.Dispatch<React.SetStateAction<any>>[];
}) {
    function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
        clear.forEach(fn => fn(""));
        setValue(e.target.value);
    }
    return (
        <div className="grid gap-1 min-w-0">
            <label className="text-xs text-neutral-400">{label}</label>
            <select
                value={value}
                onChange={handleChange}
                className={CONTROL_SELECT_CLASS}
            >
                <option value="">All</option>
                {opts.map(o => (
                    <option key={String(o)} value={String(o)}>{String(o)}</option>
                ))}
            </select>
        </div>
    );
}

/* ===== Types & helpers ===== */
type Row = { Season: string; BankNumber: number; Bank: string; Player: string; Machine: string; RawScore: number; Points: number; };
type StatResult = { count: number | null; low: number | null; lowPlayer: string | null; high: number | null; highPlayer: string | null; mean: number | null; median: number | null; std: number | null; };
function uniq<T>(a: T[]): T[] { return Array.from(new Set(a)); }
function normStr(s: unknown): string { return (s ?? "").toString().trim(); }
function abbrSeason(s: unknown): string { const m = String(s ?? "").match(/\d+/); return m ? `S${m[0]}` : String(s ?? ""); }
function formatScore(n?: number | null) { if (n == null || !Number.isFinite(n) || n <= 0) return "\u2014"; return Math.round(n).toLocaleString(); }
function formatPoints(n?: number) { if (n == null) return "\u2014"; return Math.round(n).toString(); }

/* ===== Stats computation ===== */
function computeStats(scope: Row[], isBank: boolean): StatResult {
    const v = scope.map(r => Number(r.RawScore)).filter(n => Number.isFinite(n) && n > 0);
    const c = v.length;
    if (!c) return { count: 0, low: null, lowPlayer: null, high: null, highPlayer: null, mean: null, median: null, std: null };
    const min = Math.min(...v), max = Math.max(...v);
    const lowRow = scope.find(r => Number(r.RawScore) === min) || null;
    const highRow = scope.find(r => Number(r.RawScore) === max) || null;
    const mean = v.reduce((a, b) => a + b, 0) / c;
    const sorted = [...v].sort((a, b) => a - b);
    const median = c % 2 ? sorted[(c - 1) / 2] : (sorted[c / 2 - 1] + sorted[c / 2]) / 2;
    const variance = v.reduce((s, x) => s + (x - mean) ** 2, 0) / c;
    const std = Math.sqrt(variance);
    return {
        count: c,
        low: min, lowPlayer: lowRow ? (isBank ? lowRow.Player : `${lowRow.Player} (${abbrSeason(lowRow.Season)})`) : null,
        high: max, highPlayer: highRow ? (isBank ? highRow.Player : `${highRow.Player} (${abbrSeason(highRow.Season)})`) : null,
        mean, median, std
    };
}

/* ===== Stats UI ===== */
function StatsSection({ title, stats, label }: { title: string; stats: StatResult; label: string; }) {
    return (
        <section className="mb-4">
            <h4 className="text-sm font-semibold text-neutral-300 mb-1">{title}</h4>
            {stats.count === 0 ? (
                <p className="text-neutral-500 text-sm">{"No data"}{EM}{"select filters."}</p>
            ) : (
                <div className="text-sm">
                    <div className="text-xs text-neutral-400 mb-2">{label}</div>
                    <table className="w-full text-sm border border-neutral-800 rounded-xl overflow-hidden">
                        <tbody>
                            <StatRow label="High" val={formatScore(stats.high)} sub={stats.highPlayer ? `by ${stats.highPlayer}` : undefined} color="emerald" />
                            <StatRow label="Low" val={formatScore(stats.low)} sub={stats.lowPlayer ? `by ${stats.lowPlayer}` : undefined} color="red" />
                            <StatRow label="Mean" val={formatScore(stats.mean)} color="sky" />
                            <StatRow label="Median" val={formatScore(stats.median)} color="sky" />
                            <StatRow label="Std Dev" val={formatScore(stats.std)} />
                            <StatRow label="Count" val={stats.count ?? 0} />
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
function StatRow({ label, val, sub, color }: { label: string; val: string | number | null; sub?: string; color?: "emerald" | "red" | "sky"; }) {
    const col = color ? `text-${color}-400` : "";
    return (
        <tr className="border-b border-neutral-800">
            <td className="px-3 py-2 text-neutral-400">{label}</td>
            <td className={`px-3 py-2 text-right tabular-nums ${col}`}>
                {val}{sub && <div className="text-xs text-neutral-500">{sub}</div>}
            </td>
        </tr>
    );
}

/* ===== CSV Parser ===== */
function parseScoresCSV(text: string): Row[] {
    const lines = text.split(/\r?\n/).filter(l => l.length > 0);
    const [head, ...body] = lines.map(l => l.split(","));
    const headers = head.map(h => h.trim());
    const idx = (n: string) => headers.indexOf(n);
    return body.map(r => ({
        Season: normStr(r[idx("Season")]),
        BankNumber: Number(r[idx("BankNumber")]) || 0,
        Bank: normStr(r[idx("Bank")]),
        Player: normStr(r[idx("Player")]),
        Machine: normStr(r[idx("Machine")]),
        RawScore: Number(normStr(r[idx("RawScore")]) || 0),
        Points: Number(normStr(r[idx("Points")]) || 0),
    }));
}
