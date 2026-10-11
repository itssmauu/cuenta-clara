import type { NextConfig } from "next";

// Where the Next.js server reaches the FastAPI backend. Read at build time
// (standalone output serializes this config), so Docker passes it as a build arg.
// On Vercel, vercel.json sends /api/* straight to the backend service, so this app
// never sees those requests and needs no address for it.
const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Browsers only honor it over HTTPS, so it is harmless on http://localhost
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    // The browser only ever talks to this origin: /api/* is proxied to FastAPI, so
    // session cookies are first-party and no CORS is needed. (On Vercel the platform
    // routes /api/* to the backend service before this app is involved.)
    if (process.env.VERCEL) return [];
    return [{ source: "/api/:path*", destination: `${apiInternalUrl}/api/:path*` }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
