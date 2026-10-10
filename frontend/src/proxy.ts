import { NextResponse, type NextRequest } from "next/server";

// Headers only this proxy may set: whatever a client sends under these names is dropped
const PROXY_SECRET_HEADER = "x-proxy-secret";
const CLIENT_IP_HEADER = "x-client-ip";

/**
 * Calls to /api/* are forwarded to FastAPI (rewrite in next.config.ts). On Vercel the
 * API only sees this server's address, so the proxy tells it who the visitor is (from
 * the platform's own header, never from the client) and proves the request came through
 * here with a secret shared only with the API.
 */
function forwardToApi(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(PROXY_SECRET_HEADER);
  headers.delete(CLIENT_IP_HEADER);

  const secret = process.env.API_PROXY_SECRET;
  if (secret) headers.set(PROXY_SECRET_HEADER, secret);
  // Vercel overwrites these with the real visitor address; elsewhere they are untrusted
  if (process.env.VERCEL) {
    const ip =
      request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0];
    if (ip) headers.set(CLIENT_IP_HEADER, ip.trim());
  }
  return NextResponse.next({ request: { headers } });
}

/**
 * Sets a strict Content-Security-Policy with a fresh nonce on every page request.
 * Next.js reads the nonce from the header and attaches it to its own scripts, so
 * only scripts we ship can run, even if an attacker manages to inject markup.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) return forwardToApi(request);

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    // React needs eval only in development (error overlays), never in production
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // API calls: always, so the secret and visitor IP are never missing
    "/api/:path*",
    {
      // Pages only: not the API proxy, static assets or link prefetches
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
