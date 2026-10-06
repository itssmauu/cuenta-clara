"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { buttonClass } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import { ApiError } from "@/lib/api";
import { financeApi, type Category } from "@/lib/finance-api";
import {
  transactionSchema,
  type TransactionForm,
  type TransactionValues,
} from "@/lib/finance-validation";
import { todayISO } from "@/lib/format";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: Category[];
};

const selectClass =
  "rounded-field border-field hover:border-primary-soft text-ink min-h-12 w-full border-2 bg-white px-4 text-[15px]";

/** "Añadir movimiento": a one-off income or expense. Native <dialog> handles focus and Esc. */
export function AddTransactionDialog({ open, onClose, onSaved, categories }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TransactionForm, unknown, TransactionValues>({
    resolver: zodResolver(transactionSchema),
    mode: "onBlur",
    defaultValues: {
      type: "expense",
      amount: "",
      category_id: "",
      occurred_on: todayISO(),
      note: "",
    },
  });
  const type = useWatch({ control, name: "type" });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      reset({ type: "expense", amount: "", category_id: "", occurred_on: todayISO(), note: "" });
      setServerError(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, reset]);

  async function onSubmit(values: TransactionValues) {
    setServerError(null);
    try {
      await financeApi.createTransaction({
        ...values,
        category_id: values.type === "expense" ? values.category_id : null,
      });
      onSaved();
      onClose();
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : "No pudimos guardar el movimiento.",
      );
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="add-transaction-title"
      className="backdrop:bg-ink/60 m-auto w-[min(520px,calc(100vw-24px))] rounded-[28px] p-0"
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="add-transaction-title" className="font-display text-2xl font-extrabold">
              Añadir movimiento
            </h2>
            <p className="text-muted text-sm">
              Tus ingresos y gastos fijos se registran solos. Aquí anota lo que no se repite.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hover:bg-canvas grid size-11 shrink-0 cursor-pointer place-items-center rounded-full"
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

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
          <div className="flex flex-col gap-2">
            <label htmlFor="tx-category" className="text-sm font-bold">
              Categoría
            </label>
            <select id="tx-category" className={selectClass} {...register("category_id")}>
              <option value="">Sin categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
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
          <button type="button" onClick={onClose} className={buttonClass("ghost")}>
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
    </dialog>
  );
}
