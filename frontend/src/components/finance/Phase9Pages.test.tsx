import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import { financeApi, type Dashboard, type SavingsGoal } from "@/lib/finance-api";
import { subtractMoney } from "@/lib/format";
import { renderWithSession, testCategories } from "@/test-utils";

import { GoalsPage } from "./GoalsPage";
import { ReportsPage } from "./ReportsPage";
import { TransactionsPage } from "./TransactionsPage";

const laptop: SavingsGoal = {
  id: "g1",
  name: "Laptop",
  target_amount: "600.00",
  saved_amount: "150.00",
  due_date: "2026-10-25",
  account_id: "a-main",
  remaining: "450.00",
  progress_percent: 25,
  completed: false,
  overdue: false,
  periods_left: 3,
  suggested_per_period: "150.00",
};

describe("subtractMoney", () => {
  it("is exact to the cent", () => {
    expect(subtractMoney("0.30", "0.10")).toBe("0.20");
    expect(subtractMoney("40.00", "55.00")).toBe("-15.00");
  });
});

describe("GoalsPage", () => {
  beforeEach(() => {
    vi.spyOn(financeApi, "listGoals").mockResolvedValue([laptop]);
  });

  it("shows progress and how much to save per period", async () => {
    renderWithSession(<GoalsPage />);

    const card = await screen.findByRole("article", { name: "Laptop" });
    expect(card).toHaveTextContent("$150.00 de $600.00");
    expect(within(card).getByRole("meter", { name: "Progreso de Laptop" })).toHaveAttribute(
      "aria-valuenow",
      "25",
    );
    expect(card).toHaveTextContent(
      "Aparta $150.00 por semana (3 semanas) para llegar el 25 de octubre.",
    );
  });

  it("celebrates a completed goal and caps the bar at 100 %", async () => {
    vi.mocked(financeApi.listGoals).mockResolvedValue([
      {
        ...laptop,
        saved_amount: "700.00",
        remaining: "0.00",
        progress_percent: 117,
        completed: true,
        suggested_per_period: null,
      },
    ]);
    renderWithSession(<GoalsPage />);

    const card = await screen.findByRole("article", { name: "Laptop" });
    expect(card).toHaveTextContent("¡Meta cumplida!");
    expect(within(card).getByRole("meter")).toHaveAttribute("aria-valuenow", "100");
  });

  it("creates a goal without a deadline", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(financeApi, "createGoal").mockResolvedValue(laptop);
    renderWithSession(<GoalsPage />);
    await screen.findByRole("article", { name: "Laptop" });

    await user.click(screen.getByRole("button", { name: /Nueva meta/ }));
    const dialog = screen.getByRole("dialog", { name: "Nueva meta" });
    await user.type(within(dialog).getByLabelText("¿Para qué ahorras?"), "Viaje");
    await user.type(within(dialog).getByLabelText("Meta"), "1,200");
    await user.click(within(dialog).getByRole("button", { name: "Guardar meta" }));

    expect(create).toHaveBeenCalledWith({
      name: "Viaje",
      target_amount: "1200",
      saved_amount: "0",
      due_date: null,
      account_id: "a-main",
    });
    expect(await screen.findByText("Meta creada.")).toBeInTheDocument();
  });

  it("sends withdrawals as negative amounts and shows the API's refusal", async () => {
    const user = userEvent.setup();
    const contribute = vi
      .spyOn(financeApi, "contribute")
      .mockRejectedValue(new ApiError(422, "No puedes retirar más de lo que llevas ahorrado."));
    renderWithSession(<GoalsPage />);

    await user.click(await screen.findByRole("button", { name: "Aportar o retirar en Laptop" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Retirar"));
    await user.type(within(dialog).getByLabelText("Monto"), "500");
    await user.click(within(dialog).getByRole("button", { name: "Retirar" }));

    // A single account: nothing to move money from, so it is only recorded
    expect(contribute).toHaveBeenCalledWith("g1", "-500", null);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("No puedes retirar más");
  });

  it("shows an empty state", async () => {
    vi.mocked(financeApi.listGoals).mockResolvedValue([]);
    renderWithSession(<GoalsPage />);

    expect(await screen.findByText("Aún no tienes metas de ahorro")).toBeInTheDocument();
  });
});

const report: Dashboard = {
  account: { id: "a-main", name: "Gastos del día", kind: "spending", is_primary: true },
  period: "weekly",
  period_start: "2026-10-05",
  period_end: "2026-10-11",
  currency: "USD",
  initial_balance: "100.00",
  balance_as_of: "2026-09-01",
  opening_balance: "100.00",
  income: "160.00",
  fixed_expenses: "30.00",
  variable_expenses: "25.00",
  spent: "55.00",
  transfers: "0.00",
  available_balance: "205.00",
  spending_limit: "40.00",
  limit_remaining: "-15.00",
  limit_used_percent: 138,
  over_limit: true,
  limit_status: "over",
  previous_period_start: "2026-09-28",
  previous_period_end: "2026-10-04",
  previous_income: "160.00",
  previous_spent: "40.00",
  spending_by_category: [
    { category_id: "c-transport", name: "Transporte", color: "#5B4BDB", amount: "30.00" },
    { category_id: "c-food", name: "Comida", color: "#FF7A59", amount: "25.00" },
  ],
  series: [],
  upcoming_fixed_expenses: [],
  recent_transactions: [],
};

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.spyOn(financeApi, "getDashboard").mockResolvedValue(report);
  });

  it("compares this period with the previous one, in words", async () => {
    renderWithSession(<ReportsPage />);

    const table = await screen.findByRole("table", { name: "" });
    const spentRow = within(table).getByRole("rowheader", { name: "Gastado" }).closest("tr")!;
    expect(spentRow).toHaveTextContent("$40.00");
    expect(spentRow).toHaveTextContent("$55.00");
    expect(spentRow).toHaveTextContent("+$15.00 (más)");
    const incomeRow = within(table).getByRole("rowheader", { name: "Ingresos" }).closest("tr")!;
    expect(incomeRow).toHaveTextContent("Sin cambio");
  });

  it("breaks spending down by category", async () => {
    renderWithSession(<ReportsPage />);

    const table = await screen.findByRole("table", { name: "Gasto por categoría" });
    expect(
      within(table)
        .getAllByRole("row")
        .map((r) => r.textContent),
    ).toEqual(["CATEGORÍAGASTADO", "Transporte$30.00", "Comida$25.00"]);
  });

  it("builds the CSV link from the chosen filters", async () => {
    const user = userEvent.setup();
    renderWithSession(<ReportsPage />);

    await user.type(screen.getByLabelText("Desde"), "2026-10-01");
    await user.selectOptions(screen.getByLabelText("Tipo"), "expense");

    expect(screen.getByRole("link", { name: "Descargar CSV" })).toHaveAttribute(
      "href",
      "/api/v1/transactions/export?from=2026-10-01&type=expense&account_id=a-main",
    );
  });
});

describe("TransactionsPage export", () => {
  it("downloads exactly what the filters show", async () => {
    const user = userEvent.setup();
    vi.spyOn(financeApi, "listCategories").mockResolvedValue(testCategories);
    vi.spyOn(financeApi, "listTransactions").mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    renderWithSession(<TransactionsPage />);

    const link = screen.getByRole("link", { name: "Exportar CSV" });
    expect(link).toHaveAttribute("href", "/api/v1/transactions/export");

    await user.selectOptions(screen.getByLabelText("Tipo"), "income");
    expect(link).toHaveAttribute("href", "/api/v1/transactions/export?type=income");
  });
});
