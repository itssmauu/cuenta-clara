import path from "node:path";

import { test } from "@playwright/test";

import {
  completeOnboarding,
  confirmDuePayments,
  register,
  skipCookieNotice,
  uniqueEmail,
  waitForSettled,
} from "./helpers";

// Captures the README screenshots: `npm run screenshots` (skipped in normal runs)
const OUT = path.resolve(__dirname, "../../docs/screenshots");

test("@screenshots capture the main screens", async ({ page, context }) => {
  await skipCookieNotice(context);
  await page.setViewportSize({ width: 1360, height: 900 });

  await page.goto("/");
  await waitForSettled(page); // the hero fades in on load
  await page.screenshot({ path: `${OUT}/landing.png` });

  await page.goto("/register");
  await page.getByLabel("Nombre").fill("Ana");
  await page.getByLabel("Contraseña", { exact: true }).fill("Lluvia-Verde");
  await page.screenshot({ path: `${OUT}/registro.png` });

  await register(page, "Ana", uniqueEmail("screens"));
  await completeOnboarding(page);
  await confirmDuePayments(page);

  // A savings account next to the day-to-day one, with money moved into it
  await page.goto("/cuentas");
  await page.getByRole("button", { name: "Nueva cuenta" }).click();
  const account = page.getByRole("dialog", { name: "Nueva cuenta" });
  await account.getByLabel("Nombre").fill("Ahorro");
  await account.getByLabel("¿Para qué la usas?").selectOption("savings");
  await account.getByLabel(/¿Cuánto tenía/).fill("400");
  await account.getByRole("button", { name: "Guardar cuenta" }).click();
  await page.getByRole("article", { name: "Ahorro" }).waitFor();
  await page.getByRole("button", { name: "Mover dinero" }).first().click();
  const move = page.getByRole("dialog", { name: "Mover dinero entre cuentas" });
  await move.getByLabel("Monto").fill("50");
  await move.getByLabel("Nota (opcional)").fill("Ahorro de la semana");
  await move.getByRole("button", { name: "Mover dinero" }).click();
  await page.getByText("Ahorro de la semana").waitFor();
  await page.getByText("Dinero movido entre tus cuentas.").waitFor({ state: "hidden" });
  await waitForSettled(page);
  await page.screenshot({ path: `${OUT}/cuentas.png`, fullPage: true });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Añadir movimiento" }).click();
  const dialog = page.getByRole("dialog", { name: "Añadir movimiento" });
  await dialog.getByLabel("Monto").fill("25");
  await dialog.getByLabel("Categoría").selectOption({ label: "Comida" });
  await dialog.getByLabel("Nota (opcional)").fill("Almuerzo");
  await dialog.getByRole("button", { name: "Guardar movimiento" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByText("Te pasaste por").first().waitFor();
  // A clean shot: no toast and no chart tooltip under a leftover pointer
  await page.getByText("Movimiento guardado.").waitFor({ state: "hidden" });
  await page.mouse.move(0, 0);
  await waitForSettled(page);
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
