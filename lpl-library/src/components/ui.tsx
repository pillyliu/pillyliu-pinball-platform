import type { CSSProperties, ReactNode } from "react";

function cn(...parts: Array<string | null | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export const APP_BACKGROUND_STYLE = {
  background:
    "radial-gradient(70% 70% at 20% -10%, rgba(56, 189, 248, 0.13), transparent 70%) top center / 100% 48rem no-repeat, radial-gradient(65% 65% at 90% -20%, rgba(14, 165, 233, 0.08), transparent 72%) top center / 100% 52rem no-repeat, #0a0a0a",
} as const;

export const PAGE_SIDE_INSET_STYLE: CSSProperties = {
  paddingLeft: "max(1rem, env(safe-area-inset-left))",
  paddingRight: "max(1rem, env(safe-area-inset-right))",
};

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-6xl py-6 lg:max-w-screen-2xl", className)} style={PAGE_SIDE_INSET_STYLE}>
      {children}
    </div>
  );
}

export const CONTROL_INPUT_CLASS =
  "w-full rounded-xl bg-neutral-900 px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none ring-1 ring-neutral-700 focus:ring-2 focus:ring-sky-500/40";

export const CONTROL_SELECT_CLASS =
  "w-full appearance-none rounded-xl bg-neutral-900 px-4 pr-10 py-2.5 text-sm text-neutral-100 outline-none ring-1 ring-neutral-700 focus:ring-2 focus:ring-sky-500/40";

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
