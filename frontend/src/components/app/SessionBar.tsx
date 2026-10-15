"use client";

import { CalendarDays, Clock, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useLocale, useT } from "@/i18n/client";
import { INTL_LOCALE } from "@/i18n/config";
import { describeSessionTime, formatSessionTime, sessionStart } from "@/lib/session-clock";

import { useSession } from "./session";

// es-US: "lunes, 12 de octubre de 2026" and "7:45 p. m.", the conventions used in Panama;
// en-US: "Monday, October 12, 2026" and "7:45 PM"
function formats(locale: string) {
  return {
    date: new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    time: new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }),
  };
}

/** Ticks every second while mounted. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * Top right of every signed-in page: who is signed in, today's date, the time, and how
 * long this session has lasted. Everything is computed in the browser; nothing is sent.
 */
export function SessionBar() {
  const t = useT();
  const { user } = useSession();
  const now = useNow();
  const [startedAt] = useState(() => sessionStart());
  const elapsed = now - startedAt;
  const today = new Date(now);
  const firstName = user.name.split(" ")[0] ?? user.name;
  const locale = useLocale();
  const { date: dateFormat, time: timeFormat } = useMemo(
    () => formats(INTL_LOCALE[locale]),
    [locale],
  );

  return (
    <section
      aria-label={t("Tu sesión")}
      className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm"
    >
      <p className="text-body flex items-center gap-1.5 font-semibold first-letter:uppercase">
        <CalendarDays aria-hidden="true" className="text-primary size-4 shrink-0" />
        <time dateTime={today.toISOString().slice(0, 10)}>{dateFormat.format(today)}</time>
      </p>
      <p className="text-body flex items-center gap-1.5 font-semibold tabular-nums">
        <Clock aria-hidden="true" className="text-primary size-4 shrink-0" />
        <span className="sr-only">{t("Hora:")} </span>
        <time dateTime={today.toISOString()}>{timeFormat.format(today)}</time>
      </p>
      <p className="bg-primary-tint text-ink flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold tabular-nums">
        <Timer aria-hidden="true" className="text-primary size-4 shrink-0" />
        <span>{t("En sesión")}</span>
        {/* role="timer" is not announced on every tick; the label says it in words */}
        <span
          role="timer"
          aria-label={t("Tiempo en sesión: {time}", { time: describeSessionTime(elapsed, t) })}
        >
          {formatSessionTime(elapsed)}
        </span>
      </p>
      <p className="flex items-center gap-2 font-bold">
        <span
          aria-hidden="true"
          className="bg-accent text-ink grid size-8 shrink-0 place-items-center rounded-full text-sm font-extrabold"
        >
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="max-w-[12ch] truncate" title={user.name}>
          <span className="sr-only">{t("Sesión de")} </span>
          {firstName}
        </span>
      </p>
      <LanguageSwitcher />
    </section>
  );
}
