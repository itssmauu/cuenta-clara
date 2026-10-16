"use client";

import { ArrowDownLeft, ArrowUpRight, HandCoins, Plus, Users } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useSession } from "@/components/app/session";
import { buttonClass } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState, TableSkeleton } from "@/components/ui/Feedback";
import { FormAlert } from "@/components/ui/FormAlert";
import { ScrollRegion } from "@/components/ui/ScrollRegion";
import { useT } from "@/i18n/client";
import { msg } from "@/i18n/translate";
import { ApiError } from "@/lib/api";
import {
  financeApi,
  type Account,
  type Transaction,
  type TransactionType,
} from "@/lib/finance-api";
import { formatDate, formatMoney } from "@/lib/format";
import { notifyDataChanged, useResource, type Resource } from "@/lib/use-resource";

import { accountName } from "./accounts-ui";
import { RowActions, td, th } from "./RowActions";
import { TransactionDialog } from "./TransactionDialog";

/** The newest movements shown in each section; the full list lives in Movimientos */
const RECENT = 10;

type Preset = { type: TransactionType; thirdParty: boolean; title: string };

type Props = {
  accounts: Account[];
  onNotice: (message: string) => void;
};

/**
 * Money that does not repeat, below the recurring incomes:
 * - occasional income: the user's own money (a gift, an extra job), counted as income;
 * - someone else's money: received to pay something for them, or paid on their behalf.
 *   It moves the balance but is never income or spending, and its running total says
 *   how much of it the user still holds.
 */
