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
    // Phase 9: the over-limit alert and the category breakdown
    await expect(
      page.getByText("Te pasaste de tu límite semanal por $15.00", { exact: false }),
    ).toBeVisible();
    // The table view sits in a <details>: open it like a user would
    const categories = page.getByRole("region", { name: "Gasto por categoría" });
    await categories.getByText("Ver como tabla").click();
    await expect(categories.getByRole("table")).toContainText("Comida$25.00");
    await expect(categories.getByRole("table")).toContainText("Sin categoría$30.00");
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

  test("saves towards a goal", async () => {
    await page.getByRole("link", { name: "Metas de ahorro" }).click();
    await expect(page.getByText("Aún no tienes metas de ahorro")).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("button", { name: "Nueva meta" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Nueva meta" });
    await dialog.getByLabel("¿Para qué ahorras?").fill("Laptop");
    await dialog.getByLabel("Meta", { exact: true }).fill("600");
    await dialog.getByRole("button", { name: "Guardar meta" }).click();

    const card = page.getByRole("article", { name: "Laptop" });
    await expect(card).toContainText("$0.00 de $600.00");
    await page.getByRole("button", { name: "Aportar o retirar en Laptop" }).click();
    const money = page.getByRole("dialog");
    await money.getByLabel("Monto").fill("150");
    await money.getByRole("button", { name: "Aportar" }).click();

    await expect(card).toContainText("$150.00 de $600.00");
    await expect(card.getByRole("meter")).toHaveAttribute("aria-valuenow", "25");
    await expectAccessible(page);
  });

  test("reports compare periods and export a CSV", async () => {
    await page.getByRole("link", { name: "Reportes" }).click();
    await expect(page.getByRole("heading", { name: /Este periodo frente a/ })).toBeVisible();
    await expectAccessible(page);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Descargar CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^cuenta-clara-movimientos-.*.csv$/);
    const csv = await (await download.createReadStream()).toArray();
    const text = Buffer.concat(csv).toString("utf8");
    expect(text).toContain("fecha,tipo,monto,categoria,nota");
    expect(text).toContain("gasto,-25.00,Comida,Almuerzo");
  });

  test("the forecast can use a trend estimate", async () => {
    await page.getByRole("link", { name: "Predicción" }).click();
    await page.getByRole("button", { name: "Tendencia" }).click();
    await expect(page.getByRole("button", { name: "Tendencia" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // A brand-new user has no complete weeks: the page explains the fallback
    await expect(page.getByText(/hacen falta al menos 3 periodos completos/)).toBeVisible();
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
