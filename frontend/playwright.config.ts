import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running stack (web + API + database).
 * Locally: `E2E_BASE_URL=http://localhost:3000 npm run e2e`. In CI they run against
 * the Docker Compose stack. The tests create their own users with unique emails.
 */
export default defineConfig({
  testDir: "./e2e",
  // One worker: the API rate-limits logins per IP, and every test shares one IP
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "es-PA",
    timezoneId: "America/Panama",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "e2e", use: { ...devices["Desktop Chrome"] }, grepInvert: /@screenshots/ },
    // README screenshots, opt-in: npm run screenshots
    { name: "screenshots", use: { ...devices["Desktop Chrome"] }, grep: /@screenshots/ },
  ],
});
