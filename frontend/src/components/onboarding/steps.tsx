"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { buttonClass } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/FormAlert";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import {
  FREQUENCIES,
  FREQUENCY_LABELS,
  fixedExpenseSchema,
  initialBalanceSchema,
  normalizeMoney,
  spendingLimitSchema,
  type FixedExpenseForm,
  type FixedExpenseValues,
} from "@/lib/finance-validation";
import type { Frequency } from "@/lib/finance-api";
import { formatMoney } from "@/lib/format";

const frequencyOptions = FREQUENCIES.map((value) => ({ value, label: FREQUENCY_LABELS[value] }));

function StepActions({ onBack, children }: { onBack?: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-3 pt-2">
      {onBack ? (
        <button type="button" onClick={onBack} className={buttonClass("ghost")}>
          Atrás
        </button>
      ) : (
        <span />
      )}
      {children}
    </div>
  );
}

// ── Step 1 ──────────────────────────────────────────────

export function BalanceStep({
  initial,
  onNext,
}: {
  initial: string;
  onNext: (value: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof initialBalanceSchema>, unknown, z.output<typeof initialBalanceSchema>>(
    {
      resolver: zodResolver(initialBalanceSchema),
      defaultValues: { initial_balance: initial },
    },
  );

  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => onNext(v.initial_balance))}
      className="flex flex-col gap-5"
    >
      <TextField
        id="initial-balance"
        label="¿Con cuánto dinero cuentas hoy?"
        inputMode="decimal"
        placeholder="100.00"
        autoComplete="off"
        hint="Suma lo que tienes disponible: efectivo y cuentas. Puedes cambiarlo después."
        error={errors.initial_balance?.message}
        {...register("initial_balance")}
      />
      <StepActions>
        <button type="submit" className={buttonClass("primary", "lg")}>
          Continuar
        </button>
      </StepActions>
    </form>
  );
}

// ── Step 2 ──────────────────────────────────────────────

const emptyExpense: FixedExpenseForm = {
  name: "",
  amount: "",
  frequency: "monthly",
  custom_period_days: "",
  due_day: "",
};

