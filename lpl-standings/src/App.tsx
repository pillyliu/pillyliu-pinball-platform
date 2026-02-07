import { useEffect, useMemo, useState } from "react";
import { fetchPinballText, prefetchPinballTextAssets } from "./lib/pinballCache";

/**
 * Pinball Standings Viewer — scrollable in both directions (touch-friendly)
 * Auto-loads CSV and shows latest season by default
 */

const DEFAULT_STANDINGS_URL = "/pinball/data/LPL_Standings.csv";

type StandRow = {
    season: string | number;
    player: string;
    total: number | string;
    rank?: string | number;
    eligible?: string | number;
    nights?: string | number;
    [k: string]: any;
};

type Standing = {
    player: string;
    seasonTotal: number;
    eligible?: string | number;
    nights?: string | number;
    banks: number[];
};

export default function App() {
    const [rows, setRows] = useState<StandRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [season, setSeason] = useState<number | null>(null);

    const cfgMode = useMemo(() => {
        try { return new URLSearchParams(window.location.search).get("cfg") === "1"; }
        catch { return false; }
    }, []);

    const demoMode = useMemo(() => {
        try { return new URLSearchParams(window.location.search).get("demo") === "1"; }
        catch { return false; }
    }, []);

    const [dataUrl, setDataUrl] = useState<string>(() =>
        localStorage.getItem("standings_csv_url") || DEFAULT_STANDINGS_URL
    );

    useEffect(() => {
        prefetchPinballTextAssets(["/pinball/data"]).catch(() => undefined);
    }, []);

    useEffect(() => {
        (async () => {
            try {
                setError(null);
                if (demoMode) { setRows(parseStandingsCSV(DEMO_CSV)); return; }
                const text = await fetchPinballText(dataUrl);
                setRows(parseStandingsCSV(text));
            } catch (e: any) {
                setError(e?.message || "Failed to load standings CSV");
                setRows([]);
            }
        })();
    }, [dataUrl, demoMode]);

    const seasonList = useMemo(() => {
        const nums = uniq(
            rows.map(r => coerceSeason(r.season)).filter(n => Number.isFinite(n) && n > 0)
        ).sort((a, b) => a - b);
        return nums;
    }, [rows]);

    useEffect(() => {
        if (seasonList.length && season === null) {
            setSeason(seasonList[seasonList.length - 1]);
        }
    }, [seasonList, season]);

    const standings = useMemo<Standing[]>(() => {
        if (!season) return [];
        const sel = rows.filter(r => coerceSeason(r.season) === season);
        if (!sel.length) return [];

        const toNum = (v: any) => Number(v) || 0;
        const mapped: Standing[] = sel.map(r => ({
            player: String(r.player ?? "").trim(),
            seasonTotal: toNum(r.total),
            eligible: r.eligible,
            nights: r.nights,
            banks: Array.from({ length: 8 }, (_, i) => toNum(r[`bank_${i + 1}`]))
        }));

        const hasRank = sel.every(r => String(r.rank ?? "").trim() !== "");
        if (hasRank) {
            const rankMap = new Map(sel.map(r => [String(r.player).trim(), Number(r.rank) || 999999]));
            return mapped.sort((a, b) => (rankMap.get(a.player) ?? 999999) - (rankMap.get(b.player) ?? 999999));
        }
        return mapped.sort((a, b) => b.seasonTotal - a.seasonTotal);
    }, [rows, season]);

    function saveUrlAndReload() {
        localStorage.setItem("standings_csv_url", dataUrl);
        setDataUrl(dataUrl);
    }

    return (
        <div className="min-h-dvh bg-neutral-950 text-neutral-100 overflow-hidden">
            <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
                <div className="mx-auto max-w-screen-2xl px-4 py-4 flex flex-wrap items-center gap-3 justify-between">
                    <h1 className="text-lg font-bold tracking-tight">Pinball Standings</h1>
                    {cfgMode && (
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <input
                                value={dataUrl}
                                onChange={e => setDataUrl(e.target.value)}
                                placeholder="https://.../standings.csv"
                                className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 w-full sm:w-auto sm:max-w-[420px] min-w-0"
                            />
                            <button
                                onClick={saveUrlAndReload}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500"
                            >
                                Load URL
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main className="mx-auto max-w-screen-2xl px-4 py-6 grid gap-6">
                {error && (
                    <div className="text-sm bg-red-900/30 border border-red-800 text-red-200 rounded-xl p-3">
                        {error}
                    </div>
                )}

                {/* Season selector */}
                <section className="grid gap-3 rounded-2xl border border-neutral-800 p-4">
                    <div className="flex flex-wrap items-center gap-3 min-w-0">
                        <label className="text-sm text-neutral-400">Season</label>
                        <select
                            value={season ?? ""}
                            onChange={e => setSeason(Number(e.target.value) || seasonList.at(-1) || 0)}
                            className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2"
                        >
                            {seasonList.map(s => (
                                <option key={s} value={s}>
                                    Season {s}
                                </option>
                            ))}
                        </select>
                    </div>
                </section>

                {/* Scrollable table */}
                <section className="rounded-2xl border border-neutral-800 p-0 overflow-auto touch-pan-x touch-pan-y ios-scroller">
                    <div className="min-w-max">
                        <table className="w-full text-sm border-collapse">
                            <thead className="bg-neutral-950 sticky top-0">
                                <tr className="text-left text-neutral-400 border-b border-neutral-800">
                                    <th className="py-2 px-4">#</th>
                                    <th className="py-2 px-4">Player</th>
                                    <th className="py-2 px-4">Season Points</th>
                                    <th className="py-2 px-4">Eligible</th>
                                    <th className="py-2 px-4">Nights</th>
                                    <th className="py-2 px-4">B1</th>
                                    <th className="py-2 px-4">B2</th>
                                    <th className="py-2 px-4">B3</th>
                                    <th className="py-2 px-4">B4</th>
                                    <th className="py-2 px-4">B5</th>
                                    <th className="py-2 px-4">B6</th>
                                    <th className="py-2 px-4">B7</th>
                                    <th className="py-2 px-4">B8</th>
                                </tr>
                            </thead>
                            <tbody>
                                {standings.map((s, i) => {
                                    const rank = i + 1;
                                    const top8 = rank <= 8;
                                    const rankStyle =
                                        rank === 1
                                            ? "text-yellow-400"
                                            : rank === 2
                                                ? "text-neutral-300"
                                                : rank === 3
                                                    ? "text-amber-600"
                                                    : "";
                                    return (
                                        <tr key={s.player} className="border-b border-neutral-900">
                                            <td className={`py-2 px-4 tabular-nums ${rankStyle}`}>{rank}</td>
                                            <td className={`py-2 px-4 ${top8 ? "font-semibold" : ""} break-words max-w-[14rem]`}>
                                                {s.player}
                                            </td>
                                            <td className="py-2 px-4 tabular-nums">{Math.round(s.seasonTotal)}</td>
                                            <td className="py-2 px-4">{String(s.eligible ?? "")}</td>
                                            <td className="py-2 px-4 tabular-nums">{String(s.nights ?? "")}</td>
                                            {s.banks.map((b, idx) => (
                                                <td key={idx} className="py-2 px-4 tabular-nums">{Math.round(b)}</td>
                                            ))}
                                        </tr>
                                    );
                                })}
                                {!standings.length && (
                                    <tr>
                                        <td colSpan={13} className="py-6 text-center text-neutral-500">
                                            No rows. Check CSV or season selection.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </div>
    );
}

/* ========================= Helpers ========================= */

function uniq<T>(array: T[]): T[] {
    return Array.from(new Set(array as any));
}
function coerceSeason(s: any): number {
    const m = String(s ?? "").match(/\d+/);
    return m ? Number(m[0]) : Number(s) || 0;
}
function parseStandingsCSV(text: string): StandRow[] {
    const rows: string[][] = [];
    let field = "", row: string[] = [], inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
            } else field += ch;
        } else {
            if (ch === '"') inQuotes = true;
            else if (ch === ",") { row.push(field); field = ""; }
            else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
            else if (ch !== "\r") field += ch;
        }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    if (!rows.length) return [];

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const body = rows.slice(1);
    const need = ["season", "player", "total", "bank_1", "bank_2", "bank_3", "bank_4", "bank_5", "bank_6", "bank_7", "bank_8"];
    for (const n of need)
        if (!headers.includes(n)) throw new Error(`Standings CSV missing column: ${n}`);

    return body.filter(r => r.length === headers.length).map(r => {
        const obj: any = {};
        headers.forEach((h, i) => (obj[h] = r[i]));
        return obj as StandRow;
    });
}

/* ========================= DEMO CSV ========================= */
const DEMO_CSV = `season,player,total,rank,eligible,nights,bank_1,bank_2,bank_3,bank_4,bank_5,bank_6,bank_7,bank_8
22,Peter Liu,3340,1,Yes,8,470,480,455,500,420,495,500,500
22,Danny Clark,3290,2,Yes,8,460,500,410,470,480,500,500,500
22,Jessica Schultz,3285,3,Yes,8,455,470,460,480,430,490,500,500
22,Bryan Johnson,3250,4,Yes,8,440,465,480,455,500,470,500,500
23,Peter Liu,3350,1,Yes,8,480,490,500,470,460,495,500,500`;
