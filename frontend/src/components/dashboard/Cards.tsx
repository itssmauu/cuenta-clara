"use client";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowUpRight,
  CheckCircle2,
  Info,
  Minus,
  PiggyBank,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { useT } from "@/i18n/client";
import type { Translate } from "@/i18n/translate";
import type { Dashboard, UpcomingFixedExpense } from "@/lib/finance-api";
import { formatDate, formatMoney, subtractMoney } from "@/lib/format";

import { PERIOD_ADJECTIVE, PREVIOUS_PERIOD_NAME } from "./period-labels";

type KpiProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  tone?: "ink" | "white" | "tint";
  valueClass?: string;
  comparison?: { current: string; previous: string; currency: string; previousName: string };
};

/** "↑ $15.00 más que la semana anterior": an arrow plus words, so it never relies on color. */
function Comparison({
  current,
  previous,
  currency,
  previousName,
}: NonNullable<KpiProps["comparison"]>) {
  const t = useT();
  const diff = subtractMoney(current, previous);
  const amount = Number(diff);
  const Icon = amount > 0 ? ArrowUpRight : amount < 0 ? ArrowDownRight : Minus;
  const previous_ = t(previousName);
  const difference = formatMoney(Math.abs(amount), currency);
  const text =
    amount === 0
      ? t("Igual que {previous}", { previous: previous_ })
      : amount > 0
        ? t("{amount} más que {previous}", { amount: difference, previous: previous_ })
        : t("{amount} menos que {previous}", { amount: difference, previous: previous_ });
  return (
    <span className="text-body flex items-center gap-1 text-xs font-bold">
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {text}
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  note,
  tone = "white",
  valueClass = "",
  comparison,
}: KpiProps) {
  const surface = { ink: "bg-ink text-white", white: "bg-white", tint: "bg-primary-tint" }[tone];
  const soft = { ink: "text-on-ink", white: "text-muted", tint: "text-on-tint" }[tone];
  const tile = {
    ink: "bg-ink-2 text-accent",
    white: "bg-canvas text-primary",
    tint: "bg-white text-primary",
  }[tone];
  return (
    <div className={`rounded-card relative flex flex-col gap-2 p-6 ${surface}`}>
      <span
        aria-hidden="true"
        className={`absolute top-5 right-5 grid size-10 place-items-center rounded-2xl ${tile}`}
      >
        <Icon className="size-5" />
      </span>
      <span className={`pr-12 text-[13px] font-semibold ${soft}`}>{label}</span>
      {/* Keyed by value: a new figure (another period) blurs in instead of snapping */}
      <span
        key={value}
        className={`font-display animate-value-in text-[28px] font-extrabold tracking-[-0.02em] tabular-nums sm:text-[32px] ${valueClass}`}
      >
        {value}
      </span>
      <span className={`text-xs font-semibold ${soft}`}>{note}</span>
      {comparison ? <Comparison {...comparison} /> : null}
    </div>
  );
}

export function KpiCards({ dashboard: d }: { dashboard: Dashboard }) {
  const t = useT();
  const money = (value: string) => formatMoney(value, d.currency);
  const since = formatDate(d.balance_as_of, { day: "numeric", month: "short", year: "numeric" });
  const compare = (current: string, previous: string) => ({
    current,
    previous,
    currency: d.currency,
    previousName: PREVIOUS_PERIOD_NAME[d.period],
  });
  return (
    <section
      aria-label={t("Resumen del periodo")}
      className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4"
    >
      <Kpi
        tone="ink"
        icon={Wallet}
        label={t("Saldo inicial")}
        value={money(d.initial_balance)}
        note={t("Desde el {date}", { date: since })}
      />
      <Kpi
        icon={ArrowUpCircle}
        label={t("Ingresos del periodo")}
        value={money(d.income)}
        note={t("Saldo al iniciar: {amount}", { amount: money(d.opening_balance) })}
        valueClass="text-mint-ink"
        comparison={compare(d.income, d.previous_income)}
      />
      <Kpi
        icon={ArrowDownCircle}
        label={t("Gastado")}
        value={money(d.spent)}
        note={t("Fijos {fixed} · Variables {variable}", {
          fixed: money(d.fixed_expenses),
          variable: money(d.variable_expenses),
        })}
        comparison={compare(d.spent, d.previous_spent)}
      />
      <Kpi
        tone="tint"
        icon={PiggyBank}
        label={t("Saldo disponible")}
        value={money(d.available_balance)}
        note={transfersNote(d, t) ?? t("Saldo al iniciar + ingresos − gastos")}
        valueClass="text-primary-hover"
      />
    </section>
  );
}

/** Money moved between accounts changes the balance without being income or spending. */
function transfersNote(d: Dashboard, t: Translate): string | null {
  const amount = Number(d.transfers);
  if (amount === 0) return null;
  const moved = formatMoney(Math.abs(amount), d.currency);
  return amount > 0
    ? t("Incluye {amount} que llegaron de otras cuentas", { amount: moved })
    : t("Incluye {amount} que pasaste a otras cuentas", { amount: moved });
}

