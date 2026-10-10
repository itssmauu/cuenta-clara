import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionProvider } from "@/components/app/session";
import { financeApi, type Dashboard as DashboardData, type Settings } from "@/lib/finance-api";

import { Dashboard } from "./Dashboard";

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => search,
}));

const settings: Settings = {
  balance_as_of: "2026-10-05",
  currency: "USD",
  income_period: "weekly",
  custom_period_days: null,
  spending_limit: "40.00",
  onboarding_completed: true,
};

// The spec example: $100, spent $30, received $160 → $230
const dashboard: DashboardData = {
  account: { id: "a-main", name: "Gastos del día", kind: "spending", is_primary: true },
  period: "weekly",
  period_start: "2026-10-05",
  period_end: "2026-10-11",
  currency: "USD",
  initial_balance: "100.00",
  balance_as_of: "2026-10-05",
  opening_balance: "100.00",
  income: "160.00",
  fixed_expenses: "0.00",
  variable_expenses: "30.00",
  spent: "30.00",
  transfers: "0.00",
  available_balance: "230.00",
  spending_limit: "40.00",
  limit_remaining: "10.00",
  limit_used_percent: 75,
  over_limit: false,
  limit_status: "ok",
  previous_period_start: "2026-09-28",
  previous_period_end: "2026-10-04",
  previous_income: "160.00",
  previous_spent: "45.00",
  spending_by_category: [
    { category_id: "c1", name: "Transporte", color: "#5B4BDB", amount: "30.00" },
  ],
  series: [
    {
      period_start: "2026-09-28",
      period_end: "2026-10-04",
      spent: "45.00",
      limit: "40.00",
      over_limit: true,
    },
    {
      period_start: "2026-10-05",
      period_end: "2026-10-11",
      spent: "30.00",
      limit: "40.00",
      over_limit: false,
    },
  ],
  upcoming_fixed_expenses: [
    { id: "f1", name: "Internet", amount: "25.00", due_on: "2026-10-15", category_id: null },
  ],
  recent_transactions: [],
};

function renderDashboard() {
  return render(
    <SessionProvider
      value={{
        user: { id: "u1", email: "ana@example.com", name: "Ana", terms_accepted: true },
        settings,
        setSettings: vi.fn(),
        setUser: vi.fn(),
        logout: vi.fn(),
      }}
    >
      <Dashboard />
    </SessionProvider>,
  );
}

beforeEach(() => {
  search = new URLSearchParams();
  replace.mockReset();
  vi.spyOn(financeApi, "getDashboard").mockResolvedValue(dashboard);
  vi.spyOn(financeApi, "listCategories").mockResolvedValue([
    { id: "c1", name: "Transporte", color: "#5B4BDB", is_default: true },
  ]);
  vi.spyOn(financeApi, "listTransactions").mockResolvedValue({
    items: [
      {
        id: "t1",
        type: "expense",
        amount: "30.00",
        category_id: "c1",
        occurred_on: "2026-10-06",
        note: "Pasaje",
        account_id: "a-main",
      },
    ],
    total: 1,
    limit: 10,
    offset: 0,
  });
});

