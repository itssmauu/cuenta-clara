"use client";

import { CheckCircle2, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

/** A short confirmation ("Ingreso guardado") announced to screen readers, gone after a few seconds. */
export function useNotice(timeoutMs = 4000) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), timeoutMs);
    return () => clearTimeout(timer);
  }, [message, timeoutMs]);

  const show = useCallback((text: string) => setMessage(text), []);
  return [message, show] as const;
}

export function Notice({ message }: { message: string | null }) {
  // The live region always exists so screen readers notice when text appears in it
  return (
    <div role="status" aria-live="polite" className="empty:hidden">
      {message ? (
        <p className="bg-mint-tint text-ink flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold">
          <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="bg-canvas flex flex-col items-start gap-3 rounded-3xl p-6 sm:p-8">
      <Icon aria-hidden="true" className="text-primary size-9" />
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="text-body max-w-prose text-sm leading-relaxed">{text}</p>
      {action}
    </div>
  );
}

export function TableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" className="flex flex-col gap-2">
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} aria-hidden="true" className="bg-canvas h-12 animate-pulse rounded-2xl" />
      ))}
    </div>
  );
}

/** Active / paused label with an icon dot plus words (never color alone). */
export function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
        active ? "bg-mint-tint text-ink" : "bg-canvas text-muted"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${active ? "bg-mint-ink" : "bg-muted"}`}
      />
      {active ? "Activo" : "Pausado"}
    </span>
  );
}
