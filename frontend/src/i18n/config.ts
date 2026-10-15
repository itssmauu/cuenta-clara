/** The languages Cuenta Clara speaks. Spanish is the source: every text is written in it. */
export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";
/** Remembers the choice for a year; readable on the server so pages render in it. */
export const LOCALE_COOKIE = "cc-lang";

export const LOCALE_NAMES: Record<Locale, string> = { es: "Español", en: "English" };
/** Intl locale per language: es-US writes "$1,234.50" and "12 oct", as in Panama */
export const INTL_LOCALE: Record<Locale, string> = { es: "es-US", en: "en-US" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** The first supported language in an Accept-Language header, if any. */
export function fromAcceptLanguage(header: string | null | undefined): Locale | null {
  for (const part of (header ?? "").split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return null;
}
