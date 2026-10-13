import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import { financeApi, type BudgetSummary } from "@/lib/finance-api";
import { budgetSchema } from "@/lib/finance-validation";
import { renderWithSession } from "@/test-utils";

import { BudgetPage } from "./BudgetPage";

const summary: BudgetSummary = {
  account: { id: "a-main", name: "Gastos del día", kind: "spending", is_primary: true },
  currency: "USD",
  income_period: "weekly",
  period: { start: "2026-10-05", end: "2026-10-11", type: "weekly" },
  rows: [
    {
      category_id: "c-food",
      name: "Comida",
      amount: "40.00",
      budget: "40.00",
      spent: "35.00",
      remaining: "5.00",
      percent: "87.50",
      status: "warning",
    },
    {
      category_id: "c-bus",
      name: "Transporte",
      amount: "20.00",
      budget: "20.00",
      spent: "26.00",
      remaining: "-6.00",
      percent: "130.00",
      status: "over",
    },
    {
      category_id: "c-fun",
      name: "Ocio",
      amount: null,
      budget: null,
      spent: "12.00",
      remaining: null,
      percent: null,
      status: "none",
    },
  ],
  unbudgeted_spent: "15.00",
  totals: { budgeted: "60.00", spent: "61.00", remaining: "-1.00" },
  spending_limit: "100.00",
  unassigned: "40.00",
  over_limit_warning: false,
};

beforeEach(() => {
  vi.spyOn(financeApi, "getBudgets").mockResolvedValue(summary);
});

afterEach(() => vi.unstubAllGlobals());

async function renderPage() {
  renderWithSession(<BudgetPage />);
  return screen.findByRole("heading", { name: "Por categoría" });
}

