import Link from "next/link";

import type { Category, Transaction } from "@/lib/finance-api";
import { formatDate, formatMoney } from "@/lib/format";

type Props = {
  title: string;
  transactions: Transaction[] | undefined;
  categories: Map<string, Category>;
  currency: string;
  onAdd: () => void;
};

export function PeriodExpenses({ title, transactions, categories, currency, onAdd }: Props) {
  return (
    <section
      aria-labelledby="period-expenses-title"
      className="flex flex-col gap-4 rounded-[32px] bg-white p-6 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="period-expenses-title" className="font-display text-xl font-bold">
          {title}
        </h2>
        <Link
          href="/gastos"
          className="text-primary inline-flex min-h-11 items-center text-sm font-bold hover:underline"
        >
          Ver todos
        </Link>
      </div>

      {transactions === undefined ? (
        <p role="status" className="text-muted text-sm">
          Cargando movimientos…
        </p>
      ) : transactions.length === 0 ? (
        <div className="bg-canvas flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5">
          <p className="text-body text-sm font-semibold">
            Aún no registras gastos en este periodo.
          </p>
          <button
            type="button"
            onClick={onAdd}
            className="text-primary min-h-11 cursor-pointer text-sm font-bold hover:underline"
          >
            Añadir un gasto
          </button>
        </div>
      ) : (
        // Wide table scrolls inside its own box on small screens
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="text-muted text-left text-xs tracking-[0.06em]">
                <th scope="col" className="px-2 py-2.5 font-bold">
                  CONCEPTO
                </th>
                <th scope="col" className="px-2 py-2.5 font-bold">
                  CATEGORÍA
                </th>
                <th scope="col" className="px-2 py-2.5 font-bold">
                  FECHA
                </th>
                <th scope="col" className="px-2 py-2.5 text-right font-bold">
                  MONTO
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const category = t.category_id ? categories.get(t.category_id) : undefined;
                return (
                  <tr key={t.id} className="border-line border-t">
                    <td className="px-2 py-3.5 font-bold">
                      {t.note ?? <span className="text-muted font-semibold">Sin nota</span>}
                    </td>
                    <td className="px-2 py-3.5">
                      {category ? (
                        <span className="bg-canvas inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold">
                          <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2.5">
                            <circle cx="5" cy="5" r="5" fill={category.color} />
                          </svg>
                          {category.name}
                        </span>
                      ) : (
                        <span className="text-muted text-xs font-semibold">Sin categoría</span>
                      )}
                    </td>
                    <td className="text-muted px-2 py-3.5">
                      {formatDate(t.occurred_on, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="px-2 py-3.5 text-right font-extrabold tabular-nums">
                      −{formatMoney(t.amount, currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
