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
    <div className="min-h-dvh bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-4 px-4 py-4">
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
        </div>
        {controls ? (
          <div className="mx-auto flex max-w-screen-2xl justify-end px-4 pb-4">
            {controls}
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-screen-2xl px-4 py-6 grid gap-6">{children}</main>
    </div>
  );
}

export const CONTROL_INPUT_CLASS =
  "w-full rounded-xl bg-neutral-900 px-4 py-3 text-neutral-100 placeholder:text-neutral-500 outline-none ring-1 ring-neutral-700 focus:ring-2 focus:ring-sky-500/40";

export const CONTROL_SELECT_CLASS =
  "w-full min-w-[11rem] rounded-xl bg-neutral-900 px-4 py-3 text-neutral-100 outline-none ring-1 ring-neutral-700 focus:ring-2 focus:ring-sky-500/40";

export const PRIMARY_BUTTON_CLASS =
  "rounded-xl bg-emerald-600 px-4 py-3 text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50";

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl bg-neutral-900 ring-1 ring-neutral-800", className)}>
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