/** "Dentro del límite · te quedan $X" / "Te pasaste por $X": icon + words, never color alone. */
export function LimitChip({ dashboard: d }: { dashboard: Dashboard }) {
  const t = useT();
  if (d.spending_limit === null || d.limit_remaining === null) {
    return (
      <span className="bg-canvas inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-bold">
        <Info aria-hidden="true" className="size-4" />
        {t("Sin límite de gasto")}
      </span>
    );
  }
  const remaining = Number(d.limit_remaining);
  if (d.over_limit) {
    return (
      <span className="bg-accent-tint text-ink inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-bold">
        <AlertTriangle aria-hidden="true" className="size-4" />
        {t("Te pasaste por {amount}", { amount: formatMoney(Math.abs(remaining), d.currency) })}
      </span>
    );
  }
  return (
    <span className="bg-mint-tint text-ink inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-bold">
      <CheckCircle2 aria-hidden="true" className="size-4" />
      {t("Dentro del límite · te quedan {amount}", {
        amount: formatMoney(remaining, d.currency),
      })}
    </span>
  );
}

export function LimitMeter({ dashboard: d }: { dashboard: Dashboard }) {
  const t = useT();
  const percent = d.limit_used_percent;
  // The spending limit belongs to the day-to-day account, not to savings or funds
  if (d.account && !d.account.is_primary) {
    return (
      <div className="bg-ink flex flex-col gap-3.5 rounded-[32px] p-7 text-white">
        <span className="text-on-ink text-[13px] font-bold">{t("Balance del periodo")}</span>
        <p className="font-display text-[26px] leading-tight font-extrabold tracking-[-0.02em]">
          {Number(d.spent) === 0 ? t("Sin gastos en esta cuenta") : t("Gastos de esta cuenta")}
        </p>
        <span className="text-on-ink text-[13px] font-semibold">
          {t(
            "Tu límite de gasto se aplica a tu cuenta principal. Aquí ves cómo cambia el saldo de esta cuenta.",
          )}
        </span>
      </div>
    );
  }
  const headline =
    percent === null
      ? t("Define un límite para medir tu ritmo")
      : d.over_limit
        ? t("Gastas más de lo planeado")
        : percent >= 80
          ? t("Cerca de tu límite")
          : t("Vas en equilibrio");

  return (
    <div className="bg-ink flex flex-col gap-3.5 rounded-[32px] p-7 text-white">
      <span className="text-on-ink text-[13px] font-bold">{t("Balance del periodo")}</span>
      <p className="font-display text-[26px] leading-tight font-extrabold tracking-[-0.02em]">
        {headline}
      </p>
      {percent === null ? (
        <Link
          href="/ajustes"
          className="text-accent inline-flex min-h-11 items-center text-sm font-bold hover:underline"
        >
          {t("Definir límite de gasto")}
        </Link>
      ) : (
        <>
          <div
            role="meter"
            aria-label={t("Uso del límite de gasto")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(percent, 100)}
            aria-valuetext={t("{percent}% del límite", { percent })}
            className="bg-ink-2 h-3.5 overflow-hidden rounded-full"
          >
            {/* Rendered on the client only, so this style is applied through the CSSOM (CSP-safe) */}
            {/* Full-width bar clipped to the percentage: it grows on arrival and glides on
                changes without the rounded end ever squashing */}
            <div
              className={`meter-fill h-full rounded-full ${d.over_limit ? "bg-accent" : "bg-mint"}`}
              style={{ clipPath: `inset(0 ${100 - Math.min(percent, 100)}% 0 0 round 999px)` }}
            />
          </div>
          <span className="text-on-ink text-[13px] font-semibold">
            {t("Has usado el {percent}% de tu límite {period}", {
              percent,
              period: t(PERIOD_ADJECTIVE[d.period]),
            })}
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
  const t = useT();
  return (
    <section
      aria-labelledby="upcoming-title"
      className="bg-primary-tint flex flex-col gap-3 rounded-[32px] p-6"
    >
      <h2 id="upcoming-title" className="font-display text-base font-bold">
        {t("Próximos gastos fijos")}
      </h2>
      {items.length === 0 ? (
        <p className="text-on-tint text-sm">
          {t("No tienes gastos fijos activos.")}{" "}
          <Link href="/gastos-fijos" className="text-primary font-bold hover:underline">
            {t("Agregar uno")}
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

/** Alert once 80 % of the period's limit is used, and again when it is exceeded. */
export function LimitAlert({ dashboard: d }: { dashboard: Dashboard }) {
  const t = useT();
  if (d.limit_status !== "warning" && d.limit_status !== "over") return null;
  const remaining = d.limit_remaining ?? "0";
  const period = t(PERIOD_ADJECTIVE[d.period]);
  return (
    <p
      role="status"
      className="bg-accent-tint text-ink flex items-start gap-3 rounded-2xl px-5 py-4 text-sm font-bold"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      {d.limit_status === "over"
        ? t("Te pasaste de tu límite {period} por {amount}. Revisa tus gastos de este periodo.", {
            period,
            amount: formatMoney(Math.abs(Number(remaining)), d.currency),
          })
        : t("Atención: llevas el {percent}% de tu límite {period}. Te quedan {amount}.", {
            percent: d.limit_used_percent ?? 0,
            period,
            amount: formatMoney(remaining, d.currency),
          })}
    </p>
  );
}
