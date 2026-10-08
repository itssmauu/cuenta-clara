/**
 * Validation for money forms. Mirrors the API rules (NUMERIC(12,2), positive amounts,
 * custom frequency needs a day count); the API validates everything again.
 */
import { z } from "zod";

import type { DashboardPeriod, Frequency } from "./finance-api";

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: "Diario",
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  custom: "Personalizado",
};

export const PERIOD_OPTIONS: DashboardPeriod[] = ["daily", "weekly", "biweekly", "monthly"];
export const FREQUENCIES = Object.keys(FREQUENCY_LABELS) as Frequency[];

/** "160", "160.5", "1,250.75" → "160.00"-style strings the API accepts; at most 2 decimals. */
export function normalizeMoney(raw: string): string {
  return raw.trim().replace(/,/g, "");
}

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

function money({ allowZero }: { allowZero: boolean }) {
  return z
    .string()
    .transform(normalizeMoney)
    .pipe(
      z
        .string()
        .min(1, { error: "Escribe un monto." })
        .regex(MONEY_PATTERN, { error: "Usa solo números, con hasta 2 decimales (ej. 25.50)." })
        .refine((value) => allowZero || Number(value) > 0, {
          error: "El monto debe ser mayor que 0.",
        }),
    );
}

const frequency = z.enum(FREQUENCIES as [Frequency, ...Frequency[]], {
  error: "Elige una frecuencia.",
});

const optionalDays = z
  .string()
  .optional()
  .transform((value) => (value ? Number(value) : null))
  .pipe(
    z
      .number({ error: "Escribe un número de días." })
      .int({ error: "Usa un número entero de días." })
      .min(1, { error: "Mínimo 1 día." })
      .max(366, { error: "Máximo 366 días." })
      .nullable(),
  );

function requireDaysWhenCustom<
  T extends { frequency: Frequency; custom_period_days: number | null },
>(data: T, ctx: z.RefinementCtx) {
  if (data.frequency === "custom" && data.custom_period_days === null) {
    ctx.addIssue({
      code: "custom",
      message: "Indica cada cuántos días.",
      path: ["custom_period_days"],
    });
  }
}

const isoDate = z.iso.date({ error: "Elige una fecha válida." });

export const initialBalanceSchema = z.object({
  initial_balance: money({ allowZero: true }),
});

const fixedExpenseFields = z.object({
  name: z.string().trim().min(1, { error: "Escribe un nombre." }).max(100),
  amount: money({ allowZero: false }),
  frequency,
  custom_period_days: optionalDays,
  due_day: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .pipe(
      z
        .number()
        .int()
        .min(1, { error: "Entre 1 y 31." })
        .max(31, { error: "Entre 1 y 31." })
        .nullable(),
    ),
});

/** Onboarding: start date and category are filled in automatically. */
export const fixedExpenseSchema = fixedExpenseFields.superRefine(requireDaysWhenCustom);

/** Full create/edit form on the "Gastos fijos" page. */
export const fixedExpenseFormSchema = fixedExpenseFields
  .extend({
    start_date: z.iso.date({ error: "Elige una fecha válida." }),
    category_id: z.string().transform((value) => value || null),
  })
  .superRefine(requireDaysWhenCustom);

export const incomeSchema = z
  .object({
    label: z.string().trim().min(1, { error: "Escribe de dónde viene el ingreso." }).max(100),
    amount: money({ allowZero: false }),
    frequency,
    custom_period_days: optionalDays,
    start_date: isoDate,
  })
  .superRefine(requireDaysWhenCustom);

export const spendingLimitSchema = z.object({
  // Empty = no limit
  spending_limit: z
    .string()
    .transform(normalizeMoney)
    .pipe(
      z.union([
        z.literal(""),
        z.string().regex(MONEY_PATTERN, { error: "Usa solo números, con hasta 2 decimales." }),
      ]),
    ),
});

export const transactionSchema = z.object({
  type: z.enum(["expense", "income"]),
  amount: money({ allowZero: false }),
  category_id: z.string().transform((value) => value || null),
  occurred_on: isoDate,
  note: z
    .string()
    .trim()
    .max(255, { error: "Máximo 255 caracteres." })
    .transform((value) => value || null),
});

export const settingsSchema = z
  .object({
    initial_balance: money({ allowZero: true }),
    balance_as_of: isoDate,
    currency: z.string().regex(/^[A-Z]{3}$/, { error: "Elige una moneda." }),
    income_period: frequency,
    custom_period_days: optionalDays,
  })
  .and(spendingLimitSchema)
  .superRefine((data, ctx) =>
    requireDaysWhenCustom({ ...data, frequency: data.income_period }, ctx),
  );

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Escribe un nombre." })
    .max(50, { error: "Máximo 50 caracteres." }),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, { error: "Elige un color." }),
});

export type FixedExpenseForm = z.input<typeof fixedExpenseSchema>;
export type FixedExpenseValues = z.output<typeof fixedExpenseSchema>;
export type FixedExpenseFullForm = z.input<typeof fixedExpenseFormSchema>;
export type FixedExpenseFullValues = z.output<typeof fixedExpenseFormSchema>;
export type SettingsForm = z.input<typeof settingsSchema>;
export type SettingsValues = z.output<typeof settingsSchema>;
export type CategoryValues = z.output<typeof categorySchema>;
export type IncomeForm = z.input<typeof incomeSchema>;
export type IncomeValues = z.output<typeof incomeSchema>;
export type TransactionForm = z.input<typeof transactionSchema>;
export type TransactionValues = z.output<typeof transactionSchema>;

export const goalSchema = z.object({
  name: z.string().trim().min(1, { error: "Escribe un nombre para la meta." }).max(100),
  target_amount: money({ allowZero: false }),
  saved_amount: money({ allowZero: true }),
  // Empty = no deadline
  due_date: z.union([z.literal(""), isoDate]).transform((value) => value || null),
});

export const contributionSchema = z
  .object({
    direction: z.enum(["deposit", "withdraw"]),
    amount: money({ allowZero: false }),
  })
  // The API takes a signed amount: negative means taking money out of the goal
  .transform(({ direction, amount }) => (direction === "withdraw" ? `-${amount}` : amount));

export type GoalForm = z.input<typeof goalSchema>;
export type GoalValues = z.output<typeof goalSchema>;
export type ContributionForm = z.input<typeof contributionSchema>;
