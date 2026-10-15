"use client";

import { ChevronLeft, ChevronRight, Download, Plus, ReceiptText, SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/app/PageHeader";
import { useSession } from "@/components/app/session";
import { buttonClass } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState, Notice, TableSkeleton, useNotice } from "@/components/ui/Feedback";
import { FormAlert } from "@/components/ui/FormAlert";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { useT } from "@/i18n/client";
import { msg } from "@/i18n/translate";
import { ApiError } from "@/lib/api";
import {
  financeApi,
  type Category,
  type Transaction,
  type TransactionType,
} from "@/lib/finance-api";
import { categoryName } from "@/lib/finance-validation";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { useResource } from "@/lib/use-resource";
import { ScrollRegion } from "@/components/ui/ScrollRegion";

import { accountName } from "./accounts-ui";
import { CategoryChip } from "./CategoryChip";
import { TransactionDialog } from "./TransactionDialog";
import { RowActions, td, th } from "./RowActions";

export const PAGE_SIZE = 20;

type Filters = {
  from: string;
  to: string;
  type: "" | TransactionType;
  categoryId: string;
  accountId: string;
};
const NO_FILTERS: Filters = { from: "", to: "", type: "", categoryId: "", accountId: "" };

export function TransactionsPage() {
  const t = useT();
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
    account_id: filters.accountId || undefined,
    limit: PAGE_SIZE,
    offset,
  };
  const [page, reload] = useResource(`transactions:${JSON.stringify(params)}`, () =>
    financeApi.listTransactions(params),
  );
  const [categoryList] = useResource("categories", financeApi.listCategories);
  const [today] = useState(todayISO);
  const [accountList] = useResource(`accounts:${today}`, () => financeApi.listAccounts(today));
  // Account filter and column only matter with more than one account
  const accounts = accountList.data ?? [];
  const multiAccount = accounts.length > 1;
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
      showNotice(msg("Movimiento eliminado."));
      reload();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : t("No pudimos eliminar el movimiento."),
      );
    } finally {
      setDeleting(null);
      setBusy(false);
    }
  }

  const data = page.data;
  const label = (tx: Transaction) =>
    t("{what} del {date}", {
      what: tx.note ?? (tx.type === "income" ? t("ingreso") : t("gasto")),
      date: formatDate(tx.occurred_on, { day: "numeric", month: "short" }),
    });
  const addButton = (
    <button
      type="button"
      onClick={() => setEditing({ item: null })}
      className={buttonClass("accent", "md", "font-extrabold")}
    >
      <Plus aria-hidden="true" className="size-4" strokeWidth={3} />
      {t("Añadir movimiento")}
    </button>
  );

  return (
    <>
      <PageHeader
        title={t("Gastos")}
        subtitle={t("Todos tus movimientos que no se repiten")}
        actions={
          <>
            {/* Same filters as the table: what you see is what you download */}
            <a
              href={financeApi.exportUrl({
                from: params.from,
                to: params.to,
                type: params.type,
                category_id: params.category_id,
                account_id: params.account_id,
              })}
              download
              className={buttonClass("ghost")}
            >
              <Download aria-hidden="true" className="size-4" />
              {t("Exportar CSV")}
            </a>
            {addButton}
          </>
        }
      />
      <Notice message={notice} />
      {error ? <FormAlert title={error} /> : null}

      <section
        aria-labelledby="transactions-title"
        className="flex flex-col gap-5 rounded-[32px] bg-white p-6 sm:p-7"
      >
        <h2 id="transactions-title" className="font-display text-xl font-bold">
          {t("Movimientos")}
        </h2>

        {/* All filters in one row above the table */}
        <div
          role="group"
          aria-label={t("Filtros")}
          className={`grid gap-3 sm:grid-cols-2 lg:items-end ${
            multiAccount
              ? "lg:grid-cols-[1fr_1fr_1fr_1.2fr_1.2fr_auto]"
              : "lg:grid-cols-[1fr_1fr_1fr_1.3fr_auto]"
          }`}
        >
          <TextField
            id="filter-from"
            label={t("Desde")}
            type="date"
            value={filters.from}
            onChange={(e) => updateFilter({ from: e.target.value })}
          />
          <TextField
            id="filter-to"
            label={t("Hasta")}
            type="date"
            value={filters.to}
            onChange={(e) => updateFilter({ to: e.target.value })}
          />
          <SelectField
            id="filter-type"
            label={t("Tipo")}
            value={filters.type}
            onChange={(e) => updateFilter({ type: e.target.value as Filters["type"] })}
            options={[
              { value: "", label: t("Todos") },
              { value: "expense", label: t("Gastos") },
              { value: "income", label: t("Ingresos") },
            ]}
          />
          <SelectField
            id="filter-category"
            label={t("Categoría")}
            value={filters.categoryId}
            onChange={(e) => updateFilter({ categoryId: e.target.value })}
            options={[
              { value: "", label: t("Todas") },
              ...(categoryList.data ?? []).map((c) => ({
                value: c.id,
                label: categoryName(c.name, t),
              })),
            ]}
          />
          {multiAccount ? (
            <SelectField
              id="filter-account"
              label={t("Cuenta")}
              value={filters.accountId}
              onChange={(e) => updateFilter({ accountId: e.target.value })}
              options={[
                { value: "", label: t("Todas") },
                ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          ) : null}
          <button
            type="button"
            onClick={() => updateFilter(NO_FILTERS)}
            disabled={!filtered}
            className={buttonClass("ghost", "md", "min-h-12")}
          >
            {t("Limpiar filtros")}
          </button>
        </div>

        {page.status === "error" && !data ? (
          <FormAlert title={t("No pudimos cargar tus movimientos.")} items={[page.error.message]} />
        ) : !data ? (
          <TableSkeleton rows={5} />
        ) : data.items.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={SearchX}
              title={t("Ningún movimiento coincide")}
              text={t("Prueba con otras fechas, otro tipo u otra categoría.")}
              action={
                <button
                  type="button"
                  onClick={() => updateFilter(NO_FILTERS)}
                  className={buttonClass("ink")}
                >
                  {t("Limpiar filtros")}
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={ReceiptText}
              title={t("Aún no registras movimientos")}
              text={t(
                "Anota aquí lo que no se repite: un almuerzo, un taxi, un regalo que recibiste. Tus ingresos y gastos fijos se cuentan solos.",
              )}
              action={addButton}
            />
          )
        ) : (
          <>
            <ScrollRegion label={t("Tabla de movimientos")} busy={page.status === "loading"}>
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th scope="col" className={th}>
                      {t("FECHA")}
                    </th>
                    <th scope="col" className={th}>
                      {t("CONCEPTO")}
                    </th>
                    <th scope="col" className={th}>
                      {t("CATEGORÍA")}
                    </th>
                    {multiAccount ? (
                      <th scope="col" className={th}>
                        {t("CUENTA")}
                      </th>
                    ) : null}
                    <th scope="col" className={th}>
                      {t("TIPO")}
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      {t("MONTO")}
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      <span className="sr-only">{t("Acciones")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((tx) => {
                    const income = tx.type === "income";
                    return (
                      <tr key={tx.id} className="border-line border-t">
                        <td className={`${td} text-muted whitespace-nowrap`}>
                          {formatDate(tx.occurred_on, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </td>
                        <th scope="row" className={`${td} text-left font-bold`}>
                          {tx.note ?? (
                            <span className="text-muted font-semibold">{t("Sin nota")}</span>
                          )}
                        </th>
                        <td className={td}>
                          {income ? (
                            <span className="text-muted text-xs">—</span>
                          ) : (
                            <CategoryChip
                              category={tx.category_id ? categories.get(tx.category_id) : undefined}
                            />
                          )}
                        </td>
                        {multiAccount ? (
                          <td className={`${td} text-body`}>
                            {accountName(accounts, tx.account_id)}
                          </td>
                        ) : null}
                        <td className={td}>{income ? t("Ingreso") : t("Gasto")}</td>
                        <td
                          className={`${td} text-right font-extrabold whitespace-nowrap tabular-nums ${
                            income ? "text-mint-ink" : ""
                          }`}
                        >
                          {income ? "+" : "−"}
                          {formatMoney(tx.amount, settings.currency)}
                        </td>
                        <td className="px-1 py-1">
                          <RowActions
                            label={label(tx)}
                            onEdit={() => setEditing({ item: tx })}
                            onDelete={() => setDeleting(tx)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollRegion>

            <nav
              aria-label={t("Paginación")}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-muted text-sm font-semibold" aria-live="polite">
                {t("Mostrando {from}–{to} de {total}", {
                  from: data.offset + 1,
                  to: data.offset + data.items.length,
                  total: data.total,
                })}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                  className={buttonClass("ghost")}
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                  {t("Anterior")}
                </button>
                <button
                  type="button"
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={data.offset + data.items.length >= data.total}
                  className={buttonClass("ghost")}
                >
                  {t("Siguiente")}
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
        accounts={accounts}
        defaultAccountId={filters.accountId || null}
        onClose={() => setEditing(null)}
        onSaved={(message) => {
          showNotice(message);
          reload();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={t("Eliminar movimiento")}
        message={
          deleting?.note
            ? t("¿Eliminar este movimiento («{note}»)? Esta acción no se puede deshacer.", {
                note: deleting.note,
              })
            : t("¿Eliminar este movimiento? Esta acción no se puede deshacer.")
        }
        confirmLabel={t("Eliminar")}
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
