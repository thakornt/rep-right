import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import path from "node:path";

// One .env at the repo root serves both the API and this app. Next only reads
// apps/web/.env* by itself; values already set (e.g. on Vercel) still win.
// forceReload: Next has already loaded (and cached) apps/web's env by now.
loadEnvConfig(path.resolve(process.cwd(), "../.."), process.env.NODE_ENV !== "production", undefined, true);

// The browser only ever talks to this origin; /api/* is proxied to the Go API
// so the refresh-token cookie stays first-party (Safari/iOS block third-party ones).
const apiOrigin = (process.env.API_ORIGIN ?? "http://localhost:8080").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/:path*` }];
  },
};

export default nextConfig;
