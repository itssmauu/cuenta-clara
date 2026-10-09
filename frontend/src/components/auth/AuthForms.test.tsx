import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, authApi } from "@/lib/api";

import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const STRONG = "Lluvia-Verde-2026!";

beforeEach(() => {
  push.mockReset();
});

describe("LoginForm", () => {
  it("shows field errors on submit and links them to the inputs", async () => {
    const user = userEvent.setup();
    const login = vi.spyOn(authApi, "login");
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Entrar" }));

    const email = screen.getByLabelText("Correo electrónico");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Escribe tu correo electrónico.");
    expect(screen.getByLabelText("Contraseña")).toHaveAccessibleDescription(
      "Escribe tu contraseña.",
    );
    expect(login).not.toHaveBeenCalled();
  });

  it("logs in and goes to the dashboard", async () => {
    const user = userEvent.setup();
    const login = vi
      .spyOn(authApi, "login")
      .mockResolvedValue({ id: "1", email: "ana@example.com", name: "Ana", terms_accepted: true });
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    await user.type(screen.getByLabelText("Contraseña"), STRONG);
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(login).toHaveBeenCalledWith({ email: "ana@example.com", password: STRONG });
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("shows the API's generic error in a focused alert", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "login").mockRejectedValue(
      new ApiError(
        401,
        "Correo o contraseña incorrectos, o la cuenta está bloqueada temporalmente.",
      ),
    );
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "mala");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Correo o contraseña incorrectos");
    expect(alert).toHaveFocus();
    expect(push).not.toHaveBeenCalled();
  });

  it("lets the user reveal the password", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    const password = screen.getByLabelText("Contraseña");

    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar contraseña" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("RegisterForm", () => {
  async function fillForm(password = STRONG, confirmation = password, acceptTerms = true) {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    await user.type(screen.getByLabelText("Contraseña"), password);
    await user.type(screen.getByLabelText("Confirmar contraseña"), confirmation);
    if (acceptTerms) await user.click(screen.getByRole("checkbox", { name: /acepto los/ }));
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
  }

  it("ticks password requirements as they are met", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    const rule = (label: RegExp) => screen.getByText(label).closest("li");

    expect(rule(/12 caracteres o más/)).toHaveAttribute("data-met", "false");
    await user.type(screen.getByLabelText("Contraseña"), STRONG);
    expect(rule(/12 caracteres o más/)).toHaveAttribute("data-met", "true");
    expect(rule(/Un símbolo/)).toHaveAttribute("data-met", "true");
  });

  it("registers, logs in with the same credentials and goes to the dashboard", async () => {
    const register = vi.spyOn(authApi, "register").mockResolvedValue({ message: "ok" });
    const login = vi
      .spyOn(authApi, "login")
      .mockResolvedValue({ id: "1", email: "ana@example.com", name: "Ana", terms_accepted: true });
    render(<RegisterForm />);

    await fillForm();

    expect(register).toHaveBeenCalledWith({
      name: "Ana",
      email: "ana@example.com",
      password: STRONG,
      accept_terms: true,
    });
    expect(login).toHaveBeenCalledWith({ email: "ana@example.com", password: STRONG });
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("asks for consent before creating the account, with links to both documents", async () => {
    const register = vi.spyOn(authApi, "register");
    render(<RegisterForm />);

    const checkbox = screen.getByRole("checkbox", { name: /acepto los/ });
    expect(checkbox).not.toBeChecked(); // consent is never pre-ticked
    expect(screen.getByRole("link", { name: "Términos y condiciones" })).toHaveAttribute(
      "href",
      "/legal/terminos",
    );
    expect(screen.getByRole("link", { name: "Política de privacidad" })).toHaveAttribute(
      "href",
      "/legal/privacidad",
    );

    await fillForm(STRONG, STRONG, false);

    expect(await screen.findByText(/Debes aceptar los Términos/)).toBeInTheDocument();
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(register).not.toHaveBeenCalled();
  });

  it("does not submit when the passwords differ", async () => {
    const register = vi.spyOn(authApi, "register");
    render(<RegisterForm />);

    await fillForm(STRONG, "Otra-Clave-2026!");

    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("lists every password problem the API reports", async () => {
    vi.spyOn(authApi, "register").mockRejectedValue(
      new ApiError(422, "La contraseña no es segura.", [
        "Es demasiado común. Elige algo menos predecible.",
      ]),
    );
    render(<RegisterForm />);

    await fillForm("Password-2026!");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("La contraseña no es segura.");
    expect(alert).toHaveTextContent("Es demasiado común.");
  });

  it("does not reveal whether the email already had an account", async () => {
    vi.spyOn(authApi, "register").mockResolvedValue({ message: "ok" });
    vi.spyOn(authApi, "login").mockRejectedValue(
      new ApiError(401, "Correo o contraseña incorrectos."),
    );
    render(<RegisterForm />);

    await fillForm();

    expect(await screen.findByRole("alert")).toHaveTextContent(/Si ya tenías una cuenta/);
    expect(push).not.toHaveBeenCalled();
  });
});
