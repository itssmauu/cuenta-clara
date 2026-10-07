import type { ReactNode } from "react";

/** Title bar at the top of every signed-in page, with room for actions on the right. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  /** Small label above the title, e.g. the section name when the title is a greeting. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="bg-canvas flex flex-wrap items-center justify-between gap-4 rounded-[32px] px-6 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-col gap-1">
        {eyebrow ? (
          <p className="text-primary text-xs font-bold tracking-[0.08em] uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-[26px] font-extrabold tracking-[-0.02em] sm:text-[30px]">
          {title}
        </h1>
        {subtitle ? <p className="text-muted text-sm font-semibold">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
