"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { PERIOD_NOUN } from "@/components/dashboard/period-labels";
import { buttonClass } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import { useT } from "@/i18n/client";
import { ApiError } from "@/lib/api";
import { financeApi, type Frequency } from "@/lib/finance-api";
import {
  budgetCategorySchema,
  type BudgetCategoryForm,
  type BudgetCategoryValues,
} from "@/lib/finance-validation";

const DEFAULT_COLOR = "#5B4BDB";

/**
 * Creates one of the user's own categories from the budget page, with its budget if
 * given. It is a normal category: it shows up wherever categories are chosen (expenses,
 * fixed expenses, Configuración), so it never has to be created twice.
 */
export function NewBudgetCategoryForm({
  incomePeriod,
  onCancel,
  onSaved,
}: {
  incomePeriod: Frequency;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const t = useT();
  const [serverError, setServerError] = useState<string | null>(null);
  const per = t(PERIOD_NOUN[incomePeriod]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BudgetCategoryForm, unknown, BudgetCategoryValues>({
    resolver: zodResolver(budgetCategorySchema),
    defaultValues: { name: "", color: DEFAULT_COLOR, amount: "" },
  });

  async function onSubmit({ name, color, amount }: BudgetCategoryValues) {
    setServerError(null);
    let created;
    try {
      created = await financeApi.createCategory({ name, color });
    } catch (error) {
      // e.g. 409 "Ya tienes una categoría con ese nombre."
      setServerError(
        error instanceof ApiError ? error.message : t("No pudimos crear la categoría."),
      );
      return;
    }
    if (!amount) {
      onSaved(
        t("Categoría «{name}» creada. Ya puedes usarla en tus gastos.", { name: created.name }),
      );
      return;
    }
    try {
      await financeApi.setBudget(created.id, amount);
      onSaved(t("Categoría «{name}» creada con su presupuesto.", { name: created.name }));
    } catch {
      // The category exists either way: say so, and let the user set the amount in the list
      onSaved(
        t(
          "Categoría «{name}» creada, pero no pudimos guardar su presupuesto. Ponlo desde la lista.",
          { name: created.name },
        ),
      );
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError ? <FormAlert title={serverError} /> : null}
      <TextField
        id="new-category-name"
        label={t("Nombre de la categoría")}
        placeholder={t("Gimnasio, mascotas, universidad…")}
        error={errors.name?.message}
        {...register("name")}
      />
      <div className="flex flex-col gap-2">
        <label htmlFor="new-category-color" className="text-sm font-bold">
          {t("Color")}
        </label>
        <input
          id="new-category-color"
          type="color"
          className="rounded-field border-field h-12 w-24 cursor-pointer border-2 bg-white p-1"
          {...register("color")}
        />
      </div>
      <TextField
        id="new-category-amount"
        label={t("Presupuesto por {per} (opcional)", { per })}
        inputMode="decimal"
        autoComplete="off"
        placeholder="25.00"
        hint={t("Puedes dejarlo vacío y ponerlo después.")}
        error={errors.amount?.message}
        {...register("amount")}
      />
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className={buttonClass("ghost")}>
          {t("Cancelar")}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className={buttonClass("primary")}
        >
          {isSubmitting ? t("Creando…") : t("Crear categoría")}
        </button>
      </div>
    </form>
  );
}
