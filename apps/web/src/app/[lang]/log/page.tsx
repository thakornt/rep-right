import type { Metadata } from "next";

import { getMessages } from "@/lib/i18n/server";
import { Suspense } from "react";

import { PageLoader } from "../logo-loader";
import { RequireAuth } from "../require-auth";
import { LogForm } from "./log-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).meta.log, robots: { index: false } };
}

export default async function LogPage() {
  const t = await getMessages();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-6 pb-6">
      <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{t.headings.log}</h1>
      <RequireAuth>
        {/* LogForm reads ?add= via useSearchParams, which needs a Suspense boundary. */}
        <Suspense fallback={<PageLoader label={t.common.loading} />}>
          <LogForm />
        </Suspense>
      </RequireAuth>
    </main>
  );
}
