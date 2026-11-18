import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Sans_Thai } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LocaleProvider } from "@/lib/i18n/client";
import { LOCALES, isLocale } from "@/lib/i18n/locale";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { SITE_NAME, pageMeta, siteUrl } from "@/lib/seo";

import { ProgramSync } from "@/lib/my-program";

import "./globals.css";
import { LogoMark } from "./logo-mark";
import { Nav } from "./nav";
import { NavigationSplash } from "./navigation-splash";
import { ServiceWorker } from "./service-worker";
import { SettingsLink } from "./settings-link";

// Manrope for Latin and numbers, Noto Sans Thai for Thai (the grey + orange preset).
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const notoSansThai = Noto_Sans_Thai({ variable: "--font-noto-sans-thai", subsets: ["thai"] });

// Every page is prerendered once per language; proxy.ts picks which copy a visitor gets.
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  // Every page's own metadata sets its title, description, canonical address and link preview
  // (pageMeta); these are the defaults, and the shared-link image is ./opengraph-image.tsx.
  const { openGraph, twitter } = pageMeta(await getLocale(), {
    title: t.meta.siteTitle,
    description: t.meta.siteDescription,
    path: "/",
  });
  return {
    metadataBase: siteUrl(),
    applicationName: SITE_NAME,
    title: t.meta.siteTitle,
    description: t.meta.siteDescription,
    openGraph,
    twitter,
    appleWebApp: { capable: true, title: "rep-right", statusBarStyle: "black-translucent" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b0c",
  viewportFit: "cover",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getMessages();
  return (
    <html lang={lang} className={`${manrope.variable} ${notoSansThai.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
        <header className="mx-auto flex w-full max-w-xl items-center px-4 pt-4">
          <Link href="/" className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
            <LogoMark />
            Rep Right
          </Link>
          <SettingsLink label={t.nav.settings} />
        </header>
        <LocaleProvider locale={lang}>
          {children}
          <NavigationSplash />
          <Nav />
          <ServiceWorker />
          <ProgramSync />
        </LocaleProvider>
      </body>
    </html>
  );
}
