"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { CategorySpending } from "@/lib/finance-api";
import { formatMoney } from "@/lib/format";

/**
 * Spending per category as horizontal bars. One hue for every bar: the chart compares
 * magnitudes, and identity is carried by the category name (with its color dot in the table).
 */
export function CategoryBreakdown({
  items,
  currency,
  emptyText = "Aún no hay gastos en este periodo.",
}: {
  items: CategorySpending[];
  currency: string;
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <p className="text-muted text-sm">{emptyText}</p>;
  }

  const data = items.map((item) => ({
    name: item.name,
    amount: Number(item.amount),
    label: formatMoney(item.amount, currency),
  }));
  // 36 px per category keeps bars at most 24 px thick with air between them
  const height = Math.max(120, data.length * 36 + 16);

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 72, bottom: 0, left: 0 }}
          >
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-ink)", fontSize: 13, fontWeight: 700 }}
            />
            <Tooltip
              cursor={{ fill: "var(--color-canvas)" }}
              isAnimationActive={false}
              formatter={(_value, _name, entry) => [
                (entry.payload as { label: string }).label,
                "Gastado",
              ]}
            />
            <Bar
              dataKey="amount"
              fill="var(--color-primary-bar)"
              maxBarSize={24}
              radius={[0, 4, 4, 0]}
            >
              <LabelList
                dataKey="label"
                position="right"
                fill="var(--color-ink)"
                fontSize={12}
                fontWeight={800}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="text-sm">
        <summary className="text-primary inline-flex min-h-11 cursor-pointer items-center font-bold">
          Ver como tabla
        </summary>
        <table className="w-full border-collapse">
          <caption className="sr-only">Gasto por categoría</caption>
          <thead>
            <tr className="text-muted text-left text-xs tracking-[0.06em]">
              <th scope="col" className="py-2 font-bold">
                CATEGORÍA
              </th>
              <th scope="col" className="py-2 text-right font-bold">
                GASTADO
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.category_id ?? "none"} className="border-line border-t">
                <th scope="row" className="py-2 text-left font-semibold">
                  <span className="inline-flex items-center gap-2">
                    {item.color ? (
                      <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2.5">
                        <circle cx="5" cy="5" r="5" fill={item.color} />
                      </svg>
                    ) : null}
                    {item.name}
                  </span>
                </th>
                <td className="py-2 text-right font-bold tabular-nums">
                  {formatMoney(item.amount, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
