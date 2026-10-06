"use client";

import { ChevronLeft, ChevronRight, Plus, ReceiptText, SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/app/PageHeader";
import { useSession } from "@/components/app/session";
import { buttonClass } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState, Notice, TableSkeleton, useNotice } from "@/components/ui/Feedback";
import { FormAlert } from "@/components/ui/FormAlert";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { ApiError } from "@/lib/api";
import {
  financeApi,
  type Category,
  type Transaction,
  type TransactionType,
} from "@/lib/finance-api";
import { formatDate, formatMoney } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

import { CategoryChip } from "./CategoryChip";
import { TransactionDialog } from "./TransactionDialog";
import { RowActions, td, th } from "./RowActions";

export const PAGE_SIZE = 20;

type Filters = { from: string; to: string; type: "" | TransactionType; categoryId: string };
const NO_FILTERS: Filters = { from: "", to: "", type: "", categoryId: "" };

export function TransactionsPage() {
  const { settings } = useSession();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<{ item: Transaction | null } | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, showNotice] = useNotice();

  const params = {
    from: filters.from || undefined,
    to: filters.to || undefined,
    type: filters.type || undefined,
    category_id: filters.categoryId || undefined,
    limit: PAGE_SIZE,
    offset,
  };
  const [page, reload] = useResource(`transactions:${JSON.stringify(params)}`, () =>
    financeApi.listTransactions(params),
  );
  const [categoryList] = useResource("categories", financeApi.listCategories);
  const categories = useMemo(
    () => new Map<string, Category>((categoryList.data ?? []).map((c) => [c.id, c])),
    [categoryList.data],
  );

  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);
  // Any filter change starts again from the first page
  function updateFilter(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setOffset(0);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await financeApi.deleteTransaction(deleting.id);
      showNotice("Movimiento eliminado.");
      reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No pudimos eliminar el movimiento.");
    } finally {
      setDeleting(null);
      setBusy(false);
    }
  }

  const data = page.data;
  const label = (t: Transaction) =>
    `${t.note ?? (t.type === "income" ? "ingreso" : "gasto")} del ${formatDate(t.occurred_on, {
      day: "numeric",
      month: "short",
    })}`;
  const addButton = (
    <button
      type="button"
      onClick={() => setEditing({ item: null })}
      className={buttonClass("accent", "md", "font-extrabold")}
    >
      <Plus aria-hidden="true" className="size-4" strokeWidth={3} />
      Añadir movimiento
    </button>
  );

  return (
    <>
      <PageHeader
        title="Gastos"
        subtitle="Todos tus movimientos que no se repiten"
        actions={addButton}
      />
      <Notice message={notice} />
      {error ? <FormAlert title={error} /> : null}

      <section
        aria-labelledby="transactions-title"
        className="flex flex-col gap-5 rounded-[32px] bg-white p-6 sm:p-7"
      >
        <h2 id="transactions-title" className="font-display text-xl font-bold">
          Movimientos
        </h2>

        {/* All filters in one row above the table */}
        <div
          role="group"
          aria-label="Filtros"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.3fr_auto] lg:items-end"
        >
          <TextField
            id="filter-from"
            label="Desde"
            type="date"
            value={filters.from}
            onChange={(e) => updateFilter({ from: e.target.value })}
          />
          <TextField
            id="filter-to"
            label="Hasta"
            type="date"
            value={filters.to}
            onChange={(e) => updateFilter({ to: e.target.value })}
          />
          <SelectField
            id="filter-type"
            label="Tipo"
            value={filters.type}
            onChange={(e) => updateFilter({ type: e.target.value as Filters["type"] })}
            options={[
              { value: "", label: "Todos" },
              { value: "expense", label: "Gastos" },
              { value: "income", label: "Ingresos" },
            ]}
          />
          <SelectField
            id="filter-category"
            label="Categoría"
            value={filters.categoryId}
            onChange={(e) => updateFilter({ categoryId: e.target.value })}
            options={[
              { value: "", label: "Todas" },
              ...(categoryList.data ?? []).map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <button
            type="button"
            onClick={() => updateFilter(NO_FILTERS)}
            disabled={!filtered}
            className={buttonClass("ghost", "md", "min-h-12")}
          >
            Limpiar filtros
          </button>
        </div>

        {page.status === "error" && !data ? (
          <FormAlert title="No pudimos cargar tus movimientos." items={[page.error.message]} />
        ) : !data ? (
          <TableSkeleton rows={5} />
        ) : data.items.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={SearchX}
              title="Ningún movimiento coincide"
              text="Prueba con otras fechas, otro tipo u otra categoría."
              action={
                <button
                  type="button"
                  onClick={() => updateFilter(NO_FILTERS)}
                  className={buttonClass("ink")}
                >
                  Limpiar filtros
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={ReceiptText}
              title="Aún no registras movimientos"
              text="Anota aquí lo que no se repite: un almuerzo, un taxi, un regalo que recibiste. Tus ingresos y gastos fijos se cuentan solos."
              action={addButton}
            />
          )
        ) : (
          <>
            <div className="overflow-x-auto" aria-busy={page.status === "loading"}>
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th scope="col" className={th}>
                      FECHA
                    </th>
                    <th scope="col" className={th}>
                      CONCEPTO
                    </th>
                    <th scope="col" className={th}>
                      CATEGORÍA
                    </th>
                    <th scope="col" className={th}>
                      TIPO
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      MONTO
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((t) => {
                    const income = t.type === "income";
                    return (
                      <tr key={t.id} className="border-line border-t">
                        <td className={`${td} text-muted whitespace-nowrap`}>
                          {formatDate(t.occurred_on, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </td>
                        <th scope="row" className={`${td} text-left font-bold`}>
                          {t.note ?? <span className="text-muted font-semibold">Sin nota</span>}
                        </th>
                        <td className={td}>
                          {income ? (
                            <span className="text-muted text-xs">—</span>
                          ) : (
                            <CategoryChip
                              category={t.category_id ? categories.get(t.category_id) : undefined}
                            />
                          )}
                        </td>
                        <td className={td}>{income ? "Ingreso" : "Gasto"}</td>
                        <td
                          className={`${td} text-right font-extrabold whitespace-nowrap tabular-nums ${
                            income ? "text-mint-ink" : ""
                          }`}
                        >
                          {income ? "+" : "−"}
                          {formatMoney(t.amount, settings.currency)}
                        </td>
                        <td className="px-1 py-1">
                          <RowActions
                            label={label(t)}
                            onEdit={() => setEditing({ item: t })}
                            onDelete={() => setDeleting(t)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <nav
              aria-label="Paginación"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-muted text-sm font-semibold" aria-live="polite">
                Mostrando {data.offset + 1}–{data.offset + data.items.length} de {data.total}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                  className={buttonClass("ghost")}
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={data.offset + data.items.length >= data.total}
                  className={buttonClass("ghost")}
                >
                  Siguiente
                  <ChevronRight aria-hidden="true" className="size-4" />
                </button>
              </div>
            </nav>
          </>
        )}
      </section>

      <TransactionDialog
        open={editing !== null}
        transaction={editing?.item ?? null}
        categories={categoryList.data ?? []}
        onClose={() => setEditing(null)}
        onSaved={(message) => {
          showNotice(message);
          reload();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar movimiento"
        message={`¿Eliminar este movimiento${deleting?.note ? ` («${deleting.note}»)` : ""}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
