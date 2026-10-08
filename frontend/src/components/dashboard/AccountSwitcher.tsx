"use client";

import { Layers, Plus } from "lucide-react";
import Link from "next/link";

import { AccountIcon, kindLabel } from "@/components/finance/accounts-ui";
import type { Account, AccountScope } from "@/lib/finance-api";
import { formatMoney } from "@/lib/format";

const card =
  "flex min-h-[92px] w-[210px] shrink-0 cursor-pointer flex-col justify-between gap-2 rounded-3xl p-4 text-left " +
  "transition-[background-color,color,box-shadow,scale] duration-200 ease-out-strong active:scale-[0.97]";

/**
 * "Tus cuentas": one card per account with its balance, plus "Todas". Choosing one
 * scopes the whole dashboard to it. Scrolls sideways on a phone.
 */
export function AccountSwitcher({
  accounts,
  value,
  onChange,
  currency,
}: {
  accounts: Account[];
  value: AccountScope;
  onChange: (value: AccountScope) => void;
  currency: string;
}) {
  const primary = accounts.find((a) => a.is_primary);
  const selected = value ?? primary?.id;
  const total = (
    accounts.reduce((sum, a) => sum + Math.round(Number(a.balance) * 100), 0) / 100
  ).toFixed(2);

  return (
    <div
      role="group"
      aria-label="Cuenta"
      className="-mx-1 flex [scrollbar-width:thin] gap-3 overflow-x-auto px-1 pt-1 pb-2"
    >
      {accounts.map((account) => {
        const active = selected === account.id;
        return (
          <button
            key={account.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(account.is_primary ? undefined : account.id)}
            className={`${card} ${
              active
                ? "bg-ink shadow-ink/25 text-white shadow-lg"
                : "hover:ring-primary-soft bg-white hover:ring-2"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <AccountIcon kind={account.kind} size="sm" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-bold">{account.name}</span>
                <span
                  className={`truncate text-[11px] font-semibold ${active ? "text-on-ink" : "text-muted"}`}
                >
                  {kindLabel(account)}
                </span>
              </span>
            </span>
            <span className="font-display text-xl font-extrabold tabular-nums">
              {formatMoney(account.balance, currency)}
            </span>
          </button>
        );
      })}

      {accounts.length > 1 ? (
        <button
          type="button"
          aria-pressed={selected === "all"}
          onClick={() => onChange("all")}
          className={`${card} ${
            selected === "all"
              ? "bg-ink shadow-ink/25 text-white shadow-lg"
              : "hover:ring-primary-soft bg-white hover:ring-2"
          }`}
        >
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="bg-canvas text-ink grid size-8 shrink-0 place-items-center rounded-xl"
            >
              <Layers className="size-4" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-bold">Todas</span>
              <span
                className={`text-[11px] font-semibold ${selected === "all" ? "text-on-ink" : "text-muted"}`}
              >
                Suma de tus cuentas
              </span>
            </span>
          </span>
          <span className="font-display text-xl font-extrabold tabular-nums">
            {formatMoney(total, currency)}
          </span>
        </button>
      ) : (
        // With a single account, show where to add the others (savings, funds…)
        <Link
          href="/cuentas"
          className={`${card} border-line text-body hover:border-primary hover:text-ink border-2 border-dashed`}
        >
          <Plus aria-hidden="true" className="size-5" />
          <span className="text-sm leading-snug font-bold">
            ¿Tienes otra cuenta para ahorro o fondos? Agrégala
          </span>
        </Link>
      )}
    </div>
  );
}
