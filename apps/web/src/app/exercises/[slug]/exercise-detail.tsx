"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { FormCues } from "@/content/form-cues";
import { getExercises, type Exercise } from "@/lib/api";
import { muscleLabel } from "@/lib/exercise-groups";

export function ExerciseDetail({ slug, form }: { slug: string; form: FormCues }) {
  const [exercise, setExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    getExercises()
      .then((list) => setExercise(list.find((e) => e.slug === slug) ?? null))
      .catch(() => setExercise(null));
  }, [slug]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{exercise?.name_th ?? "…"}</h1>
        {exercise && (
          <>
            <p className="text-sm text-zinc-500">{exercise.name_en}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {exercise.muscles.map((m) => (
                <Link
                  key={m}
                  href={`/exercises?muscle=${m}`}
                  className="rounded-full bg-zinc-200 px-3 py-1 text-sm dark:bg-zinc-800"
                >
                  {muscleLabel(m)}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">จุดสำคัญของฟอร์ม</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {form.cues.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">ข้อผิดพลาดที่พบบ่อย</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {form.mistakes.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-zinc-500">
        เป็นแนวทางทั่วไปสำหรับผู้ที่ไม่มีอาการบาดเจ็บ ถ้ารู้สึกเจ็บระหว่างทำให้หยุดและปรึกษาผู้เชี่ยวชาญ
      </p>

      <Link
        href={`/log?add=${slug}`}
        className="flex h-14 items-center justify-center rounded-full bg-foreground text-lg font-medium text-background"
      >
        บันทึกท่านี้
      </Link>
    </div>
  );
}
