import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import { financeApi, type PendingFixedExpense } from "@/lib/finance-api";
import { parseISODate, todayISO } from "@/lib/format";
import { renderWithSession } from "@/test-utils";

import { CheckInPrompt, dayLabel } from "./CheckInPrompt";

const today = todayISO();
const yesterday = (() => {
  const day = parseISODate(today);
  day.setDate(day.getDate() - 1);
  return todayISO(day);
})();

const lunch: PendingFixedExpense = {
  id: "fe-lunch",
  name: "Almuerzo",
  amount: "5.00",
  frequency: "daily",
  category_id: null,
  account_id: "a-main",
  account_name: "Gastos del día",
  dates: [yesterday, today],
};
const internet: PendingFixedExpense = {
  ...lunch,
  id: "fe-internet",
  name: "Internet",
  amount: "20.00",
  frequency: "monthly",
  dates: [today],
};

beforeEach(() => {
  vi.spyOn(financeApi, "pendingFixedExpenses").mockResolvedValue([lunch, internet]);
});

async function openPrompt() {
  return screen.findByRole("dialog", { name: "¿Ya pagaste estos gastos?" });
}

describe("CheckInPrompt", () => {
  it("asks on entering about every payment that is due, and nothing is counted yet", async () => {
    renderWithSession(<CheckInPrompt />);

    const dialog = await openPrompt();
    expect(financeApi.pendingFixedExpenses).toHaveBeenCalledWith(today);
    expect(dialog).toHaveTextContent("Solo se descuentan de tu saldo los que confirmes.");
    expect(within(dialog).getByRole("heading", { name: "Almuerzo" })).toBeInTheDocument();
    expect(within(dialog).getByText("$5.00 · Gastos del día")).toBeInTheDocument();
    expect(within(dialog).getByRole("group", { name: "Ayer · Almuerzo" })).toBeInTheDocument();
    expect(within(dialog).getByRole("group", { name: "Hoy · Internet" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Guardar respuestas" })).toBeDisabled();
  });

  it("stays quiet when nothing is due", async () => {
    vi.mocked(financeApi.pendingFixedExpenses).mockResolvedValue([]);
    renderWithSession(<CheckInPrompt />);

    await waitFor(() => expect(financeApi.pendingFixedExpenses).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/por confirmar/)).toBeNull();
  });

  it("sends exactly the answers given, refreshes the page data and closes when done", async () => {
    const user = userEvent.setup();
    const answer = vi.spyOn(financeApi, "answerCheckIns").mockResolvedValue(undefined);
    const changed = vi.fn();
    window.addEventListener("cuenta-clara:data-changed", changed);
    renderWithSession(<CheckInPrompt />);
    const dialog = await openPrompt();

    await user.click(within(dialog).getByRole("button", { name: "Pagué todos (2)" }));
    const internetToday = within(dialog).getByRole("group", { name: "Hoy · Internet" });
    await user.click(within(internetToday).getByRole("button", { name: "No" }));
    expect(within(internetToday).getByRole("button", { name: "No" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(dialog).getByRole("button", { name: "Guardar 3 respuestas" }));

    expect(answer).toHaveBeenCalledWith(
      [
        { fixed_expense_id: "fe-lunch", occurs_on: yesterday, paid: true },
        { fixed_expense_id: "fe-lunch", occurs_on: today, paid: true },
        { fixed_expense_id: "fe-internet", occurs_on: today, paid: false },
      ],
      today,
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(changed).toHaveBeenCalledOnce();
    window.removeEventListener("cuenta-clara:data-changed", changed);
  });

  it("keeps asking about what was left unanswered", async () => {
    const user = userEvent.setup();
    vi.spyOn(financeApi, "answerCheckIns").mockResolvedValue(undefined);
    renderWithSession(<CheckInPrompt />);
    const dialog = await openPrompt();

    const lunchToday = within(dialog).getByRole("group", { name: "Hoy · Almuerzo" });
    await user.click(within(lunchToday).getByRole("button", { name: "Lo pagué" }));
    await user.click(within(dialog).getByRole("button", { name: "Guardar 1 respuesta" }));

    await waitFor(() =>
      expect(within(dialog).queryByRole("group", { name: "Hoy · Almuerzo" })).toBeNull(),
    );
    expect(within(dialog).getByRole("group", { name: "Ayer · Almuerzo" })).toBeInTheDocument();
    expect(within(dialog).getByRole("group", { name: "Hoy · Internet" })).toBeInTheDocument();
  });

  it("can wait: a reminder stays on the page and reopens the questions", async () => {
    const user = userEvent.setup();
    renderWithSession(<CheckInPrompt />);
    const dialog = await openPrompt();

    await user.click(within(dialog).getByRole("button", { name: "Más tarde" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(
      screen.getByText("Tienes 3 pagos por confirmar. No se descuentan hasta que los confirmes."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revisar" }));
    expect(await openPrompt()).toBeInTheDocument();
  });

  it("shows the API's reason when saving fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(financeApi, "answerCheckIns").mockRejectedValue(
      new ApiError(422, "«Internet» no tiene un pago pendiente ese día."),
    );
    renderWithSession(<CheckInPrompt />);
    const dialog = await openPrompt();

    const internetToday = within(dialog).getByRole("group", { name: "Hoy · Internet" });
    await user.click(within(internetToday).getByRole("button", { name: "Lo pagué" }));
    await user.click(within(dialog).getByRole("button", { name: "Guardar 1 respuesta" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "«Internet» no tiene un pago pendiente ese día.",
    );
  });
});

describe("dayLabel", () => {
  it("names today and yesterday, and spells out older days", () => {
    expect(dayLabel("2026-10-07", "2026-10-07")).toBe("Hoy");
    expect(dayLabel("2026-10-06", "2026-10-07")).toBe("Ayer");
    expect(dayLabel("2026-10-01", "2026-10-07")).toMatch(/1.*oct/);
  });
});
