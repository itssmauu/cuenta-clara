"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/app/PageHeader";
import { useSession } from "@/components/app/session";
import { periodRange, periodTick, PERIOD_ADJECTIVE } from "@/components/dashboard/period-labels";
import { niceScale } from "@/components/dashboard/SpendingChart";
import { TableSkeleton } from "@/components/ui/Feedback";
import { FormAlert } from "@/components/ui/FormAlert";
import { financeApi, type DashboardPeriod, type Forecast } from "@/lib/finance-api";
import { FREQUENCY_LABELS, PERIOD_OPTIONS } from "@/lib/finance-validation";
import { formatMoney, todayISO } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

import { td, th } from "./RowActions";

const HORIZONS = [4, 8, 12];

const COLOR = {
  line: "var(--color-primary)",
  negative: "var(--color-accent)",
  ink: "var(--color-ink)",
  muted: "var(--color-muted)",
  grid: "var(--color-line)",
};

type Point = {
  tick: string;
  range: string;
  closing: number;
  closingText: string;
  negative: boolean;
};

function LineTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}) {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <div className="border-line rounded-xl border bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-display text-base font-extrabold tabular-nums">{point.closingText}</p>
      <p className="text-muted font-semibold">Saldo al cierre · {point.range}</p>
      {point.negative ? <p className="mt-1 font-semibold">Saldo negativo</p> : null}
    </div>
  );
}

