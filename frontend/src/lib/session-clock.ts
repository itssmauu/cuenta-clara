/**
 * When the current session started, kept in this browser only (nothing is sent anywhere).
 *
 * It is set when the user logs in and cleared when they log out, so reloading or opening
 * another tab keeps counting, and logging in again starts from zero.
 */
const KEY = "cc-session-started";

export function markSessionStart(now: number = Date.now()): void {
  try {
    window.localStorage.setItem(KEY, String(now));
  } catch {
    // Storage blocked: the bar counts from when the page opened instead
  }
}

export function clearSessionStart(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear
  }
}

/** The session's start; a missing or impossible value starts it now. */
export function sessionStart(now: number = Date.now()): number {
  let stored = NaN;
  try {
    stored = Number(window.localStorage.getItem(KEY));
  } catch {
    // Storage blocked
  }
  if (!Number.isFinite(stored) || stored <= 0 || stored > now) {
    markSessionStart(now);
    return now;
  }
  return stored;
}

/** "00:05:09", "01:30:00"; past a day, "2 d 03:15:00". */
export function formatSessionTime(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(total / 86_400);
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(Math.floor((total % 86_400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return days > 0 ? `${days} d ${clock}` : clock;
}

/** The same duration in words, for screen readers: "1 hora y 5 minutos". */
export function describeSessionTime(milliseconds: number): string {
  const minutes = Math.floor(Math.max(0, milliseconds) / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const h = hours === 1 ? "1 hora" : `${hours} horas`;
  const m = rest === 1 ? "1 minuto" : `${rest} minutos`;
  if (hours === 0) return minutes === 0 ? "menos de un minuto" : m;
  return rest === 0 ? h : `${h} y ${m}`;
}
