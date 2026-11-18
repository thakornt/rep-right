// What search engines and link previews (LINE, Facebook, X) read about the site.
// Addresses are language-free (/exercises): proxy.ts serves Thai unless the visitor chose
// English, so crawlers, which carry no cookie, always see the Thai copy.

import type { Metadata } from "next";

import { EXERCISE_NAMES, HAS_3D } from "../content/exercise-names";
import { FORM_CUES } from "../content/form-cues";
import type { Locale } from "./i18n/locale";

export const SITE_NAME = "rep-right";

/**
 * The site's public address, for absolute links in the sitemap and in shared-link previews.
 * NEXT_PUBLIC_SITE_URL wins; on Vercel without it, the project's production domain; else local dev.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): URL {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return new URL(explicit);
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3100");
}

/** Pages anyone can open without signing in, worth finding in a search. */
export const PUBLIC_PATHS = ["/", "/exercises", "/programs", "/privacy", "/terms"] as const;

/** Every exercise page with form content, the same list the pages are prerendered from. */
export const exercisePaths = () => Object.keys(FORM_CUES).map((slug) => `/exercises/${slug}`);

/**
 * Pages that are private to a signed-in person, or not pages at all (each page also says
 * robots: { index: false }); robots.txt keeps crawlers out of them.
 */
export const PRIVATE_PATHS = ["/api/", "/auth/", "/log", "/history", "/insights", "/settings", "/account", "/offline"];

const OG_LOCALE: Record<Locale, string> = { th: "th_TH", en: "en_US" };

/**
 * Title, description, canonical address and link preview for one page. A page's openGraph
 * replaces the layout's whole, the layout's picture included, so each page sets all of it here.
 * The picture is the site's card ([lang]/opengraph-image.tsx) unless the page names its own
 * (imagePath: the address of its segment's opengraph-image, without the language).
 */
export function pageMeta(
  locale: Locale,
  {
    title,
    description,
    path,
    imagePath = "",
  }: { title: string; description: string; path: string; imagePath?: string },
): Metadata {
  const image = {
    url: `/${locale}${imagePath}/opengraph-image`,
    width: 1200,
    height: 630,
    alt: SITE_NAME,
    type: "image/png",
  };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: OG_LOCALE[locale],
      url: path,
      title,
      description,
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** Title and one-sentence description for an exercise page; plain words, no numbers. */
export function exerciseCopy(slug: string, locale: Locale): { title: string; description: string } | undefined {
  const name = EXERCISE_NAMES[slug];
  if (!name) return undefined;
  const has3D = HAS_3D.has(slug);
  if (locale === "en") {
    return has3D
      ? {
          title: `${name.en}: good form in 3D — ${SITE_NAME}`,
          description: `See the ${name.en} in 3D from every side, with the key points of good form and the most common mistakes. For people who lift without a coach.`,
        }
      : {
          title: `${name.en}: good form — ${SITE_NAME}`,
          description: `How to do the ${name.en} with good form: the key points step by step and the most common mistakes. For people who lift without a coach.`,
        };
  }
  return has3D
    ? {
        title: `ท่า${name.th} (${name.en}) ฟอร์มที่ถูกต้อง ดู 3D รอบตัว — ${SITE_NAME}`,
        description: `ดูท่า${name.th} (${name.en}) แบบ 3D หมุนดูได้รอบตัว พร้อมจุดสำคัญของฟอร์มและข้อผิดพลาดที่พบบ่อย เหมาะกับมือใหม่ที่ไม่มีเทรนเนอร์`,
      }
    : {
        title: `ท่า${name.th} (${name.en}) ฟอร์มที่ถูกต้อง — ${SITE_NAME}`,
        description: `วิธีทำท่า${name.th} (${name.en}) ให้ฟอร์มถูกต้อง จุดสำคัญทีละขั้นและข้อผิดพลาดที่พบบ่อย เหมาะกับมือใหม่ที่ไม่มีเทรนเนอร์`,
      };
}