describe("Dashboard", () => {
  it("shows the four cards with the spec example", async () => {
    renderDashboard();

    const cards = await screen.findByRole("region", { name: "Resumen del periodo" });
    expect(within(cards).getByText("Saldo inicial").nextSibling).toHaveTextContent("$100.00");
    expect(within(cards).getByText("Ingresos del periodo").nextSibling).toHaveTextContent(
      "$160.00",
    );
    expect(within(cards).getByText("Gastado").nextSibling).toHaveTextContent("$30.00");
    expect(within(cards).getByText("Saldo disponible").nextSibling).toHaveTextContent("$230.00");
  });

  it("uses the user's period by default and requests today's dashboard", async () => {
    renderDashboard();

    await screen.findByText("Saldo disponible");
    expect(financeApi.getDashboard).toHaveBeenCalledWith(
      "weekly",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      undefined,
    );
    expect(screen.getByRole("button", { name: "Semanal" })).toHaveAttribute("aria-pressed", "true");
  });

  it("puts the selected period in the URL", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole("button", { name: "Mensual" }));

    expect(replace).toHaveBeenCalledWith("/dashboard?period=monthly", { scroll: false });
  });

  it("reads the period from the URL", async () => {
    search = new URLSearchParams("period=daily");
    renderDashboard();

    await screen.findByText("Saldo disponible");
    expect(financeApi.getDashboard).toHaveBeenCalledWith("daily", expect.any(String), undefined);
  });

  it("explains the limit status with words, not only color", async () => {
    renderDashboard();

    expect(await screen.findByText(/Dentro del límite · te quedan \$10.00/)).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Uso del límite de gasto" })).toHaveAttribute(
      "aria-valuenow",
      "75",
    );
  });

  it("offers the chart data as a table, flagging periods over the limit", async () => {
    renderDashboard();

    const table = await screen.findByRole("table", { name: /Gasto por periodo/ });
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Te pasaste por $5.00");
    expect(rows[2]).toHaveTextContent("Dentro del límite");
  });

  it("lists this period's expenses with their category", async () => {
    renderDashboard();

    const section = await screen.findByRole("region", { name: "Gastos de esta semana" });
    expect(await within(section).findByText("Pasaje")).toBeInTheDocument();
    expect(within(section).getByText("Transporte")).toBeInTheDocument();
    expect(financeApi.listTransactions).toHaveBeenCalledWith({
      from: "2026-10-05",
      to: "2026-10-11",
      type: "expense",
      limit: 10,
    });
  });

  it("adds a movement and refreshes the dashboard", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(financeApi, "createTransaction").mockResolvedValue({
      id: "t2",
      type: "expense",
      amount: "12.00",
      category_id: null,
      occurred_on: "2026-10-07",
      note: null,
      account_id: "a-main",
    });
    renderDashboard();
    await screen.findByText("Saldo disponible");

    await user.click(screen.getByRole("button", { name: /Añadir movimiento/ }));
    const dialog = screen.getByRole("dialog", { name: "Añadir movimiento" });
    await user.type(within(dialog).getByLabelText("Monto"), "12");
    await user.click(within(dialog).getByRole("button", { name: "Guardar movimiento" }));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "expense", amount: "12", category_id: null }),
    );
    expect(financeApi.getDashboard).toHaveBeenCalledTimes(2);
  });

  it("compares income and spending with the previous period", async () => {
    renderDashboard();

    const cards = await screen.findByRole("region", { name: "Resumen del periodo" });
    expect(cards).toHaveTextContent("Igual que la semana anterior"); // income 160 vs 160
    expect(cards).toHaveTextContent("$15.00 menos que la semana anterior"); // spent 30 vs 45
  });

  it("alerts at 80 % of the limit", async () => {
    vi.mocked(financeApi.getDashboard).mockResolvedValue({
      ...dashboard,
      limit_status: "warning",
      limit_used_percent: 85,
      limit_remaining: "6.00",
    });
    renderDashboard();

    expect(
      await screen.findByText("Atención: llevas el 85% de tu límite semanal. Te quedan $6.00."),
    ).toBeInTheDocument();
  });

  it("does not alert while well within the limit", async () => {
    renderDashboard();

    await screen.findByText("Saldo disponible");
    expect(screen.queryByText(/Atención: llevas el/)).toBeNull();
  });

  it("shows spending by category", async () => {
    renderDashboard();

    const section = await screen.findByRole("region", { name: "Gasto por categoría" });
    expect(within(section).getByRole("table")).toHaveTextContent("Transporte$30.00");
  });

  it("shows an error with a retry button when the dashboard fails", async () => {
    vi.mocked(financeApi.getDashboard).mockRejectedValueOnce(new Error("boom"));
    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar tu dashboard.");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
