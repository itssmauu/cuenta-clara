"use client";

import { AlertTriangle, PiggyBank, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

import { PageHeader } from "@/components/app/PageHeader";
import { useSession } from "@/components/app/session";
import {
  CURRENT_PERIOD_NAME,
  PERIOD_ADJECTIVE,
  PERIOD_NOUN,
  periodRange,
} from "@/components/dashboard/period-labels";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, Notice, TableSkeleton, useNotice } from "@/components/ui/Feedback";
import { FormAlert } from "@/components/ui/FormAlert";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { ApiError } from "@/lib/api";
import {
  financeApi,
  type AccountScope,
  type BudgetRow,
  type BudgetStatus,
  type BudgetSummary,
  type DashboardPeriod,
  type Frequency,
  type Money,
} from "@/lib/finance-api";
import { budgetSchema, FREQUENCY_LABELS, PERIOD_OPTIONS } from "@/lib/finance-validation";
import { formatMoney, todayISO } from "@/lib/format";
import { notifyDataChanged, useResource } from "@/lib/use-resource";

import { AccountPicker } from "./accounts-ui";

/** Status in words: the bar's color is never the only signal */
export const STATUS_TEXT: Record<BudgetStatus, string> = {
  none: "Sin presupuesto",
  ok: "Vas bien",
  warning: "Cerca del tope",
  over: "Te pasaste",
};

const BAR_COLOR: Record<BudgetStatus, string> = {
  none: "bg-muted",
  ok: "bg-primary",
  warning: "bg-accent",
  over: "bg-danger",
};

const PILL: Record<BudgetStatus, string> = {
  none: "bg-canvas text-muted",
  ok: "bg-primary-tint text-ink",
  warning: "bg-accent-tint text-ink",
  over: "bg-danger-tint text-danger",
};

type Suggestions = Record<string, Money>;

