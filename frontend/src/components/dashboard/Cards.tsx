import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import Link from "next/link";

import type { Dashboard, UpcomingFixedExpense } from "@/lib/finance-api";
import { formatDate, formatMoney } from "@/lib/format";

import { PERIOD_ADJECTIVE } from "./period-labels";

type KpiProps = {
  label: string;
  value: string;
  note: string;
  tone?: "ink" | "white" | "tint";
  valueClass?: string;
};

function Kpi({ label, value, note, tone = "white", valueClass = "" }: KpiProps) {
  const surface = { ink: "bg-ink text-white", white: "bg-white", tint: "bg-primary-tint" }[tone];
  const soft = { ink: "text-on-ink", white: "text-muted", tint: "text-on-tint" }[tone];
  return (
    <div className={`rounded-card flex flex-col gap-2 p-6 ${surface}`}>
      <span className={`text-[13px] font-semibold ${soft}`}>{label}</span>
      <span
        className={`font-display text-[28px] font-extrabold tracking-[-0.02em] tabular-nums sm:text-[32px] ${valueClass}`}
      >
        {value}
      </span>
      <span className={`text-xs font-semibold ${soft}`}>{note}</span>
    </div>
  );
}

export function KpiCards({ dashboard: d }: { dashboard: Dashboard }) {
  const money = (value: string) => formatMoney(value, d.currency);
  const since = formatDate(d.balance_as_of, { day: "numeric", month: "short", year: "numeric" });
  return (
    <section
      aria-label="Resumen del periodo"
      className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4"
    >
      <Kpi
        tone="ink"
        label="Monto inicial"
        value={money(d.initial_balance)}
        note={`Desde el ${since}`}
      />
      <Kpi
        label="Ingresos del periodo"
        value={money(d.income)}
        note={`Saldo al iniciar: ${money(d.opening_balance)}`}
        valueClass="text-mint-ink"
      />
      <Kpi
        label="Gastado"
        value={money(d.spent)}
        note={`Fijos ${money(d.fixed_expenses)} · Variables ${money(d.variable_expenses)}`}
      />
      <Kpi
        tone="tint"
        label="Saldo disponible"
        value={money(d.available_balance)}
        note="Saldo al iniciar + ingresos − gastos"
        valueClass="text-primary-hover"
      />
    </section>
  );
}

/** "Dentro del límite · te quedan $X" / "Te pasaste por $X": icon + words, never color alone. */
export function LimitChip({ dashboard: d }: { dashboard: Dashboard }) {
  if (d.spending_limit === null || d.limit_remaining === null) {
    return (
      <span className="bg-canvas inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-bold">
        <Info aria-hidden="true" className="size-4" />
        Sin límite de gasto
      </span>
    );
  }
  const remaining = Number(d.limit_remaining);
  if (d.over_limit) {
    return (
      <span className="bg-accent-tint text-ink inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-bold">
        <AlertTriangle aria-hidden="true" className="size-4" />
        Te pasaste por {formatMoney(Math.abs(remaining), d.currency)}
      </span>
    );
  }
  return (
    <span className="bg-mint-tint text-ink inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-bold">
      <CheckCircle2 aria-hidden="true" className="size-4" />
      Dentro del límite · te quedan {formatMoney(remaining, d.currency)}
    </span>
  );
}

export function LimitMeter({ dashboard: d }: { dashboard: Dashboard }) {
  const percent = d.limit_used_percent;
  const headline =
    percent === null
      ? "Define un límite para medir tu ritmo"
      : d.over_limit
        ? "Gastas más de lo planeado"
        : percent >= 80
          ? "Cerca de tu límite"
          : "Vas en equilibrio";

  return (
    <div className="bg-ink flex flex-col gap-3.5 rounded-[32px] p-7 text-white">
      <span className="text-on-ink text-[13px] font-bold">Balance del periodo</span>
      <p className="font-display text-[26px] leading-tight font-extrabold tracking-[-0.02em]">
        {headline}
      </p>
      {percent === null ? (
        <Link
          href="/ajustes"
          className="text-accent inline-flex min-h-11 items-center text-sm font-bold hover:underline"
        >
          Definir límite de gasto
        </Link>
      ) : (
        <>
          <div
            role="meter"
            aria-label="Uso del límite de gasto"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(percent, 100)}
            aria-valuetext={`${percent}% del límite`}
            className="bg-ink-2 h-3.5 overflow-hidden rounded-full"
          >
            {/* Rendered on the client only, so this style is applied through the CSSOM (CSP-safe) */}
            <div
              className={`h-full rounded-full ${d.over_limit ? "bg-accent" : "bg-mint"}`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <span className="text-on-ink text-[13px] font-semibold">
            Has usado el {percent}% de tu límite {PERIOD_ADJECTIVE[d.period]}
          </span>
        </>
      )}
    </div>
  );
}

export function UpcomingExpenses({
  items,
  currency,
}: {
  items: UpcomingFixedExpense[];
  currency: string;
}) {
  return (
    <section
      aria-labelledby="upcoming-title"
      className="bg-primary-tint flex flex-col gap-3 rounded-[32px] p-6"
    >
      <h2 id="upcoming-title" className="font-display text-base font-bold">
        Próximos gastos fijos
      </h2>
      {items.length === 0 ? (
        <p className="text-on-tint text-sm">
          No tienes gastos fijos activos.{" "}
          <Link href="/gastos-fijos" className="text-primary font-bold hover:underline">
            Agregar uno
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 text-sm font-semibold">
              <span className="truncate">{item.name}</span>
              <span className="shrink-0 tabular-nums">
                {formatMoney(item.amount, currency)} ·{" "}
                {formatDate(item.due_on, { day: "numeric", month: "short" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
