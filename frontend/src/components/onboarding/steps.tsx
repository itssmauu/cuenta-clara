"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { buttonClass } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/FormAlert";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import {
  ACCOUNT_KIND_LABELS,
  ACCOUNT_KINDS,
  accountSchema,
  FREQUENCIES,
  FREQUENCY_LABELS,
  fixedExpenseSchema,
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

const MAX_ACCOUNTS = 10;

const accountsStepSchema = z
  .object({
    accounts: z
      .array(accountSchema.omit({ is_primary: true }))
      .min(1, { error: "Agrega al menos una cuenta." })
      .max(MAX_ACCOUNTS, { error: `Hasta ${MAX_ACCOUNTS} cuentas.` }),
    // Index (as text, from a radio) of the day-to-day account
    primary: z.string(),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.accounts.forEach((account, index) => {
      const key = account.name.trim().toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["accounts", index, "name"],
          message: "Ya usaste ese nombre en otra cuenta.",
        });
      }
      seen.add(key);
    });
  });

export type AccountsStepForm = z.input<typeof accountsStepSchema>;
export type AccountsStepValues = z.output<typeof accountsStepSchema>;

export const FIRST_ACCOUNT: AccountsStepForm["accounts"][number] = {
  name: "Gastos del día",
  kind: "spending",
  initial_balance: "",
};

const kindOptions = ACCOUNT_KINDS.map((kind) => ({
  value: kind,
  label: ACCOUNT_KIND_LABELS[kind],
}));

export function AccountsStep({
  initial,
  onNext,
}: {
  initial: AccountsStepForm;
  onNext: (values: AccountsStepValues) => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<AccountsStepForm, unknown, AccountsStepValues>({
    resolver: zodResolver(accountsStepSchema),
    defaultValues: initial,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "accounts" });
  const primary = useWatch({ control, name: "primary" });

  return (
    <form noValidate onSubmit={handleSubmit(onNext)} className="flex flex-col gap-5">
      <p className="bg-mint-tint text-ink flex items-start gap-2.5 rounded-2xl p-4 text-sm font-semibold">
        <ShieldCheck aria-hidden="true" className="text-mint-ink mt-0.5 size-5 shrink-0" />
        Solo un nombre para reconocer cada cuenta. Nunca te pediremos números de cuenta, tarjetas ni
        claves.
      </p>

      <ul className="flex flex-col gap-4">
        {fields.map((field, index) => {
          const rowErrors = errors.accounts?.[index];
          const isPrimary = primary === String(index);
          return (
            <li key={field.id}>
              <fieldset
                className={`flex flex-col gap-4 rounded-3xl border-2 p-4 transition-colors duration-200 sm:p-5 ${
                  isPrimary ? "border-primary bg-primary-tint/40" : "border-line"
                }`}
              >
                <legend className="px-1 text-sm font-bold">Cuenta {index + 1}</legend>
                <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
                  <TextField
                    id={`account-${index}-name`}
                    label="Nombre"
                    placeholder="Ej. Ahorro, Gastos del día"
                    autoComplete="off"
                    error={rowErrors?.name?.message}
                    {...register(`accounts.${index}.name`)}
                  />
                  <SelectField
                    id={`account-${index}-kind`}
                    label="La uso para"
                    options={kindOptions}
                    {...register(`accounts.${index}.kind`)}
                  />
                  <TextField
                    id={`account-${index}-balance`}
                    label="¿Cuánto tiene hoy?"
                    inputMode="decimal"
                    placeholder="0.00"
                    autoComplete="off"
                    error={rowErrors?.initial_balance?.message}
                    {...register(`accounts.${index}.initial_balance`)}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold">
                    <input
                      type="radio"
                      value={String(index)}
                      className="accent-primary size-5 cursor-pointer"
                      {...register("primary")}
                    />
                    Aquí van mis gastos del día
                  </label>
                  {fields.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={isPrimary}
                      className={buttonClass("ghost", "md", "text-danger")}
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                      Quitar cuenta {index + 1}
                    </button>
                  ) : null}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ul>

      {fields.length < MAX_ACCOUNTS ? (
        <button
          type="button"
          onClick={() => append({ name: "", kind: "savings", initial_balance: "" })}
          className={buttonClass("ghost", "md", "border-line self-start border-2 border-dashed")}
        >
          <Plus aria-hidden="true" className="size-4" strokeWidth={3} />
          Agregar otra cuenta
        </button>
      ) : null}
      <p className="text-muted text-sm">
        Tu cuenta de gastos del día es la principal: el dashboard abre en ella y tu límite de gasto
        se mide ahí. Puedes cambiar todo después en Cuentas.
      </p>
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
    // Index (as text) of the onboarding account the income arrives in
    account_index: z.string(),
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
  accountNames,
  onBack,
  onNext,
}: {
  initial: IncomeStepForm;
  /** Names of the accounts from step 1, in order */
  accountNames: string[];
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
        {accountNames.length > 1 ? (
          <SelectField
            id="inc-account"
            label="¿A qué cuenta te llega?"
            options={accountNames.map((name, index) => ({ value: String(index), label: name }))}
            {...register("account_index")}
          />
        ) : null}
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
