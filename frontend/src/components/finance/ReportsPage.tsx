"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/app/PageHeader";
import { useSession } from "@/components/app/session";
import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";
import { periodRange, PREVIOUS_PERIOD_NAME } from "@/components/dashboard/period-labels";
import { buttonClass } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TableSkeleton } from "@/components/ui/Feedback";
import { FormAlert } from "@/components/ui/FormAlert";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { useT } from "@/i18n/client";
import { msg } from "@/i18n/translate";
import {
  financeApi,
  type AccountScope,
  type DashboardPeriod,
  type ReportFormat,
  type TransactionType,
} from "@/lib/finance-api";
import { FREQUENCY_LABELS, PERIOD_OPTIONS } from "@/lib/finance-validation";
import { formatMoney, subtractMoney, todayISO } from "@/lib/format";
import { useResource } from "@/lib/use-resource";
import { ScrollRegion } from "@/components/ui/ScrollRegion";

import { AccountPicker } from "./accounts-ui";
import { td, th } from "./RowActions";

function isPeriod(value: string): value is DashboardPeriod {
  return PERIOD_OPTIONS.includes(value as DashboardPeriod);
}

/** "+$15.00 (más)" / "−$5.00 (menos)": the sign and a word, never color alone. */
function Difference({
  current,
  previous,
  currency,
}: {
  current: string;
  previous: string;
  currency: string;
}) {
  const t = useT();
  const diff = Number(subtractMoney(current, previous));
  if (diff === 0) return <span className="text-muted">{t("Sin cambio")}</span>;
  return (
    <span className="font-bold">
      {diff > 0 ? "+" : "−"}
      {formatMoney(Math.abs(diff), currency)}
      <span className="text-muted font-semibold"> ({diff > 0 ? t("más") : t("menos")})</span>
    </span>
  );
}

