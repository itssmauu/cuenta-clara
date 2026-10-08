import { Landmark, PiggyBank, TrendingUp, Wallet, type LucideIcon } from "lucide-react";

import type { Account, AccountKind, AccountScope } from "@/lib/finance-api";
import { ACCOUNT_KIND_LABELS } from "@/lib/finance-validation";

const KIND_ICON: Record<AccountKind, LucideIcon> = {
  spending: Wallet,
  savings: PiggyBank,
  investment: TrendingUp,
  other: Landmark,
};

// Identity comes from the icon and the name; the tint only echoes it
const KIND_TILE: Record<AccountKind, string> = {
  spending: "bg-primary-tint text-primary",
  savings: "bg-mint-tint text-mint-ink",
  investment: "bg-accent-tint text-ink",
  other: "bg-canvas text-ink",
};

export function AccountIcon({ kind, size = "md" }: { kind: AccountKind; size?: "sm" | "md" }) {
  const Icon = KIND_ICON[kind];
  const box = size === "sm" ? "size-8 rounded-xl" : "size-11 rounded-2xl";
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center ${box} ${KIND_TILE[kind]}`}
    >
      <Icon className={size === "sm" ? "size-4" : "size-5"} />
    </span>
  );
}

/** "Ahorro" · "Gastos del día" — the kind in words, never only as an icon or color. */
export function kindLabel(account: Pick<Account, "kind" | "is_primary">): string {
  return account.is_primary ? "Principal · gastos del día" : ACCOUNT_KIND_LABELS[account.kind];
}

/** Options for a "Cuenta" select: primary first (as the API returns them). */
export function accountOptions(accounts: Account[]) {
  return accounts.map((a) => ({
    value: a.id,
    label: a.is_primary ? `${a.name} (principal)` : a.name,
  }));
}

export function accountName(accounts: Account[] | undefined, id: string | null): string {
  return accounts?.find((a) => a.id === id)?.name ?? "";
}

/** Compact "which account" select for the forecast and reports pages. */
export function AccountPicker({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[];
  value: AccountScope;
  onChange: (value: AccountScope) => void;
}) {
  // A single account needs no choice
  if (accounts.length < 2) return null;
  const primary = accounts.find((a) => a.is_primary);
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-full bg-white py-1 pr-1 pl-4 text-sm font-bold">
      Cuenta
      <select
        value={value ?? primary?.id ?? ""}
        onChange={(event) =>
          onChange(event.target.value === primary?.id ? undefined : event.target.value)
        }
        className="bg-canvas hover:bg-ink/5 min-h-9 cursor-pointer rounded-full px-3 text-sm font-bold transition-colors duration-200"
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
        <option value="all">Todas las cuentas</option>
      </select>
    </label>
  );
}
