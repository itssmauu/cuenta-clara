import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";

import { SessionProvider, type Session } from "@/components/app/session";
import type { Account, Category, Settings } from "@/lib/finance-api";

export const testSettings: Settings = {
  balance_as_of: "2026-10-05",
  currency: "USD",
  income_period: "weekly",
  custom_period_days: null,
  spending_limit: "40.00",
  onboarding_completed: true,
};

export const testPrimaryAccount: Account = {
  id: "a-main",
  name: "Gastos del día",
  kind: "spending",
  initial_balance: "100.00",
  is_primary: true,
  balance: "230.00",
};

export const testSavingsAccount: Account = {
  id: "a-savings",
  name: "Ahorro",
  kind: "savings",
  initial_balance: "400.00",
  is_primary: false,
  balance: "400.00",
};

export const testCategories: Category[] = [
  { id: "c-food", name: "Comida", color: "#FF7A59", is_default: true },
  { id: "c-transport", name: "Transporte", color: "#5B4BDB", is_default: true },
  { id: "c-gym", name: "Gimnasio", color: "#0F7A57", is_default: false },
];

/** Renders a signed-in page with a fake session. */
export function renderWithSession(ui: ReactNode, overrides: Partial<Session> = {}) {
  const session: Session = {
    user: { id: "u1", email: "ana@example.com", name: "Ana", terms_accepted: true },
    settings: testSettings,
    setSettings: vi.fn(),
    setUser: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  };
  return { session, ...render(<SessionProvider value={session}>{ui}</SessionProvider>) };
}
