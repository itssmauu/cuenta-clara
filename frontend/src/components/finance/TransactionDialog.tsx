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
import { financeApi, type Account, type Category, type Transaction } from "@/lib/finance-api";
import {
  transactionSchema,
  type TransactionForm,
  type TransactionValues,
} from "@/lib/finance-validation";
import { todayISO } from "@/lib/format";

import { accountOptions } from "./accounts-ui";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  categories: Category[];
  /** The user's accounts; with more than one the dialog asks which */
  accounts?: Account[];
  /** Preselected account for a new movement (null = the primary one) */
  defaultAccountId?: string | null;
  /** Present when editing an existing movement */
  transaction?: Transaction | null;
};

/** Create or edit a one-off income or expense. */
export function TransactionDialog({
  open,
  onClose,
  onSaved,
  categories,
  accounts = [],
  defaultAccountId = null,
  transaction,
}: Props) {
  const editing = Boolean(transaction);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Editar movimiento" : "Añadir movimiento"}
      description="Tus ingresos y gastos fijos se registran solos. Aquí anota lo que no se repite."
    >
      <TransactionFormBody
        transaction={transaction ?? null}
        categories={categories}
        accounts={accounts}
        defaultAccountId={defaultAccountId}
        onCancel={onClose}
        onSaved={(message) => {
          onSaved(message);
          onClose();
        }}
      />
    </Dialog>
  );
}

function TransactionFormBody({
  transaction,
  categories,
  accounts,
  defaultAccountId,
  onCancel,
  onSaved,
}: {
  transaction: Transaction | null;
  categories: Category[];
  accounts: Account[];
  defaultAccountId: string | null;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TransactionForm, unknown, TransactionValues>({
    resolver: zodResolver(transactionSchema),
    mode: "onBlur",
    defaultValues: {
      type: transaction?.type ?? "expense",
      amount: transaction?.amount ?? "",
      category_id: transaction?.category_id ?? "",
      occurred_on: transaction?.occurred_on ?? todayISO(),
      note: transaction?.note ?? "",
      account_id:
        transaction?.account_id ?? defaultAccountId ?? accounts.find((a) => a.is_primary)?.id ?? "",
    },
  });
  const type = useWatch({ control, name: "type" });

  async function onSubmit(values: TransactionValues) {
    setServerError(null);
    const payload = {
      ...values,
      category_id: values.type === "expense" ? values.category_id : null,
    };
    try {
      if (transaction) {
        await financeApi.updateTransaction(transaction.id, payload);
        onSaved("Movimiento actualizado.");
      } else {
        await financeApi.createTransaction(payload);
        onSaved("Movimiento guardado.");
      }
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : "No pudimos guardar el movimiento.",
      );
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError ? <FormAlert title={serverError} /> : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold">Tipo</legend>
        <div className="bg-canvas grid grid-cols-2 gap-1.5 rounded-full p-[5px]">
          {(
            [
              ["expense", "Gasto"],
              ["income", "Ingreso"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`has-[:focus-visible]:outline-focus flex min-h-11 cursor-pointer items-center justify-center rounded-full text-[15px] font-bold transition-colors duration-200 has-[:focus-visible]:outline-3 ${
                type === value ? "bg-ink text-white" : "hover:bg-ink/5"
              }`}
            >
              <input type="radio" value={value} className="sr-only" {...register("type")} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <TextField
        id="tx-amount"
        label="Monto"
        inputMode="decimal"
        placeholder="0.00"
        autoComplete="off"
        error={errors.amount?.message}
        {...register("amount")}
      />

      {type === "expense" ? (
        <SelectField
          id="tx-category"
          label="Categoría"
          options={[
            { value: "", label: "Sin categoría" },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          {...register("category_id")}
        />
      ) : null}

      {accounts.length > 1 ? (
        <SelectField
          id="tx-account"
          label={type === "income" ? "¿A qué cuenta llegó?" : "¿De qué cuenta salió?"}
          options={accountOptions(accounts)}
          {...register("account_id")}
        />
      ) : null}

      <TextField
        id="tx-date"
        label="Fecha"
        type="date"
        error={errors.occurred_on?.message}
        {...register("occurred_on")}
      />
      <TextField
        id="tx-note"
        label="Nota (opcional)"
        placeholder="Ej. almuerzo, regalo, taxi"
        error={errors.note?.message}
        {...register("note")}
      />

      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className={buttonClass("ghost")}>
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className={buttonClass("primary", "md", "font-extrabold")}
        >
          {isSubmitting ? "Guardando…" : "Guardar movimiento"}
        </button>
      </div>
    </form>
  );
}
