import { NextResponse, type NextRequest } from "next/server";

import { LOCALE_COOKIE, isLocale, pickLocale } from "@/lib/i18n/locale";

// Every page lives under app/[lang], prerendered once per language. Addresses
// stay language-free (/exercises): this picks the language from the visitor's
// saved choice, else Thai, and serves that copy of the page.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1];
  if (isLocale(first)) return NextResponse.next(); // already a language's copy

  const locale = pickLocale(request.cookies.get(LOCALE_COOKIE)?.value);
  const res = NextResponse.rewrite(new URL(`/${locale}${pathname === "/" ? "" : pathname}${search}`, request.url));
  // The same address answers in either language.
  res.headers.set("Vary", "Cookie");
  return res;
}

export const config = {
  // Pages only: not the API proxy, Next's own files, or files in public/ (they have an extension).
  matcher: ["/((?!api/|_next/|.*\\.[^/]+$).*)"],
};
