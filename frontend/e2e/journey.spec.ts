import { expect, test } from "@playwright/test";

import {
  completeOnboarding,
  expectAccessible,
  expectNoHorizontalScroll,
  kpi,
  register,
  uniqueEmail,
} from "./helpers";

// One user, one story: each step builds on the previous one
test.describe.configure({ mode: "serial" });

test.describe("a new user's first week", () => {
  const email = uniqueEmail("ana");
  let context: import("@playwright/test").BrowserContext;
  let page: import("@playwright/test").Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("registers and is sent to onboarding", async () => {
    await register(page, "Ana E2E", email);
    await expect(page).toHaveURL(/\/onboarding$/);
    await expectAccessible(page);
  });

  test("completes onboarding and sees 100 − 30 + 160 = 230", async () => {
    await completeOnboarding(page);

    await expect(kpi(page, "Monto inicial")).toHaveText("$100.00");
    await expect(kpi(page, "Ingresos del periodo")).toHaveText("$160.00");
    await expect(kpi(page, "Gastado")).toHaveText("$30.00");
    await expect(kpi(page, "Saldo disponible")).toHaveText("$230.00");
    await expect(page.getByText(/Dentro del límite · te quedan \$10\.00/)).toBeVisible();
  });

  test("the session cookies are not readable from JavaScript", async () => {
    const visible = await page.evaluate(() => document.cookie);
    expect(visible).not.toContain("access_token");
    expect(visible).not.toContain("refresh_token");
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "access_token")?.httpOnly).toBe(true);
  });

  test("adds a movement and goes over the limit", async () => {
    await page.getByRole("button", { name: "Añadir movimiento" }).click();
    const dialog = page.getByRole("dialog", { name: "Añadir movimiento" });
    await dialog.getByLabel("Monto").fill("25");
    await dialog.getByLabel("Categoría").selectOption({ label: "Comida" });
    await dialog.getByLabel("Nota (opcional)").fill("Almuerzo");
    await dialog.getByRole("button", { name: "Guardar movimiento" }).click();

    await expect(dialog).toBeHidden();
    await expect(kpi(page, "Gastado")).toHaveText("$55.00");
    await expect(kpi(page, "Saldo disponible")).toHaveText("$205.00");
    // First match is the status chip (the chart's data table repeats it)
    await expect(page.getByText("Te pasaste por $15.00").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Añadir movimiento" })).toBeFocused();
  });

  test("the dashboard is accessible and fits a phone", async () => {
    await expectAccessible(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoHorizontalScroll(page);
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("the period lives in the URL", async () => {
    await page.getByRole("button", { name: "Mensual" }).click();
    await expect(page).toHaveURL(/period=monthly/);
    await page.reload();
    await expect(page.getByRole("button", { name: "Mensual" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("pausing the income updates the balance", async () => {
    await page.getByRole("link", { name: "Ingresos" }).click();
    await expect(page.getByRole("rowheader", { name: "Beca" })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("button", { name: "Pausar Beca" }).click();
    await expect(page.getByRole("status")).toContainText("«Beca» en pausa.");

    await page.getByRole("link", { name: "Dashboard" }).click();
    await page.getByRole("button", { name: "Semanal" }).click();
    await expect(kpi(page, "Ingresos del periodo")).toHaveText("$0.00");

    await page.getByRole("link", { name: "Ingresos" }).click();
    await page.getByRole("button", { name: "Activar Beca" }).click();
    await expect(page.getByRole("status")).toContainText("«Beca» activado.");
  });

  for (const [link, heading] of [
    ["Gastos", "Movimientos"],
    ["Gastos fijos", "Tus gastos fijos"],
    ["Predicción", "Detalle por periodo"],
    ["Configuración", "Tus finanzas"],
  ] as const) {
    test(`${link} loads and is accessible`, async () => {
      await page.getByRole("link", { name: link, exact: true }).click();
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await expectAccessible(page);
    });
  }

  test("logging out ends the session", async () => {
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });
});
