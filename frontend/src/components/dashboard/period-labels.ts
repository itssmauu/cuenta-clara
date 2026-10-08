import type { DashboardPeriod, Frequency } from "@/lib/finance-api";
import { formatDate } from "@/lib/format";

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
  daily: "hoy",
  weekly: "esta semana",
  biweekly: "esta quincena",
  monthly: "este mes",
};

/** "la semana anterior", used in comparisons */
export const PREVIOUS_PERIOD_NAME: Record<Frequency, string> = {
  daily: "ayer",
  weekly: "la semana anterior",
  biweekly: "la quincena anterior",
  monthly: "el mes anterior",
  custom: "el periodo anterior",
};

export const PERIOD_ADJECTIVE: Record<Frequency, string> = {
  daily: "diario",
  weekly: "semanal",
  biweekly: "quincenal",
  monthly: "mensual",
  custom: "del periodo",
};
