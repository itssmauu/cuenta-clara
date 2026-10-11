import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, authApi } from "@/lib/api";

import { RecoverPasswordForm, RESEND_SECONDS } from "./RecoverPasswordForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const NEW_PASSWORD = "Montaña-Azul-2027!";

beforeEach(() => {
  push.mockReset();
  vi.spyOn(authApi, "forgotPassword").mockResolvedValue({ message: "ok" });
});

afterEach(() => vi.useRealTimers());

async function askForCode(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
  await user.click(screen.getByRole("button", { name: "Enviarme un código" }));
  return screen.findByRole("heading", { name: "Revisa tu correo" });
}

async function fillCode(
  user: ReturnType<typeof userEvent.setup>,
  code = "123456",
  password = NEW_PASSWORD,
) {
  await user.type(screen.getByLabelText("Código de 6 números"), code);
  await user.type(screen.getByLabelText("Contraseña nueva"), password);
  await user.type(screen.getByLabelText("Confirmar contraseña nueva"), password);
  await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
}

describe("RecoverPasswordForm", () => {
  it("asks for a code and never says whether the account exists", async () => {
    const user = userEvent.setup();
    render(<RecoverPasswordForm />);

    const heading = await askForCode(user);

    expect(authApi.forgotPassword).toHaveBeenCalledWith("ana@example.com");
    expect(heading).toHaveFocus();
    expect(
      screen.getByText(/tiene una cuenta, te enviamos un código de 6 números/),
    ).toHaveTextContent("Si ana@example.com tiene una cuenta");
  });

  it("explains when recovery is unavailable", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.forgotPassword).mockRejectedValue(
      new ApiError(503, "La recuperación de contraseña no está disponible en este momento."),
    );
    render(<RecoverPasswordForm />);

    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Enviarme un código" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("no está disponible");
    expect(screen.queryByRole("heading", { name: "Revisa tu correo" })).toBeNull();
  });

  it("sets the new password with the code, signs in and opens the dashboard", async () => {
    const user = userEvent.setup();
    const reset = vi.spyOn(authApi, "resetPassword").mockResolvedValue(undefined);
    const login = vi.spyOn(authApi, "login").mockResolvedValue({
      id: "1",
      email: "ana@example.com",
      name: "Ana",
      terms_accepted: true,
    });
    render(<RecoverPasswordForm />);
    await askForCode(user);

    await fillCode(user, "123 456"); // as some mail apps show it

    expect(reset).toHaveBeenCalledWith({
      email: "ana@example.com",
      code: "123456",
      new_password: NEW_PASSWORD,
    });
    expect(login).toHaveBeenCalledWith({ email: "ana@example.com", password: NEW_PASSWORD });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
  });

  it("checks the code and the password before calling the API", async () => {
    const user = userEvent.setup();
    const reset = vi.spyOn(authApi, "resetPassword");
    render(<RecoverPasswordForm />);
    await askForCode(user);

    await fillCode(user, "12ab", "corta");

    expect(await screen.findByText("Escribe los 6 números del código.")).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();
  });

  it("shows why the API refused: a wrong code or a weak password", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "resetPassword")
      .mockRejectedValueOnce(
        new ApiError(400, "El código no es válido o ya venció. Pide uno nuevo."),
      )
      .mockRejectedValueOnce(
        new ApiError(422, "La contraseña no es segura.", [
          "No debe contener tu nombre ni tu correo.",
        ]),
      );
    render(<RecoverPasswordForm />);
    await askForCode(user);

    await fillCode(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("ya venció");

    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
    expect(await screen.findByText("No debe contener tu nombre ni tu correo.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("lets the user ask again after a minute, or use another email", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<RecoverPasswordForm />);
    await askForCode(user);

    const resend = screen.getByRole("button", { name: /Reenviar código en \d+ s/ });
    expect(resend).toBeDisabled();
    await act(async () => {
      vi.advanceTimersByTime(RESEND_SECONDS * 1000);
    });
    await user.click(screen.getByRole("button", { name: "Reenviar código" }));
    expect(authApi.forgotPassword).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("status")).toHaveTextContent("el anterior ya no sirve");

    await user.click(screen.getByRole("button", { name: "Usar otro correo" }));
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
  });
});
