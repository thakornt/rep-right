import { NextResponse, type NextRequest } from "next/server";

// Every /api/* request is rewritten to the Go API (next.config.ts). On the way
// it gets two headers the API checks:
//   X-RR-Proxy-Secret  proves the request came through this app, so the API
//                      host cannot be called directly (PROXY_SECRET, server-only)
//   X-RR-Client-IP     the visitor's IP, which the API rate-limits by
// Values a browser sends for these headers are always overwritten.
const proxySecret = process.env.PROXY_SECRET ?? "";

function visitorIP(request: NextRequest): string {
  // On Vercel both headers are set by the platform from the real connection.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("x-real-ip") ?? forwarded ?? "";
}

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete("x-rr-proxy-secret");
  headers.delete("x-rr-client-ip");
  if (proxySecret) {
    headers.set("x-rr-proxy-secret", proxySecret);
    const ip = visitorIP(request);
    if (ip) headers.set("x-rr-client-ip", ip);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: "/api/:path*",
};
