import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";

import { SessionProvider, type Session } from "@/components/app/session";
import type { Category, Settings } from "@/lib/finance-api";

export const testSettings: Settings = {
  initial_balance: "100.00",
  balance_as_of: "2026-10-05",
  currency: "USD",
  income_period: "weekly",
  custom_period_days: null,
  spending_limit: "40.00",
  onboarding_completed: true,
};

export const testCategories: Category[] = [
  { id: "c-food", name: "Comida", color: "#FF7A59", is_default: true },
  { id: "c-transport", name: "Transporte", color: "#5B4BDB", is_default: true },
  { id: "c-gym", name: "Gimnasio", color: "#0F7A57", is_default: false },
];

/** Renders a signed-in page with a fake session. */
export function renderWithSession(ui: ReactNode, overrides: Partial<Session> = {}) {
  const session: Session = {
    user: { id: "u1", email: "ana@example.com", name: "Ana" },
    settings: testSettings,
    setSettings: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  };
  return { session, ...render(<SessionProvider value={session}>{ui}</SessionProvider>) };
}
