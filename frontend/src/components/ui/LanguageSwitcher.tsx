"use client";

import { Languages } from "lucide-react";

import { useLocale, useSetLocale, useT } from "@/i18n/client";
import { LOCALE_NAMES, LOCALES } from "@/i18n/config";

/**
 * ES | EN. Each button is named in its own language ("Español", "English") so a visitor
 * who does not read the current one can still find theirs; `lang` makes screen readers
 * pronounce it correctly.
 */
export function LanguageSwitcher({ tone = "ink" }: { tone?: "ink" | "light" }) {
  const t = useT();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const idle = tone === "light" ? "text-on-ink hover:bg-white/10" : "text-body hover:bg-ink/5";

  return (
    <div role="group" aria-label={t("Idioma")} className="flex items-center gap-1">
      <Languages
        aria-hidden="true"
        className={`size-4 shrink-0 ${tone === "light" ? "text-on-ink" : "text-primary"}`}
      />
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-label={LOCALE_NAMES[option]}
          aria-pressed={locale === option}
          onClick={() => option !== locale && setLocale(option)}
          className={`min-h-11 min-w-11 cursor-pointer rounded-full px-2 text-sm font-bold uppercase transition-colors duration-200 ${
            locale === option
              ? tone === "light"
                ? "text-ink bg-white"
                : "bg-ink text-white"
              : idle
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
