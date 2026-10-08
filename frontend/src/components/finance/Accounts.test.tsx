import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSwitcher } from "@/components/dashboard/AccountSwitcher";
import { financeApi, type SavingsGoal } from "@/lib/finance-api";
import {
  renderWithSession,
  testCategories,
  testPrimaryAccount,
  testSavingsAccount,
} from "@/test-utils";

import { AccountsPage } from "./AccountsPage";
import { GoalsPage } from "./GoalsPage";
import { TransactionDialog } from "./TransactionDialog";

const twoAccounts = [testPrimaryAccount, testSavingsAccount];

beforeEach(() => {
  vi.mocked(financeApi.listAccounts).mockResolvedValue(twoAccounts);
  vi.spyOn(financeApi, "listTransfers").mockResolvedValue([]);
});

describe("AccountsPage", () => {
  it("shows every account with its balance and the total", async () => {
    renderWithSession(<AccountsPage />);

    const main = await screen.findByRole("article", { name: "Gastos del día" });
    expect(main).toHaveTextContent("Principal · gastos del día");
    expect(main).toHaveTextContent("$230.00");
    expect(screen.getByRole("article", { name: "Ahorro" })).toHaveTextContent("$400.00");
    expect(screen.getByRole("region", { name: "Total" })).toHaveTextContent("$630.00");
  });

  it("creates an account with only a name, a kind and a balance", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(financeApi, "createAccount").mockResolvedValue({
      ...testSavingsAccount,
      id: "a-fund",
      name: "Fondo",
    });
    renderWithSession(<AccountsPage />);
    await screen.findByRole("article", { name: "Ahorro" });

    await user.click(screen.getByRole("button", { name: "Nueva cuenta" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva cuenta" });
    await user.type(within(dialog).getByLabelText("Nombre"), "Fondo");
    await user.selectOptions(within(dialog).getByLabelText("¿Para qué la usas?"), "investment");
    await user.type(within(dialog).getByLabelText(/¿Cuánto tenía/), "1,000");
    await user.click(within(dialog).getByRole("button", { name: "Guardar cuenta" }));

    expect(create).toHaveBeenCalledWith({
      name: "Fondo",
      kind: "investment",
      initial_balance: "1000",
      is_primary: false,
    });
  });

  it("refuses what looks like an account number", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(financeApi, "createAccount");
    renderWithSession(<AccountsPage />);
    await screen.findByRole("article", { name: "Ahorro" });

    await user.click(screen.getByRole("button", { name: "Nueva cuenta" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva cuenta" });
    await user.type(within(dialog).getByLabelText("Nombre"), "04-1234-5678-90");
    await user.click(within(dialog).getByRole("button", { name: "Guardar cuenta" }));

    expect(within(dialog).getByLabelText("Nombre")).toHaveAccessibleDescription(
      expect.stringContaining("no escribas números de cuenta"),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("moves money between two accounts", async () => {
    const user = userEvent.setup();
    const move = vi.spyOn(financeApi, "createTransfer").mockResolvedValue({
      id: "tr1",
      from_account_id: "a-main",
      to_account_id: "a-savings",
      amount: "50.00",
      occurred_on: "2026-10-07",
      note: null,
      goal_id: null,
    });
    renderWithSession(<AccountsPage />);
    await screen.findByRole("article", { name: "Ahorro" });

    await user.click(screen.getAllByRole("button", { name: "Mover dinero" })[0]!);
    const dialog = screen.getByRole("dialog", { name: "Mover dinero entre cuentas" });
    expect(within(dialog).getByLabelText("Desde")).toHaveDisplayValue("Gastos del día (principal)");
    expect(within(dialog).getByLabelText("Hacia")).toHaveDisplayValue("Ahorro");
    await user.type(within(dialog).getByLabelText("Monto"), "50");
    await user.click(within(dialog).getByRole("button", { name: "Mover dinero" }));

    expect(move).toHaveBeenCalledWith(
      expect.objectContaining({
        from_account_id: "a-main",
        to_account_id: "a-savings",
        amount: "50",
        note: null,
      }),
    );
  });
});

describe("AccountSwitcher", () => {
  it("scopes to one account or all of them, in words and balances", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AccountSwitcher
        accounts={twoAccounts}
        value={undefined}
        onChange={onChange}
        currency="USD"
      />,
    );

    const group = screen.getByRole("group", { name: "Cuenta" });
    const main = within(group).getByRole("button", { name: /Gastos del día/ });
    expect(main).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: /Todas/ })).toHaveTextContent("$630.00");

    await user.click(within(group).getByRole("button", { name: /Ahorro/ }));
    expect(onChange).toHaveBeenLastCalledWith("a-savings");
    await user.click(within(group).getByRole("button", { name: /Todas/ }));
    expect(onChange).toHaveBeenLastCalledWith("all");
  });

  it("with a single account it invites to add another", () => {
    render(
      <AccountSwitcher
        accounts={[testPrimaryAccount]}
        value={undefined}
        onChange={vi.fn()}
        currency="USD"
      />,
    );

    expect(screen.getByRole("link", { name: /Agrégala/ })).toHaveAttribute("href", "/cuentas");
  });
});

describe("TransactionDialog with several accounts", () => {
  it("asks which account and sends it", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(financeApi, "createTransaction").mockResolvedValue({
      id: "t1",
      type: "income",
      amount: "20.00",
      category_id: null,
      occurred_on: "2026-10-07",
      note: null,
      account_id: "a-savings",
    });
    render(
      <TransactionDialog
        open
        onClose={vi.fn()}
        onSaved={vi.fn()}
        categories={testCategories}
        accounts={twoAccounts}
        defaultAccountId="a-savings"
      />,
    );

    await user.click(screen.getByText("Ingreso"));
    expect(screen.getByLabelText("¿A qué cuenta llegó?")).toHaveDisplayValue("Ahorro");
    await user.type(screen.getByLabelText("Monto"), "20");
    await user.click(screen.getByRole("button", { name: "Guardar movimiento" }));

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ account_id: "a-savings" }));
  });
});

describe("Goals kept in an account", () => {
  const trip: SavingsGoal = {
    id: "g1",
    name: "Viaje",
    target_amount: "300.00",
    saved_amount: "0.00",
    due_date: null,
    account_id: "a-savings",
    remaining: "300.00",
    progress_percent: 0,
    completed: false,
    overdue: false,
    periods_left: null,
    suggested_per_period: null,
  };

  it("contributing moves the money from the day-to-day account by default", async () => {
    const user = userEvent.setup();
    vi.spyOn(financeApi, "listGoals").mockResolvedValue([trip]);
    const contribute = vi
      .spyOn(financeApi, "contribute")
      .mockResolvedValue({ ...trip, saved_amount: "50.00" });
    renderWithSession(<GoalsPage />);

    const card = await screen.findByRole("article", { name: "Viaje" });
    expect(card).toHaveTextContent("Guardada en Ahorro");
    await user.click(within(card).getByRole("button", { name: "Aportar o retirar en Viaje" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("¿De qué cuenta sale?")).toHaveDisplayValue(
      "Gastos del día (principal)",
    );
    await user.type(within(dialog).getByLabelText("Monto"), "50");
    await user.click(within(dialog).getByRole("button", { name: "Aportar" }));

    expect(contribute).toHaveBeenCalledWith("g1", "50", "a-main");
  });
});
