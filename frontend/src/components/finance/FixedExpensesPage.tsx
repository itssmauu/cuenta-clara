"use client";

import { Plus, Repeat } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/app/PageHeader";
import { useSession } from "@/components/app/session";
import { buttonClass } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState, Notice, StatusPill, TableSkeleton, useNotice } from "@/components/ui/Feedback";
import { FormAlert } from "@/components/ui/FormAlert";
import { ApiError } from "@/lib/api";
import { financeApi, type Category, type FixedExpense } from "@/lib/finance-api";
import { formatMoney } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

import { CategoryChip } from "./CategoryChip";
import { frequencyText } from "./IncomesPage";
import { FixedExpenseDialog } from "./RecurringDialogs";
import { RowActions, td, th } from "./RowActions";

export function FixedExpensesPage() {
  const { settings } = useSession();
  const [expenses, reload] = useResource("fixed-expenses", financeApi.listFixedExpenses);
  const [categoryList] = useResource("categories", financeApi.listCategories);
  const [editing, setEditing] = useState<{ item: FixedExpense | null } | null>(null);
  const [deleting, setDeleting] = useState<FixedExpense | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, showNotice] = useNotice();
  const categories = useMemo(
    () => new Map<string, Category>((categoryList.data ?? []).map((c) => [c.id, c])),
    [categoryList.data],
  );

  async function toggle(item: FixedExpense) {
    setError(null);
    try {
      await financeApi.updateFixedExpense(item.id, { ...item, is_active: !item.is_active });
      showNotice(item.is_active ? `«${item.name}» en pausa.` : `«${item.name}» activado.`);
      reload();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "No pudimos actualizar el gasto fijo.",
      );
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await financeApi.deleteFixedExpense(deleting.id);
      showNotice(`«${deleting.name}» eliminado.`);
      reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No pudimos eliminar el gasto fijo.");
    } finally {
      setDeleting(null);
      setBusy(false);
    }
  }

  const items = expenses.data;
  const addButton = (
    <button
      type="button"
      onClick={() => setEditing({ item: null })}
      className={buttonClass("accent", "md", "font-extrabold")}
    >
      <Plus aria-hidden="true" className="size-4" strokeWidth={3} />
      Añadir gasto fijo
    </button>
  );

  return (
    <>
      <PageHeader
        title="Gastos fijos"
        subtitle="Lo que pagas sí o sí cada periodo"
        actions={addButton}
      />
      <Notice message={notice} />
      {error ? <FormAlert title={error} /> : null}

      <section
        aria-labelledby="fixed-title"
        className="flex flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
      >
        <h2 id="fixed-title" className="font-display text-xl font-bold">
          Tus gastos fijos
        </h2>
        {expenses.status === "error" && !items ? (
          <FormAlert title="No pudimos cargar tus gastos fijos." items={[expenses.error.message]} />
        ) : !items ? (
          <TableSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="Aún no registras gastos fijos"
            text="Internet, datos móviles, pasaje, alquiler… Se descuentan solos de tu saldo en cada fecha y cuentan para tu límite."
            action={addButton}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    NOMBRE
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    MONTO
                  </th>
                  <th scope="col" className={th}>
                    FRECUENCIA
                  </th>
                  <th scope="col" className={th}>
                    CATEGORÍA
                  </th>
                  <th scope="col" className={th}>
                    ESTADO
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-line border-t">
                    <th scope="row" className={`${td} text-left font-bold`}>
                      {item.name}
                    </th>
                    <td className={`${td} text-right font-extrabold tabular-nums`}>
                      {formatMoney(item.amount, settings.currency)}
                    </td>
                    <td className={td}>
                      {frequencyText(item)}
                      {item.due_day ? (
                        <span className="text-muted"> · día {item.due_day}</span>
                      ) : null}
                    </td>
                    <td className={td}>
                      <CategoryChip
                        category={item.category_id ? categories.get(item.category_id) : undefined}
                      />
                    </td>
                    <td className={td}>
                      <StatusPill active={item.is_active} />
                    </td>
                    <td className="px-1 py-1">
                      <RowActions
                        label={item.name}
                        active={item.is_active}
                        onToggle={() => toggle(item)}
                        onEdit={() => setEditing({ item })}
                        onDelete={() => setDeleting(item)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <FixedExpenseDialog
        open={editing !== null}
        item={editing?.item ?? null}
        categories={categoryList.data ?? []}
        onClose={() => setEditing(null)}
        onSaved={(message) => {
          showNotice(message);
          reload();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar gasto fijo"
        message={`¿Eliminar «${deleting?.name ?? ""}»? Esta acción no se puede deshacer. Si solo lo dejarás de pagar un tiempo, mejor páusalo.`}
        confirmLabel="Eliminar"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
