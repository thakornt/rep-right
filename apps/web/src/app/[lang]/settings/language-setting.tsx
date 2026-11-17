"use client";

import { ChevronDown } from "lucide-react";

import { useLocale, useMessages, useSetLocale } from "@/lib/i18n/client";
import { LOCALES, isLocale } from "@/lib/i18n/locale";

/** The app's language: one row with a select. Works signed in or not; the choice is kept in a cookie. */
export function LanguageSetting() {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const t = useMessages().account;
  return (
    <label className="flex items-center justify-between gap-4 rounded-3xl bg-surface px-5 py-3">
      <span className="font-medium">{t.language}</span>
      <span className="relative">
        <select
          value={locale}
          onChange={(e) => {
            if (isLocale(e.target.value)) setLocale(e.target.value);
          }}
          className="field w-40 cursor-pointer appearance-none pr-10 text-base"
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {t.languages[l]}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          size={18}
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-faint"
        />
      </span>
    </label>
  );
}
