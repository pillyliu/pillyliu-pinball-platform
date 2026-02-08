import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  cacheAssetUrl,
  fetchPinballJson,
  prefetchPinballTextAssets,
} from "../../../shared/ui/pinballCache";
import SiteHeader from "../components/SiteHeader";
import {
  APP_BACKGROUND_STYLE,
  CONTROL_INPUT_CLASS,
  CONTROL_SELECT_CLASS,
  PageContainer,
} from "../components/ui";

type Video = { kind: string; label: string; url: string };

type Game = {
  group: number | null;
  pos?: number | null;
  bank?: number | null;

  name: string;
  manufacturer: string | null;
  year: number | null;
  slug: string;
  playfieldLocal: string;
  rulesheetLocal: string;
  videos: Video[];
};

type GroupSection = {
  groupKey: number | null;
  games: Game[];
};

type BankSection = {
  bankKey: number | null;
  games: Game[];
};

type SortMode = "location" | "bank" | "alphabetical";

function locationText(group: number | null, pos?: number | null): string | null {
  if (typeof group !== "number" || typeof pos !== "number") return null;
  const floor = group >= 1 && group <= 4 ? "U" : "D";
  return `📍 ${floor}:${group}:${pos}`;
}

function metaLine(g: Game): string {
  const parts: string[] = [];
  parts.push(g.manufacturer ?? "—");
  if (g.year) parts.push(String(g.year));

  const loc = locationText(g.group, g.pos);
  if (loc) parts.push(loc);

  if (typeof g.bank === "number" && g.bank > 0) parts.push(`Bank ${g.bank}`);

  return parts.join(" • ");
}

function playfieldImageSources(slug: string, fallback: string) {
  const base = `/pinball/images/playfields/${slug}`;
  return {
    base,
    src: `${base}_700.webp`,
    srcSet: `${base}_700.webp 700w, ${base}_1400.webp 1400w, ${fallback} 2400w`,
    fallback,
  };
}

function compareMaybeNumber(a: number | null | undefined, b: number | null | undefined): number {
  const left = typeof a === "number" && Number.isFinite(a) ? a : Number.MAX_SAFE_INTEGER;
  const right = typeof b === "number" && Number.isFinite(b) ? b : Number.MAX_SAFE_INTEGER;
  return left - right;
}

