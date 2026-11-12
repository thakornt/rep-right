"use client";

import { CircleX, ClipboardPen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { OverheadViewer } from "@/components/body/overhead-viewer";
import { PressViewer } from "@/components/body/press-viewer";
import type { PressExercise } from "@/components/body/press";
import { SquatViewer } from "@/components/body/squat-viewer";
import { FormSteps } from "@/components/form-steps";
import type { FormCues } from "@/content/form-cues";
import { getExercises, type Exercise } from "@/lib/api";
import { muscleLabel } from "@/lib/exercise-groups";

import { btnPrimary } from "../../ui";

// Exercises shown with the dumbbell, cable and floor viewer, by slug.
const PRESS_SLUGS: Record<string, PressExercise> = {
  "incline-dumbbell-press": "incline",
  "seated-dumbbell-shoulder-press": "shoulder",
  "hammer-curl": "hammer",
  "dumbbell-lateral-raise": "raise",
  "dumbbell-squat": "squat",
  "lat-pulldown": "pulldown",
  "rope-triceps-pushdown": "pushdown",
  "push-up": "pushup",
  crunch: "crunch",
  "leg-extension": "legExtension",
  "single-arm-dumbbell-row": "row",
  "romanian-deadlift": "rdl",
  "face-pull": "facePull",
};

export function ExerciseDetail({ slug, form }: { slug: string; form: FormCues }) {
  const [exercise, setExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    getExercises()
      .then((list) => setExercise(list.find((e) => e.slug === slug) ?? null))
      .catch(() => setExercise(null));
  }, [slug]);

  // With a 3D view, the form's key points sit under its controls, above the muscles.
  const steps = <FormSteps cues={form.cues} />;
  const press = PRESS_SLUGS[slug];
  const viewer =
    slug === "back-squat" ? (
      <SquatViewer steps={steps} />
    ) : slug === "overhead-dumbbell-triceps-extension" ? (
      <OverheadViewer steps={steps} />
    ) : press ? (
      <PressViewer exercise={press} steps={steps} />
    ) : null;

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

      {viewer ?? steps}

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
