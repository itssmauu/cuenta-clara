import path from "node:path";

import { test } from "@playwright/test";

import { completeOnboarding, register, uniqueEmail } from "./helpers";

// Captures the README screenshots: `npm run screenshots` (skipped in normal runs)
const OUT = path.resolve(__dirname, "../../docs/screenshots");

test("@screenshots capture the main screens", async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 900 });

  await page.goto("/");
  await page.screenshot({ path: `${OUT}/landing.png` });

  await page.goto("/register");
  await page.getByLabel("Nombre").fill("Ana");
  await page.getByLabel("Contraseña", { exact: true }).fill("Lluvia-Verde");
  await page.screenshot({ path: `${OUT}/registro.png` });

  await register(page, "Ana", uniqueEmail("screens"));
  await completeOnboarding(page);
  await page.getByRole("button", { name: "Añadir movimiento" }).click();
  const dialog = page.getByRole("dialog", { name: "Añadir movimiento" });
  await dialog.getByLabel("Monto").fill("25");
  await dialog.getByLabel("Categoría").selectOption({ label: "Comida" });
  await dialog.getByLabel("Nota (opcional)").fill("Almuerzo");
  await dialog.getByRole("button", { name: "Guardar movimiento" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByText("Te pasaste por").first().waitFor();
  await page.screenshot({ path: `${OUT}/dashboard.png`, fullPage: true });

  await page.getByRole("link", { name: "Predicción" }).click();
  await page.getByRole("heading", { name: "Detalle por periodo" }).waitFor();
  await page.screenshot({ path: `${OUT}/prediccion.png`, fullPage: true });

  await page.getByRole("link", { name: "Metas de ahorro" }).click();
  await page.getByRole("button", { name: "Nueva meta" }).first().click();
  const goal = page.getByRole("dialog", { name: "Nueva meta" });
  await goal.getByLabel("¿Para qué ahorras?").fill("Laptop");
  await goal.getByLabel("Meta", { exact: true }).fill("600");
  await goal.getByLabel("Ya tengo ahorrado").fill("150");
  const due = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
  await goal.getByLabel("Fecha objetivo (opcional)").fill(due);
  await goal.getByRole("button", { name: "Guardar meta" }).click();
  await page.getByRole("article", { name: "Laptop" }).waitFor();
  await page.screenshot({ path: `${OUT}/metas.png` });

  await page.getByRole("link", { name: "Reportes" }).click();
  await page.getByRole("heading", { name: /Este periodo frente a/ }).waitFor();
  await page.screenshot({ path: `${OUT}/reportes.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  // On a phone the sidebar is collapsed into a menu: navigate directly
  await page.goto("/dashboard");
  await page.getByText("Saldo disponible").first().waitFor();
  await page.screenshot({ path: `${OUT}/dashboard-movil.png` });
});