export function BudgetPage() {
  const { settings } = useSession();
  const [today] = useState(todayISO);
  const [period, setPeriod] = useState<DashboardPeriod>("weekly");
  // undefined = the primary (day-to-day) account
  const [account, setAccount] = useState<AccountScope>(undefined);
  const [notice, showNotice] = useNotice();
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const [summary, reload] = useResource(`budgets:${period}:${account ?? "primary"}:${today}`, () =>
    financeApi.getBudgets(period, today, account),
  );
  const [accountList] = useResource(`accounts:${today}`, () => financeApi.listAccounts(today));
  const data = summary.data;
  const money = (value: Money) => formatMoney(value, data?.currency ?? settings.currency);

  async function suggest() {
    setSuggesting(true);
    setSuggestError(null);
    try {
      const result = await financeApi.getBudgetSuggestions(today, account);
      setSuggestions(Object.fromEntries(result.suggestions.map((s) => [s.category_id, s.amount])));
      if (result.suggestions.length === 0) {
        showNotice("Aún no hay gastos con categoría para sugerir un monto.");
      }
    } catch {
      setSuggestError("No pudimos calcular las sugerencias. Inténtalo de nuevo.");
    } finally {
      setSuggesting(false);
    }
  }

  function saved(message: string) {
    showNotice(message);
    notifyDataChanged(); // the dashboard and this page refresh their numbers
  }

  return (
    <>
      <PageHeader
        title="Presupuesto"
        subtitle="Cuánto quieres gastar en cada categoría, y cómo vas"
        actions={
          <>
            <AccountPicker
              accounts={accountList.data ?? []}
              value={account}
              onChange={setAccount}
            />
            <SegmentedControl
              label="Periodo"
              options={PERIOD_OPTIONS.map((option) => ({
                value: option,
                label: FREQUENCY_LABELS[option],
              }))}
              value={period}
              onChange={setPeriod}
              layoutClass="grid w-full grid-cols-4 sm:flex sm:w-auto"
              optionClass="px-1 text-[13px] sm:px-4 sm:text-sm"
            />
          </>
        }
      />
      <Notice message={notice} />

      {summary.status === "error" && !data ? (
        <div className="flex flex-col items-start gap-3">
          <FormAlert title="No pudimos cargar tus presupuestos." items={[summary.error.message]} />
          <button
            type="button"
            onClick={reload}
            className="text-primary min-h-11 font-bold hover:underline"
          >
            Reintentar
          </button>
        </div>
      ) : !data ? (
        <TableSkeleton rows={5} />
      ) : (
        <div className="flex flex-col gap-5" aria-busy={summary.status === "loading"}>
          <SummaryCard data={data} period={period} money={money} />

          {data.over_limit_warning ? (
            <p
              role="status"
              className="bg-accent-tint text-ink flex items-start gap-3 rounded-3xl px-5 py-4 text-sm font-bold"
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              Tus presupuestos suman {money(data.totals.budgeted)}, más que tu límite de gasto de{" "}
              {money(data.spending_limit ?? "0")} {CURRENT_PERIOD_NAME[period]}. Ajusta alguno para
              no pasarte.
            </p>
          ) : null}

          <section
            aria-labelledby="budget-list-title"
            className="flex flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 id="budget-list-title" className="font-display text-xl font-bold">
                  Por categoría
                </h2>
                <p className="text-muted text-sm">
                  {periodRange(data.period.start, data.period.end)} · los montos se guardan por{" "}
                  {PERIOD_NOUN[data.income_period]}
                  {data.period.type !== data.income_period
                    ? ` y aquí se muestran como periodo ${PERIOD_ADJECTIVE[data.period.type]}`
                    : ""}
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={() => void suggest()}
                disabled={suggesting}
                aria-busy={suggesting}
                className={buttonClass("ghost", "md", "border-line border-2")}
              >
                <Sparkles aria-hidden="true" className="size-4" />
                {suggesting ? "Calculando…" : "Sugerir según mi promedio"}
              </button>
            </div>
            {suggestError ? <FormAlert title={suggestError} /> : null}

            {data.totals.budgeted === "0.00" ? (
              <EmptyState
                icon={PiggyBank}
                title="Aún no tienes presupuestos"
                text={`Elige cuánto quieres gastar por ${PERIOD_NOUN[data.income_period]} en una categoría con «Poner presupuesto», o pide una sugerencia basada en lo que sueles gastar.`}
              />
            ) : null}

            <ul className="flex flex-col">
              {data.rows.map((row) => (
                <BudgetItem
                  key={row.category_id}
                  row={row}
                  incomePeriod={data.income_period}
                  suggestion={suggestions?.[row.category_id]}
                  money={money}
                  onSaved={saved}
                />
              ))}
            </ul>

            <p className="border-line text-body flex flex-wrap justify-between gap-2 border-t pt-4 text-sm">
              <span className="font-bold">Gasto sin presupuesto (incluye «Sin categoría»)</span>
              <span className="font-bold tabular-nums">{money(data.unbudgeted_spent)}</span>
            </p>
          </section>
        </div>
      )}
    </>
  );
}

