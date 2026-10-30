import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

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

export default async function ExercisePage({ params }: PageProps<"/exercises/[slug]">) {
  const { slug } = await params;
  const form = FORM_CUES[slug];
  if (!form) notFound();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/exercises" className="text-sm text-zinc-500">
        ← ท่าทั้งหมด
      </Link>
      <ExerciseDetail slug={slug} form={form} />
    </main>
  );
}
