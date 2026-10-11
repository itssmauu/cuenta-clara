import type { NextConfig } from "next";

// Where the Next.js server reaches the FastAPI backend. Read at build time
// (standalone output serializes this config), so Docker passes it as a build arg.
const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
if (process.env.VERCEL && !process.env.API_INTERNAL_URL) {
  // Otherwise every /api call would silently go to localhost and fail
  throw new Error("Set API_INTERNAL_URL to the API's URL in the Vercel project settings");
}

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
    // session cookies are first-party and no CORS is needed.
    return [{ source: "/api/:path*", destination: `${apiInternalUrl}/api/:path*` }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
