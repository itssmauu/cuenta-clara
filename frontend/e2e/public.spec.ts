import { expect, test } from "@playwright/test";

import { expectAccessible, expectNoHorizontalScroll, PASSWORD, uniqueEmail } from "./helpers";

test.describe("public pages", () => {
  test("landing explains the product and leads to sign-up", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sabe cuánto te queda");
    await expect(page.getByText("Si tienes $100 y gastas $30, te quedan $70.")).toBeVisible();
    await page.getByRole("link", { name: "Empezar gratis" }).click();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("landing sections fade in on scroll and their figures count up", async ({ page }) => {
    await page.goto("/");
    const prediction = page.locator("#prediccion");
    await expect(prediction).toHaveAttribute("data-reveal", "hidden");

    await page.getByRole("heading", { name: /Si tienes \$100/ }).scrollIntoViewIfNeeded();
    await expect(prediction).toHaveAttribute("data-reveal", "shown");
    await expect(prediction.locator('[data-count-to="230"]').first()).toHaveText("$230");
    // Screen readers get the final figure once, never the digits in motion
    await expect(prediction.locator(".sr-only", { hasText: "$490" })).toHaveCount(1);
    await expect(prediction.locator('[data-count-to="490"]')).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    // Fully revealed, the page is still accessible
    await page.keyboard.press("End");
    await expect(page.locator('[data-reveal="hidden"]')).toHaveCount(0);
    await expectAccessible(page);
  });

  test("the moving feature band can be paused", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Pausar animación" });
    await toggle.click();

    await expect(page.getByRole("button", { name: "Reanudar animación" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const state = await page
      .locator(".marquee-track")
      .evaluate((track) => getComputedStyle(track).animationPlayState);
    expect(state).toBe("paused");
  });

  test("with reduced motion nothing is hidden or animated", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await expect(page.locator("#prediccion")).not.toHaveAttribute("data-reveal", /hidden|shown/);
    await expect(page.locator('[data-reveal="hidden"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Pausar animación" })).toBeHidden();
  });

  for (const path of [
    "/",
    "/login",
    "/register",
    "/recuperar-contrasena",
    "/no-existe",
    "/legal/privacidad",
    "/legal/terminos",
    "/legal/cookies",
  ]) {
    test(`${path} has no detectable accessibility violations`, async ({ page }) => {
      await page.goto(path);
      await expectAccessible(page);
    });
  }

  test("the legal documents are linked from every public page", async ({ page }) => {
    for (const path of ["/", "/login", "/register"]) {
      await page.goto(path);
      const legal = page.getByRole("navigation", { name: "Información legal" });
      await expect(legal.getByRole("link", { name: /privacidad/i })).toHaveAttribute(
        "href",
        "/legal/privacidad",
      );
      await expect(legal.getByRole("link", { name: /términos/i })).toBeVisible();
      await expect(legal.getByRole("link", { name: /cookies/i })).toBeVisible();
    }
  });

  test("the privacy policy names who is responsible and the user's rights", async ({ page }) => {
    await page.goto("/legal/privacidad");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Política de privacidad");
    await expect(page.locator("#responsable")).toContainText("Mauro González");
    await expect(page.locator("#normativa")).toContainText("Ley 81");
    await expect(page.locator("#derechos")).toContainText("Portabilidad");
    await expect(page.locator("#balbo")).toContainText("Google");
  });

  test("the cookie notice informs once and can be dismissed", async ({ page }) => {
    await page.goto("/");
    const notice = page.getByRole("region", { name: "Aviso de cookies" });
    await expect(notice).toContainText("Solo usamos cookies técnicas");

    await notice.getByRole("button", { name: "Entendido" }).click();
    await expect(notice).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(notice).toBeHidden();
  });

  test("signing up requires accepting the terms", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Sin Consentimiento");
    await page.getByLabel("Correo electrónico").fill(uniqueEmail("sin-consent"));
    await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirmar contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page.getByText(/Debes aceptar los Términos/)).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("unknown pages show a friendly 404", async ({ page }) => {
    const response = await page.goto("/no-existe");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  });

  test("keyboard users can skip straight to the content", async ({ page }) => {
    await page.goto("/login");

    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#contenido")).toBeFocused();
  });

  test("every page is served with a nonce-based CSP", async ({ page }) => {
    const response = await page.goto("/");
    const csp = response?.headers()["content-security-policy"] ?? "";

    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test("wrong credentials get a generic, focused error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(uniqueEmail("nadie"));
    await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();

    // Next.js adds its own route announcer with role="alert"; pick ours by its text
    const alert = page.getByRole("alert").filter({ hasText: "Correo o contraseña incorrectos" });
    await expect(alert).toBeVisible();
    await expect(alert).toBeFocused();
  });

  test("pages fit a phone screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const path of ["/", "/login", "/register", "/legal/privacidad", "/legal/cookies"]) {
      await page.goto(path);
      await expectNoHorizontalScroll(page);
    }
  });
});
