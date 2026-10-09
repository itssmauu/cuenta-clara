"use client";

import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/app/PageHeader";
import { TransactionDialog } from "@/components/finance/TransactionDialog";
import { useSession } from "@/components/app/session";
import { buttonClass } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Notice, useNotice } from "@/components/ui/Feedback";
import { FormAlert } from "@/components/ui/FormAlert";
import {
  financeApi,
  type AccountScope,
  type Category,
  type DashboardPeriod,
} from "@/lib/finance-api";
import { FREQUENCY_LABELS, PERIOD_OPTIONS } from "@/lib/finance-validation";
import { todayISO } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

import { AccountSwitcher } from "./AccountSwitcher";
import { KpiCards, LimitAlert, LimitChip, LimitMeter, UpcomingExpenses } from "./Cards";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { CURRENT_PERIOD_NAME, periodRange } from "./period-labels";
import { PeriodExpenses } from "./PeriodExpenses";
import { SpendingChart } from "./SpendingChart";

function isPeriod(value: string | null): value is DashboardPeriod {
  return PERIOD_OPTIONS.includes(value as DashboardPeriod);
}

export function Dashboard() {
  const { user, settings } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [today] = useState(todayISO);
  const [adding, setAdding] = useState(false);
  const [notice, showNotice] = useNotice();

  // The selected period lives in the URL (?period=monthly) so it survives reloads and links
  const fromUrl = searchParams.get("period");
  const fallback: DashboardPeriod = isPeriod(settings.income_period)
    ? settings.income_period
    : "weekly";
  const period: DashboardPeriod = isPeriod(fromUrl) ? fromUrl : fallback;
  // Which account: ?account=<id> or ?account=all; none = the primary (day-to-day) one
  const account: AccountScope = searchParams.get("account") ?? undefined;

  const [dashboard, reloadDashboard] = useResource(
    `dashboard:${period}:${account ?? "primary"}:${today}`,
    () => financeApi.getDashboard(period, today, account),
  );
  const [accountList, reloadAccounts] = useResource(`accounts:${today}`, () =>
    financeApi.listAccounts(today),
  );
  const [categoryList] = useResource("categories", financeApi.listCategories);

  const current = dashboard.data;
  const [expenses, reloadExpenses] = useResource(
    current ? `expenses:${current.period_start}:${current.period_end}` : "expenses:pending",
    () =>
      current
        ? financeApi.listTransactions({
            from: current.period_start,
            to: current.period_end,
            type: "expense",
            limit: 10,
          })
        : new Promise<never>(() => {}),
  );

  const categories = useMemo(
    () => new Map<string, Category>((categoryList.data ?? []).map((c) => [c.id, c])),
    [categoryList.data],
  );

  function updateUrl(changes: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) params.delete(key);
      else params.set(key, value);
    }
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  function refreshAll() {
    reloadDashboard();
    reloadExpenses();
    reloadAccounts();
  }

  // A new movement goes to the account on screen (the primary one when viewing all)
  const defaultAccountId = current?.account?.id ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title={`Hola, ${user.name.split(" ")[0]}`}
        subtitle={
          current
            ? `${current.account?.name ?? "Todas tus cuentas"} · ${CURRENT_PERIOD_NAME[period]}, ${periodRange(current.period_start, current.period_end)}`
            : "Resumen de tus finanzas"
        }
        actions={
          <>
            <SegmentedControl
              label="Periodo"
              options={PERIOD_OPTIONS.map((option) => ({
                value: option,
                label: FREQUENCY_LABELS[option],
              }))}
              value={period}
              onChange={(next) => updateUrl({ period: next })}
              layoutClass="grid w-full grid-cols-4 sm:flex sm:w-auto"
              optionClass="px-1 text-[13px] sm:px-4 sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={buttonClass("accent", "md", "font-extrabold")}
            >
              <Plus aria-hidden="true" className="size-4" strokeWidth={3} />
              Añadir movimiento
            </button>
          </>
        }
      />

      <Notice message={notice} />

      {accountList.data ? (
        <AccountSwitcher
          accounts={accountList.data}
          value={account}
          onChange={(next) => updateUrl({ account: next })}
          currency={settings.currency}
        />
      ) : null}

      {dashboard.status === "error" && !current ? (
        <div className="flex flex-col items-start gap-3">
          <FormAlert title="No pudimos cargar tu dashboard." items={[dashboard.error.message]} />
          <button type="button" onClick={reloadDashboard} className={buttonClass("ink")}>
            Reintentar
          </button>
        </div>
      ) : !current ? (
        <DashboardSkeleton />
      ) : (
        <div className="stagger-in flex flex-col gap-5" aria-busy={dashboard.status === "loading"}>
          <LimitAlert dashboard={current} />
          <KpiCards dashboard={current} />

          <div className="flex flex-wrap gap-5">
            <section
              aria-labelledby="chart-title"
              className="flex min-w-0 flex-[2_1_460px] flex-col gap-5 rounded-[32px] bg-white p-6 sm:p-7"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h2 id="chart-title" className="font-display text-xl font-bold">
                    Gasto vs. límite
                  </h2>
                  <p className="text-muted text-[13px] font-semibold">
                    Los periodos que pasan la línea se marcan en coral
                  </p>
                </div>
                <LimitChip dashboard={current} />
              </div>
              <SpendingChart dashboard={current} />
            </section>

            <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-5">
              <LimitMeter dashboard={current} />
              <UpcomingExpenses
                items={current.upcoming_fixed_expenses}
                currency={current.currency}
              />
            </div>
          </div>

          <section
            aria-labelledby="categories-chart-title"
            className="flex flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
          >
            <h2 id="categories-chart-title" className="font-display text-xl font-bold">
              Gasto por categoría
            </h2>
            <CategoryBreakdown items={current.spending_by_category} currency={current.currency} />
          </section>

          <PeriodExpenses
            title={`Gastos de ${CURRENT_PERIOD_NAME[period]}`}
            transactions={expenses.data?.items}
            categories={categories}
            currency={current.currency}
            onAdd={() => setAdding(true)}
          />
        </div>
      )}

      <TransactionDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(message) => {
          showNotice(message);
          refreshAll();
        }}
        categories={categoryList.data ?? []}
        accounts={accountList.data ?? []}
        defaultAccountId={defaultAccountId}
      />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-5">
      <span className="sr-only">Cargando tu dashboard…</span>
      <div aria-hidden="true" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-card h-[132px] animate-pulse bg-white/70" />
        ))}
      </div>
      <div aria-hidden="true" className="h-[420px] animate-pulse rounded-[32px] bg-white/70" />
    </div>
  );
}
