"use client";

import { Plus, Repeat } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/app/PageHeader";
import { useSession } from "@/components/app/session";
import { buttonClass } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState, Notice, StatusPill, TableSkeleton, useNotice } from "@/components/ui/Feedback";
import { FormAlert } from "@/components/ui/FormAlert";
import { useT } from "@/i18n/client";
import { ApiError } from "@/lib/api";
import {
  financeApi,
  fixedExpensePayload,
  type Category,
  type FixedExpense,
} from "@/lib/finance-api";
import { formatMoney, todayISO } from "@/lib/format";
import { useResource } from "@/lib/use-resource";
import { ScrollRegion } from "@/components/ui/ScrollRegion";

import { CategoryChip } from "./CategoryChip";
import { frequencyText } from "./IncomesPage";
import { FixedExpenseDialog } from "./RecurringDialogs";
import { accountName } from "./accounts-ui";
import { RowActions, td, th } from "./RowActions";

export function FixedExpensesPage() {
  const t = useT();
  const { settings } = useSession();
  const [expenses, reload] = useResource("fixed-expenses", financeApi.listFixedExpenses);
  const [categoryList] = useResource("categories", financeApi.listCategories);
  const [today] = useState(todayISO);
  const [accountList] = useResource(`accounts:${today}`, () => financeApi.listAccounts(today));
  // Which account each item uses only matters with more than one
  const accounts = accountList.data ?? [];
  const multiAccount = accounts.length > 1;
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
      await financeApi.updateFixedExpense(
        item.id,
        fixedExpensePayload(item, { is_active: !item.is_active }),
      );
      showNotice(
        item.is_active
          ? t("«{name}» en pausa.", { name: item.name })
          : t("«{name}» activado.", { name: item.name }),
      );
      reload();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : t("No pudimos actualizar el gasto fijo."),
      );
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await financeApi.deleteFixedExpense(deleting.id);
      showNotice(t("«{name}» eliminado.", { name: deleting.name }));
      reload();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : t("No pudimos eliminar el gasto fijo."),
      );
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
      {t("Añadir gasto fijo")}
    </button>
  );

  return (
    <>
      <PageHeader
        title={t("Gastos fijos")}
        subtitle={t(
          "Lo que pagas cada periodo. El día que toca, te preguntamos si lo pagaste: solo entonces se descuenta",
        )}
        actions={addButton}
      />
      <Notice message={notice} />
      {error ? <FormAlert title={error} /> : null}

      <section
        aria-labelledby="fixed-title"
        className="flex flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
      >
        <h2 id="fixed-title" className="font-display text-xl font-bold">
          {t("Tus gastos fijos")}
        </h2>
        {expenses.status === "error" && !items ? (
          <FormAlert
            title={t("No pudimos cargar tus gastos fijos.")}
            items={[expenses.error.message]}
          />
        ) : !items ? (
          <TableSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title={t("Aún no registras gastos fijos")}
            text={t(
              "Internet, datos móviles, pasaje, alquiler… Se descuentan solos de tu saldo en cada fecha y cuentan para tu límite.",
            )}
            action={addButton}
          />
        ) : (
          <ScrollRegion label={t("Tabla de gastos fijos")}>
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    {t("NOMBRE")}
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    {t("MONTO")}
                  </th>
                  <th scope="col" className={th}>
                    {t("FRECUENCIA")}
                  </th>
                  <th scope="col" className={th}>
                    {t("CATEGORÍA")}
                  </th>
                  <th scope="col" className={th}>
                    {t("ESTADO")}
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    <span className="sr-only">{t("Acciones")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-line border-t">
                    <th scope="row" className={`${td} text-left font-bold`}>
                      {item.name}
                      {multiAccount ? (
                        <span className="text-muted block text-xs font-semibold">
                          {t("Sale de {account}", {
                            account: accountName(accounts, item.account_id),
                          })}
                        </span>
                      ) : null}
                    </th>
                    <td className={`${td} text-right font-extrabold tabular-nums`}>
                      {formatMoney(item.amount, settings.currency)}
                    </td>
                    <td className={td}>
                      {frequencyText(item, t)}
                      {item.due_day ? (
                        <span className="text-muted">
                          {t(" · día {day}", { day: item.due_day ?? "" })}
                        </span>
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
          </ScrollRegion>
        )}
      </section>

      <FixedExpenseDialog
        open={editing !== null}
        item={editing?.item ?? null}
        categories={categoryList.data ?? []}
        accounts={accounts}
        onClose={() => setEditing(null)}
        onSaved={(message) => {
          showNotice(message);
          reload();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={t("Eliminar gasto fijo")}
        message={t(
          "¿Eliminar «{name}»? Esta acción no se puede deshacer. Si solo lo dejarás de pagar un tiempo, mejor páusalo.",
          { name: deleting?.name ?? "" },
        )}
        confirmLabel={t("Eliminar")}
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
