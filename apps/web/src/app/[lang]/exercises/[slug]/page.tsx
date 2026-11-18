import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { FORM_CUES } from "@/content/form-cues";
import { EXERCISE_NAMES } from "@/content/exercise-names";
import { formCues } from "@/content/form-cues-en";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { exerciseCopy, pageMeta } from "@/lib/seo";

import { ExerciseDetail } from "./exercise-detail";

// Every exercise with form content is prerendered; other slugs render notFound().
export function generateStaticParams() {
  return Object.keys(FORM_CUES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/exercises/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const copy = exerciseCopy(slug, await getLocale());
  if (!copy) return {};
  const path = `/exercises/${slug}`;
  // Its own card (./opengraph-image.tsx), with the exercise's name.
  return pageMeta(await getLocale(), { ...copy, path, imagePath: path });
}

// params is awaited inside Suspense so the shell (back link) shows instantly
// on navigation; partialPrefetching serves it while an unlisted slug renders.
export default async function ExercisePage({ params }: PageProps<"/[lang]/exercises/[slug]">) {
  const t = await getMessages();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/exercises" className="w-fit text-sm text-muted hover:text-fg">
        {t.exercises.back}
      </Link>
      <Suspense>
        <Exercise params={params} />
      </Suspense>
    </main>
  );
}

async function Exercise({ params }: { params: PageProps<"/[lang]/exercises/[slug]">["params"] }) {
  const { slug } = await params;
  // The neutral-grip and single-arm pulldowns are grips of the lat pulldown now.
  if (slug === "neutral-grip-lat-pulldown" || slug === "single-arm-lat-pulldown") redirect("/exercises/lat-pulldown");
  // The back and front squats are bar positions of the barbell squat now.
  if (slug === "back-squat" || slug === "front-squat") redirect("/exercises/barbell-squat");
  // The seated dumbbell shoulder press is a way of doing the overhead press now.
  if (slug === "seated-dumbbell-shoulder-press") redirect("/exercises/overhead-press");
  // The dumbbell and cable overhead triceps extensions are tools of one exercise now.
  if (slug === "overhead-dumbbell-triceps-extension" || slug === "overhead-cable-triceps-extension")
    redirect("/exercises/overhead-triceps-extension");
  const form = formCues(slug, await getLocale());
  if (!form) notFound();
  return <ExerciseDetail slug={slug} form={form} name={EXERCISE_NAMES[slug]} />;
}
