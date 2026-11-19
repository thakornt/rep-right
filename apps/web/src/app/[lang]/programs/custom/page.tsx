import type { Metadata } from "next";

import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/seo";

import { CustomProgramForm } from "./custom-program-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return pageMeta(await getLocale(), {
    title: t.customProgram.meta,
    description: t.customProgram.intro,
    path: "/programs/custom",
  });
}

export default async function CustomProgramPage() {
  const t = (await getMessages()).customProgram;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-6 pb-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[2.1rem] leading-tight font-semibold tracking-tight">{t.title}</h1>
        <p className="text-[0.95rem] leading-8 text-muted">{t.intro}</p>
      </header>
      <CustomProgramForm />
    </main>
  );
}
