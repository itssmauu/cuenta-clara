"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/Dialog";
import { FormAlert } from "@/components/ui/FormAlert";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { ApiError } from "@/lib/api";
import {
  financeApi,
  type Account,
  type Category,
  type FixedExpense,
  type Income,
} from "@/lib/finance-api";
import {
  FREQUENCIES,
  FREQUENCY_LABELS,
  fixedExpenseFormSchema,
  incomeSchema,
  type FixedExpenseFullForm,
  type FixedExpenseFullValues,
  type IncomeForm,
  type IncomeValues,
} from "@/lib/finance-validation";
import { todayISO } from "@/lib/format";

import { accountOptions } from "./accounts-ui";

const frequencyOptions = FREQUENCIES.map((value) => ({ value, label: FREQUENCY_LABELS[value] }));

type DialogProps<T> = {
  open: boolean;
  item: T | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  /** With more than one account the dialog asks which one */
  accounts?: Account[];
};

/** The account to preselect: the item's own, or the primary one. */
function initialAccount(accounts: Account[], current: string | undefined): string {
  return current ?? accounts.find((a) => a.is_primary)?.id ?? "";
}

function FormFooter({
  submitting,
  onCancel,
  label,
}: {
  submitting: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-3">
      <button type="button" onClick={onCancel} className={buttonClass("ghost")}>
        Cancelar
      </button>
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className={buttonClass("primary", "md", "font-extrabold")}
      >
        {submitting ? "Guardando…" : label}
      </button>
    </div>
  );
}

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

// ── Incomes ─────────────────────────────────────────────

export function IncomeDialog({ open, item, onClose, onSaved, accounts = [] }: DialogProps<Income>) {
  return (
    <Dialog open={open} onClose={onClose} title={item ? "Editar ingreso" : "Añadir ingreso"}>
      <IncomeFormBody
        item={item}
        accounts={accounts}
        onCancel={onClose}
        onSaved={(m) => {
          onSaved(m);
          onClose();
        }}
      />
    </Dialog>
  );
}

