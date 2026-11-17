import type { Metadata, Viewport } from "next";
import { Settings } from "lucide-react";
import { Manrope, Noto_Sans_Thai } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LocaleProvider } from "@/lib/i18n/client";
import { LOCALES, isLocale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/server";

import { ProgramSync } from "@/lib/my-program";

import "./globals.css";
import { LogoMark } from "./logo-mark";
import { Nav } from "./nav";
import { NavigationSplash } from "./navigation-splash";
import { ServiceWorker } from "./service-worker";

// Manrope for Latin and numbers, Noto Sans Thai for Thai (the grey + orange preset).
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const notoSansThai = Noto_Sans_Thai({ variable: "--font-noto-sans-thai", subsets: ["thai"] });

// Every page is prerendered once per language; proxy.ts picks which copy a visitor gets.
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: t.meta.siteTitle,
    description: t.meta.siteDescription,
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
          {/* Settings sits up here, not in the bottom bar: language works signed out too. */}
          <Link
            href="/settings"
            aria-label={t.nav.settings}
            title={t.nav.settings}
            className="-mr-2 ml-auto flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-raised hover:text-fg"
          >
            <Settings aria-hidden size={22} />
          </Link>
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
