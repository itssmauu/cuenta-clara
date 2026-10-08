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
import { financeApi, type DashboardPeriod, type TransactionType } from "@/lib/finance-api";
import { FREQUENCY_LABELS, PERIOD_OPTIONS } from "@/lib/finance-validation";
import { formatMoney, subtractMoney, todayISO } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

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
  const diff = Number(subtractMoney(current, previous));
  if (diff === 0) return <span className="text-muted">Sin cambio</span>;
  return (
    <span className="font-bold">
      {diff > 0 ? "+" : "−"}
      {formatMoney(Math.abs(diff), currency)}
      <span className="text-muted font-semibold"> ({diff > 0 ? "más" : "menos"})</span>
    </span>
  );
}

export function ReportsPage() {
  const { settings } = useSession();
  const [today] = useState(todayISO);
  const initial: DashboardPeriod = isPeriod(settings.income_period)
    ? settings.income_period
    : "monthly";
  const [period, setPeriod] = useState<DashboardPeriod>(initial);
  const [report, reload] = useResource(`report:${period}:${today}`, () =>
    financeApi.getDashboard(period, today),
  );
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
        title="Reportes"
        subtitle="Compara periodos, mira en qué se va tu dinero y descarga tus datos"
        actions={
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
        }
      />

      {report.status === "error" && !data ? (
        <div className="flex flex-col items-start gap-3">
          <FormAlert title="No pudimos cargar el reporte." items={[report.error.message]} />
          <button type="button" onClick={reload} className={buttonClass("ink")}>
            Reintentar
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
              Este periodo frente a {PREVIOUS_PERIOD_NAME[data.period]}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th scope="col" className={th}>
                      <span className="sr-only">Concepto</span>
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      ANTERIOR ({periodRange(data.previous_period_start, data.previous_period_end)})
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      ACTUAL ({periodRange(data.period_start, data.period_end)})
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      DIFERENCIA
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Ingresos", data.previous_income, data.income],
                    ["Gastado", data.previous_spent, data.spent],
                    [
                      "Neto (ingresos − gastos)",
                      net(data.previous_income, data.previous_spent),
                      net(data.income, data.spent),
                    ],
                  ].map(([label, previous, current]) => (
                    <tr key={label} className="border-line border-t">
                      <th scope="row" className={`${td} text-left font-bold`}>
                        {label}
                      </th>
                      <td className={`${td} text-right tabular-nums`}>{money(previous!)}</td>
                      <td className={`${td} text-right font-bold tabular-nums`}>
                        {money(current!)}
                      </td>
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
            </div>
          </section>

          <section
            aria-labelledby="report-categories-title"
            className="flex flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
          >
            <h2 id="report-categories-title" className="font-display text-xl font-bold">
              Gasto por categoría ({periodRange(data.period_start, data.period_end)})
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
            Exportar movimientos
          </h2>
          <p className="text-muted text-sm">
            Descarga tus movimientos como CSV para abrirlos en Excel o Google Sheets. Deja las
            fechas vacías para exportar todo.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <TextField
            id="export-from"
            label="Desde"
            type="date"
            value={exportFilters.from}
            onChange={(e) => setExportFilters((f) => ({ ...f, from: e.target.value }))}
          />
          <TextField
            id="export-to"
            label="Hasta"
            type="date"
            value={exportFilters.to}
            onChange={(e) => setExportFilters((f) => ({ ...f, to: e.target.value }))}
          />
          <SelectField
            id="export-type"
            label="Tipo"
            value={exportFilters.type}
            onChange={(e) =>
              setExportFilters((f) => ({ ...f, type: e.target.value as "" | TransactionType }))
            }
            options={[
              { value: "", label: "Todos" },
              { value: "expense", label: "Gastos" },
              { value: "income", label: "Ingresos" },
            ]}
          />
          <a
            href={financeApi.exportUrl({
              from: exportFilters.from || undefined,
              to: exportFilters.to || undefined,
              type: exportFilters.type || undefined,
            })}
            download
            className={buttonClass("primary", "md", "min-h-12")}
          >
            <Download aria-hidden="true" className="size-4" />
            Descargar CSV
          </a>
        </div>
      </section>
    </>
  );
}
