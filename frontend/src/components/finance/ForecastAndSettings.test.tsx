import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import { financeApi, type Forecast } from "@/lib/finance-api";
import { renderWithSession, testCategories, testSettings } from "@/test-utils";

import { ForecastPage } from "./ForecastPage";
import { SettingsPage } from "./SettingsPage";

// 100 − 30 + 160 = 230, then +130 per week
const forecast: Forecast = {
  period: "weekly",
  currency: "USD",
  average_variable_spending: "0.00",
  periods: [
    ["2026-10-05", "2026-10-11", "100.00", "230.00", true],
    ["2026-10-12", "2026-10-18", "230.00", "360.00", false],
    ["2026-10-19", "2026-10-25", "360.00", "490.00", false],
    ["2026-10-26", "2026-11-01", "490.00", "620.00", false],
  ].map(([start, end, opening, closing, current]) => ({
    period_start: start as string,
    period_end: end as string,
    opening_balance: opening as string,
    income: "160.00",
    fixed_expenses: "30.00",
    variable_spending: "0.00",
    closing_balance: closing as string,
    is_current: current as boolean,
  })),
};

describe("ForecastPage", () => {
  beforeEach(() => {
    vi.spyOn(financeApi, "getForecast").mockResolvedValue(forecast);
  });

  it("headlines the final projected balance and details every period", async () => {
    renderWithSession(<ForecastPage />);

    const headline = await screen.findByRole("region", { name: "Saldo proyectado en 4 periodos" });
    expect(within(headline).getByText("$620.00")).toBeInTheDocument();
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(5);
    expect(rows[1]).toHaveTextContent("Actual");
    expect(rows[1]).toHaveTextContent("$230.00");
    expect(financeApi.getForecast).toHaveBeenCalledWith(4, undefined, expect.any(String));
  });

  it("changes the horizon and the period", async () => {
    const user = userEvent.setup();
    renderWithSession(<ForecastPage />);
    await screen.findByRole("region", { name: "Saldo proyectado en 4 periodos" });

    await user.click(screen.getByRole("button", { name: "8 periodos" }));
    expect(financeApi.getForecast).toHaveBeenLastCalledWith(8, undefined, expect.any(String));
    await user.click(screen.getByRole("button", { name: "Mensual" }));
    expect(financeApi.getForecast).toHaveBeenLastCalledWith(8, "monthly", expect.any(String));
  });

  it("warns, with words, when the balance would go negative", async () => {
    const negative = structuredClone(forecast);
    negative.periods[3]!.closing_balance = "-20.00";
    vi.mocked(financeApi.getForecast).mockResolvedValue(negative);
    renderWithSession(<ForecastPage />);

    expect(await screen.findByText(/quedaría en negativo/)).toBeInTheDocument();
    expect(screen.getByText("(saldo negativo)", { exact: false })).toBeInTheDocument();
  });
});

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.spyOn(financeApi, "listCategories").mockResolvedValue(testCategories);
  });

  it("saves changes and updates the session", async () => {
    const user = userEvent.setup();
    const saved = { ...testSettings, spending_limit: "50.00" };
    const save = vi.spyOn(financeApi, "saveSettings").mockResolvedValue(saved);
    const { session } = renderWithSession(<SettingsPage />);

    const submit = screen.getByRole("button", { name: "Guardar cambios" });
    expect(submit).toBeDisabled(); // nothing changed yet

    const limit = screen.getByLabelText("Límite de gasto por periodo (opcional)");
    await user.clear(limit);
    await user.type(limit, "50");
    await user.click(submit);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        initial_balance: "100.00",
        spending_limit: "50",
        income_period: "weekly",
        custom_period_days: null,
        onboarding_completed: true,
      }),
    );
    expect(session.setSettings).toHaveBeenCalledWith(saved);
    expect(await screen.findByText("Configuración guardada.")).toBeInTheDocument();
  });

  it("an empty limit means no limit", async () => {
    const user = userEvent.setup();
    const save = vi.spyOn(financeApi, "saveSettings").mockResolvedValue(testSettings);
    renderWithSession(<SettingsPage />);

    await user.clear(screen.getByLabelText("Límite de gasto por periodo (opcional)"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ spending_limit: null }));
  });

  it("shows default categories as read-only and lets the user manage their own", async () => {
    renderWithSession(<SettingsPage />);

    const section = screen.getByRole("region", { name: "Categorías" });
    expect(await within(section).findByText("Comida")).toBeInTheDocument();
    expect(
      within(section).queryByRole("button", { name: /Eliminar la categoría Comida/ }),
    ).toBeNull();
    expect(
      within(section).getByRole("button", { name: "Eliminar la categoría Gimnasio" }),
    ).toBeInTheDocument();
  });

  it("shows the API message when a category name is taken", async () => {
    const user = userEvent.setup();
    vi.spyOn(financeApi, "createCategory").mockRejectedValue(
      new ApiError(409, "Ya tienes una categoría con ese nombre."),
    );
    renderWithSession(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Nueva categoría" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva categoría" });
    await user.type(within(dialog).getByLabelText("Nombre"), "comida");
    await user.click(within(dialog).getByRole("button", { name: "Guardar categoría" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Ya tienes una categoría con ese nombre.",
    );
  });
});