export function ReportsPage() {
  const t = useT();
  const { settings } = useSession();
  const [today] = useState(todayISO);
  const initial: DashboardPeriod = isPeriod(settings.income_period)
    ? settings.income_period
    : "monthly";
  const [period, setPeriod] = useState<DashboardPeriod>(initial);
  const [account, setAccount] = useState<AccountScope>(undefined);
  const [report, reload] = useResource(`report:${period}:${account ?? "primary"}:${today}`, () =>
    financeApi.getDashboard(period, today, account),
  );
  const [accountList] = useResource(`accounts:${today}`, () => financeApi.listAccounts(today));
  const [format, setFormat] = useState<ReportFormat>("csv");
  const [exportFilters, setExportFilters] = useState<{
    from: string;
    to: string;
    type: "" | TransactionType;
  }>({
    from: "",
    to: "",
    type: "",
  });

  const data = report.data;
  const money = (value: string) => formatMoney(value, data?.currency ?? settings.currency);
  const net = (income: string, spent: string) => subtractMoney(income, spent);

  return (
    <>
      <PageHeader
        title={t("Reportes")}
        subtitle={
          data
            ? t("{name}: compara periodos, mira en qué se va tu dinero y descarga tus datos", {
                name: data.account?.name ?? t("Todas tus cuentas"),
              })
            : t("Compara periodos, mira en qué se va tu dinero y descarga tus datos")
        }
        actions={
          <>
            <AccountPicker
              accounts={accountList.data ?? []}
              value={account}
              onChange={setAccount}
            />
            <SegmentedControl
              label={t("Periodo")}
              options={PERIOD_OPTIONS.map((option) => ({
                value: option,
                label: FREQUENCY_LABELS[option],
              }))}
              value={period}
              onChange={setPeriod}
              layoutClass="grid w-full grid-cols-2 max-[399px]:rounded-[26px] min-[400px]:grid-cols-4 sm:flex sm:w-auto"
              optionClass="px-1 text-[13px] sm:px-4 sm:text-sm"
            />
          </>
        }
      />

      {report.status === "error" && !data ? (
        <div className="flex flex-col items-start gap-3">
          <FormAlert title={t("No pudimos cargar el reporte.")} items={[report.error.message]} />
          <button type="button" onClick={reload} className={buttonClass("ink")}>
            {t("Reintentar")}
          </button>
        </div>
      ) : !data ? (
        <TableSkeleton rows={4} />
      ) : (
        <div className="flex flex-col gap-5" aria-busy={report.status === "loading"}>
          <section
            aria-labelledby="comparison-title"
            className="flex flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
          >
            <h2 id="comparison-title" className="font-display text-xl font-bold">
              {t("Este periodo frente a {previous}", {
                previous: t(PREVIOUS_PERIOD_NAME[data.period]),
              })}
            </h2>
            <ScrollRegion label={t("Tabla de comparación entre periodos")}>
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th scope="col" className={th}>
                      <span className="sr-only">{t("Concepto")}</span>
                    </th>
                    {/* Current first: on a phone it is the column that fits without scrolling */}
                    <th scope="col" className={`${th} text-right`}>
                      {t("ACTUAL ({range})", {
                        range: periodRange(data.period_start, data.period_end),
                      })}
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      {t("ANTERIOR ({range})", {
                        range: periodRange(data.previous_period_start, data.previous_period_end),
                      })}
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      {t("DIFERENCIA")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [msg("Ingresos"), data.previous_income, data.income],
                    [msg("Gastado"), data.previous_spent, data.spent],
                    [
                      msg("Neto (ingresos − gastos)"),
                      net(data.previous_income, data.previous_spent),
                      net(data.income, data.spent),
                    ],
                  ].map(([label, previous, current]) => (
                    <tr key={label} className="border-line border-t">
                      <th scope="row" className={`${td} text-left font-bold`}>
                        {t(label!)}
                      </th>
                      <td className={`${td} text-right font-bold tabular-nums`}>
                        {money(current!)}
                      </td>
                      <td className={`${td} text-right tabular-nums`}>{money(previous!)}</td>
                      <td className={`${td} text-right tabular-nums`}>
                        <Difference
                          current={current!}
                          previous={previous!}
                          currency={data.currency}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollRegion>
          </section>

          <section
            aria-labelledby="report-categories-title"
            className="flex flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
          >
            <h2 id="report-categories-title" className="font-display text-xl font-bold">
              {t("Gasto por categoría ({range})", {
                range: periodRange(data.period_start, data.period_end),
              })}
            </h2>
            <CategoryBreakdown items={data.spending_by_category} currency={data.currency} />
          </section>
        </div>
      )}

      <section
        aria-labelledby="export-title"
        className="flex flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
      >
        <div className="flex flex-col gap-1">
          <h2 id="export-title" className="font-display text-xl font-bold">
            {t("Descargar reporte")}
          </h2>
          <p className="text-muted text-sm">
            {data?.account
              ? t(
                  "Incluye tus movimientos, cada ingreso y gasto fijo en su fecha, y lo que moviste entre cuentas (cuenta {name}). Sin fechas, va desde que empezaste a usar Cuenta Clara hasta hoy.",
                  { name: data.account.name },
                )
              : t(
                  "Incluye tus movimientos, cada ingreso y gasto fijo en su fecha, y lo que moviste entre cuentas. Sin fechas, va desde que empezaste a usar Cuenta Clara hasta hoy.",
                )}
          </p>
        </div>
        <SegmentedControl
          label={t("Formato del reporte")}
          options={[
            { value: "csv", label: t("CSV · Excel") },
            { value: "pdf", label: t("PDF · para leer o imprimir") },
          ]}
          value={format}
          onChange={setFormat}
          layoutClass="grid grid-cols-2 self-start sm:flex"
          optionClass="px-4 text-sm"
        />
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <TextField
            id="export-from"
            label={t("Desde")}
            type="date"
            value={exportFilters.from}
            onChange={(e) => setExportFilters((f) => ({ ...f, from: e.target.value }))}
          />
          <TextField
            id="export-to"
            label={t("Hasta")}
            type="date"
            value={exportFilters.to}
            onChange={(e) => setExportFilters((f) => ({ ...f, to: e.target.value }))}
          />
          <SelectField
            id="export-type"
            label={t("Tipo")}
            value={exportFilters.type}
            onChange={(e) =>
              setExportFilters((f) => ({ ...f, type: e.target.value as "" | TransactionType }))
            }
            options={[
              { value: "", label: t("Todos") },
              { value: "expense", label: t("Gastos") },
              { value: "income", label: t("Ingresos") },
            ]}
          />
          <a
            href={financeApi.reportUrl({
              format,
              from: exportFilters.from || undefined,
              to: exportFilters.to || undefined,
              type: exportFilters.type || undefined,
              // Same account as the report above ("all" for every account)
              account,
            })}
            download
            className={buttonClass("primary", "md", "min-h-12")}
          >
            <Download aria-hidden="true" className="size-4" />
            {format === "pdf" ? t("Descargar PDF") : t("Descargar CSV")}
          </a>
        </div>
      </section>
    </>
  );
}
