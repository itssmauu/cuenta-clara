// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy } from "./proxy";

// NextResponse.next({ request: { headers } }) hands the new request headers to Next.js
// as `x-middleware-request-<name>`, listing the kept names in x-middleware-override-headers
const forwarded = (response: Response, name: string) =>
  response.headers.get(`x-middleware-request-${name}`);
const kept = (response: Response) =>
  (response.headers.get("x-middleware-override-headers") ?? "").split(",");

function apiCall(headers: Record<string, string> = {}) {
  return new NextRequest("https://cuentaclara.example/api/v1/auth/me", { headers });
}

afterEach(() => vi.unstubAllEnvs());

describe("proxy for /api", () => {
  it("adds the shared secret and the visitor IP that Vercel reports", () => {
    vi.stubEnv("API_PROXY_SECRET", "s".repeat(40));
    vi.stubEnv("VERCEL", "1");

    const response = proxy(apiCall({ "x-real-ip": "198.51.100.7" }));

    expect(forwarded(response, "x-proxy-secret")).toBe("s".repeat(40));
    expect(forwarded(response, "x-client-ip")).toBe("198.51.100.7");
    // API responses are JSON: no page CSP for them
    expect(response.headers.get("content-security-policy")).toBeNull();
  });

  it("never forwards the secret or IP a client tries to send", () => {
    vi.stubEnv("API_PROXY_SECRET", "");
    vi.stubEnv("VERCEL", "");

    const response = proxy(
      apiCall({
        "x-proxy-secret": "guessed",
        "x-client-ip": "203.0.113.9",
        "x-real-ip": "1.2.3.4",
      }),
    );

    expect(kept(response)).not.toContain("x-proxy-secret");
    expect(kept(response)).not.toContain("x-client-ip");
  });

  it("replaces a client-sent IP with Vercel's on Vercel", () => {
    vi.stubEnv("VERCEL", "1");

    const response = proxy(apiCall({ "x-client-ip": "203.0.113.9", "x-real-ip": "198.51.100.7" }));

    expect(forwarded(response, "x-client-ip")).toBe("198.51.100.7");
  });
});

describe("proxy for pages", () => {
  it("sets a nonce-based CSP", () => {
    const response = proxy(new NextRequest("https://cuentaclara.example/dashboard"));

    expect(response.headers.get("content-security-policy")).toMatch(
      /'nonce-[^']+' 'strict-dynamic'/,
    );
  });
});
