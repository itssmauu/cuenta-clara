import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, authApi } from "@/lib/api";
import { financeApi, type Settings } from "@/lib/finance-api";

import { OnboardingWizard } from "./OnboardingWizard";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const pending: Settings = {
  balance_as_of: "2026-10-05",
  currency: "USD",
  income_period: "monthly",
  custom_period_days: null,
  spending_limit: null,
  onboarding_completed: false,
};

beforeEach(() => {
  replace.mockReset();
  vi.spyOn(authApi, "me").mockResolvedValue({ id: "u1", email: "ana@example.com", name: "Ana" });
  vi.spyOn(financeApi, "getSettings").mockResolvedValue(pending);
  vi.spyOn(financeApi, "createFixedExpense").mockResolvedValue({
    id: "f1",
    name: "Pasaje",
    amount: "30.00",
    frequency: "weekly",
    custom_period_days: null,
    start_date: "2026-10-05",
    due_day: null,
    category_id: null,
    is_active: true,
    account_id: "a-main",
  });
  vi.spyOn(financeApi, "createIncome").mockResolvedValue({
    id: "i1",
    label: "Beca",
    amount: "160.00",
    frequency: "weekly",
    custom_period_days: null,
    start_date: "2026-10-05",
    is_active: true,
    account_id: "a-main",
  });
  vi.spyOn(financeApi, "updateAccount").mockImplementation(async (id, data) => ({
    ...data,
    id,
    balance: data.initial_balance,
  }));
  vi.spyOn(financeApi, "createAccount").mockImplementation(async (data) => ({
    ...data,
    id: `a-${data.name}`,
    balance: data.initial_balance,
  }));
  vi.spyOn(financeApi, "saveSettings").mockResolvedValue({
    ...pending,
    onboarding_completed: true,
  });
});

async function walkThroughSteps(user: ReturnType<typeof userEvent.setup>) {
  // 1 · two accounts: $100 for daily spending and $400 of savings
  const first = await screen.findByRole("group", { name: "Cuenta 1" });
  await user.type(within(first).getByLabelText("¿Cuánto tiene hoy?"), "100");
  await user.click(screen.getByRole("button", { name: "Agregar otra cuenta" }));
  const second = screen.getByRole("group", { name: "Cuenta 2" });
  await user.type(within(second).getByLabelText("Nombre"), "Ahorro");
  await user.type(within(second).getByLabelText("¿Cuánto tiene hoy?"), "400");
  await user.click(screen.getByRole("button", { name: "Continuar" }));

  // 2 · one fixed expense
  await user.type(await screen.findByLabelText("Nombre"), "Pasaje");
  await user.type(screen.getByLabelText("Monto"), "30");
  await user.selectOptions(screen.getByLabelText("Frecuencia"), "weekly");
  await user.click(screen.getByRole("button", { name: "Agregar gasto fijo" }));
  expect(screen.getByRole("list", { name: "Gastos fijos agregados" })).toHaveTextContent("Pasaje");
  await user.click(screen.getByRole("button", { name: "Continuar" }));

  // 3 · weekly income of $160
  await user.selectOptions(await screen.findByLabelText("¿Cada cuánto recibes dinero?"), "weekly");
  await user.type(screen.getByLabelText(/¿Cuánto recibes cada vez\?/), "160");
  await user.type(screen.getByLabelText("¿De dónde viene?"), "Beca");
  expect(screen.getByLabelText("¿A qué cuenta te llega?")).toHaveDisplayValue("Gastos del día");
  await user.click(screen.getByRole("button", { name: "Continuar" }));

  // 4 · limit
  await user.type(await screen.findByLabelText(/como máximo por periodo semanal/), "40");
  await user.click(screen.getByRole("button", { name: "Ver mi dashboard" }));
}

describe("OnboardingWizard", () => {
  it("saves everything at the end and opens the dashboard", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);

    await walkThroughSteps(user);

    // The day-to-day account becomes the primary one registration created
    expect(financeApi.updateAccount).toHaveBeenCalledWith("a-main", {
      name: "Gastos del día",
      kind: "spending",
      initial_balance: "100",
      is_primary: true,
    });
    expect(financeApi.createAccount).toHaveBeenCalledWith({
      name: "Ahorro",
      kind: "savings",
      initial_balance: "400",
      is_primary: false,
    });
    expect(financeApi.createFixedExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Pasaje",
        amount: "30",
        frequency: "weekly",
        due_day: null,
        account_id: "a-main",
      }),
    );
    expect(financeApi.createIncome).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Beca",
        amount: "160",
        frequency: "weekly",
        account_id: "a-main",
      }),
    );
    expect(financeApi.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        income_period: "weekly",
        spending_limit: "40",
        onboarding_completed: true,
      }),
    );
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("validates each step before moving on", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);

    const first = await screen.findByRole("group", { name: "Cuenta 1" });
    await user.type(within(first).getByLabelText("¿Cuánto tiene hoy?"), "cien");
    await user.clear(within(first).getByLabelText("Nombre"));
    await user.type(within(first).getByLabelText("Nombre"), "0412345678901");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(within(first).getByLabelText("¿Cuánto tiene hoy?")).toHaveAccessibleDescription(
      expect.stringContaining("Usa solo números"),
    );
    // Never an account number, even in the name
    expect(within(first).getByLabelText("Nombre")).toHaveAccessibleDescription(
      expect.stringContaining("no escribas números de cuenta"),
    );
    expect(screen.getByText("Paso 1 de 4")).toBeInTheDocument();
  });

  it("does not create duplicates when retrying after a failure", async () => {
    const user = userEvent.setup();
    vi.mocked(financeApi.saveSettings).mockRejectedValueOnce(
      new ApiError(500, "Error del servidor."),
    );
    render(<OnboardingWizard />);

    await walkThroughSteps(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos guardar todo");

    await user.click(screen.getByRole("button", { name: "Ver mi dashboard" }));

    expect(financeApi.updateAccount).toHaveBeenCalledTimes(1);
    expect(financeApi.createAccount).toHaveBeenCalledTimes(1);
    expect(financeApi.createFixedExpense).toHaveBeenCalledTimes(1);
    expect(financeApi.createIncome).toHaveBeenCalledTimes(1);
    expect(financeApi.saveSettings).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("sends users who already finished onboarding to the dashboard", async () => {
    vi.mocked(financeApi.getSettings).mockResolvedValue({ ...pending, onboarding_completed: true });
    render(<OnboardingWizard />);

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });
});
