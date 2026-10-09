import { describe, expect, it } from "vitest";

import { fixedExpenseSchema, spendingLimitSchema, transactionSchema } from "./finance-validation";
import { formatMoney, parseISODate, todayISO } from "./format";

describe("money fields", () => {
  const base = { name: "Internet", frequency: "monthly", custom_period_days: "", due_day: "" };

  it.each([
    ["25", "25"],
    ["25.5", "25.5"],
    ["1,250.75", "1250.75"],
    [" 30 ", "30"],
  ])("accepts %j as %j", (raw, expected) => {
    const parsed = fixedExpenseSchema.parse({ ...base, amount: raw });
    expect(parsed.amount).toBe(expected);
  });

  it.each(["0", "-5", "10.999", "abc", ""])("rejects %j", (raw) => {
    expect(fixedExpenseSchema.safeParse({ ...base, amount: raw }).success).toBe(false);
  });
});

describe("fixedExpenseSchema", () => {
  const valid = {
    name: "Pasaje",
    amount: "15",
    frequency: "weekly",
    custom_period_days: "",
    due_day: "",
  };

  it("turns empty optional numbers into null", () => {
    expect(fixedExpenseSchema.parse(valid)).toMatchObject({
      custom_period_days: null,
      due_day: null,
    });
  });

  it("requires a day count for custom frequency", () => {
    const result = fixedExpenseSchema.safeParse({ ...valid, frequency: "custom" });
    expect(result.error?.issues[0]?.path).toEqual(["custom_period_days"]);
  });

  it("checks the due day range", () => {
    expect(fixedExpenseSchema.safeParse({ ...valid, due_day: "32" }).success).toBe(false);
    expect(fixedExpenseSchema.parse({ ...valid, due_day: "15" }).due_day).toBe(15);
  });
});

describe("spendingLimitSchema", () => {
  it("allows no limit", () => {
    expect(spendingLimitSchema.parse({ spending_limit: "" }).spending_limit).toBe("");
  });

  it("allows a zero limit but not text", () => {
    expect(spendingLimitSchema.safeParse({ spending_limit: "0" }).success).toBe(true);
    expect(spendingLimitSchema.safeParse({ spending_limit: "mucho" }).success).toBe(false);
  });
});

describe("transactionSchema", () => {
  it("sends null for an empty category and note", () => {
    const parsed = transactionSchema.parse({
      type: "expense",
      amount: "12",
      category_id: "",
      occurred_on: "2026-10-07",
      note: "  ",
    });
    expect(parsed).toMatchObject({ category_id: null, note: null, account_id: null });
  });
});

describe("format", () => {
  it("formats dollars the Panamanian way", () => {
    expect(formatMoney("1234.5")).toBe("$1,234.50");
  });

  it("reads ISO dates as local days and writes today locally", () => {
    const date = parseISODate("2026-10-07");
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 7]);
    expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
