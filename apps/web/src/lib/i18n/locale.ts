// The two languages the app speaks, and how a visitor's language is chosen.
// Shared by the proxy (server), server components and client components.

export const LOCALES = ["en", "th"] as const;
export type Locale = (typeof LOCALES)[number];

/** Used when the browser prefers neither language. */
export const DEFAULT_LOCALE: Locale = "en";

/** Cookie holding the visitor's own choice; it wins over the browser's language. */
export const LOCALE_COOKIE = "lang";

/** A year: the choice should outlast a gap in training. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/**
 * The language from an Accept-Language header: Thai when the visitor ranks Thai
 * above English (or lists Thai and not English), otherwise English.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { lang: tag.trim().toLowerCase().split("-")[0], q: q ? Number(q.slice(2)) : 1, i };
    })
    .filter((x) => x.lang && Number.isFinite(x.q) && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  const first = ranked.find((x) => isLocale(x.lang));
  return first ? (first.lang as Locale) : DEFAULT_LOCALE;
}

/** The cookie's choice when it is valid, otherwise the browser's language. */
export function pickLocale(cookie: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  return isLocale(cookie) ? cookie : localeFromAcceptLanguage(acceptLanguage);
}

/** BCP 47 tag for dates and numbers. English uses day-month order, like the Thai dates. */
export const DATE_LOCALE: Record<Locale, string> = { en: "en-GB", th: "th-TH" };
