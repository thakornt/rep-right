import { NextResponse, type NextRequest } from "next/server";

import { LOCALE_COOKIE, isLocale, pickLocale } from "@/lib/i18n/locale";

// /api/* is rewritten to the Go API (next.config.ts). On the way it gets two
// headers the API checks:
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

function toApi(request: NextRequest) {
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

// Every page lives under app/[lang], prerendered once per language. Addresses
// stay language-free (/exercises): this picks the language from the visitor's
// saved choice, else Thai, and serves that copy of the page.
function toPage(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1];
  if (isLocale(first)) return NextResponse.next(); // already a language's copy

  const locale = pickLocale(request.cookies.get(LOCALE_COOKIE)?.value);
  const res = NextResponse.rewrite(new URL(`/${locale}${pathname === "/" ? "" : pathname}${search}`, request.url));
  // The same address answers in either language.
  res.headers.set("Vary", "Cookie");
  return res;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  return pathname === "/api" || pathname.startsWith("/api/") ? toApi(request) : toPage(request);
}

export const config = {
  matcher: [
    // The API proxy.
    "/api/:path*",
    // Pages only: not Next's own files, or files in public/ (they have an extension).
    "/((?!api/|_next/|.*\\.[^/]+$).*)",
  ],
};
