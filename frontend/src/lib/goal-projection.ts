/**
 * How much a savings goal will have over time at a steady pace, for goals without a
 * due date. Pure: the pace comes from the API (the user's real contributions) or from
 * the simulator ("what if I put $40 a week?").
 */
import { parseISODate, todayISO } from "./format";

export type TrendUnit = "week" | "month" | "year";
export type PaceUnit = "week" | "month";

/** How far each view looks ahead: 12 weeks, 12 months, 5 years. */
export const HORIZON: Record<TrendUnit, number> = { week: 12, month: 12, year: 5 };

// Average month and year, the same rule the rest of the app uses to convert periods
const DAYS_PER_MONTH = 30.4375;
const DAY_MS = 86_400_000;
/** Past this, "you would get there in…" is not a useful date anymore */
const MAX_REACH_DAYS = 365 * 100;

export type ProjectionPoint = {
  /** ISO day of the point: today, then one step per week/month/year */
  date: string;
  /** Saved by then (never below zero, never past the target) */
  amount: number;
  reached: boolean;
};

export type Projection = {
  points: ProjectionPoint[];
  /** ISO day the target is reached at this pace; null if never (pace ≤ 0) or too far */
  reachDate: string | null;
  /** True when it would take longer than MAX_REACH_DAYS */
  tooFar: boolean;
};

/** A pace typed in the simulator, as an amount per week. */
export function perWeek(amount: number, unit: PaceUnit): number {
  return unit === "week" ? amount : (amount * 7) / DAYS_PER_MONTH;
}

/** `start` moved `n` weeks, months or years ahead (month ends clamp: 31 Jan + 1 month = 28 Feb). */
export function addUnits(start: Date, unit: TrendUnit, n: number): Date {
  if (unit === "week")
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7 * n);
  const months = unit === "month" ? n : 12 * n;
  const target = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(start.getDate(), lastDay));
  return target;
}

function daysBetween(from: Date, to: Date): number {
  // Calendar days, safe across daylight-saving changes
  return Math.round(
    (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
      Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) /
      DAY_MS,
  );
}

export function projectGoal({
  saved,
  target,
  weekly,
  unit,
  today = todayISO(),
}: {
  saved: number;
  target: number;
  /** Net amount put in per week (negative: money leaving the goal) */
  weekly: number;
  unit: TrendUnit;
  today?: string;
}): Projection {
  const start = parseISODate(today);
  const perDay = weekly / 7;
  const points = Array.from({ length: HORIZON[unit] + 1 }, (_, n) => {
    const day = addUnits(start, unit, n);
    const raw = saved + perDay * daysBetween(start, day);
    const amount = Math.round(Math.min(Math.max(raw, 0), target) * 100) / 100;
    return { date: todayISO(day), amount, reached: amount >= target };
  });

  if (saved >= target) return { points, reachDate: today, tooFar: false };
  if (perDay <= 0) return { points, reachDate: null, tooFar: false };
  const days = Math.ceil((target - saved) / perDay);
  if (days > MAX_REACH_DAYS) return { points, reachDate: null, tooFar: true };
  const reach = new Date(start.getFullYear(), start.getMonth(), start.getDate() + days);
  return { points, reachDate: todayISO(reach), tooFar: false };
}
