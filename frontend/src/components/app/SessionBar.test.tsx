import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authApi } from "@/lib/api";
import {
  clearSessionStart,
  describeSessionTime,
  formatSessionTime,
  markSessionStart,
  sessionStart,
} from "@/lib/session-clock";
import { renderWithSession } from "@/test-utils";

import { SessionBar } from "./SessionBar";

const KEY = "cc-session-started";
// Monday 12 October 2026, 7:45:00 p.m. local time
const NOW = new Date(2026, 9, 12, 19, 45, 0).getTime();

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe("session clock", () => {
  it.each([
    [0, "00:00:00"],
    [9_000, "00:00:09"],
    [65 * 60_000 + 9_000, "01:05:09"],
    [(2 * 24 * 60 + 3 * 60 + 15) * 60_000, "2 d 03:15:00"],
    [-5_000, "00:00:00"],
  ])("formats %i ms as %s", (ms, text) => {
    expect(formatSessionTime(ms)).toBe(text);
  });

  it.each([
    [20_000, "menos de un minuto"],
    [60_000, "1 minuto"],
    [65 * 60_000, "1 hora y 5 minutos"],
    [120 * 60_000, "2 horas"],
  ])("says %i ms as %s", (ms, words) => {
    expect(describeSessionTime(ms)).toBe(words);
  });

  it("remembers when the session started and starts over when missing or impossible", () => {
    markSessionStart(NOW - 60_000);
    expect(sessionStart(NOW)).toBe(NOW - 60_000);

    clearSessionStart();
    expect(sessionStart(NOW)).toBe(NOW);
    expect(localStorage.getItem(KEY)).toBe(String(NOW));

    localStorage.setItem(KEY, String(NOW + 3_600_000)); // in the future
    expect(sessionStart(NOW)).toBe(NOW);
  });

  it("starts at login and ends at logout", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).endsWith("/logout")
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify({ id: "1", email: "a@b.co", name: "Ana" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
    );

    await authApi.login({ email: "a@b.co", password: "x" });
    expect(localStorage.getItem(KEY)).not.toBeNull();

    await authApi.logout();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe("SessionBar", () => {
  it("shows the name, today's date, the time and the session timer", () => {
    vi.useFakeTimers({ now: NOW });
    markSessionStart(NOW - (65 * 60_000 + 9_000));

    renderWithSession(<SessionBar />);

    const bar = screen.getByRole("region", { name: "Tu sesión" });
    expect(bar).toHaveTextContent("Ana");
    expect(bar).toHaveTextContent(/lunes, 12 de octubre de 2026/);
    expect(bar).toHaveTextContent(/7:45/);
    const timer = within(bar).getByRole("timer");
    expect(timer).toHaveTextContent("01:05:09");
    expect(timer).toHaveAccessibleName("Tiempo en sesión: 1 hora y 5 minutos");
  });

  it("keeps counting every second", () => {
    vi.useFakeTimers({ now: NOW });
    markSessionStart(NOW);
    renderWithSession(<SessionBar />);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.getByRole("timer")).toHaveTextContent("00:00:03");
  });
});
