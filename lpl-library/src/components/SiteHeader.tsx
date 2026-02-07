type SiteHeaderProps = {
  title: string;
  active: "Library" | "Stats" | "Standings" | "Targets" | "Home";
};

const NAV_LINKS = [
  { href: "https://pillyliu.com/", label: "Home" as const },
  { href: "https://pillyliu.com/lpl_library/", label: "Library" as const },
  { href: "https://pillyliu.com/lpl_stats/", label: "Stats" as const },
  { href: "https://pillyliu.com/lpl_standings/", label: "Standings" as const },
  { href: "https://pillyliu.com/lpl_targets/", label: "Targets" as const },
];

export default function SiteHeader({ title, active }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
            Pillyliu Pinball
          </div>
          <h1 className="text-lg font-bold tracking-tight">{title}</h1>
        </div>

        <nav className="flex flex-wrap items-center gap-2 text-sm">
          {NAV_LINKS.map((link) => {
            const isActive = link.label === active;
            return (
              <a
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 ring-1 transition ${
                  isActive
                    ? "bg-sky-500/15 text-sky-200 ring-sky-400/40"
                    : "bg-neutral-900 text-neutral-300 ring-neutral-700 hover:text-neutral-100 hover:ring-neutral-500"
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
