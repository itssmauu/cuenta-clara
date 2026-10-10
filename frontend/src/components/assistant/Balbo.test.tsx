import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import { assistantApi } from "@/lib/assistant-api";
import { renderWithSession } from "@/test-utils";

import { Balbo } from "./Balbo";

beforeEach(() => {
  vi.spyOn(assistantApi, "status").mockResolvedValue({ name: "Balbo", available: true });
});

async function openChat(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Abrir el chat con Balbo/ }));
  return screen.getByRole("dialog", { name: "Balbo" });
}

describe("Balbo", () => {
  it("opens from the round button, greets by name and focuses the question box", async () => {
    const user = userEvent.setup();
    renderWithSession(<Balbo />);

    const launcher = screen.getByRole("button", { name: /Abrir el chat con Balbo/ });
    expect(launcher).toHaveAttribute("aria-expanded", "false");
    const panel = await openChat(user);

    expect(launcher).toHaveAttribute("aria-expanded", "true");
    expect(within(panel).getByRole("log")).toHaveTextContent("¡Hola, Ana! Soy Balbo");
    expect(within(panel).getByLabelText("Escribe tu pregunta para Balbo")).toHaveFocus();
  });

  it("answers a question with the reply from the API", async () => {
    const user = userEvent.setup();
    const chat = vi.spyOn(assistantApi, "chat").mockResolvedValue({
      reply: "Mejor espera.\n- Te quedan $230.00\n- La PS5 cuesta $550.00",
      on_topic: true,
    });
    renderWithSession(<Balbo />);
    const panel = await openChat(user);

    await user.type(
      within(panel).getByLabelText("Escribe tu pregunta para Balbo"),
      "¿Compro una PS5?",
    );
    await user.keyboard("{Enter}");

    expect(chat).toHaveBeenCalledWith([{ role: "user", content: "¿Compro una PS5?" }]);
    const log = within(panel).getByRole("log");
    expect(await within(log).findByText("Mejor espera.")).toBeInTheDocument();
    // "- " lines become a real list
    expect(
      within(log)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toContain("Te quedan $230.00");
  });

  it("sends a suggestion and keeps the conversation as history", async () => {
    const user = userEvent.setup();
    const chat = vi
      .spyOn(assistantApi, "chat")
      .mockResolvedValueOnce({ reply: "Vas bien.", on_topic: true })
      .mockResolvedValueOnce({ reply: "Aparta $20 por semana.", on_topic: true });
    renderWithSession(<Balbo />);
    const panel = await openChat(user);

    await user.click(within(panel).getByRole("button", { name: "¿Cómo voy esta semana?" }));
    await within(panel).findByText("Vas bien.");
    await user.type(
      within(panel).getByLabelText("Escribe tu pregunta para Balbo"),
      "¿Y para ahorrar?",
    );
    await user.click(within(panel).getByRole("button", { name: "Enviar pregunta" }));

    expect(chat).toHaveBeenLastCalledWith([
      { role: "user", content: "¿Cómo voy esta semana?" },
      { role: "assistant", content: "Vas bien." },
      { role: "user", content: "¿Y para ahorrar?" },
    ]);
    expect(await within(panel).findByText("Aparta $20 por semana.")).toBeInTheDocument();
  });

  it("the robot waves, then types on its phone, then pays attention", async () => {
    const user = userEvent.setup();
    let reply!: (value: { reply: string; on_topic: boolean }) => void;
    vi.spyOn(assistantApi, "chat").mockReturnValue(new Promise((resolve) => (reply = resolve)));
    const { container } = renderWithSession(<Balbo />);
    const robot = () => container.querySelector("header .bb")!;
    const panel = await openChat(user);

    expect(robot()).toHaveAttribute("data-state", "greeting");
    expect(within(panel).getByRole("img", { name: /saludando/ })).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "¿Cómo voy esta semana?" }));
    expect(robot()).toHaveAttribute("data-state", "typing");
    expect(within(panel).getByRole("status")).toHaveTextContent("Balbo está escribiendo");

    reply({ reply: "Vas bien.", on_topic: true });
    await within(panel).findByText("Vas bien.");
    expect(robot()).toHaveAttribute("data-state", "attentive");
    expect(within(panel).queryByRole("img", { name: /saludando/ })).toBeNull();
  });

  it("shows Balbo's refusal for off-topic questions", async () => {
    const user = userEvent.setup();
    vi.spyOn(assistantApi, "chat").mockResolvedValue({
      reply: "Eso se sale de lo mío. Solo puedo ayudarte con tus finanzas.",
      on_topic: false,
    });
    renderWithSession(<Balbo />);
    const panel = await openChat(user);

    await user.type(within(panel).getByLabelText("Escribe tu pregunta para Balbo"), "Un poema");
    await user.keyboard("{Enter}");

    expect(
      await within(panel).findByText(/Solo puedo ayudarte con tus finanzas/),
    ).toBeInTheDocument();
  });

  it("explains errors and never sends them back as history", async () => {
    const user = userEvent.setup();
    const chat = vi
      .spyOn(assistantApi, "chat")
      .mockRejectedValueOnce(new ApiError(429, "Le has preguntado mucho a Balbo."))
      .mockResolvedValueOnce({ reply: "Listo.", on_topic: true });
    renderWithSession(<Balbo />);
    const panel = await openChat(user);
    const input = within(panel).getByLabelText("Escribe tu pregunta para Balbo");

    await user.type(input, "Hola");
    await user.keyboard("{Enter}");
    expect(await within(panel).findByText("Le has preguntado mucho a Balbo.")).toBeInTheDocument();

    await user.type(input, "¿Cuánto tengo?");
    await user.keyboard("{Enter}");
    expect(chat).toHaveBeenLastCalledWith([
      { role: "user", content: "Hola" },
      { role: "user", content: "¿Cuánto tengo?" },
    ]);
  });

  it("says when it is not available and disables the box", async () => {
    const user = userEvent.setup();
    vi.mocked(assistantApi.status).mockResolvedValue({ name: "Balbo", available: false });
    renderWithSession(<Balbo />);
    const panel = await openChat(user);

    expect(
      await within(panel).findByText(/no está disponible en este momento/),
    ).toBeInTheDocument();
    expect(within(panel).getByLabelText("Escribe tu pregunta para Balbo")).toBeDisabled();
    // Keyboard users still land inside the panel, and Escape still closes it
    expect(within(panel).getByRole("button", { name: "Cerrar el chat con Balbo" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: /Abrir el chat con Balbo/ })).toHaveFocus();
  });

  it("closes with Escape and gives focus back to the button", async () => {
    const user = userEvent.setup();
    renderWithSession(<Balbo />);
    await openChat(user);

    await user.keyboard("{Escape}");

    const launcher = screen.getByRole("button", { name: /Abrir el chat con Balbo/ });
    expect(launcher).toHaveAttribute("aria-expanded", "false");
    expect(launcher).toHaveFocus();
  });
});
