"use client";

// The active language in Client Components. The root layout provides it from
// the [lang] segment, so the server render and the browser always agree.

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, type ReactNode } from "react";

import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "./locale";
import { MESSAGES, type Messages } from "./messages";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export const useLocale = (): Locale => useContext(LocaleContext);

export const useMessages = (): Messages => MESSAGES[useLocale()];

/**
 * Saves the visitor's choice in a cookie (not auth-related: it only picks the
 * language) and shows the current page in it. The proxy reads the cookie, so
 * every page from here on comes in the chosen language.
 */
export function useSetLocale() {
  const router = useRouter();
  return useCallback(
    (locale: Locale) => {
      const secure = window.location.protocol === "https:" ? "; secure" : "";
      document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax${secure}`;
      // Drops every page the router kept in the old language and fetches this one again.
      router.refresh();
    },
    [router],
  );
}
