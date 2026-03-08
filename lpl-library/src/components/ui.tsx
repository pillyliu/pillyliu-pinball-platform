import type { ReactNode } from "react";
import { PAGE_SIDE_INSET_STYLE } from "./uiStyles";

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
  return (
    <div className={cn("mx-auto max-w-6xl py-6 lg:max-w-screen-2xl", className)} style={PAGE_SIDE_INSET_STYLE}>
      {children}
    </div>
  );
}

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