describe("BudgetPage", () => {
  it("asks for the weekly view by default and shows the totals", async () => {
    await renderPage();

    expect(financeApi.getBudgets).toHaveBeenCalledWith("weekly", expect.any(String), undefined);
    const card = screen.getByRole("region", { name: /Resumen esta semana/ });
    expect(within(card).getByText("Presupuestado").nextSibling).toHaveTextContent("$60.00");
    expect(within(card).getByText("Te pasaste").nextSibling).toHaveTextContent("$1.00");
    expect(within(card).getByText("Sin asignar").nextSibling).toHaveTextContent("$40.00");
    expect(screen.getByText(/Gasto sin presupuesto/).nextSibling).toHaveTextContent("$15.00");
  });

  it("shows progress with numbers and words, never color alone", async () => {
    await renderPage();

    const food = screen.getByRole("progressbar", { name: "Presupuesto de Comida" });
    expect(food).toHaveAttribute("aria-valuenow", "87.5");
    expect(food).toHaveAttribute("aria-valuetext", "87.50 % usado. Cerca del tope.");
    expect(screen.getByText("Cerca del tope · 87.50 %")).toBeInTheDocument();
    // Over 100 %: the bar stops at 100 but the text tells the truth
    const bus = screen.getByRole("progressbar", { name: "Presupuesto de Transporte" });
    expect(bus).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText(/\$26\.00 de \$20\.00 · te pasaste por \$6\.00/)).toBeInTheDocument();
    // No budget: no bar at all
    expect(screen.queryByRole("progressbar", { name: "Presupuesto de Ocio" })).toBeNull();
    expect(screen.getByText("Sin presupuesto")).toBeInTheDocument();
  });

  it("warns when the budgets add up to more than the spending limit", async () => {
    vi.mocked(financeApi.getBudgets).mockResolvedValue({
      ...summary,
      unassigned: "-20.00",
      over_limit_warning: true,
      totals: { ...summary.totals, budgeted: "120.00" },
    });
    await renderPage();

    expect(
      screen.getByText(/Tus presupuestos suman \$120\.00, más que tu límite de gasto de \$100\.00/),
    ).toHaveAttribute("role", "status");
  });

  it("invites to start when there are no budgets yet", async () => {
    vi.mocked(financeApi.getBudgets).mockResolvedValue({
      ...summary,
      rows: summary.rows.map((r) => ({
        ...r,
        amount: null,
        budget: null,
        remaining: null,
        percent: null,
        status: "none" as const,
      })),
      totals: { budgeted: "0.00", spent: "0.00", remaining: "0.00" },
    });
    await renderPage();

    expect(screen.getByRole("heading", { name: "Aún no tienes presupuestos" })).toBeInTheDocument();
  });

  it("sets a budget inline, per income period, and validates it first", async () => {
    const user = userEvent.setup();
    const save = vi.spyOn(financeApi, "setBudget").mockResolvedValue({
      category_id: "c-fun",
      amount: "25.00",
      income_period: "weekly",
    });
    await renderPage();

    await user.click(screen.getByRole("button", { name: "Poner presupuesto a Ocio" }));
    const field = screen.getByLabelText("Presupuesto de Ocio por semana");
    await user.type(field, "abc");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(save).not.toHaveBeenCalled();
    expect(field).toHaveAccessibleDescription(/Usa solo números/);

    await user.clear(field);
    await user.type(field, "25");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(save).toHaveBeenCalledWith("c-fun", "25");
    expect(await screen.findByText("Presupuesto de Ocio guardado.")).toBeInTheDocument();
  });

  it("shows the API's reason when saving fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(financeApi, "setBudget").mockRejectedValue(
      new ApiError(404, "La categoría no existe."),
    );
    await renderPage();

    await user.click(screen.getByRole("button", { name: "Cambiar el presupuesto de Comida" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByLabelText("Presupuesto de Comida por semana"),
    ).toHaveAccessibleDescription("La categoría no existe.");
  });

  it("removes a budget", async () => {
    const user = userEvent.setup();
    const remove = vi.spyOn(financeApi, "removeBudget").mockResolvedValue(undefined);
    await renderPage();

    await user.click(screen.getByRole("button", { name: "Quitar el presupuesto de Transporte" }));

    expect(remove).toHaveBeenCalledWith("c-bus");
    expect(await screen.findByText("Quitaste el presupuesto de Transporte.")).toBeInTheDocument();
  });

  it("suggests amounts from the user's average and applies one", async () => {
    const user = userEvent.setup();
    vi.spyOn(financeApi, "getBudgetSuggestions").mockResolvedValue({
      period: "weekly",
      based_on_periods: 3,
      suggestions: [{ category_id: "c-fun", name: "Ocio", amount: "18.00" }],
    });
    const save = vi.spyOn(financeApi, "setBudget").mockResolvedValue({
      category_id: "c-fun",
      amount: "18.00",
      income_period: "weekly",
    });
    await renderPage();

    await user.click(screen.getByRole("button", { name: "Sugerir según mi promedio" }));
    await user.click(
      await screen.findByRole("button", {
        name: "Usar $18.00 por semana como presupuesto de Ocio",
      }),
    );

    expect(save).toHaveBeenCalledWith("c-fun", "18.00");
  });

  it("creates a new category with its budget, usable everywhere", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(financeApi, "createCategory").mockResolvedValue({
      id: "c-gym",
      name: "Gimnasio",
      color: "#5b4bdb",
      is_default: false,
    });
    const save = vi.spyOn(financeApi, "setBudget").mockResolvedValue({
      category_id: "c-gym",
      amount: "25",
      income_period: "weekly",
    });
    const changed = vi.fn();
    window.addEventListener("cuenta-clara:data-changed", changed);
    await renderPage();

    await user.click(screen.getByRole("button", { name: "Añadir categoría" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva categoría" });
    expect(dialog).toHaveTextContent("podrás elegirla al registrar cualquier gasto");
    await user.type(within(dialog).getByLabelText("Nombre de la categoría"), "Gimnasio");
    await user.type(within(dialog).getByLabelText("Presupuesto por semana (opcional)"), "25");
    await user.click(within(dialog).getByRole("button", { name: "Crear categoría" }));

    expect(create).toHaveBeenCalledWith({ name: "Gimnasio", color: expect.any(String) });
    expect(save).toHaveBeenCalledWith("c-gym", "25");
    expect(
      await screen.findByText("Categoría «Gimnasio» creada con su presupuesto."),
    ).toBeInTheDocument();
    // Every page with a category picker refreshes, so it is available right away
    expect(changed).toHaveBeenCalled();
    window.removeEventListener("cuenta-clara:data-changed", changed);
  });

  it("can create the category without a budget yet", async () => {
    const user = userEvent.setup();
    vi.spyOn(financeApi, "createCategory").mockResolvedValue({
      id: "c-pets",
      name: "Mascotas",
      color: "#5b4bdb",
      is_default: false,
    });
    const save = vi.spyOn(financeApi, "setBudget");
    await renderPage();

    await user.click(screen.getByRole("button", { name: "Añadir categoría" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva categoría" });
    await user.type(within(dialog).getByLabelText("Nombre de la categoría"), "Mascotas");
    await user.click(within(dialog).getByRole("button", { name: "Crear categoría" }));

    expect(save).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Categoría «Mascotas» creada. Ya puedes usarla en tus gastos."),
    ).toBeInTheDocument();
  });

  it("explains a repeated name and checks the amount before creating anything", async () => {
    const user = userEvent.setup();
    const create = vi
      .spyOn(financeApi, "createCategory")
      .mockRejectedValue(new ApiError(409, "Ya tienes una categoría con ese nombre."));
    await renderPage();
    await user.click(screen.getByRole("button", { name: "Añadir categoría" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva categoría" });

    await user.type(within(dialog).getByLabelText("Nombre de la categoría"), "Comida");
    await user.type(within(dialog).getByLabelText("Presupuesto por semana (opcional)"), "-3");
    await user.click(within(dialog).getByRole("button", { name: "Crear categoría" }));
    expect(create).not.toHaveBeenCalled();

    await user.clear(within(dialog).getByLabelText("Presupuesto por semana (opcional)"));
    await user.click(within(dialog).getByRole("button", { name: "Crear categoría" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Ya tienes una categoría con ese nombre.",
    );
  });

  it("switches the period shown", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("button", { name: "Mensual" }));

    await waitFor(() =>
      expect(financeApi.getBudgets).toHaveBeenLastCalledWith(
        "monthly",
        expect.any(String),
        undefined,
      ),
    );
  });

  it("offers to retry when loading fails", async () => {
    vi.mocked(financeApi.getBudgets).mockRejectedValue(new ApiError(500, "Error del servidor."));
    renderWithSession(<BudgetPage />);

    expect(await screen.findByText("No pudimos cargar tus presupuestos.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});

describe("budget client and validation", () => {
  it("sends the amount to the right category", async () => {
    vi.mocked(financeApi.getBudgets).mockRestore(); // the real client this time
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify({ category_id: "c-food", amount: "40.00" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await financeApi.setBudget("c-food", "40.00");
    await financeApi.getBudgets("monthly", "2026-10-07", "all");

    const [putUrl, putInit] = fetchMock.mock.calls[0]!;
    expect(putUrl).toBe("/api/v1/budgets/c-food");
    expect(putInit?.method).toBe("PUT");
    expect(putInit?.body).toBe(JSON.stringify({ amount: "40.00" }));
    expect(fetchMock.mock.calls[1]![0]).toBe(
      "/api/v1/budgets?period=monthly&date=2026-10-07&account=all",
    );
  });

  it.each([
    ["25", true],
    ["1,250.50", true],
    ["0", false],
    ["-5", false],
    ["10.001", false],
    ["1000000.01", false],
  ])("budget amount %s valid: %s", (amount, valid) => {
    expect(budgetSchema.safeParse({ amount }).success).toBe(valid);
  });
});
