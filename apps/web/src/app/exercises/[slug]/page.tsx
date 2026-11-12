import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { FORM_CUES } from "@/content/form-cues";

import { ExerciseDetail } from "./exercise-detail";

// Every exercise with form content is prerendered; other slugs render notFound().
export function generateStaticParams() {
  return Object.keys(FORM_CUES).map((slug) => ({ slug }));
}

const titleFromSlug = (slug: string) =>
  slug
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

export async function generateMetadata({ params }: PageProps<"/exercises/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const form = FORM_CUES[slug];
  return {
    title: `${titleFromSlug(slug)} ฟอร์มที่ถูกต้อง — rep-right`,
    description: form?.cues.join(" "),
  };
}

// params is awaited inside Suspense so the shell (back link) shows instantly
// on navigation; partialPrefetching serves it while an unlisted slug renders.
export default function ExercisePage({ params }: PageProps<"/exercises/[slug]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/exercises" className="w-fit text-sm text-muted hover:text-fg">
        ← ท่าทั้งหมด
      </Link>
      <Suspense>
        <Exercise params={params} />
      </Suspense>
    </main>
  );
}

async function Exercise({ params }: { params: PageProps<"/exercises/[slug]">["params"] }) {
  const { slug } = await params;
  // The neutral-grip and single-arm pulldowns are grips of the lat pulldown now.
  if (slug === "neutral-grip-lat-pulldown" || slug === "single-arm-lat-pulldown") redirect("/exercises/lat-pulldown");
  const form = FORM_CUES[slug];
  if (!form) notFound();
  return <ExerciseDetail slug={slug} form={form} />;
}
