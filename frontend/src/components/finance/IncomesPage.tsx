"use client";

import { Plus, Wallet } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/app/PageHeader";
import { useSession } from "@/components/app/session";
import { buttonClass } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState, Notice, StatusPill, TableSkeleton, useNotice } from "@/components/ui/Feedback";
import { FormAlert } from "@/components/ui/FormAlert";
import { ApiError } from "@/lib/api";
import { financeApi, type Income } from "@/lib/finance-api";
import { FREQUENCY_LABELS } from "@/lib/finance-validation";
import { formatDate, formatMoney } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

import { IncomeDialog } from "./RecurringDialogs";
import { RowActions, td, th } from "./RowActions";

function frequencyText(item: Pick<Income, "frequency" | "custom_period_days">) {
  return item.frequency === "custom"
    ? `Cada ${item.custom_period_days} días`
    : FREQUENCY_LABELS[item.frequency];
}

export function IncomesPage() {
  const { settings } = useSession();
  const [incomes, reload] = useResource("incomes", financeApi.listIncomes);
  const [editing, setEditing] = useState<{ item: Income | null } | null>(null);
  const [deleting, setDeleting] = useState<Income | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, showNotice] = useNotice();
  const money = (value: string) => formatMoney(value, settings.currency);

  async function toggle(item: Income) {
    setError(null);
    try {
      await financeApi.updateIncome(item.id, { ...item, is_active: !item.is_active });
      showNotice(item.is_active ? `«${item.label}» en pausa.` : `«${item.label}» activado.`);
      reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No pudimos actualizar el ingreso.");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await financeApi.deleteIncome(deleting.id);
      showNotice(`«${deleting.label}» eliminado.`);
      setDeleting(null);
      reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No pudimos eliminar el ingreso.");
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  const items = incomes.data;
  const addButton = (
    <button
      type="button"
      onClick={() => setEditing({ item: null })}
      className={buttonClass("accent", "md", "font-extrabold")}
    >
      <Plus aria-hidden="true" className="size-4" strokeWidth={3} />
      Añadir ingreso
    </button>
  );

  return (
    <>
      <PageHeader
        title="Ingresos"
        subtitle="Lo que recibes de forma recurrente"
        actions={addButton}
      />
      <Notice message={notice} />
      {error ? <FormAlert title={error} /> : null}

      <section
        aria-labelledby="incomes-title"
        className="flex flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
      >
        <h2 id="incomes-title" className="font-display text-xl font-bold">
          Tus ingresos recurrentes
        </h2>
        {incomes.status === "error" && !items ? (
          <FormAlert title="No pudimos cargar tus ingresos." items={[incomes.error.message]} />
        ) : !items ? (
          <TableSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Aún no registras ingresos"
            text="Agrega tu salario, beca o cualquier dinero que recibas de forma regular. Se sumará solo a tu saldo en cada fecha."
            action={addButton}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    CONCEPTO
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    MONTO
                  </th>
                  <th scope="col" className={th}>
                    FRECUENCIA
                  </th>
                  <th scope="col" className={th}>
                    DESDE
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
                      {item.label}
                    </th>
                    <td className={`${td} text-mint-ink text-right font-extrabold tabular-nums`}>
                      {money(item.amount)}
                    </td>
                    <td className={td}>{frequencyText(item)}</td>
                    <td className={`${td} text-muted`}>
                      {formatDate(item.start_date, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className={td}>
                      <StatusPill active={item.is_active} />
                    </td>
                    <td className="px-1 py-1">
                      <RowActions
                        label={item.label}
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
        <p className="text-muted text-[13px]">
          Pausar un ingreso lo excluye de los cálculos (también de periodos pasados) sin borrarlo.
        </p>
      </section>

      <IncomeDialog
        open={editing !== null}
        item={editing?.item ?? null}
        onClose={() => setEditing(null)}
        onSaved={(message) => {
          showNotice(message);
          reload();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar ingreso"
        message={`¿Eliminar «${deleting?.label ?? ""}»? Esta acción no se puede deshacer. Si solo dejará de llegar por un tiempo, mejor páusalo.`}
        confirmLabel="Eliminar"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

export { frequencyText };
