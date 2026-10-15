/**
 * Typed client for the Cuenta Clara API.
 *
 * Requests go to `/api/v1/...` on this same origin (Next.js proxies them to FastAPI),
 * so the session cookies are sent automatically. The access token lives in an
 * HttpOnly cookie that JavaScript can never read; this module only reads the
 * `csrf_token` cookie and copies it into the `X-CSRF-Token` header.
 */

import { clearSessionStart, markSessionStart } from "./session-clock";

const API_PREFIX = "/api/v1";
const CSRF_COOKIE = "csrf_token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// These start or renew a session themselves: never retry them through a refresh
const NO_REFRESH_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/password/forgot",
  "/auth/password/reset",
]);

export type User = { id: string; email: string; name: string; terms_accepted: boolean };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Every broken password rule, when the server rejects a weak password */
    readonly problems: string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const GENERIC_ERROR = "Algo salió mal. Inténtalo de nuevo en un momento.";
const NETWORK_ERROR = "No pudimos conectar con el servidor. Revisa tu conexión.";
const INVALID_EMAIL = "Escribe un correo válido, por ejemplo ana@correo.com.";
const INVALID_DATA = "Revisa los datos del formulario e inténtalo de nuevo.";
const VALUE_ERROR = "Value error, ";

export function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const match = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

/**
 * Our own validators speak Spanish ("Value error, Debes aceptar…"); Pydantic's built-in
 * checks answer in technical English ("value is not a valid email address…"). Show ours
 * without the prefix and replace the others with a plain message.
 */
function validationMessage({ msg, loc }: { msg: string; loc?: unknown[] }): string {
  if (msg.startsWith(VALUE_ERROR)) return msg.slice(VALUE_ERROR.length);
  return loc?.at(-1) === "email" ? INVALID_EMAIL : INVALID_DATA;
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    return new ApiError(response.status, GENERIC_ERROR);
  }
  const { detail, problems } = (body ?? {}) as { detail?: unknown; problems?: unknown };
  // FastAPI validation errors arrive as a list of { msg, loc }; ours as a plain string
  const message =
    typeof detail === "string"
      ? detail
      : Array.isArray(detail) && typeof detail[0]?.msg === "string"
        ? validationMessage(detail[0] as { msg: string; loc?: unknown[] })
        : GENERIC_ERROR;
  const problemList = Array.isArray(problems) ? problems.map(String) : [];
  return new ApiError(response.status, message, problemList);
}

type RequestOptions = { method?: string; body?: unknown };

/** "en" when the page is shown in English (the language switcher sets <html lang>). */
function pageLanguage(): string {
  return typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "es";
}

async function send(path: string, { method = "GET", body }: RequestOptions): Promise<Response> {
  // The API writes emails and Balbo's replies in the language the app is read in
  const headers = new Headers({ Accept: "application/json", "Accept-Language": pageLanguage() });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (!SAFE_METHODS.has(method)) {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  try {
    return await fetch(`${API_PREFIX}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR);
  }
}

// Several requests can expire at once: share a single refresh between them
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= send("/auth/refresh", { method: "POST" })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);

  // The access token lasts 15 minutes: renew it once with the refresh token and retry
  if (response.status === 401 && !NO_REFRESH_PATHS.has(path) && (await refreshSession())) {
    response = await send(path, options);
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const authApi = {
  register: (data: { name: string; email: string; password: string; accept_terms: boolean }) =>
    request<{ message: string }>("/auth/register", { method: "POST", body: data }),
  login: async (data: { email: string; password: string }) => {
    const user = await request<User>("/auth/login", { method: "POST", body: data });
    markSessionStart(); // the session timer at the top right starts here
    return user;
  },
  logout: async () => {
    clearSessionStart();
    await request<void>("/auth/logout", { method: "POST" });
  },
  me: () => request<User>("/auth/me"),
  /** Emails a 6-digit code if the account exists; the answer is the same either way */
  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/password/forgot", { method: "POST", body: { email } }),
  /** Sets a new password with the code; every open session is closed */
  resetPassword: (data: { email: string; code: string; new_password: string }) =>
    request<void>("/auth/password/reset", { method: "POST", body: data }),
};