export function OneOffIncomeSections({ accounts, onNotice }: Props) {
  const t = useT();
  const [categoryList] = useResource("categories", financeApi.listCategories);
  const [occasional] = useResource("transactions:occasional-income", () =>
    financeApi.listTransactions({ type: "income", third_party: false, limit: RECENT }),
  );
  const [others] = useResource("transactions:third-party", () =>
    financeApi.listTransactions({ third_party: true, limit: RECENT }),
  );
  const [held] = useResource("third-party-balance", financeApi.thirdPartyBalance);
  const [dialog, setDialog] = useState<{ preset?: Preset; item?: Transaction } | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every list here, and any other view of the money on the page, fetches fresh data
  const reload = notifyDataChanged;

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await financeApi.deleteTransaction(deleting.id);
      onNotice(msg("Movimiento eliminado."));
      setDeleting(null);
      reload();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : t("No pudimos eliminar el movimiento."),
      );
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  const occasionalPreset: Preset = {
    type: "income",
    thirdParty: false,
    title: msg("Registrar ingreso ocasional"),
  };
  const receivedPreset: Preset = {
    type: "income",
    thirdParty: true,
    title: msg("Me pasaron dinero de terceros"),
  };
  const paidPreset: Preset = {
    type: "expense",
    thirdParty: true,
    title: msg("Pagué con dinero de terceros"),
  };
  const open = (preset: Preset) => () => setDialog({ preset });

  return (
    <>
      {error ? <FormAlert title={error} /> : null}

      <section
        aria-labelledby="occasional-title"
        className="flex flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex max-w-prose flex-col gap-1">
            <h2 id="occasional-title" className="font-display text-xl font-bold">
              {t("Ingresos ocasionales")}
            </h2>
            <p className="text-muted text-sm">
              {t(
                "Dinero tuyo que no llega siempre ni por el mismo monto: un regalo, un trabajo extra, lo que te mandan a veces. Cuenta como ingreso, pero no se repite.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={open(occasionalPreset)}
            className={buttonClass("ink", "md")}
          >
            <Plus aria-hidden="true" className="size-4" strokeWidth={3} />
            {t("Registrar ingreso ocasional")}
          </button>
        </div>
        <MovementList
          state={occasional}
          accounts={accounts}
          label={msg("Tabla de ingresos ocasionales")}
          empty={
            <EmptyState
              icon={HandCoins}
              title={t("Aún no registras ingresos ocasionales")}
              text={t("Cuando te llegue dinero que no es fijo, anótalo aquí con su monto.")}
            />
          }
          onEdit={(item) => setDialog({ item })}
          onDelete={setDeleting}
        />
      </section>

      <section
        aria-labelledby="third-party-title"
        className="flex flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
      >
        <div className="flex flex-col gap-1">
          <h2 id="third-party-title" className="font-display text-xl font-bold">
            {t("Dinero de terceros")}
          </h2>
          <p className="text-muted max-w-prose text-sm">
            {t(
              "Plata que te pasan para pagar algo de otra persona. Cambia el saldo de tu cuenta, pero no es tu ingreso ni tu gasto: no cuenta para tu límite ni tu presupuesto.",
            )}
          </p>
        </div>

        <HeldBalance balance={held.data?.balance} currency={useCurrency()} />

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={open(receivedPreset)} className={buttonClass("ink", "md")}>
            <ArrowDownLeft aria-hidden="true" className="size-4" strokeWidth={3} />
            {t("Me pasaron dinero")}
          </button>
          <button
            type="button"
            onClick={open(paidPreset)}
            className={buttonClass("ghost", "md", "border-line border-2")}
          >
            <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={3} />
            {t("Pagué por otra persona")}
          </button>
        </div>

        <MovementList
          state={others}
          accounts={accounts}
          label={msg("Tabla de dinero de terceros")}
          empty={
            <EmptyState
              icon={Users}
              title={t("Sin dinero de terceros")}
              text={t(
                "Si alguien te pasa plata para que le pagues algo, regístrala aquí y luego anota el pago.",
              )}
            />
          }
          onEdit={(item) => setDialog({ item })}
          onDelete={setDeleting}
        />
      </section>

      <TransactionDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        onSaved={(message) => {
          onNotice(message);
          reload();
        }}
        categories={categoryList.data ?? []}
        accounts={accounts}
        transaction={dialog?.item ?? null}
        preset={dialog?.preset}
        title={dialog?.preset?.title}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={t("Eliminar movimiento")}
        message={t("¿Eliminar este movimiento? Esta acción no se puede deshacer.")}
        confirmLabel={t("Eliminar")}
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function useCurrency(): string {
  return useSession().settings.currency;
}

/** How much of someone else's money the user still holds (or put in from their own). */
function HeldBalance({ balance, currency }: { balance: string | undefined; currency: string }) {
  const t = useT();
  const amount = balance === undefined ? null : Number(balance);
  return (
    <div className="bg-primary-tint flex flex-col gap-1 rounded-3xl p-5">
      <span className="text-on-tint text-[13px] font-bold">
        {amount !== null && amount < 0 ? t("Pusiste de tu dinero") : t("Por usar de terceros")}
      </span>
      <span className="font-display text-ink text-[28px] font-extrabold tabular-nums">
        {amount === null ? "—" : formatMoney(Math.abs(amount), currency)}
      </span>
      <span className="text-on-tint text-xs font-semibold">
        {amount !== null && amount < 0
          ? t("Pagaste por otras personas más de lo que te pasaron.")
          : t(
              "Lo que te pasaron menos lo que ya pagaste por ellos. Está en tu saldo, pero no es tuyo.",
            )}
      </span>
    </div>
  );
}

function MovementList({
  state,
  accounts,
  label,
  empty,
  onEdit,
  onDelete,
}: {
  state: Resource<{ items: Transaction[] }>;
  accounts: Account[];
  label: string;
  empty: ReactNode;
  onEdit: (item: Transaction) => void;
  onDelete: (item: Transaction) => void;
}) {
  const t = useT();
  const currency = useCurrency();
  const multiAccount = accounts.length > 1;

  if (state.status === "error" && !state.data) {
    return (
      <FormAlert title={t("No pudimos cargar tus movimientos.")} items={[state.error.message]} />
    );
  }
  if (!state.data) return <TableSkeleton rows={2} />;
  if (state.data.items.length === 0) return <>{empty}</>;

  return (
    <ScrollRegion label={t(label)}>
      {/* Phones: the date goes under the concept, so the amount is always in view */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className={`${th} hidden sm:table-cell`}>
              {t("FECHA")}
            </th>
            <th scope="col" className={th}>
              {t("CONCEPTO")}
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
          {state.data.items.map((item) => {
            const incoming = item.type === "income";
            const concept =
              item.note ??
              (item.third_party
                ? incoming
                  ? t("Me pasaron dinero")
                  : t("Pagué por otra persona")
                : t("Ingreso ocasional"));
            return (
              <tr key={item.id} className="border-line border-t">
                <td className={`${td} text-muted hidden whitespace-nowrap sm:table-cell`}>
                  {formatDate(item.occurred_on, { day: "numeric", month: "short" })}
                </td>
                <th scope="row" className={`${td} text-left font-bold`}>
                  {concept}
                  <span className="text-muted block text-xs font-semibold sm:hidden">
                    {formatDate(item.occurred_on, { day: "numeric", month: "short" })}
                  </span>
                  {item.third_party ? (
                    <span className="text-muted block text-xs font-semibold">
                      {incoming ? t("Recibido de terceros") : t("Pagado por terceros")}
                    </span>
                  ) : null}
                  {multiAccount ? (
                    <span className="text-muted block text-xs font-semibold">
                      {accountName(accounts, item.account_id)}
                    </span>
                  ) : null}
                </th>
                <td
                  className={`${td} text-right font-extrabold tabular-nums ${
                    incoming ? "text-mint-ink" : ""
                  }`}
                >
                  {incoming ? "+" : "−"}
                  {formatMoney(item.amount, currency)}
                </td>
                <td className="px-1 py-1">
                  <RowActions
                    label={concept}
                    onEdit={() => onEdit(item)}
                    onDelete={() => onDelete(item)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollRegion>
  );
}
