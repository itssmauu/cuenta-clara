import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Lluvia-Verde-2026!";

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Waits until the network is idle and every finite animation or transition has ended. */
export async function waitForSettled(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        // Infinite ones (loading pulses) never finish: only wait for the finite ones
        .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
        .map((a) => a.finished),
    ),
  );
}

/** Fails the test on any WCAG 2.2 A/AA violation axe can detect on the current page. */
export async function expectAccessible(page: Page) {
  // Audit the settled page: mid-transition colors (e.g. a button turning active) would
  // otherwise be measured halfway and report a contrast that the user never really sees
  await waitForSettled(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(summary, `axe violations on ${page.url()}`).toEqual([]);
}

/** Pages must never scroll sideways on a phone. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

export async function register(page: Page, name: string, email: string) {
  await page.goto("/register");
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmar contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
}

/** The spec example: $100, weekly bus fare $30, weekly grant $160, $40 limit. */
export async function completeOnboarding(page: Page) {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("¿Con cuánto dinero cuentas hoy?").fill("100");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByLabel("Nombre").fill("Pasaje");
  await page.getByLabel("Monto").fill("30");
  await page.getByLabel("Frecuencia").selectOption("weekly");
  await page.getByRole("button", { name: "Agregar gasto fijo" }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();

  await page.getByLabel("¿Cada cuánto recibes dinero?").selectOption("weekly");
  await page.getByLabel(/¿Cuánto recibes cada vez\?/).fill("160");
  await page.getByLabel("¿De dónde viene?").fill("Beca");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByLabel(/como máximo por periodo semanal/).fill("40");
  await page.getByRole("button", { name: "Ver mi dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export function kpi(page: Page, label: string) {
  return page
    .getByRole("region", { name: "Resumen del periodo" })
    .getByText(label, { exact: true })
    .locator("xpath=following-sibling::*[1]");
}
