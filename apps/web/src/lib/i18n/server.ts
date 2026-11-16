// The active language in Server Components, from the [lang] root segment.

import { lang } from "next/root-params";

import { DEFAULT_LOCALE, isLocale, type Locale } from "./locale";
import { MESSAGES, type Messages } from "./messages";

export async function getLocale(): Promise<Locale> {
  const l = await lang();
  return isLocale(l) ? l : DEFAULT_LOCALE;
}

export async function getMessages(): Promise<Messages> {
  return MESSAGES[await getLocale()];
}
