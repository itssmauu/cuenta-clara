import type { DashboardPeriod, Frequency } from "@/lib/finance-api";
import { formatDate } from "@/lib/format";
import { msg } from "@/i18n/translate";

/** Short x-axis label for a period, e.g. "mié 7", "5 oct", "oct". */
export function periodTick(period: Frequency, start: string): string {
  switch (period) {
    case "daily":
      return formatDate(start, { weekday: "short", day: "numeric" });
    case "monthly":
      return formatDate(start, { month: "short" });
    default:
      return formatDate(start, { day: "numeric", month: "short" });
  }
}

/** Full label for tables and tooltips, e.g. "5 oct – 11 oct". */
export function periodRange(start: string, end: string): string {
  const day = (iso: string) => formatDate(iso, { day: "numeric", month: "short" });
  return start === end ? day(start) : `${day(start)} – ${day(end)}`;
}

export const CURRENT_PERIOD_NAME: Record<DashboardPeriod, string> = {
  daily: msg("hoy"),
  weekly: msg("esta semana"),
  biweekly: msg("esta quincena"),
  monthly: msg("este mes"),
};

/** "la semana anterior", used in comparisons */
export const PREVIOUS_PERIOD_NAME: Record<Frequency, string> = {
  daily: msg("ayer"),
  weekly: msg("la semana anterior"),
  biweekly: msg("la quincena anterior"),
  monthly: msg("el mes anterior"),
  custom: msg("el periodo anterior"),
};

export const PERIOD_ADJECTIVE: Record<Frequency, string> = {
  daily: msg("diario"),
  weekly: msg("semanal"),
  biweekly: msg("quincenal"),
  monthly: msg("mensual"),
  custom: msg("del periodo"),
};

/** "por semana", used where an amount belongs to one period */
export const PERIOD_NOUN: Record<Frequency, string> = {
  daily: msg("día"),
  weekly: msg("semana"),
  biweekly: msg("quincena"),
  monthly: msg("mes"),
  custom: msg("periodo"),
};