function IncomeFormBody({
  item,
  accounts,
  onCancel,
  onSaved,
}: {
  item: Income | null;
  accounts: Account[];
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<IncomeForm, unknown, IncomeValues>({
    resolver: zodResolver(incomeSchema),
    mode: "onBlur",
    defaultValues: {
      label: item?.label ?? "",
      amount: item?.amount ?? "",
      frequency: item?.frequency ?? "monthly",
      custom_period_days: item?.custom_period_days ? String(item.custom_period_days) : "",
      start_date: item?.start_date ?? todayISO(),
      account_id: initialAccount(accounts, item?.account_id),
    },
  });
  const frequency = useWatch({ control, name: "frequency" });

  async function onSubmit(values: IncomeValues) {
    setServerError(null);
    try {
      if (item) {
        await financeApi.updateIncome(item.id, { ...values, is_active: item.is_active });
        onSaved("Ingreso actualizado.");
      } else {
        await financeApi.createIncome(values);
        onSaved("Ingreso guardado.");
      }
    } catch (error) {
      setServerError(apiMessage(error, "No pudimos guardar el ingreso."));
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError ? <FormAlert title={serverError} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="income-label"
          label="Concepto"
          placeholder="Salario, beca…"
          error={errors.label?.message}
          {...register("label")}
        />
        <TextField
          id="income-amount"
          label="Monto"
          inputMode="decimal"
          placeholder="160.00"
          autoComplete="off"
          error={errors.amount?.message}
          {...register("amount")}
        />
        <SelectField
          id="income-frequency"
          label="Frecuencia"
          options={frequencyOptions}
          error={errors.frequency?.message}
          {...register("frequency")}
        />
        {frequency === "custom" ? (
          <TextField
            id="income-days"
            label="Cada cuántos días"
            inputMode="numeric"
            placeholder="10"
            error={errors.custom_period_days?.message}
            {...register("custom_period_days")}
          />
        ) : null}
        <TextField
          id="income-start"
          label="Fecha de referencia"
          type="date"
          hint="Un día en que lo recibiste o lo recibirás. Las repeticiones se cuentan desde ahí."
          error={errors.start_date?.message}
          {...register("start_date")}
        />
        {accounts.length > 1 ? (
          <SelectField
            id="income-account"
            label="¿A qué cuenta llega?"
            options={accountOptions(accounts)}
            {...register("account_id")}
          />
        ) : null}
      </div>
      <FormFooter submitting={isSubmitting} onCancel={onCancel} label="Guardar ingreso" />
    </form>
  );
}

// ── Fixed expenses ──────────────────────────────────────

export function FixedExpenseDialog({
  open,
  item,
  onClose,
  onSaved,
  categories,
  accounts = [],
}: DialogProps<FixedExpense> & { categories: Category[] }) {
  return (
    <Dialog open={open} onClose={onClose} title={item ? "Editar gasto fijo" : "Añadir gasto fijo"}>
      <FixedExpenseFormBody
        item={item}
        categories={categories}
        accounts={accounts}
        onCancel={onClose}
        onSaved={(m) => {
          onSaved(m);
          onClose();
        }}
      />
    </Dialog>
  );
}

function FixedExpenseFormBody({
  item,
  categories,
  accounts,
  onCancel,
  onSaved,
}: {
  item: FixedExpense | null;
  categories: Category[];
  accounts: Account[];
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FixedExpenseFullForm, unknown, FixedExpenseFullValues>({
    resolver: zodResolver(fixedExpenseFormSchema),
    mode: "onBlur",
    defaultValues: {
      name: item?.name ?? "",
      amount: item?.amount ?? "",
      frequency: item?.frequency ?? "monthly",
      custom_period_days: item?.custom_period_days ? String(item.custom_period_days) : "",
      due_day: item?.due_day ? String(item.due_day) : "",
      start_date: item?.start_date ?? todayISO(),
      category_id: item?.category_id ?? "",
      account_id: initialAccount(accounts, item?.account_id),
    },
  });
  const frequency = useWatch({ control, name: "frequency" });

  async function onSubmit(values: FixedExpenseFullValues) {
    setServerError(null);
    const payload = { ...values, due_day: values.frequency === "monthly" ? values.due_day : null };
    try {
      if (item) {
        await financeApi.updateFixedExpense(item.id, { ...payload, is_active: item.is_active });
        onSaved("Gasto fijo actualizado.");
      } else {
        await financeApi.createFixedExpense(payload);
        onSaved("Gasto fijo guardado.");
      }
    } catch (error) {
      setServerError(apiMessage(error, "No pudimos guardar el gasto fijo."));
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError ? <FormAlert title={serverError} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="fixed-name"
          label="Nombre"
          placeholder="Internet, pasaje…"
          error={errors.name?.message}
          {...register("name")}
        />
        <TextField
          id="fixed-amount"
          label="Monto"
          inputMode="decimal"
          placeholder="25.00"
          autoComplete="off"
          error={errors.amount?.message}
          {...register("amount")}
        />
        <SelectField
          id="fixed-frequency"
          label="Frecuencia"
          options={frequencyOptions}
          error={errors.frequency?.message}
          {...register("frequency")}
        />
        {frequency === "monthly" ? (
          <TextField
            id="fixed-due-day"
            label="Día de pago (opcional)"
            inputMode="numeric"
            placeholder="15"
            error={errors.due_day?.message}
            {...register("due_day")}
          />
        ) : null}
        {frequency === "custom" ? (
          <TextField
            id="fixed-days"
            label="Cada cuántos días"
            inputMode="numeric"
            placeholder="10"
            error={errors.custom_period_days?.message}
            {...register("custom_period_days")}
          />
        ) : null}
        <SelectField
          id="fixed-category"
          label="Categoría"
          options={[
            { value: "", label: "Sin categoría" },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          {...register("category_id")}
        />
        <TextField
          id="fixed-start"
          label="Aplica desde"
          type="date"
          error={errors.start_date?.message}
          {...register("start_date")}
        />
        {accounts.length > 1 ? (
          <SelectField
            id="fixed-account"
            label="¿De qué cuenta sale?"
            options={accountOptions(accounts)}
            {...register("account_id")}
          />
        ) : null}
      </div>
      <FormFooter submitting={isSubmitting} onCancel={onCancel} label="Guardar gasto fijo" />
    </form>
  );
}
