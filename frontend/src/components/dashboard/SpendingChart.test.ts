import { describe, expect, it } from "vitest";

import { niceScale } from "./SpendingChart";

describe("niceScale", () => {
  it.each([
    [63.25, [0, 20, 40, 60, 80]], // $55 spent + headroom
    [46, [0, 20, 40, 60]], // $40 limit + headroom
    [9.5, [0, 2.5, 5, 7.5, 10]],
    [120, [0, 50, 100, 150]],
    [0, [0, 1]], // no spending and no limit yet
  ])("gives clean ticks for %d", (value, ticks) => {
    const scale = niceScale(value);
    expect(scale.ticks).toEqual(ticks);
    expect(scale.max).toBe(ticks.at(-1));
    expect(scale.max).toBeGreaterThanOrEqual(value);
  });
});
