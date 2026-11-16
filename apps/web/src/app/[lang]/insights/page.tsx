import type { Metadata } from "next";

import { getMessages } from "@/lib/i18n/server";

import { RequireAuth } from "../require-auth";
import { InsightsView } from "./insights-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).meta.insights, robots: { index: false } };
}

export default async function InsightsPage() {
  const t = await getMessages();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-6 pb-6">
      <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{t.headings.insights}</h1>
      <RequireAuth>
        <InsightsView />
      </RequireAuth>
    </main>
  );
}