export default function LibraryIndex() {
  const [games, setGames] = useState<Game[]>([]);
  const [q, setQ] = useState("");
  const [bank, setBank] = useState<number | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("location");

  useEffect(() => {
    fetchPinballJson<Game[]>("/pinball/data/pinball_library.json")
      .then((data) => setGames(Array.isArray(data) ? data : []))
      .catch(() => setGames([]));
  }, []);

  useEffect(() => {
    prefetchPinballTextAssets().catch(() => undefined);
  }, []);

  const bankOptions = useMemo<number[]>(() => {
    const s = new Set<number>();
    for (const g of games) {
      if (typeof g.bank === "number" && g.bank > 0) s.add(g.bank);
    }
    return Array.from(s).sort((a, b) => a - b);
  }, [games]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    const scoped = games.filter((g) => {
      const matchesQuery =
        !query ||
        `${g.name} ${g.manufacturer ?? ""} ${g.year ?? ""}`
          .toLowerCase()
          .includes(query);

      const matchesBank =
        bank === "all" || (typeof g.bank === "number" && g.bank === bank);

      return matchesQuery && matchesBank;
    });

    return [...scoped].sort((a, b) => {
      if (sortMode === "alphabetical") {
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }

      if (sortMode === "bank") {
        return (
          compareMaybeNumber(a.bank, b.bank) ||
          compareMaybeNumber(a.group, b.group) ||
          compareMaybeNumber(a.pos, b.pos) ||
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
      }

      return (
        compareMaybeNumber(a.group, b.group) ||
        compareMaybeNumber(a.pos, b.pos) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
    });
  }, [games, q, bank, sortMode]);

  const sections = useMemo<GroupSection[]>(() => {
    const out: GroupSection[] = [];
    for (const g of filtered) {
      const last = out[out.length - 1];
      if (!last || last.groupKey !== g.group) {
        out.push({ groupKey: g.group ?? null, games: [g] });
      } else {
        last.games.push(g);
      }
    }
    return out;
  }, [filtered]);

  const bankSections = useMemo<BankSection[]>(() => {
    const out: BankSection[] = [];
    for (const g of filtered) {
      const key = typeof g.bank === "number" && Number.isFinite(g.bank) ? g.bank : null;
      const last = out[out.length - 1];
      if (!last || last.bankKey !== key) {
        out.push({ bankKey: key, games: [g] });
      } else {
        last.games.push(g);
      }
    }
    return out;
  }, [filtered]);

  const showGroupedView = bank === "all" && sortMode === "location";
  const showBankSectionedView = bank === "all" && sortMode === "bank";

  return (
    <div className="min-h-screen text-neutral-100" style={APP_BACKGROUND_STYLE}>
      <SiteHeader title="Pinball Library" active="Library" />
      <PageContainer>
        <h2 className="text-2xl font-semibold">Browse Machines</h2>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search games…"
            className={`${CONTROL_INPUT_CLASS} md:flex-1`}
          />

          <div className="grid w-full grid-cols-2 gap-3 md:w-[28rem] md:flex-none">
            <div className="relative">
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className={CONTROL_SELECT_CLASS}
                aria-label="Sort games"
              >
                <option value="location">Sort: Location</option>
                <option value="bank">Sort: Bank</option>
                <option value="alphabetical">Sort: Alphabetical</option>
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl text-neutral-300">
                ▾
              </span>
            </div>

            <div className="relative">
              <select
                value={bank === "all" ? "all" : String(bank)}
                onChange={(e) => {
                  const v = e.target.value;
                  setBank(v === "all" ? "all" : Number(v));
                }}
                className={CONTROL_SELECT_CLASS}
                aria-label="Filter by bank"
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

        <div className="mt-6">
          {showGroupedView ? (
            <div className="space-y-8">
              {sections.map((section, idx) => (
                <div key={`${section.groupKey ?? "nogroup"}-${idx}`}>
                  {idx > 0 && (
                    <div className="mb-6 h-px w-full bg-white/55" />
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {section.games.map((g) => {
                      const image = playfieldImageSources(g.slug, g.playfieldLocal);
                      return (
                        <Link
                          key={g.slug}
                          to={`/game/${g.slug}`}
                          className="group rounded-2xl bg-neutral-900 ring-1 ring-neutral-800 hover:ring-neutral-600 transition overflow-hidden"
                        >
                          <div className="aspect-[16/9] bg-neutral-800">
                            <img
                              src={image.src}
                              srcSet={image.srcSet}
                              sizes="(min-width: 1024px) 325px, (min-width: 640px) 50vw, 100vw"
                              alt={`${g.name} playfield`}
                              className="h-full w-full object-cover opacity-90 group-hover:opacity-100"
                              onLoad={(e) => cacheAssetUrl((e.currentTarget as HTMLImageElement).currentSrc)}
                              onError={(e) => {
                                const el = e.currentTarget as HTMLImageElement;
                                el.removeAttribute("srcset");
                                el.removeAttribute("sizes");
                                el.src = image.fallback;
                              }}
                            />
                          </div>

                          <div className="p-4">
                            <div className="text-lg font-semibold">{g.name}</div>

                            <div className="mt-1 text-sm text-neutral-400">
                              {metaLine(g)}
                            </div>

                            <div className="mt-3 text-sm text-neutral-300">
                              Videos: {g.videos.length}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : showBankSectionedView ? (
            <div className="space-y-8">
              {bankSections.map((section, idx) => (
                <div key={`${section.bankKey ?? "nobank"}-${idx}`}>
                  {idx > 0 && (
                    <div className="mb-6 h-px w-full bg-white/55" />
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {section.games.map((g) => {
                      const image = playfieldImageSources(g.slug, g.playfieldLocal);
                      return (
                        <Link
                          key={g.slug}
                          to={`/game/${g.slug}`}
                          className="group rounded-2xl bg-neutral-900 ring-1 ring-neutral-800 hover:ring-neutral-600 transition overflow-hidden"
                        >
                          <div className="aspect-[16/9] bg-neutral-800">
                            <img
                              src={image.src}
                              srcSet={image.srcSet}
                              sizes="(min-width: 1024px) 325px, (min-width: 640px) 50vw, 100vw"
                              alt={`${g.name} playfield`}
                              className="h-full w-full object-cover opacity-90 group-hover:opacity-100"
                              onLoad={(e) => cacheAssetUrl((e.currentTarget as HTMLImageElement).currentSrc)}
                              onError={(e) => {
                                const el = e.currentTarget as HTMLImageElement;
                                el.removeAttribute("srcset");
                                el.removeAttribute("sizes");
                                el.src = image.fallback;
                              }}
                            />
                          </div>

                          <div className="p-4">
                            <div className="text-lg font-semibold">{g.name}</div>

                            <div className="mt-1 text-sm text-neutral-400">
                              {metaLine(g)}
                            </div>

                            <div className="mt-3 text-sm text-neutral-300">
                              Videos: {g.videos.length}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {filtered.map((g) => {
                const image = playfieldImageSources(g.slug, g.playfieldLocal);
                return (
                  <Link
                    key={g.slug}
                    to={`/game/${g.slug}`}
                    className="group rounded-2xl bg-neutral-900 ring-1 ring-neutral-800 hover:ring-neutral-600 transition overflow-hidden"
                  >
                    <div className="aspect-[16/9] bg-neutral-800">
                      <img
                        src={image.src}
                        srcSet={image.srcSet}
                        sizes="(min-width: 1024px) 325px, (min-width: 640px) 50vw, 100vw"
                        alt={`${g.name} playfield`}
                        className="h-full w-full object-cover opacity-90 group-hover:opacity-100"
                        onLoad={(e) => cacheAssetUrl((e.currentTarget as HTMLImageElement).currentSrc)}
                        onError={(e) => {
                          const el = e.currentTarget as HTMLImageElement;
                          el.removeAttribute("srcset");
                          el.removeAttribute("sizes");
                          el.src = image.fallback;
                        }}
                      />
                    </div>

                    <div className="p-4">
                      <div className="text-lg font-semibold">{g.name}</div>

                      <div className="mt-1 text-sm text-neutral-400">
                        {metaLine(g)}
                      </div>

                      <div className="mt-3 text-sm text-neutral-300">
                        Videos: {g.videos.length}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {games.length === 0 && (
          <div className="mt-8 text-neutral-400">
            No data loaded. Confirm canonical file{" "}
            <code className="rounded bg-neutral-900 px-2 py-1">
              shared/pinball/data/pinball_library.json
            </code>{" "}
            exists and has been deployed to <code className="rounded bg-neutral-900 px-2 py-1">/pinball/data/pinball_library.json</code>.
          </div>
        )}
      </PageContainer>
    </div>
  );
}
