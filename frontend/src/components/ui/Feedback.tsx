"use client";

import { CheckCircle2, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

const LEAVE_MS = 200;

/** Each confirmation gets its own id, so saving twice in a row shows (and times) it twice. */
export type NoticeMessage = { text: string; id: number } | null;

/** A short confirmation ("Ingreso guardado") announced to screen readers, gone after a few seconds. */
export function useNotice(timeoutMs = 4000) {
  const [message, setMessage] = useState<NoticeMessage>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), timeoutMs);
    return () => clearTimeout(timer);
  }, [message, timeoutMs]);

  const show = useCallback((text: string) => setMessage({ text, id: Date.now() }), []);
  return [message, show] as const;
}

/**
 * A toast at the bottom of the screen: it floats over the page instead of pushing
 * the content down, rises in and leaves the way it came. It never takes clicks,
 * so it cannot get in the way of what is underneath.
 */
export function Notice({ message }: { message: NoticeMessage }) {
  // Keep the last message on screen while it animates out
  const [shown, setShown] = useState(message);
  if (message && message !== shown) setShown(message);
  const leaving = shown !== null && message === null;

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setShown(null), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  // The live region always exists so screen readers notice when text appears in it
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-6"
    >
      {shown ? (
        <p
          key={shown.id}
          data-leaving={leaving || undefined}
          className="toast bg-ink flex items-center gap-2.5 rounded-full py-3 pr-5 pl-3.5 text-sm font-bold text-white shadow-[0_12px_32px_-8px_rgb(21_25_61/0.45)]"
        >
          <CheckCircle2 aria-hidden="true" className="text-mint size-5 shrink-0" />
          {shown.text}
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
