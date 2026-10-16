"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { setFormatLocale } from "@/lib/format";

import { LOCALE_COOKIE, type Locale } from "./config";
import { translator, type Translate } from "./translate";

type LocaleState = { locale: Locale; setLocale: (locale: Locale) => void; t: Translate };

const LocaleContext = createContext<LocaleState | null>(null);

const YEAR = 60 * 60 * 24 * 365;

export function LocaleProvider({ initial, children }: { initial: Locale; children: ReactNode }) {
  const router = useRouter();
  const [locale, setState] = useState(initial);
  // Dates and money on the client follow the language (the server renders few of them)
  if (typeof window !== "undefined") setFormatLocale(locale);

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${YEAR}; samesite=lax`;
      document.documentElement.lang = next;
      setState(next);
      router.refresh(); // server-rendered parts (landing, legal pages) follow
    },
    [router],
  );

  const value = useMemo(() => ({ locale, setLocale, t: translator(locale) }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

// Outside the provider (isolated tests, a crash screen) everything stays in Spanish
const SPANISH: LocaleState = { locale: "es", setLocale: () => {}, t: translator("es") };

function useLocaleState(): LocaleState {
  return useContext(LocaleContext) ?? SPANISH;
}

export function useLocale(): Locale {
  return useLocaleState().locale;
}

export function useSetLocale(): (locale: Locale) => void {
  return useLocaleState().setLocale;
}

export function useT(): Translate {
  return useLocaleState().t;
}
