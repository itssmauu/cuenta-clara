/**
 * Display helpers. Amounts arrive from the API as strings ("230.00") and are only
 * converted to numbers to format them or to size a chart bar, never to do math.
 */

import { INTL_LOCALE, type Locale } from "@/i18n/config";

// es-US renders "$1,234.50" and "12 oct", the conventions used in Panama. The language
// switch changes it on the client (LocaleProvider); the server always renders Spanish.
let LOCALE = INTL_LOCALE.es;

export function setFormatLocale(locale: Locale): void {
  LOCALE = INTL_LOCALE[locale];
}

/** The Intl locale in use, for components that format dates themselves */
export function intlLocale(): string {
  return LOCALE;
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(value: string | number, currency = "USD"): string {
  const key = `${LOCALE}:${currency}`;
  let formatter = moneyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, { style: "currency", currency });
    moneyFormatters.set(key, formatter);
  }
  return formatter.format(Number(value));
}

/** Parses an ISO date ("2026-10-07") as a local calendar day, not as UTC midnight. */
export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

export function formatDate(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALE, options).format(parseISODate(iso));
}

/** Today in the user's own timezone, as the API expects it (YYYY-MM-DD). */
export function todayISO(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function toCents(value: string): number {
  return Math.round(Number(value) * 100);
}

/** a − b for money strings, exact to the cent ("55.00" − "40.00" → "15.00"). */
export function subtractMoney(a: string, b: string): string {
  return ((toCents(a) - toCents(b)) / 100).toFixed(2);
}
