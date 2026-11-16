import type { Metadata } from "next";
import { Suspense } from "react";

import { getMessages } from "@/lib/i18n/server";

import { Badge3D } from "../badge-3d";
import { ExercisesLoading, LibraryView } from "./library-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.meta.exercises, description: t.meta.exercisesDescription };
}

export default async function ExercisesPage() {
  const t = (await getMessages()).exercises;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pt-6 pb-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[2.1rem] leading-tight font-semibold tracking-tight">{t.title}</h1>
        <p className="text-[0.95rem] leading-8 text-muted">
          {t.introBefore}{" "}
          <Badge3D className="align-middle" />{" "}
          <span className="whitespace-nowrap">{t.introAfter}</span>
        </p>
      </header>
      {/* useSearchParams needs a Suspense boundary so the rest of the page can prerender. */}
      <Suspense fallback={<ExercisesLoading />}>
        <LibraryView />
      </Suspense>
    </main>
  );
}
