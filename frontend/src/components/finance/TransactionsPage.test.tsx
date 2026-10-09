import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { financeApi, type Transaction } from "@/lib/finance-api";
import { renderWithSession, testCategories } from "@/test-utils";

import { PAGE_SIZE, TransactionsPage } from "./TransactionsPage";

const lunch: Transaction = {
  id: "t1",
  type: "expense",
  amount: "12.50",
  category_id: "c-food",
  occurred_on: "2026-10-06",
  note: "Almuerzo",
  account_id: "a-main",
};
const gift: Transaction = {
  id: "t2",
  type: "income",
  amount: "50.00",
  category_id: null,
  occurred_on: "2026-10-04",
  note: "Regalo",
  account_id: "a-main",
};

beforeEach(() => {
  vi.spyOn(financeApi, "listCategories").mockResolvedValue(testCategories);
  vi.spyOn(financeApi, "listTransactions").mockResolvedValue({
    items: [lunch, gift],
    total: 45,
    limit: PAGE_SIZE,
    offset: 0,
  });
});

describe("TransactionsPage", () => {
  it("shows expenses and incomes with sign and category", async () => {
    renderWithSession(<TransactionsPage />);

    const lunchRow = (await screen.findByRole("rowheader", { name: "Almuerzo" })).closest("tr")!;
    expect(lunchRow).toHaveTextContent("−$12.50");
    expect(lunchRow).toHaveTextContent("Gasto");
    expect(await within(lunchRow).findByText("Comida")).toBeInTheDocument();
    const giftRow = screen.getByRole("rowheader", { name: "Regalo" }).closest("tr")!;
    expect(giftRow).toHaveTextContent("+$50.00");
    expect(giftRow).toHaveTextContent("Ingreso");
  });

  it("filters by type and date, starting again from the first page", async () => {
    const user = userEvent.setup();
    renderWithSession(<TransactionsPage />);
    await screen.findByRole("rowheader", { name: "Almuerzo" });

    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(financeApi.listTransactions).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: PAGE_SIZE }),
    );

    await user.selectOptions(screen.getByLabelText("Tipo"), "expense");
    expect(financeApi.listTransactions).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "expense", offset: 0, limit: PAGE_SIZE }),
    );

    await user.type(screen.getByLabelText("Desde"), "2026-10-01");
    expect(financeApi.listTransactions).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: "2026-10-01", type: "expense" }),
    );
  });

  it("shows which slice of the results is visible", async () => {
    renderWithSession(<TransactionsPage />);

    expect(await screen.findByText("Mostrando 1–2 de 45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Anterior/ })).toBeDisabled();
  });

  it("tells apart 'no data yet' from 'no results for these filters'", async () => {
    const user = userEvent.setup();
    vi.mocked(financeApi.listTransactions).mockResolvedValue({
      items: [],
      total: 0,
      limit: PAGE_SIZE,
      offset: 0,
    });
    renderWithSession(<TransactionsPage />);

    expect(await screen.findByText("Aún no registras movimientos")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Tipo"), "income");
    expect(await screen.findByText("Ningún movimiento coincide")).toBeInTheDocument();
  });

  it("edits a movement with its values prefilled", async () => {
    const user = userEvent.setup();
    const update = vi.spyOn(financeApi, "updateTransaction").mockResolvedValue(lunch);
    renderWithSession(<TransactionsPage />);

    await user.click(await screen.findByRole("button", { name: /Editar Almuerzo/ }));
    const dialog = screen.getByRole("dialog", { name: "Editar movimiento" });
    expect(within(dialog).getByLabelText("Monto")).toHaveValue("12.50");
    await user.click(within(dialog).getByRole("button", { name: "Guardar movimiento" }));

    expect(update).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({
        type: "expense",
        amount: "12.50",
        category_id: "c-food",
        note: "Almuerzo",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Movimiento actualizado.");
  });

  it("deletes only after confirming", async () => {
    const user = userEvent.setup();
    const remove = vi.spyOn(financeApi, "deleteTransaction").mockResolvedValue(undefined);
    renderWithSession(<TransactionsPage />);

    await user.click(await screen.findByRole("button", { name: /Eliminar Almuerzo/ }));
    const confirm = screen.getByRole("dialog", { name: "Eliminar movimiento" });
    expect(remove).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole("button", { name: "Eliminar" }));

    expect(remove).toHaveBeenCalledWith("t1");
  });
});
