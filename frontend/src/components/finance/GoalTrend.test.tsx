import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { financeApi, type SavingsGoal } from "@/lib/finance-api";
import { renderWithSession } from "@/test-utils";

import { GoalsPage } from "./GoalsPage";

const trip: SavingsGoal = {
  id: "g2",
  name: "Viaje",
  target_amount: "600.00",
  saved_amount: "180.00",
  due_date: null,
  account_id: "a-main",
  remaining: "420.00",
  progress_percent: 30,
  completed: false,
  overdue: false,
  periods_left: null,
  suggested_per_period: null,
  pace_per_week: "25.00",
  pace_since: "2026-09-01",
};

beforeEach(() => {
  vi.spyOn(financeApi, "listGoals").mockResolvedValue([trip]);
});

async function openTrend() {
  const user = userEvent.setup();
  renderWithSession(<GoalsPage />);
  await user.click(await screen.findByRole("button", { name: "Ver la tendencia de Viaje" }));
  return { user, dialog: screen.getByRole("dialog", { name: "Tendencia · Viaje" }) };
}

describe("Goal trend", () => {
  it("a goal without a date says when the user's pace gets there", async () => {
    renderWithSession(<GoalsPage />);

    const card = await screen.findByRole("article", { name: "Viaje" });
    expect(card).toHaveTextContent(/Te faltan \$420\.00\. A tu ritmo la alcanzas hacia el/);
  });

  it("shows the pace and the projection by months, weeks or years", async () => {
    const { user, dialog } = await openTrend();

    expect(within(dialog).getByRole("region", { name: "Tu ritmo" })).toHaveTextContent(
      "Tu ritmo: $25.00 por semana",
    );
    const table = within(dialog).getByRole("table", { name: "Cuánto tendrías con el tiempo" });
    // Today and the next 12 months; the first row is what is saved today
    expect(within(table).getAllByRole("row")).toHaveLength(14);
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("$180.00");

    await user.click(within(dialog).getByRole("button", { name: "Años" }));
    expect(within(table).getAllByRole("row")).toHaveLength(7); // header + today + 5 years
    expect(within(table).getAllByRole("row").at(-1)).toHaveTextContent("$600.00");
  });

  it("simulates another amount next to the real pace", async () => {
    const { user, dialog } = await openTrend();

    await user.type(within(dialog).getByLabelText("Monto"), "40");

    expect(within(dialog).getByRole("status")).toHaveTextContent(
      /Con \$40\.00 por semana, la alcanzas hacia el/,
    );
    const table = within(dialog).getByRole("table", { name: "Cuánto tendrías con el tiempo" });
    expect(
      within(table).getByRole("columnheader", { name: "CON $40.00 POR SEMANA" }),
    ).toBeInTheDocument(); // inside the collapsed "ver como tabla"
  });

  it("without enough history it asks to try an amount", async () => {
    vi.mocked(financeApi.listGoals).mockResolvedValue([
      { ...trip, pace_per_week: null, pace_since: null },
    ]);
    const { dialog } = await openTrend();

    expect(dialog).toHaveTextContent("Aún no podemos calcular tu ritmo");
    expect(within(dialog).queryByRole("table")).not.toBeInTheDocument();
  });

  it("goals with a due date keep their plan instead", async () => {
    vi.mocked(financeApi.listGoals).mockResolvedValue([{ ...trip, due_date: "2027-01-01" }]);
    renderWithSession(<GoalsPage />);

    await screen.findByRole("article", { name: "Viaje" });
    expect(screen.queryByRole("button", { name: "Ver la tendencia de Viaje" })).toBeNull();
  });
});
