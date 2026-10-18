import { describe, expect, it } from "vitest";

import { addUnits, perWeek, projectGoal } from "./goal-projection";

const TODAY = "2026-10-18";

describe("projectGoal", () => {
  it("grows week by week at the pace and says when the target is reached", () => {
    // Laptop: $600, $180 saved, $25 a week → $420 left = 117.6 days → 118
    const result = projectGoal({ saved: 180, target: 600, weekly: 25, unit: "week", today: TODAY });

    expect(result.points).toHaveLength(13); // today + 12 weeks
    expect(result.points[0]).toEqual({ date: TODAY, amount: 180, reached: false });
    expect(result.points[4]).toEqual({ date: "2026-11-15", amount: 280, reached: false });
    expect(result.reachDate).toBe("2027-02-13");
  });

  it("stops at the target", () => {
    const { points } = projectGoal({
      saved: 180,
      target: 600,
      weekly: 25,
      unit: "year",
      today: TODAY,
    });

    expect(points.map((p) => p.date)).toEqual([
      "2026-10-18",
      "2027-10-18",
      "2028-10-18",
      "2029-10-18",
      "2030-10-18",
      "2031-10-18",
    ]);
    expect(points[1]).toMatchObject({ amount: 600, reached: true });
    expect(points.at(-1)).toMatchObject({ amount: 600, reached: true });
  });

  it("months follow the calendar", () => {
    const { points } = projectGoal({
      saved: 0,
      target: 1000,
      weekly: 7,
      unit: "month",
      today: TODAY,
    });

    expect(points[1]).toEqual({ date: "2026-11-18", amount: 31, reached: false });
    expect(points).toHaveLength(13);
  });

  it("without a positive pace the target is never reached and money never goes negative", () => {
    const withdrawing = projectGoal({
      saved: 50,
      target: 600,
      weekly: -20,
      unit: "week",
      today: TODAY,
    });

    expect(withdrawing.reachDate).toBeNull();
    expect(withdrawing.points.at(-1)?.amount).toBe(0);
  });

  it("an already reached goal is reached today", () => {
    expect(
      projectGoal({ saved: 600, target: 600, weekly: 0, unit: "week", today: TODAY }).reachDate,
    ).toBe(TODAY);
  });

  it("says so when it would take more than a lifetime", () => {
    const slow = projectGoal({
      saved: 0,
      target: 1_000_000,
      weekly: 1,
      unit: "year",
      today: TODAY,
    });

    expect(slow).toMatchObject({ reachDate: null, tooFar: true });
  });
});

describe("helpers", () => {
  it("converts a monthly amount to a weekly pace", () => {
    expect(perWeek(40, "week")).toBe(40);
    expect(perWeek(30.4375, "month")).toBeCloseTo(7);
  });

  it("clamps month ends", () => {
    const end = addUnits(new Date(2027, 0, 31), "month", 1);
    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2027, 1, 28]);
  });
});
