import type { NextConfig } from "next";

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
