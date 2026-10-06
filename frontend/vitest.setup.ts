import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  // Cookies set by one test (e.g. csrf_token) must not leak into the next
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
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
};
