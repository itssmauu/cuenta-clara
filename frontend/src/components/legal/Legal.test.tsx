import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrivacySection } from "@/components/finance/PrivacySection";
import { ApiError } from "@/lib/api";
import { assistantApi } from "@/lib/assistant-api";
import { LEGAL } from "@/lib/legal";
import * as privacy from "@/lib/privacy-api";

import { COOKIE_NOTICE_KEY, CookieNotice } from "./CookieNotice";
import { TermsGate } from "./TermsGate";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const { privacyApi } = privacy;

beforeEach(() => {
  replace.mockReset();
  vi.spyOn(assistantApi, "status").mockResolvedValue({
    name: "Balbo",
    available: true,
    consented: false,
  });
});

describe("PrivacySection", () => {
  it("downloads a copy of every stored datum as a JSON file", async () => {
    const user = userEvent.setup();
    const data = { usuario: { email: "ana@example.com" } };
    vi.spyOn(privacyApi, "exportData").mockResolvedValue(data);
    const save = vi.spyOn(privacy, "saveAsJsonFile").mockImplementation(() => {});
    render(<PrivacySection onNotice={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Descargar mis datos" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(data));
  });

  it("turns Balbo on and off", async () => {
    const user = userEvent.setup();
    const onNotice = vi.fn();
    const grant = vi.spyOn(privacyApi, "grantAssistant").mockResolvedValue(undefined);
    const revoke = vi.spyOn(privacyApi, "revokeAssistant").mockResolvedValue(undefined);
    render(<PrivacySection onNotice={onNotice} />);

    await user.click(await screen.findByRole("button", { name: "Activar Balbo" }));
    expect(grant).toHaveBeenCalledOnce();
    expect(onNotice).toHaveBeenCalledWith("Balbo está activado.");

    await user.click(await screen.findByRole("button", { name: "Desactivar Balbo" }));
    expect(revoke).toHaveBeenCalledOnce();
    expect(await screen.findByText(/Desactivado: no se envía nada/)).toBeInTheDocument();
  });

  it("deletes the account only with the password, then leaves the app", async () => {
    const user = userEvent.setup();
    const remove = vi
      .spyOn(privacyApi, "deleteAccount")
      .mockRejectedValueOnce(new ApiError(403, "La contraseña no es correcta."))
      .mockResolvedValueOnce(undefined);
    render(<PrivacySection onNotice={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Eliminar mi cuenta" }));
    const dialog = screen.getByRole("dialog", { name: "Eliminar tu cuenta" });
    const confirm = within(dialog).getByRole("button", { name: "Eliminar para siempre" });

    await user.click(confirm);
    expect(within(dialog).getByText("Escribe tu contraseña para confirmar.")).toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();

    const password = within(dialog).getByLabelText("Tu contraseña, para confirmar");
    await user.type(password, "mala");
    await user.click(confirm);
    expect(await within(dialog).findByText("La contraseña no es correcta.")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    await user.clear(password);
    await user.type(password, "Lluvia-Verde-2026!");
    await user.click(confirm);
    expect(remove).toHaveBeenLastCalledWith("Lluvia-Verde-2026!");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});

describe("TermsGate", () => {
  it("records consent to the current version and lets the user in", async () => {
    const user = userEvent.setup();
    const updated = { id: "u1", email: "ana@example.com", name: "Ana", terms_accepted: true };
    const accept = vi.spyOn(privacyApi, "acceptTerms").mockResolvedValue(updated);
    const onAccepted = vi.fn();
    render(<TermsGate onAccepted={onAccepted} onLogout={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Actualizamos nuestros términos" })).toHaveFocus();
    expect(screen.getByRole("link", { name: "Política de privacidad" })).toHaveAttribute(
      "href",
      "/legal/privacidad",
    );
    await user.click(screen.getByRole("button", { name: "Acepto los nuevos términos" }));

    expect(accept).toHaveBeenCalledWith(LEGAL.version);
    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith(updated));
  });

  it("lets the user exercise their rights without accepting", () => {
    render(<TermsGate onAccepted={vi.fn()} onLogout={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Descargar mis datos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar mi cuenta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });
});

describe("CookieNotice", () => {
  beforeEach(() => localStorage.clear());

  it("explains the essential cookies and stays away once dismissed", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<CookieNotice />);

    const notice = screen.getByRole("region", { name: "Aviso de cookies" });
    expect(notice).toHaveTextContent("Solo usamos cookies técnicas");
    expect(within(notice).getByRole("link", { name: "Más información" })).toHaveAttribute(
      "href",
      "/legal/cookies",
    );

    await user.click(within(notice).getByRole("button", { name: "Entendido" }));
    expect(screen.queryByRole("region", { name: "Aviso de cookies" })).toBeNull();
    expect(localStorage.getItem(COOKIE_NOTICE_KEY)).toBe("seen");

    unmount();
    render(<CookieNotice />);
    expect(screen.queryByRole("region", { name: "Aviso de cookies" })).toBeNull();
  });
});
