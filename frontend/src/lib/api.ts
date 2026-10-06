/**
 * Typed client for the Cuenta Clara API.
 *
 * Requests go to `/api/v1/...` on this same origin (Next.js proxies them to FastAPI),
 * so the session cookies are sent automatically. The access token lives in an
 * HttpOnly cookie that JavaScript can never read; this module only reads the
 * `csrf_token` cookie and copies it into the `X-CSRF-Token` header.
 */

const API_PREFIX = "/api/v1";
const CSRF_COOKIE = "csrf_token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// These start or renew a session themselves: never retry them through a refresh
const NO_REFRESH_PATHS = new Set(["/auth/login", "/auth/register", "/auth/refresh"]);

export type User = { id: string; email: string; name: string };

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

export function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const match = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    return new ApiError(response.status, GENERIC_ERROR);
  }
  const { detail, problems } = (body ?? {}) as { detail?: unknown; problems?: unknown };
  // FastAPI validation errors arrive as a list of { msg }; ours as a plain string
  const message =
    typeof detail === "string"
      ? detail
      : Array.isArray(detail) && typeof detail[0]?.msg === "string"
        ? String(detail[0].msg)
        : GENERIC_ERROR;
  const problemList = Array.isArray(problems) ? problems.map(String) : [];
  return new ApiError(response.status, message, problemList);
}

type RequestOptions = { method?: string; body?: unknown };

async function send(path: string, { method = "GET", body }: RequestOptions): Promise<Response> {
  const headers = new Headers({ Accept: "application/json" });
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
  register: (data: { name: string; email: string; password: string }) =>
    request<{ message: string }>("/auth/register", { method: "POST", body: data }),
  login: (data: { email: string; password: string }) =>
    request<User>("/auth/login", { method: "POST", body: data }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<User>("/auth/me"),
};
