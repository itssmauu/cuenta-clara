"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/Dialog";
import { FormAlert } from "@/components/ui/FormAlert";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { useT } from "@/i18n/client";
import { msg } from "@/i18n/translate";
import { ApiError } from "@/lib/api";
import {
  financeApi,
  type Account,
  type Category,
  type FixedExpense,
  type Income,
} from "@/lib/finance-api";
import {
  categoryName,
  fixedExpenseFormSchema,
  type FixedExpenseFullForm,
  type FixedExpenseFullValues,
  FREQUENCIES,
  FREQUENCY_LABELS,
  type IncomeForm,
  incomeSchema,
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
  const t = useT();
  return (
    <div className="flex flex-wrap justify-end gap-3">
      <button type="button" onClick={onCancel} className={buttonClass("ghost")}>
        {t("Cancelar")}
      </button>
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className={buttonClass("primary", "md", "font-extrabold")}
      >
        {submitting ? t("Guardando…") : label}
      </button>
    </div>
  );
}

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

// ── Incomes ─────────────────────────────────────────────

export function IncomeDialog({ open, item, onClose, onSaved, accounts = [] }: DialogProps<Income>) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={item ? t("Editar ingreso") : t("Añadir ingreso")}>
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
  const t = useT();
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
        onSaved(msg("Ingreso actualizado."));
      } else {
        await financeApi.createIncome(values);
        onSaved(msg("Ingreso guardado."));
      }
    } catch (error) {
      setServerError(apiMessage(error, msg("No pudimos guardar el ingreso.")));
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError ? <FormAlert title={serverError} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="income-label"
          label={t("Concepto")}
          placeholder={t("Salario, beca…")}
          error={errors.label?.message}
          {...register("label")}
        />
        <TextField
          id="income-amount"
          label={t("Monto")}
          inputMode="decimal"
          placeholder="160.00"
          autoComplete="off"
          error={errors.amount?.message}
          {...register("amount")}
        />
        <SelectField
          id="income-frequency"
          label={t("Frecuencia")}
          options={frequencyOptions}
          error={errors.frequency?.message}
          {...register("frequency")}
        />
        {frequency === "custom" ? (
          <TextField
            id="income-days"
            label={t("Cada cuántos días")}
            inputMode="numeric"
            placeholder="10"
            error={errors.custom_period_days?.message}
            {...register("custom_period_days")}
          />
        ) : null}
        <TextField
          id="income-start"
          label={t("Fecha de referencia")}
          type="date"
          hint={t(
            "Un día en que lo recibiste o lo recibirás. Las repeticiones se cuentan desde ahí.",
          )}
          error={errors.start_date?.message}
          {...register("start_date")}
        />
        {accounts.length > 1 ? (
          <SelectField
            id="income-account"
            label={t("¿A qué cuenta llega?")}
            options={accountOptions(accounts, t)}
            {...register("account_id")}
          />
        ) : null}
      </div>
      <FormFooter submitting={isSubmitting} onCancel={onCancel} label={t("Guardar ingreso")} />
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
  const t = useT();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={item ? t("Editar gasto fijo") : t("Añadir gasto fijo")}
    >
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
  const t = useT();
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
        onSaved(msg("Gasto fijo actualizado."));
      } else {
        await financeApi.createFixedExpense(payload);
        onSaved(msg("Gasto fijo guardado."));
      }
    } catch (error) {
      setServerError(apiMessage(error, msg("No pudimos guardar el gasto fijo.")));
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError ? <FormAlert title={serverError} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="fixed-name"
          label={t("Nombre")}
          placeholder={t("Internet, pasaje…")}
          error={errors.name?.message}
          {...register("name")}
        />
        <TextField
          id="fixed-amount"
          label={t("Monto")}
          inputMode="decimal"
          placeholder="25.00"
          autoComplete="off"
          error={errors.amount?.message}
          {...register("amount")}
        />
        <SelectField
          id="fixed-frequency"
          label={t("Frecuencia")}
          options={frequencyOptions}
          error={errors.frequency?.message}
          {...register("frequency")}
        />
        {frequency === "monthly" ? (
          <TextField
            id="fixed-due-day"
            label={t("Día de pago (opcional)")}
            inputMode="numeric"
            placeholder="15"
            error={errors.due_day?.message}
            {...register("due_day")}
          />
        ) : null}
        {frequency === "custom" ? (
          <TextField
            id="fixed-days"
            label={t("Cada cuántos días")}
            inputMode="numeric"
            placeholder="10"
            error={errors.custom_period_days?.message}
            {...register("custom_period_days")}
          />
        ) : null}
        <SelectField
          id="fixed-category"
          label={t("Categoría")}
          options={[
            { value: "", label: t("Sin categoría") },
            ...categories.map((c) => ({ value: c.id, label: categoryName(c.name, t) })),
          ]}
          {...register("category_id")}
        />
        <TextField
          id="fixed-start"
          label={t("Aplica desde")}
          type="date"
          error={errors.start_date?.message}
          {...register("start_date")}
        />
        {accounts.length > 1 ? (
          <SelectField
            id="fixed-account"
            label={t("¿De qué cuenta sale?")}
            options={accountOptions(accounts, t)}
            {...register("account_id")}
          />
        ) : null}
      </div>
      <FormFooter submitting={isSubmitting} onCancel={onCancel} label={t("Guardar gasto fijo")} />
    </form>
  );
}
