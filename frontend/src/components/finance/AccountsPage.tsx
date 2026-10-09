"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  ArrowRightLeft,
  LayoutDashboard,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { PageHeader } from "@/components/app/PageHeader";
import { useSession } from "@/components/app/session";
import { buttonClass } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { EmptyState, Notice, TableSkeleton, useNotice } from "@/components/ui/Feedback";
import { FormAlert } from "@/components/ui/FormAlert";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { ApiError } from "@/lib/api";
import { financeApi, type Account, type Transfer } from "@/lib/finance-api";
import {
  ACCOUNT_KIND_LABELS,
  ACCOUNT_KINDS,
  accountSchema,
  transferSchema,
  type AccountForm,
  type AccountValues,
  type TransferForm,
  type TransferValues,
} from "@/lib/finance-validation";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

import { AccountIcon, accountName, accountOptions, kindLabel } from "./accounts-ui";
import { RowActions, td, th } from "./RowActions";

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/** Sums money strings exactly, in integer cents. */
function sumMoney(values: string[]): string {
  const cents = values.reduce((total, value) => total + Math.round(Number(value) * 100), 0);
  return (cents / 100).toFixed(2);
}

export function AccountsPage() {
  const { settings } = useSession();
  const [today] = useState(todayISO);
  const [accounts, reloadAccounts] = useResource(`accounts:${today}`, () =>
    financeApi.listAccounts(today),
  );
  const [transfers, reloadTransfers] = useResource("transfers", () => financeApi.listTransfers());
  const [editing, setEditing] = useState<{ item: Account | null } | null>(null);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, showNotice] = useNotice();
  const money = (value: string) => formatMoney(value, settings.currency);

  function reloadAll() {
    reloadAccounts();
    reloadTransfers();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await financeApi.deleteAccount(deleting.id);
      showNotice(`Cuenta «${deleting.name}» eliminada.`);
      reloadAccounts();
    } catch (caught) {
      setError(apiMessage(caught, "No pudimos eliminar la cuenta."));
    } finally {
      setDeleting(null);
      setBusy(false);
    }
  }

  async function removeTransfer(transfer: Transfer) {
    setError(null);
    try {
      await financeApi.deleteTransfer(transfer.id);
      showNotice("Transferencia eliminada.");
      reloadAll();
    } catch (caught) {
      setError(apiMessage(caught, "No pudimos eliminar la transferencia."));
    }
  }

  const items = accounts.data;
  const canMove = (items?.length ?? 0) > 1;

  return (
    <>
      <PageHeader
        title="Tus cuentas"
        subtitle="Separa tu dinero como lo tienes en el banco: gastos, ahorro, fondos…"
        actions={
          <>
            {canMove ? (
              <button type="button" onClick={() => setMoving(true)} className={buttonClass("ink")}>
                <ArrowRightLeft aria-hidden="true" className="size-4" />
                Mover dinero
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setEditing({ item: null })}
              className={buttonClass("accent", "md", "font-extrabold")}
            >
              <Plus aria-hidden="true" className="size-4" strokeWidth={3} />
              Nueva cuenta
            </button>
          </>
        }
      />
      <Notice message={notice} />
      {error ? <FormAlert title={error} /> : null}

      {accounts.status === "error" && !items ? (
        <FormAlert title="No pudimos cargar tus cuentas." items={[accounts.error.message]} />
      ) : !items ? (
        <TableSkeleton rows={2} />
      ) : (
        <div className="stagger-in flex flex-col gap-5">
          <section
            aria-label="Total"
            className="bg-ink flex flex-wrap items-end justify-between gap-4 rounded-[32px] p-6 text-white sm:p-7"
          >
            <div className="flex flex-col gap-1">
              <span className="text-on-ink text-[13px] font-semibold">Total en tus cuentas</span>
              <span className="font-display text-[34px] font-extrabold tracking-[-0.02em] tabular-nums">
                {money(sumMoney(items.map((a) => a.balance)))}
              </span>
            </div>
            <p className="text-on-ink flex max-w-[420px] items-start gap-2 text-[13px] leading-relaxed font-semibold">
              <ShieldCheck aria-hidden="true" className="text-mint mt-0.5 size-4 shrink-0" />
              Solo guardamos un nombre para reconocer cada cuenta. Nunca te pediremos números de
              cuenta, tarjetas ni claves.
            </p>
          </section>

          <ul aria-label="Cuentas" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((account) => (
              <li key={account.id}>
                <AccountCard
                  account={account}
                  money={money}
                  since={settings.balance_as_of}
                  onEdit={() => setEditing({ item: account })}
                  onDelete={() => setDeleting(account)}
                />
              </li>
            ))}
          </ul>

          <section
            aria-labelledby="transfers-title"
            className="flex flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
          >
            <h2 id="transfers-title" className="font-display text-xl font-bold">
              Movimientos entre cuentas
            </h2>
            {!transfers.data ? (
              <TableSkeleton rows={2} />
            ) : transfers.data.length === 0 ? (
              <EmptyState
                icon={ArrowRightLeft}
                title="Aún no has movido dinero entre cuentas"
                text="Cuando pases dinero de tu cuenta de gastos a la de ahorro (o al revés), regístralo aquí: cambia el saldo de ambas sin contar como gasto ni ingreso."
                action={
                  canMove ? (
                    <button
                      type="button"
                      onClick={() => setMoving(true)}
                      className={buttonClass("ink")}
                    >
                      Mover dinero
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <caption className="sr-only">Movimientos entre cuentas, del más reciente</caption>
                  <thead>
                    <tr className="border-line border-b">
                      <th scope="col" className={th}>
                        FECHA
                      </th>
                      <th scope="col" className={th}>
                        DE → A
                      </th>
                      <th scope="col" className={th}>
                        NOTA
                      </th>
                      <th scope="col" className={`${th} text-right`}>
                        MONTO
                      </th>
                      <th scope="col" className={th}>
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.data.map((t) => {
                      const from = accountName(items, t.from_account_id);
                      const to = accountName(items, t.to_account_id);
                      return (
                        <tr key={t.id} className="border-line border-b last:border-0">
                          <td className={`${td} text-body whitespace-nowrap`}>
                            {formatDate(t.occurred_on, { day: "numeric", month: "short" })}
                          </td>
                          <td className={`${td} font-semibold`}>
                            <span className="inline-flex flex-wrap items-center gap-1.5">
                              {from}
                              <ArrowRight aria-hidden="true" className="text-muted size-4" />
                              <span className="sr-only">{" hacia "}</span>
                              {to}
                            </span>
                          </td>
                          <td className={`${td} text-body`}>{t.note ?? "—"}</td>
                          <td className={`${td} text-right font-bold tabular-nums`}>
                            {money(t.amount)}
                          </td>
                          <td className={`${td} text-right`}>
                            <button
                              type="button"
                              onClick={() => removeTransfer(t)}
                              aria-label={`Eliminar la transferencia de ${from} a ${to}`}
                              className="text-muted hover:bg-canvas hover:text-danger grid size-11 cursor-pointer place-items-center rounded-full transition-colors duration-200"
                            >
                              <Trash2 aria-hidden="true" className="size-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.item ? "Editar cuenta" : "Nueva cuenta"}
        description="Solo un nombre para reconocerla. Nunca escribas números de cuenta ni claves."
      >
        <AccountFormBody
          item={editing?.item ?? null}
          onCancel={() => setEditing(null)}
          onSaved={(message) => {
            showNotice(message);
            setEditing(null);
            reloadAccounts();
          }}
        />
      </Dialog>
      <Dialog
        open={moving}
        onClose={() => setMoving(false)}
        title="Mover dinero entre cuentas"
        description="No cuenta como gasto ni como ingreso: solo cambia dónde está tu dinero."
      >
        {items ? (
          <TransferFormBody
            accounts={items}
            onCancel={() => setMoving(false)}
            onSaved={(message) => {
              showNotice(message);
              setMoving(false);
              reloadAll();
            }}
          />
        ) : null}
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar cuenta"
        message={`¿Eliminar «${deleting?.name ?? ""}»? Solo se puede si no tiene movimientos.`}
        confirmLabel="Eliminar"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function AccountCard({
  account,
  money,
  since,
  onEdit,
  onDelete,
}: {
  account: Account;
  money: (value: string) => string;
  since: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      aria-labelledby={`account-${account.id}`}
      className={`rounded-card flex h-full flex-col gap-4 bg-white p-6 ${
        account.is_primary ? "ring-primary ring-2" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <AccountIcon kind={account.kind} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2
            id={`account-${account.id}`}
            className="font-display text-lg leading-tight font-bold break-words"
          >
            {account.name}
          </h2>
          <span className="text-muted text-[13px] font-semibold">{kindLabel(account)}</span>
        </div>
        <RowActions label={`la cuenta ${account.name}`} onEdit={onEdit} onDelete={onDelete} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-muted text-[13px] font-semibold">Saldo hoy</span>
        <span className="font-display animate-value-in text-[30px] font-extrabold tracking-[-0.02em] tabular-nums">
          {money(account.balance)}
        </span>
        <span className="text-muted text-xs font-semibold">
          Empezó con {money(account.initial_balance)} el{" "}
          {formatDate(since, { day: "numeric", month: "short" })}
        </span>
      </div>
      <Link
        href={account.is_primary ? "/dashboard" : `/dashboard?account=${account.id}`}
        className="text-primary mt-auto inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-bold hover:underline"
      >
        <LayoutDashboard aria-hidden="true" className="size-4" />
        Ver en el dashboard
      </Link>
    </article>
  );
}

function AccountFormBody({
  item,
  onCancel,
  onSaved,
}: {
  item: Account | null;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccountForm, unknown, AccountValues>({
    resolver: zodResolver(accountSchema),
    mode: "onBlur",
    defaultValues: {
      name: item?.name ?? "",
      kind: item?.kind ?? "savings",
      initial_balance: item?.initial_balance ?? "",
      is_primary: item?.is_primary ?? false,
    },
  });

  async function onSubmit(values: AccountValues) {
    setServerError(null);
    try {
      if (item) {
        await financeApi.updateAccount(item.id, values);
        onSaved("Cuenta actualizada.");
      } else {
        await financeApi.createAccount(values);
        onSaved("Cuenta creada.");
      }
    } catch (error) {
      setServerError(apiMessage(error, "No pudimos guardar la cuenta."));
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError ? <FormAlert title={serverError} /> : null}
      <TextField
        id="account-name"
        label="Nombre"
        placeholder="Ej. Ahorro, Gastos del día, Fondo de emergencia"
        autoComplete="off"
        error={errors.name?.message}
        {...register("name")}
      />
      <SelectField
        id="account-kind"
        label="¿Para qué la usas?"
        options={ACCOUNT_KINDS.map((kind) => ({ value: kind, label: ACCOUNT_KIND_LABELS[kind] }))}
        error={errors.kind?.message}
        {...register("kind")}
      />
      <TextField
        id="account-balance"
        label="¿Cuánto tenía al empezar a usar Cuenta Clara?"
        inputMode="decimal"
        placeholder="0.00"
        autoComplete="off"
        hint="Desde ahí sumamos y restamos sus movimientos para saber cuánto tiene hoy."
        error={errors.initial_balance?.message}
        {...register("initial_balance")}
      />
      {/* The primary role can only be handed to another account, never just removed */}
      {item?.is_primary ? (
        <p className="bg-primary-tint text-on-tint rounded-2xl p-4 text-sm font-semibold">
          Es tu cuenta principal: el dashboard abre en ella y tu límite de gasto se aplica aquí.
          Para cambiarla, marca otra cuenta como principal.
        </p>
      ) : (
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            className="accent-primary mt-0.5 size-5 shrink-0 cursor-pointer"
            {...register("is_primary")}
          />
          <span>
            Es la cuenta de mis gastos del día (principal)
            <span className="text-muted block text-[13px] font-medium">
              El dashboard abrirá en ella y tu límite de gasto se aplicará aquí.
            </span>
          </span>
        </label>
      )}
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
          {isSubmitting ? "Guardando…" : "Guardar cuenta"}
        </button>
      </div>
    </form>
  );
}

function TransferFormBody({
  accounts,
  onCancel,
  onSaved,
}: {
  accounts: Account[];
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const primary = accounts.find((a) => a.is_primary) ?? accounts[0]!;
  const firstOther = accounts.find((a) => a.id !== primary.id) ?? primary;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TransferForm, unknown, TransferValues>({
    resolver: zodResolver(transferSchema),
    mode: "onBlur",
    defaultValues: {
      from_account_id: primary.id,
      to_account_id: firstOther.id,
      amount: "",
      occurred_on: todayISO(),
      note: "",
    },
  });

  async function onSubmit(values: TransferValues) {
    setServerError(null);
    try {
      await financeApi.createTransfer(values);
      onSaved("Dinero movido entre tus cuentas.");
    } catch (error) {
      setServerError(apiMessage(error, "No pudimos mover el dinero."));
    }
  }

  const options = accountOptions(accounts);
  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {serverError ? <FormAlert title={serverError} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="transfer-from"
          label="Desde"
          options={options}
          error={errors.from_account_id?.message}
          {...register("from_account_id")}
        />
        <SelectField
          id="transfer-to"
          label="Hacia"
          options={options}
          error={errors.to_account_id?.message}
          {...register("to_account_id")}
        />
      </div>
      <TextField
        id="transfer-amount"
        label="Monto"
        inputMode="decimal"
        placeholder="0.00"
        autoComplete="off"
        error={errors.amount?.message}
        {...register("amount")}
      />
      <TextField
        id="transfer-date"
        label="Fecha"
        type="date"
        error={errors.occurred_on?.message}
        {...register("occurred_on")}
      />
      <TextField
        id="transfer-note"
        label="Nota (opcional)"
        placeholder="Ej. ahorro de la quincena"
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
          {isSubmitting ? "Moviendo…" : "Mover dinero"}
        </button>
      </div>
    </form>
  );
}
