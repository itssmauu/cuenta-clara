import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { financeApi } from "@/lib/finance-api";

// findBy*/waitFor give up after 1 s by default: too tight when every test file runs at once
configure({ asyncUtilTimeout: 3000 });

// Pages load the user's accounts; by default there is one, so no account choices show up.
// (Defined here, not imported from test-utils: that would load next/navigation before the
// test files get to mock it.)
beforeEach(() => {
  vi.spyOn(financeApi, "listAccounts").mockResolvedValue([
    {
      id: "a-main",
      name: "Gastos del día",
      kind: "spending",
      initial_balance: "100.00",
      is_primary: true,
      balance: "230.00",
    },
  ]);
});

afterEach(() => {
  cleanup();
  // Cookies set by one test (e.g. csrf_token) must not leak into the next
  if (typeof document === "undefined") return;
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
});

// jsdom has no layout engine: Recharts' ResponsiveContainer needs ResizeObserver to exist,
// and <dialog> needs showModal/close (not implemented in jsdom)
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
// (Server-side tests run in the node environment, which has no DOM at all)
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
}