export function FixedExpensesStep({
  items,
  onAdd,
  onRemove,
  onBack,
  onNext,
}: {
  items: FixedExpenseValues[];
  onAdd: (item: FixedExpenseValues) => void;
  onRemove: (index: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FixedExpenseForm, unknown, FixedExpenseValues>({
    resolver: zodResolver(fixedExpenseSchema),
    defaultValues: emptyExpense,
  });
  const frequency = useWatch({ control, name: "frequency" });

  function add(values: FixedExpenseValues) {
    onAdd({ ...values, due_day: values.frequency === "monthly" ? values.due_day : null });
    reset(emptyExpense);
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        noValidate
        onSubmit={handleSubmit(add)}
        className="bg-canvas flex flex-col gap-4 rounded-3xl p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="fx-name"
            label="Nombre"
            placeholder="Internet, pasaje…"
            error={errors.name?.message}
            {...register("name")}
          />
          <TextField
            id="fx-amount"
            label="Monto"
            inputMode="decimal"
            placeholder="25.00"
            autoComplete="off"
            error={errors.amount?.message}
            {...register("amount")}
          />
          <SelectField
            id="fx-frequency"
            label="Frecuencia"
            options={frequencyOptions}
            error={errors.frequency?.message}
            {...register("frequency")}
          />
          {frequency === "monthly" ? (
            <TextField
              id="fx-due-day"
              label="Día de pago (opcional)"
              inputMode="numeric"
              placeholder="15"
              error={errors.due_day?.message}
              {...register("due_day")}
            />
          ) : null}
          {frequency === "custom" ? (
            <TextField
              id="fx-days"
              label="Cada cuántos días"
              inputMode="numeric"
              placeholder="10"
              error={errors.custom_period_days?.message}
              {...register("custom_period_days")}
            />
          ) : null}
        </div>
        <button type="submit" className={buttonClass("ink", "md", "self-start")}>
          Agregar gasto fijo
        </button>
      </form>

      {items.length > 0 ? (
        <ul aria-label="Gastos fijos agregados" className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li
              key={`${item.name}-${index}`}
              className="border-line flex items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate font-bold">{item.name}</span>
                <span className="text-muted text-sm font-semibold">
                  {formatMoney(item.amount)} · {FREQUENCY_LABELS[item.frequency]}
                  {item.due_day ? ` · día ${item.due_day}` : ""}
                  {item.custom_period_days ? ` · cada ${item.custom_period_days} días` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="text-muted hover:text-danger grid size-11 shrink-0 cursor-pointer place-items-center rounded-full"
              >
                <Trash2 aria-hidden="true" className="size-5" />
                <span className="sr-only">Quitar {item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-sm">
          Aún no agregas gastos fijos. Si no tienes, puedes continuar.
        </p>
      )}

      <StepActions onBack={onBack}>
        <button type="button" onClick={onNext} className={buttonClass("primary", "lg")}>
          {items.length > 0 ? "Continuar" : "Continuar sin gastos fijos"}
        </button>
      </StepActions>
    </div>
  );
}

// ── Step 3 ──────────────────────────────────────────────

const incomeStepSchema = z
  .object({
    frequency: z.enum(FREQUENCIES as [Frequency, ...Frequency[]]),
    custom_period_days: z.string(),
    label: z.string().trim().max(100),
    // Empty = no regular income; the period still drives the dashboard
    amount: z
      .string()
      .transform(normalizeMoney)
      .pipe(
        z.union([
          z.literal(""),
          z
            .string()
            .regex(/^\d{1,10}(\.\d{1,2})?$/, { error: "Usa solo números, con hasta 2 decimales." })
            .refine((v) => Number(v) > 0, { error: "El monto debe ser mayor que 0." }),
        ]),
      ),
    start_date: z.iso.date({ error: "Elige una fecha válida." }),
  })
  .superRefine((data, ctx) => {
    if (data.frequency !== "custom") return;
    const days = Number(data.custom_period_days);
    if (!Number.isInteger(days) || days < 1 || days > 366) {
      ctx.addIssue({
        code: "custom",
        path: ["custom_period_days"],
        message: "Entre 1 y 366 días.",
      });
    }
  });

export type IncomeStepForm = z.input<typeof incomeStepSchema>;
export type IncomeStepValues = z.output<typeof incomeStepSchema>;

export function IncomeStep({
  initial,
  onBack,
  onNext,
}: {
  initial: IncomeStepForm;
  onBack: () => void;
  onNext: (values: IncomeStepValues) => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<IncomeStepForm, unknown, IncomeStepValues>({
    resolver: zodResolver(incomeStepSchema),
    defaultValues: initial,
  });
  const frequency = useWatch({ control, name: "frequency" });

  return (
    <form noValidate onSubmit={handleSubmit(onNext)} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="inc-frequency"
          label="¿Cada cuánto recibes dinero?"
          options={frequencyOptions}
          error={errors.frequency?.message}
          {...register("frequency")}
        />
        {frequency === "custom" ? (
          <TextField
            id="inc-days"
            label="Cada cuántos días"
            inputMode="numeric"
            placeholder="10"
            error={errors.custom_period_days?.message}
            {...register("custom_period_days")}
          />
        ) : null}
        <TextField
          id="inc-amount"
          label="¿Cuánto recibes cada vez? (opcional)"
          inputMode="decimal"
          placeholder="160.00"
          autoComplete="off"
          hint="Déjalo vacío si no tienes un ingreso fijo."
          error={errors.amount?.message}
          {...register("amount")}
        />
        <TextField
          id="inc-label"
          label="¿De dónde viene?"
          placeholder="Salario, beca, mesada…"
          error={errors.label?.message}
          {...register("label")}
        />
        <TextField
          id="inc-date"
          label="¿Cuándo lo recibes? (última o próxima vez)"
          type="date"
          error={errors.start_date?.message}
          {...register("start_date")}
        />
      </div>
      <p className="text-muted text-sm">
        Esta frecuencia será tu periodo: el dashboard y tu límite de gasto se miden con ella.
      </p>
      <StepActions onBack={onBack}>
        <button type="submit" className={buttonClass("primary", "lg")}>
          Continuar
        </button>
      </StepActions>
    </form>
  );
}

// ── Step 4 ──────────────────────────────────────────────

export function LimitStep({
  initial,
  periodLabel,
  submitting,
  error,
  onBack,
  onFinish,
}: {
  initial: string;
  periodLabel: string;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onFinish: (limit: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof spendingLimitSchema>, unknown, z.output<typeof spendingLimitSchema>>({
    resolver: zodResolver(spendingLimitSchema),
    defaultValues: { spending_limit: initial },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => onFinish(v.spending_limit))}
      className="flex flex-col gap-5"
    >
      {error ? <FormAlert title={error} /> : null}
      <TextField
        id="limit"
        label={`¿Cuánto quieres gastar como máximo por periodo ${periodLabel}? (opcional)`}
        inputMode="decimal"
        placeholder="40.00"
        autoComplete="off"
        hint="Incluye tus gastos fijos. Te avisaremos cuando te pases. Déjalo vacío para no usar límite."
        error={errors.spending_limit?.message}
        {...register("spending_limit")}
      />
      <StepActions onBack={onBack}>
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className={buttonClass("accent", "lg", "font-extrabold")}
        >
          {submitting ? "Guardando…" : "Ver mi dashboard"}
        </button>
      </StepActions>
    </form>
  );
}
