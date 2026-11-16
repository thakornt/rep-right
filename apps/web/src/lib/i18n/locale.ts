// The two languages the app speaks, and how a visitor's language is chosen.
// Shared by the proxy (server), server components and client components.

export const LOCALES = ["en", "th"] as const;
export type Locale = (typeof LOCALES)[number];

/** The language for anyone who has not picked one: the app is made for Thai lifters first. */
export const DEFAULT_LOCALE: Locale = "th";

/** Cookie holding the visitor's own choice. */
export const LOCALE_COOKIE = "lang";

/** A year: the choice should outlast a gap in training. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/**
 * The cookie's choice when it is valid, otherwise Thai. The browser's language is not used:
 * many Thai phones are set to English, and the owner wants Thai unless the visitor switches.
 */
export function pickLocale(cookie: string | null | undefined): Locale {
  return isLocale(cookie) ? cookie : DEFAULT_LOCALE;
}

/** BCP 47 tag for dates and numbers. English uses day-month order, like the Thai dates. */
export const DATE_LOCALE: Record<Locale, string> = { en: "en-GB", th: "th-TH" };
