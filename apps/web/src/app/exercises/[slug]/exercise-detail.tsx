"use client";

import { CircleX, ClipboardPen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { FormCues } from "@/content/form-cues";
import { getExercises, type Exercise } from "@/lib/api";
import { muscleLabel } from "@/lib/exercise-groups";

import { btnPrimary } from "../../ui";

export function ExerciseDetail({ slug, form }: { slug: string; form: FormCues }) {
  const [exercise, setExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    getExercises()
      .then((list) => setExercise(list.find((e) => e.slug === slug) ?? null))
      .catch(() => setExercise(null));
  }, [slug]);

  return (
    <div className="flex flex-col gap-9">
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{exercise?.name_th ?? "…"}</h1>
          {exercise && <p className="mt-1 text-sm text-muted">{exercise.name_en}</p>}
        </div>
        {exercise && (
          <div className="flex flex-wrap gap-1.5">
            {exercise.muscles.map((m) => (
              <Link
                key={m}
                href={`/exercises?muscle=${m}`}
                className="rounded-full bg-primary/12 px-3 py-1 text-sm text-primary transition-colors hover:bg-primary/20"
              >
                {muscleLabel(m)}
              </Link>
            ))}
          </div>
        )}
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium tracking-wide text-faint">จุดสำคัญของฟอร์ม</h2>
        <ol className="flex flex-col">
          {form.cues.map((c, i) => (
            <li key={c} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Connector between steps */}
              {i < form.cues.length - 1 && (
                <span aria-hidden className="absolute top-9 bottom-1 left-[1.05rem] w-px bg-line" />
              )}
              <span className="num grid h-9 w-9 shrink-0 place-items-center rounded-full bg-raised text-sm font-semibold text-primary">
                {i + 1}
              </span>
              <p className="pt-1.5 text-[1.02rem] leading-relaxed">{c}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-faint">ข้อผิดพลาดที่พบบ่อย</h2>
        <ul className="flex flex-col gap-3">
          {form.mistakes.map((m) => (
            <li key={m} className="flex gap-3">
              <CircleX aria-hidden size={20} className="mt-0.5 shrink-0 text-danger" />
              <span className="leading-relaxed text-fg/90">{m}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-3">
        <Link href={`/log?add=${slug}`} className={btnPrimary}>
          <ClipboardPen aria-hidden size={18} /> บันทึกท่านี้
        </Link>
        <p className="text-xs leading-relaxed text-faint">
          เป็นแนวทางทั่วไปสำหรับผู้ที่ไม่มีอาการบาดเจ็บ ถ้ารู้สึกเจ็บระหว่างทำให้หยุดและปรึกษาผู้เชี่ยวชาญ
        </p>
      </div>
    </div>
  );
}
