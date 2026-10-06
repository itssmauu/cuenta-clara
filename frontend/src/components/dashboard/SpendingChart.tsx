"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Dashboard } from "@/lib/finance-api";
import { formatMoney } from "@/lib/format";

import { periodRange, periodTick } from "./period-labels";

// Chart colors come from the design tokens (CSS variables), never raw hex
const COLOR = {
  within: "var(--color-primary-bar)",
  over: "var(--color-accent)",
  ink: "var(--color-ink)",
  muted: "var(--color-muted)",
  grid: "var(--color-line)",
};

type Point = {
  tick: string;
  range: string;
  spent: number;
  spentText: string;
  overBy: string | null;
  over: boolean;
};

/**
 * Clean y-axis: a round step (1, 2, 2.5 or 5 × 10ⁿ) for about 4 intervals, and a maximum
 * that is a whole number of steps, so ticks read 0 / 20 / 40 / 60 instead of 0 / 16.5 / 33.
 */
export function niceScale(value: number, intervals = 4): { max: number; ticks: number[] } {
  if (value <= 0) return { max: 1, ticks: [0, 1] };
  const raw = value / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * magnitude >= raw) ?? 10) * magnitude;
  const max = Math.ceil(value / step) * step;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  return { max, ticks };
}

function buildPoints(dashboard: Dashboard): Point[] {
  const money = (value: string | number) => formatMoney(value, dashboard.currency);
  return dashboard.series.map((p) => ({
    tick: periodTick(dashboard.period, p.period_start),
    range: periodRange(p.period_start, p.period_end),
    spent: Number(p.spent),
    spentText: money(p.spent),
    overBy: p.over_limit && p.limit ? money(Number(p.spent) - Number(p.limit)) : null,
    over: p.over_limit,
  }));
}

type TooltipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> };

function ChartTooltip({ active, payload }: TooltipProps) {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <div className="border-line rounded-xl border bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-display text-base font-extrabold tabular-nums">{point.spentText}</p>
      <p className="text-muted font-semibold">{point.range}</p>
      <p className="mt-1 font-semibold">
        {point.overBy ? `Te pasaste por ${point.overBy}` : "Dentro del límite"}
      </p>
    </div>
  );
}

export function SpendingChart({ dashboard }: { dashboard: Dashboard }) {
  const points = buildPoints(dashboard);
  const limit = dashboard.spending_limit === null ? null : Number(dashboard.spending_limit);
  const limitText = dashboard.spending_limit
    ? formatMoney(dashboard.spending_limit, dashboard.currency)
    : null;
  // Headroom so the limit line and value labels never touch the top, then a clean maximum
  const scale = niceScale(Math.max(limit ?? 0, ...points.map((p) => p.spent)) * 1.15);

  return (
    <div className="flex flex-col gap-4">
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={COLOR.grid} />
            <XAxis
              dataKey="tick"
              tickLine={false}
              axisLine={{ stroke: COLOR.grid }}
              tick={{ fill: COLOR.muted, fontSize: 12, fontWeight: 700 }}
            />
            <YAxis
              width={64}
              domain={[0, scale.max]}
              tickLine={false}
              axisLine={false}
              ticks={scale.ticks}
              tick={{ fill: COLOR.muted, fontSize: 11, fontWeight: 700 }}
              tickFormatter={(value: number) => formatMoney(value, dashboard.currency)}
            />
            <Tooltip
              content={(props) => <ChartTooltip {...props} />}
              cursor={{ fill: "var(--color-canvas)" }}
              isAnimationActive={false}
            />
            <Bar dataKey="spent" name="Gastado" maxBarSize={24} radius={[4, 4, 0, 0]}>
              {points.map((point) => (
                <Cell key={point.range} fill={point.over ? COLOR.over : COLOR.within} />
              ))}
              {/* Value labels only where the story is: the periods over the limit */}
              <LabelList
                dataKey="spentText"
                position="top"
                content={({ x, y, width, value, index }) =>
                  index !== undefined && points[index]?.over ? (
                    <text
                      x={Number(x) + Number(width) / 2}
                      y={Number(y) - 8}
                      textAnchor="middle"
                      fill={COLOR.ink}
                      fontSize={11}
                      fontWeight={800}
                    >
                      {value}
                    </text>
                  ) : null
                }
              />
            </Bar>
            {limit !== null ? (
              <ReferenceLine
                y={limit}
                stroke={COLOR.ink}
                strokeDasharray="6 4"
                strokeWidth={2}
                ifOverflow="extendDomain"
                label={{
                  value: `Límite ${limitText}`,
                  position: "insideTopRight",
                  fill: COLOR.ink,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="text-body flex flex-wrap gap-5 text-xs font-bold" aria-label="Leyenda">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="bg-primary-bar size-3.5 rounded" />
          Dentro del límite
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="bg-accent size-3.5 rounded" />
          Te pasaste
        </li>
        {limit !== null ? (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="border-ink w-5 border-t-2 border-dashed" />
            Límite
          </li>
        ) : null}
      </ul>

      {/* The same numbers as a table: reachable without hover, color or sight */}
      <details className="text-sm">
        <summary className="text-primary inline-flex min-h-11 cursor-pointer items-center font-bold">
          Ver los datos como tabla
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] border-collapse">
            <caption className="sr-only">Gasto por periodo comparado con el límite</caption>
            <thead>
              <tr className="text-muted text-left text-xs tracking-[0.06em]">
                <th scope="col" className="py-2 pr-4 font-bold">
                  PERIODO
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-bold">
                  GASTADO
                </th>
                <th scope="col" className="py-2 font-bold">
                  ESTADO
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.range} className="border-line border-t">
                  <th scope="row" className="py-2 pr-4 text-left font-semibold">
                    {point.range}
                  </th>
                  <td className="py-2 pr-4 text-right font-bold tabular-nums">{point.spentText}</td>
                  <td className="py-2">
                    {point.overBy
                      ? `Te pasaste por ${point.overBy}`
                      : limit === null
                        ? "Sin límite"
                        : "Dentro del límite"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
