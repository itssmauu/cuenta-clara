import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { financeApi, type Transaction } from "@/lib/finance-api";
import { renderWithSession, testCategories } from "@/test-utils";

import { IncomesPage } from "./IncomesPage";

const gift: Transaction = {
  id: "t1",
  type: "income",
  amount: "40.00",
  category_id: null,
  occurred_on: "2026-10-06",
  note: "Papá",
  account_id: "a-main",
  third_party: false,
};
const forTheBill: Transaction = {
  id: "t2",
  type: "income",
  amount: "50.00",
  category_id: null,
  occurred_on: "2026-10-07",
  note: "Luz de mamá",
  account_id: "a-main",
  third_party: true,
};

beforeEach(() => {
  vi.spyOn(financeApi, "listIncomes").mockResolvedValue([]);
  vi.spyOn(financeApi, "listCategories").mockResolvedValue(testCategories);
  vi.spyOn(financeApi, "listTransactions").mockImplementation(async (params) => ({
    items: params.third_party ? [forTheBill] : [gift],
    total: 1,
    limit: 10,
    offset: 0,
  }));
  vi.spyOn(financeApi, "thirdPartyBalance").mockResolvedValue({ balance: "50.00" });
});

describe("Occasional income and someone else's money", () => {
  it("keeps them apart from the recurring incomes", async () => {
    renderWithSession(<IncomesPage />);

    const occasional = await screen.findByRole("region", { name: "Ingresos ocasionales" });
    expect(await within(occasional).findByRole("rowheader", { name: /Papá/ })).toBeInTheDocument();
    expect(financeApi.listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ type: "income", third_party: false }),
    );

    const others = screen.getByRole("region", { name: "Dinero de terceros" });
    const row = (await within(others).findByRole("rowheader", { name: /Luz de mamá/ })).closest(
      "tr",
    )!;
    expect(row).toHaveTextContent("Recibido de terceros");
    expect(row).toHaveTextContent("+$50.00");
    expect(within(others).getByText("Por usar de terceros")).toBeInTheDocument();
    expect(within(others).getByText("$50.00", { selector: "span" })).toBeInTheDocument();
  });

  it("records money received for someone else as theirs, without a category", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(financeApi, "createTransaction").mockResolvedValue(forTheBill);
    renderWithSession(<IncomesPage />);

    await user.click(await screen.findByRole("button", { name: "Me pasaron dinero" }));
    const dialog = screen.getByRole("dialog", { name: "Me pasaron dinero de terceros" });
    expect(within(dialog).getByLabelText("Es dinero de terceros (no es mío)")).toBeChecked();
    await user.type(within(dialog).getByLabelText("Monto"), "50");
    await user.click(within(dialog).getByRole("button", { name: "Guardar movimiento" }));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "income",
        amount: "50",
        third_party: true,
        category_id: null,
      }),
    );
  });

  it("asks no category when paying for someone else", async () => {
    const user = userEvent.setup();
    renderWithSession(<IncomesPage />);

    await user.click(await screen.findByRole("button", { name: "Pagué por otra persona" }));
    const dialog = screen.getByRole("dialog", { name: "Pagué con dinero de terceros" });

    expect(within(dialog).getByRole("radio", { name: "Pagué por otra persona" })).toBeChecked();
    expect(within(dialog).queryByLabelText("Categoría")).not.toBeInTheDocument();
  });

  it("an occasional income is the user's own", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(financeApi, "createTransaction").mockResolvedValue(gift);
    renderWithSession(<IncomesPage />);

    await user.click(await screen.findByRole("button", { name: "Registrar ingreso ocasional" }));
    const dialog = screen.getByRole("dialog", { name: "Registrar ingreso ocasional" });
    expect(within(dialog).getByLabelText("Es dinero de terceros (no es mío)")).not.toBeChecked();
    await user.type(within(dialog).getByLabelText("Monto"), "40");
    await user.click(within(dialog).getByRole("button", { name: "Guardar movimiento" }));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "income", amount: "40", third_party: false }),
    );
  });
});
