import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { financeApi, type FixedExpense, type Income } from "@/lib/finance-api";
import { renderWithSession, testCategories } from "@/test-utils";

import { FixedExpensesPage } from "./FixedExpensesPage";
import { IncomesPage } from "./IncomesPage";

const beca: Income = {
  id: "i1",
  label: "Beca",
  amount: "160.00",
  frequency: "weekly",
  custom_period_days: null,
  start_date: "2026-10-05",
  is_active: true,
};

const internet: FixedExpense = {
  id: "f1",
  name: "Internet",
  amount: "25.00",
  frequency: "monthly",
  custom_period_days: null,
  start_date: "2026-10-01",
  due_day: 15,
  category_id: "c-transport",
  is_active: true,
};

beforeEach(() => {
  vi.spyOn(financeApi, "listIncomes").mockResolvedValue([beca]);
  vi.spyOn(financeApi, "listFixedExpenses").mockResolvedValue([internet]);
  vi.spyOn(financeApi, "listCategories").mockResolvedValue(testCategories);
});

describe("IncomesPage", () => {
  it("lists incomes with amount, frequency and status", async () => {
    renderWithSession(<IncomesPage />);

    const row = (await screen.findByRole("rowheader", { name: "Beca" })).closest("tr")!;
    expect(row).toHaveTextContent("$160.00");
    expect(row).toHaveTextContent("Semanal");
    expect(row).toHaveTextContent("Activo");
  });

  it("shows an empty state with a call to action", async () => {
    vi.mocked(financeApi.listIncomes).mockResolvedValue([]);
    renderWithSession(<IncomesPage />);

    expect(await screen.findByText("Aún no registras ingresos")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Añadir ingreso/ })).toHaveLength(2);
  });

  it("creates an income from the dialog and confirms it", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(financeApi, "createIncome").mockResolvedValue(beca);
    renderWithSession(<IncomesPage />);
    await screen.findByRole("rowheader", { name: "Beca" });

    await user.click(screen.getByRole("button", { name: /Añadir ingreso/ }));
    const dialog = screen.getByRole("dialog", { name: "Añadir ingreso" });
    await user.type(within(dialog).getByLabelText("Concepto"), "Salario");
    await user.type(within(dialog).getByLabelText("Monto"), "500");
    await user.click(within(dialog).getByRole("button", { name: "Guardar ingreso" }));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Salario", amount: "500", frequency: "monthly" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Ingreso guardado.");
    expect(financeApi.listIncomes).toHaveBeenCalledTimes(2);
  });

  it("pauses an income keeping the rest of its data", async () => {
    const user = userEvent.setup();
    const update = vi
      .spyOn(financeApi, "updateIncome")
      .mockResolvedValue({ ...beca, is_active: false });
    renderWithSession(<IncomesPage />);

    await user.click(await screen.findByRole("button", { name: "Pausar Beca" }));

    // Exact body: the API rejects unknown fields such as id or timestamps
    expect(update).toHaveBeenCalledWith("i1", {
      label: "Beca",
      amount: "160.00",
      frequency: "weekly",
      custom_period_days: null,
      start_date: "2026-10-05",
      is_active: false,
    });
  });

  it("only deletes after confirmation", async () => {
    const user = userEvent.setup();
    const remove = vi.spyOn(financeApi, "deleteIncome").mockResolvedValue(undefined);
    renderWithSession(<IncomesPage />);

    await user.click(await screen.findByRole("button", { name: "Eliminar Beca" }));
    expect(remove).not.toHaveBeenCalled();
    const confirm = screen.getByRole("dialog", { name: "Eliminar ingreso" });
    expect(confirm).toHaveTextContent("no se puede deshacer");

    await user.click(within(confirm).getByRole("button", { name: "Eliminar" }));
    expect(remove).toHaveBeenCalledWith("i1");
  });

  it("cancelling the confirmation deletes nothing", async () => {
    const user = userEvent.setup();
    const remove = vi.spyOn(financeApi, "deleteIncome");
    renderWithSession(<IncomesPage />);

    await user.click(await screen.findByRole("button", { name: "Eliminar Beca" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));

    expect(remove).not.toHaveBeenCalled();
  });
});

describe("FixedExpensesPage", () => {
  it("pauses a fixed expense sending only the fields the API accepts", async () => {
    const user = userEvent.setup();
    const update = vi
      .spyOn(financeApi, "updateFixedExpense")
      .mockResolvedValue({ ...internet, is_active: false });
    renderWithSession(<FixedExpensesPage />);

    await user.click(await screen.findByRole("button", { name: "Pausar Internet" }));

    expect(update).toHaveBeenCalledWith("f1", {
      name: "Internet",
      amount: "25.00",
      frequency: "monthly",
      custom_period_days: null,
      start_date: "2026-10-01",
      due_day: 15,
      category_id: "c-transport",
      is_active: false,
    });
  });

  it("shows the category and the due day", async () => {
    renderWithSession(<FixedExpensesPage />);

    const row = (await screen.findByRole("rowheader", { name: "Internet" })).closest("tr")!;
    expect(row).toHaveTextContent("Mensual · día 15");
    expect(await within(row).findByText("Transporte")).toBeInTheDocument();
  });

  it("edits with the current values prefilled and keeps it active", async () => {
    const user = userEvent.setup();
    const update = vi.spyOn(financeApi, "updateFixedExpense").mockResolvedValue(internet);
    renderWithSession(<FixedExpensesPage />);

    await user.click(await screen.findByRole("button", { name: "Editar Internet" }));
    const dialog = screen.getByRole("dialog", { name: "Editar gasto fijo" });
    const amount = within(dialog).getByLabelText("Monto");
    expect(amount).toHaveValue("25.00");
    await user.clear(amount);
    await user.type(amount, "30");
    await user.click(within(dialog).getByRole("button", { name: "Guardar gasto fijo" }));

    expect(update).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({
        amount: "30",
        due_day: 15,
        category_id: "c-transport",
        is_active: true,
      }),
    );
  });

  it("asks for the day count when the frequency is custom", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(financeApi, "createFixedExpense");
    renderWithSession(<FixedExpensesPage />);
    await screen.findByRole("rowheader", { name: "Internet" });

    await user.click(screen.getByRole("button", { name: /Añadir gasto fijo/ }));
    const dialog = screen.getByRole("dialog", { name: "Añadir gasto fijo" });
    await user.type(within(dialog).getByLabelText("Nombre"), "Lavandería");
    await user.type(within(dialog).getByLabelText("Monto"), "8");
    await user.selectOptions(within(dialog).getByLabelText("Frecuencia"), "custom");
    await user.click(within(dialog).getByRole("button", { name: "Guardar gasto fijo" }));

    expect(await within(dialog).findByText("Indica cada cuántos días.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });
});