function ForecastChart({ forecast }: { forecast: Forecast }) {
  const points: Point[] = forecast.periods.map((p) => ({
    tick: periodTick(forecast.period, p.period_start),
    range: periodRange(p.period_start, p.period_end),
    closing: Number(p.closing_balance),
    closingText: formatMoney(p.closing_balance, forecast.currency),
    negative: Number(p.closing_balance) < 0,
  }));
  const values = points.map((p) => p.closing);
  const hasNegative = values.some((v) => v < 0);
  const upper = niceScale(Math.max(...values, 0) * 1.1);
  const lower = hasNegative ? niceScale(-Math.min(...values) * 1.1) : null;

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={COLOR.grid} />
          <XAxis
            dataKey="tick"
            tickLine={false}
            axisLine={{ stroke: COLOR.grid }}
            tick={{ fill: COLOR.muted, fontSize: 12, fontWeight: 700 }}
          />
          <YAxis
            width={72}
            domain={[lower ? -lower.max : 0, upper.max]}
            ticks={lower ? undefined : upper.ticks}
            tickLine={false}
            axisLine={false}
            tick={{ fill: COLOR.muted, fontSize: 11, fontWeight: 700 }}
            tickFormatter={(value: number) => formatMoney(value, forecast.currency)}
          />
          {hasNegative ? <ReferenceLine y={0} stroke={COLOR.ink} strokeWidth={1.5} /> : null}
          <Tooltip
            content={(props) => <LineTooltip {...props} />}
            cursor={{ stroke: COLOR.muted, strokeDasharray: "4 4" }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="closing"
            name="Saldo al cierre"
            stroke={COLOR.line}
            strokeWidth={2}
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; index?: number }) => (
              <circle
                key={props.index}
                cx={props.cx}
                cy={props.cy}
                r={4}
                stroke="white"
                strokeWidth={2}
                fill={points[props.index ?? 0]?.negative ? COLOR.negative : COLOR.line}
              />
            )}
            activeDot={{ r: 6, stroke: "white", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ForecastPage() {
  const { settings } = useSession();
  const [today] = useState(todayISO);
  const [horizon, setHorizon] = useState(4);
  // undefined = the user's own income period (may be a custom length)
  const [period, setPeriod] = useState<DashboardPeriod | undefined>(undefined);

  const [forecast, reload] = useResource(`forecast:${horizon}:${period ?? "user"}:${today}`, () =>
    financeApi.getForecast(horizon, period, today),
  );
  const data = forecast.data;
  const money = (value: string) => formatMoney(value, data?.currency ?? settings.currency);
  const last = data?.periods.at(-1);
  const firstNegative = data?.periods.find((p) => Number(p.closing_balance) < 0);
  const activePeriod = period ?? data?.period;

  return (
    <>
      <PageHeader
        title="Predicción"
        subtitle="Tu saldo proyectado para los próximos periodos"
        actions={
          <>
            <div
              role="group"
              aria-label="Periodo"
              className="flex flex-wrap gap-1 rounded-full bg-white p-1"
            >
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={activePeriod === option}
                  onClick={() => setPeriod(option)}
                  className={`min-h-11 cursor-pointer rounded-full px-4 text-sm font-bold transition-colors duration-200 ${
                    activePeriod === option ? "bg-ink text-white" : "hover:bg-ink/5"
                  }`}
                >
                  {FREQUENCY_LABELS[option]}
                </button>
              ))}
            </div>
            <div
              role="group"
              aria-label="Cuántos periodos"
              className="flex gap-1 rounded-full bg-white p-1"
            >
              {HORIZONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} periodos`}
                  aria-pressed={horizon === n}
                  onClick={() => setHorizon(n)}
                  className={`min-h-11 min-w-11 cursor-pointer rounded-full px-3 text-sm font-bold transition-colors duration-200 ${
                    horizon === n ? "bg-ink text-white" : "hover:bg-ink/5"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </>
        }
      />

      {forecast.status === "error" && !data ? (
        <div className="flex flex-col items-start gap-3">
          <FormAlert title="No pudimos calcular tu predicción." items={[forecast.error.message]} />
          <button
            type="button"
            onClick={reload}
            className="text-primary min-h-11 font-bold hover:underline"
          >
            Reintentar
          </button>
        </div>
      ) : !data || !last ? (
        <TableSkeleton rows={4} />
      ) : (
        <div className="flex flex-col gap-5" aria-busy={forecast.status === "loading"}>
          <div className="flex flex-wrap gap-5">
            {/* The headline number: where the balance ends up */}
            <section
              aria-labelledby="forecast-headline"
              className="bg-ink flex min-w-0 flex-[1_1_280px] flex-col gap-2 rounded-[32px] p-7 text-white"
            >
              <h2 id="forecast-headline" className="text-on-ink text-[13px] font-bold">
                Saldo proyectado en {data.periods.length} periodos
              </h2>
              <p className="font-display text-[40px] leading-none font-extrabold tracking-[-0.02em] tabular-nums">
                {money(last.closing_balance)}
              </p>
              <p className="text-on-ink text-sm font-semibold">
                Al {periodRange(last.period_end, last.period_end)} · periodo{" "}
                {PERIOD_ADJECTIVE[data.period]}
              </p>
            </section>
            <section className="bg-primary-tint flex min-w-0 flex-[2_1_380px] flex-col gap-2 rounded-[32px] p-7">
              <h2 className="font-display text-base font-bold">Cómo se calcula</h2>
              <p className="text-on-tint text-sm leading-relaxed">
                El periodo actual usa tus datos reales. Los siguientes suman tus ingresos
                recurrentes, restan tus gastos fijos y un gasto variable estimado de{" "}
                <strong className="text-ink">{money(data.average_variable_spending)}</strong> por
                periodo (tu promedio reciente).
              </p>
              {firstNegative ? (
                <p className="text-ink mt-1 flex items-start gap-2 text-sm font-bold">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  Tu saldo quedaría en negativo a partir del periodo{" "}
                  {periodRange(firstNegative.period_start, firstNegative.period_end)}.
                </p>
              ) : null}
            </section>
          </div>

          <section
            aria-labelledby="forecast-chart-title"
            className="flex flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
          >
            <h2 id="forecast-chart-title" className="font-display text-xl font-bold">
              Saldo al cierre de cada periodo
            </h2>
            <ForecastChart forecast={data} />
          </section>

          <section
            aria-labelledby="forecast-table-title"
            className="flex flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
          >
            <h2 id="forecast-table-title" className="font-display text-xl font-bold">
              Detalle por periodo
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th scope="col" className={th}>
                      PERIODO
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      SALDO AL INICIAR
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      INGRESOS
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      GASTOS FIJOS
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      GASTO VARIABLE
                    </th>
                    <th scope="col" className={`${th} text-right`}>
                      SALDO AL CIERRE
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.periods.map((p) => {
                    const negative = Number(p.closing_balance) < 0;
                    return (
                      <tr
                        key={p.period_start}
                        className={`border-line border-t ${p.is_current ? "bg-canvas" : ""}`}
                      >
                        <th scope="row" className={`${td} text-left font-bold whitespace-nowrap`}>
                          {periodRange(p.period_start, p.period_end)}
                          {p.is_current ? (
                            <span className="text-primary ml-2 text-xs">Actual</span>
                          ) : null}
                        </th>
                        <td className={`${td} text-right tabular-nums`}>
                          {money(p.opening_balance)}
                        </td>
                        <td className={`${td} text-mint-ink text-right font-bold tabular-nums`}>
                          +{money(p.income)}
                        </td>
                        <td className={`${td} text-right tabular-nums`}>
                          −{money(p.fixed_expenses)}
                        </td>
                        <td className={`${td} text-right tabular-nums`}>
                          −{money(p.variable_spending)}
                          <span className="text-muted block text-xs">
                            {p.is_current ? "real" : "estimado"}
                          </span>
                        </td>
                        <td className={`${td} text-right font-extrabold tabular-nums`}>
                          {negative ? (
                            <span className="inline-flex items-center gap-1.5">
                              <AlertTriangle aria-hidden="true" className="size-4" />
                              {money(p.closing_balance)}
                              <span className="sr-only"> (saldo negativo)</span>
                            </span>
                          ) : (
                            money(p.closing_balance)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