function SummaryCard({
  data,
  period,
  money,
}: {
  data: BudgetSummary;
  period: DashboardPeriod;
  money: (value: Money) => string;
}) {
  const remaining = Number(data.totals.remaining);
  const stats = [
    { label: "Presupuestado", value: money(data.totals.budgeted) },
    { label: "Gastado", value: money(data.totals.spent), hint: "en categorías con presupuesto" },
    {
      label: remaining < 0 ? "Te pasaste" : "Te queda",
      value: money(String(Math.abs(remaining).toFixed(2))),
    },
    {
      label: "Sin asignar",
      value: data.unassigned === null ? "—" : money(data.unassigned),
      hint:
        data.spending_limit === null
          ? "sin límite de gasto"
          : `de tu límite de ${money(data.spending_limit)}`,
    },
  ];
  return (
    <section
      aria-labelledby="budget-summary-title"
      className="bg-ink flex flex-col gap-4 rounded-[32px] p-6 text-white sm:p-7"
    >
      <h2 id="budget-summary-title" className="text-on-ink text-[13px] font-bold">
        Resumen {CURRENT_PERIOD_NAME[period]} · {data.account?.name ?? "todas tus cuentas"}
      </h2>
      <dl className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex min-w-0 flex-col gap-1">
            <dt className="text-on-ink text-sm font-semibold">{stat.label}</dt>
            <dd className="font-display text-2xl font-extrabold tabular-nums sm:text-[28px]">
              {stat.value}
            </dd>
            {stat.hint ? <dd className="text-on-ink-muted text-xs">{stat.hint}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

function BudgetItem({
  row,
  incomePeriod,
  suggestion,
  money,
  onSaved,
}: {
  row: BudgetRow;
  incomePeriod: Frequency;
  suggestion: Money | undefined;
  money: (value: Money) => string;
  onSaved: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.amount ?? suggestion ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = `budget-${row.category_id}`;
  const per = PERIOD_NOUN[incomePeriod];

  function startEditing(initial: string) {
    setDraft(initial);
    setError(null);
    setEditing(true);
  }

  async function save(event?: FormEvent, amountOverride?: Money) {
    event?.preventDefault();
    const parsed = budgetSchema.safeParse({ amount: amountOverride ?? draft });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa el monto.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await financeApi.setBudget(row.category_id, parsed.data.amount);
      setEditing(false);
      onSaved(`Presupuesto de ${row.name} guardado.`);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "No pudimos guardar el monto.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await financeApi.removeBudget(row.category_id);
      onSaved(`Quitaste el presupuesto de ${row.name}.`);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "No pudimos quitarlo.");
    } finally {
      setBusy(false);
    }
  }

  const percent = row.percent === null ? null : Number(row.percent);
  const remaining = row.remaining === null ? null : Number(row.remaining);

  return (
    <li className="border-line flex flex-col gap-3 border-t py-4 first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-bold">{row.name}</h3>
          <p className="text-body text-sm tabular-nums">
            {row.budget === null ? (
              <>Gastado {money(row.spent)}</>
            ) : (
              <>
                {money(row.spent)} de {money(row.budget)}
                {remaining !== null && remaining < 0
                  ? ` · te pasaste por ${money(Math.abs(remaining).toFixed(2))}`
                  : ` · te quedan ${money(row.remaining ?? "0")}`}
              </>
            )}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${PILL[row.status]}`}>
          {STATUS_TEXT[row.status]}
          {percent !== null ? ` · ${row.percent} %` : ""}
        </span>
      </div>

      {percent !== null ? (
        <div
          role="progressbar"
          aria-label={`Presupuesto de ${row.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(percent, 100)}
          aria-valuetext={`${row.percent} % usado. ${STATUS_TEXT[row.status]}.`}
          className="bg-canvas h-2.5 overflow-hidden rounded-full"
        >
          <div
            className={`h-full rounded-full ${BAR_COLOR[row.status]}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      ) : null}

      {editing ? (
        <form
          noValidate
          onSubmit={(event) => void save(event)}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-[180px] flex-1">
            <TextField
              id={inputId}
              label={`Presupuesto de ${row.name} por ${per}`}
              inputMode="decimal"
              autoComplete="off"
              value={draft}
              error={error ?? undefined}
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
          <button type="submit" disabled={busy} className={buttonClass("primary")}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className={buttonClass("ghost")}>
            Cancelar
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {row.amount === null ? (
            <button
              type="button"
              onClick={() => startEditing(suggestion ?? "")}
              aria-label={`Poner presupuesto a ${row.name}`}
              className={buttonClass("ghost", "md", "border-line border-2")}
            >
              Poner presupuesto
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => startEditing(row.amount ?? "")}
                aria-label={`Cambiar el presupuesto de ${row.name}`}
                className={buttonClass("ghost", "md", "border-line border-2")}
              >
                Cambiar ({money(row.amount)} por {per})
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy}
                aria-label={`Quitar el presupuesto de ${row.name}`}
                className={buttonClass("ghost")}
              >
                Quitar
              </button>
            </>
          )}
          {suggestion && suggestion !== row.amount ? (
            <button
              type="button"
              onClick={() => void save(undefined, suggestion)}
              disabled={busy}
              aria-label={`Usar ${money(suggestion)} por ${per} como presupuesto de ${row.name}`}
              className="text-primary inline-flex min-h-11 cursor-pointer items-center px-2 text-sm font-bold hover:underline"
            >
              Sugerido: {money(suggestion)} por {per} · Usar
            </button>
          ) : null}
          {error && !editing ? (
            <p role="alert" className="text-danger text-sm font-semibold">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </li>
  );
}
