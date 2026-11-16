import type { MetadataRoute } from "next";
import { cookies } from "next/headers";

import { LOCALE_COOKIE, pickLocale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/messages";

// Lets phones install the app to the home screen and open it full screen,
// named in the language the visitor uses (their saved choice, else Thai).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = pickLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = MESSAGES[locale].meta;
  return {
    name: t.siteTitle,
    short_name: "rep-right",
    description: t.appDescription,
    lang: locale,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
