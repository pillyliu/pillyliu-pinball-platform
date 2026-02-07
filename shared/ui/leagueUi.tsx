import type { ReactNode } from "react";
import type { NavLabel } from "./navLinks";

type NavItem = { href: string; label: NavLabel };

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function SiteShell({
  title,
  activeLabel,
  navItems,
  controls,
  children,
}: {
  title: string;
  activeLabel: NavLabel;
  navItems: readonly NavItem[];
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 overflow-x-hidden">
      <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto max-w-screen-2xl px-4 py-4 flex flex-wrap items-center gap-4 justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
              Pillyliu Pinball
            </div>
            <h1 className="text-lg font-bold tracking-tight">{title}</h1>
          </div>

          <nav className="flex flex-wrap items-center gap-2 text-sm">
            {navItems.map((link) => {
              const active = link.label === activeLabel;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-full px-3 py-1.5 ring-1 transition",
                    active
                      ? "bg-sky-500/15 text-sky-200 ring-sky-400/40"
                      : "bg-neutral-900 text-neutral-300 ring-neutral-700 hover:text-neutral-100 hover:ring-neutral-500"
                  )}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          {controls}
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-4 py-6 grid gap-6">{children}</main>
    </div>
  );
}

export const CONTROL_INPUT_CLASS =
  "bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40";

export const CONTROL_SELECT_CLASS =
  "bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40";

export const PRIMARY_BUTTON_CLASS =
  "px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50";

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-neutral-800 bg-neutral-950/40", className)}>
      {children}
    </section>
  );
}

export function SectionTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={cn("text-sm font-semibold tracking-wide text-neutral-200", className)}>{children}</h2>;
}
