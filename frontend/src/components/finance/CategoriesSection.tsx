"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { buttonClass } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { TableSkeleton } from "@/components/ui/Feedback";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import { ApiError } from "@/lib/api";
import { financeApi, type Category } from "@/lib/finance-api";
import { categorySchema, type CategoryValues } from "@/lib/finance-validation";
import { useResource } from "@/lib/use-resource";

import { CategoryChip } from "./CategoryChip";
import { RowActions } from "./RowActions";

const DEFAULT_COLOR = "#5B4BDB";

export function CategoriesSection({ onNotice }: { onNotice: (message: string) => void }) {
  const [categories, reload] = useResource("categories", financeApi.listCategories);
  const [editing, setEditing] = useState<{ item: Category | null } | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await financeApi.deleteCategory(deleting.id);
      onNotice(`Categoría «${deleting.name}» eliminada.`);
      reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No pudimos eliminar la categoría.");
    } finally {
      setDeleting(null);
      setBusy(false);
    }
  }

  const items = categories.data;
  const defaults = items?.filter((c) => c.is_default) ?? [];
  const own = items?.filter((c) => !c.is_default) ?? [];

  return (
    <section
      aria-labelledby="categories-title"
      className="flex flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="categories-title" className="font-display text-xl font-bold">
          Categorías
        </h2>
        <button
          type="button"
          onClick={() => setEditing({ item: null })}
          className={buttonClass("ink")}
        >
          Nueva categoría
        </button>
      </div>
      {error ? <FormAlert title={error} /> : null}

      {!items ? (
        <TableSkeleton rows={2} />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h3 className="text-muted flex items-center gap-1.5 text-sm font-bold">
              <Lock aria-hidden="true" className="size-4" />
              Predeterminadas (no se pueden editar)
            </h3>
            <ul className="flex flex-wrap gap-2">
              {defaults.map((c) => (
                <li key={c.id}>
                  <CategoryChip category={c} />
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-muted text-sm font-bold">Tus categorías</h3>
            {own.length === 0 ? (
              <p className="text-body text-sm">Aún no creas categorías propias.</p>
            ) : (
              <ul className="flex flex-col">
                {own.map((c) => (
                  <li
                    key={c.id}
                    className="border-line flex items-center justify-between gap-3 border-t py-1"
                  >
                    <CategoryChip category={c} />
                    <RowActions
                      label={`la categoría ${c.name}`}
                      onEdit={() => setEditing({ item: c })}
                      onDelete={() => setDeleting(c)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.item ? "Editar categoría" : "Nueva categoría"}
      >
        <CategoryForm
          item={editing?.item ?? null}
          onCancel={() => setEditing(null)}
          onSaved={(message) => {
            onNotice(message);
            setEditing(null);
            reload();
          }}
        />
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar categoría"
        message={`¿Eliminar «${deleting?.name ?? ""}»? Los movimientos y gastos fijos que la usan se conservan, pero quedarán sin categoría.`}
        confirmLabel="Eliminar"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}

function CategoryForm({
  item,
  onCancel,
  onSaved,
}: {
  item: Category | null;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: item?.name ?? "", color: item?.color ?? DEFAULT_COLOR },
  });

  async function onSubmit(values: CategoryValues) {
    setServerError(null);
    try {
      if (item) {
        await financeApi.updateCategory(item.id, values);
        onSaved("Categoría actualizada.");
      } else {
        await financeApi.createCategory(values);
        onSaved("Categoría creada.");
      }
    } catch (error) {
      // e.g. 409 "Ya tienes una categoría con ese nombre."
      setServerError(
        error instanceof ApiError ? error.message : "No pudimos guardar la categoría.",
      );
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError ? <FormAlert title={serverError} /> : null}
      <TextField
        id="category-name"
        label="Nombre"
        placeholder="Gimnasio, mascotas…"
        error={errors.name?.message}
        {...register("name")}
      />
      <div className="flex flex-col gap-2">
        <label htmlFor="category-color" className="text-sm font-bold">
          Color
        </label>
        <input
          id="category-color"
          type="color"
          className="rounded-field border-field h-12 w-24 cursor-pointer border-2 bg-white p-1"
          {...register("color")}
        />
      </div>
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
          {isSubmitting ? "Guardando…" : "Guardar categoría"}
        </button>
      </div>
    </form>
  );
}
