import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/seo";

import { ApiStatus } from "./api-status";
import { AuthPanel } from "./auth-panel";
import { DeletedNotice } from "./deleted-notice";
import { ProgramCta } from "./program-cta";
import { RegionCards } from "./region-cards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return pageMeta(await getLocale(), { title: t.meta.siteTitle, description: t.meta.siteDescription, path: "/" });
}

export default async function Home() {
  const t = await getMessages();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-4 pt-8 pb-6">
      <DeletedNotice />

      <section className="flex flex-col gap-6">
        <h1 className="text-[1.9rem] leading-tight font-semibold tracking-tight text-balance">
          {t.home.titleBefore}
          <span className="text-primary">{t.home.titleHighlight}</span>
          {t.home.titleAfter}
        </h1>
        <RegionCards />
        <Link href="/exercises" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary">
          {t.home.allExercises} <ArrowRight aria-hidden size={16} />
        </Link>
        <ProgramCta />
      </section>

      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-[var(--shadow-lift)]">
        <AuthPanel />
      </section>

      <ApiStatus />
    </main>
  );
}
