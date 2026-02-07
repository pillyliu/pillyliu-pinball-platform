import type { ReactNode } from "react";

function cn(...parts: Array<string | null | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mx-auto max-w-6xl p-6 lg:max-w-screen-2xl", className)}>{children}</div>;
}

export const CONTROL_INPUT_CLASS =
  "w-full rounded-xl bg-neutral-900 px-4 py-3 text-neutral-100 placeholder:text-neutral-500 outline-none ring-1 ring-neutral-700 focus:ring-2 focus:ring-sky-500/40";

export const CONTROL_SELECT_CLASS =
  "w-full rounded-xl bg-neutral-900 px-4 py-3 text-neutral-100 outline-none ring-1 ring-neutral-700 focus:ring-2 focus:ring-sky-500/40";

export const SUBTLE_BUTTON_CLASS =
  "rounded-xl bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-sky-500/40";

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl bg-neutral-900 ring-1 ring-neutral-800", className)}>
      {children}
    </div>
  );
}

export function SectionHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("text-lg font-semibold", className)}>{children}</div>;
}
