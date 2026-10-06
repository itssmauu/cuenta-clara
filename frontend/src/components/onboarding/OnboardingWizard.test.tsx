import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, authApi } from "@/lib/api";
import { financeApi, type Settings } from "@/lib/finance-api";

import { OnboardingWizard } from "./OnboardingWizard";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const pending: Settings = {
  initial_balance: "0.00",
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
  vi.spyOn(financeApi, "createFixedExpense").mockResolvedValue({ id: "f1" });
  vi.spyOn(financeApi, "createIncome").mockResolvedValue({ id: "i1" });
  vi.spyOn(financeApi, "saveSettings").mockResolvedValue({
    ...pending,
    onboarding_completed: true,
  });
});

async function walkThroughSteps(user: ReturnType<typeof userEvent.setup>) {
  // 1 · initial balance
  await user.type(await screen.findByLabelText("¿Con cuánto dinero cuentas hoy?"), "100");
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

    expect(financeApi.createFixedExpense).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Pasaje", amount: "30", frequency: "weekly", due_day: null }),
    );
    expect(financeApi.createIncome).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Beca", amount: "160", frequency: "weekly" }),
    );
    expect(financeApi.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        initial_balance: "100",
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

    await user.type(await screen.findByLabelText("¿Con cuánto dinero cuentas hoy?"), "cien");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByLabelText("¿Con cuánto dinero cuentas hoy?")).toHaveAccessibleDescription(
      expect.stringContaining("Usa solo números"),
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
