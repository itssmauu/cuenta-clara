import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, authApi, request } from "./api";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function headersOf(call: Parameters<typeof fetch>) {
  return new Headers(call[1]?.headers);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request", () => {
  it("sends the CSRF cookie as a header on state-changing requests", async () => {
    document.cookie = "csrf_token=abc123; path=/";
    const fetchMock = mockFetch(new Response(null, { status: 204 }));

    await authApi.logout();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/auth/logout");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("same-origin");
    expect(headersOf(fetchMock.mock.calls[0]!).get("X-CSRF-Token")).toBe("abc123");
  });

  it("does not send the CSRF header on GET", async () => {
    document.cookie = "csrf_token=abc123; path=/";
    const fetchMock = mockFetch(
      json(200, { id: "1", email: "a@b.co", name: "Ana", terms_accepted: true }),
    );

    await authApi.me();

    expect(headersOf(fetchMock.mock.calls[0]!).has("X-CSRF-Token")).toBe(false);
  });

  it("refreshes the session once on 401 and retries", async () => {
    const user = { id: "1", email: "a@b.co", name: "Ana", terms_accepted: true };
    const fetchMock = mockFetch(json(401, { detail: "x" }), json(200, user), json(200, user));

    await expect(authApi.me()).resolves.toEqual(user);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/auth/me",
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
    ]);
  });

  it("gives up when the refresh fails", async () => {
    const fetchMock = mockFetch(json(401, { detail: "No has iniciado sesión." }), json(401, {}));

    await expect(authApi.me()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never refreshes when logging in fails", async () => {
    const fetchMock = mockFetch(json(401, { detail: "Correo o contraseña incorrectos." }));

    await expect(authApi.login({ email: "a@b.co", password: "x" })).rejects.toThrow(
      "Correo o contraseña incorrectos.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("exposes password problems from the API", async () => {
    mockFetch(
      json(422, { detail: "La contraseña no es segura.", problems: ["Es demasiado común."] }),
    );

    const failure = request("/auth/register", { method: "POST", body: {} });

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ problems: ["Es demasiado común."] });
  });

  it("uses the first message of a FastAPI validation error", async () => {
    mockFetch(json(422, { detail: [{ msg: "Field required", loc: ["body", "email"] }] }));

    await expect(request("/x")).rejects.toThrow("Field required");
  });

  it("turns network failures into a friendly ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline")));

    await expect(authApi.me()).rejects.toMatchObject({
      status: 0,
      message: expect.stringMatching(/conexión/),
    });
  });
});
