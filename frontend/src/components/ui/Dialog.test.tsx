import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Dialog } from "./Dialog";

function Form({ open }: { open: boolean }) {
  return (
    <Dialog open={open} onClose={() => {}} title="Añadir">
      <label htmlFor="note">Nota</label>
      <input id="note" />
    </Dialog>
  );
}

describe("Dialog", () => {
  it("starts fresh when reopened right after closing", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Form open />);
    await user.type(screen.getByLabelText("Nota"), "Luz de mamá");

    // Closed and opened again before the closing animation ends
    rerender(<Form open={false} />);
    rerender(<Form open />);

    expect(screen.getByLabelText("Nota")).toHaveValue("");
  });
});
