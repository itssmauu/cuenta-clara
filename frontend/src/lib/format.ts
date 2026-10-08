/**
 * Display helpers. Amounts arrive from the API as strings ("230.00") and are only
 * converted to numbers to format them or to size a chart bar, never to do math.
 */

// es-US renders "$1,234.50", the convention used in Panama for dollars
const LOCALE = "es-US";

const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(value: string | number, currency = "USD"): string {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, { style: "currency", currency });
    moneyFormatters.set(currency, formatter);
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
