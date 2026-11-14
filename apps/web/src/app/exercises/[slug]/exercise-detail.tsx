"use client";

import { CircleX, ClipboardPen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { OverheadViewer } from "@/components/body/overhead-viewer";
import { PressViewer } from "@/components/body/press-viewer";
import type { PressExercise } from "@/components/body/press";
import { SquatViewer } from "@/components/body/squat-viewer";
import { WaySwitch } from "@/components/body/way-switch";
import { FormSteps } from "@/components/form-steps";
import { BARBELL_SQUAT_BARS, LAT_PULLDOWN_GRIPS, OVERHEAD_EXTENSION_TOOLS, OVERHEAD_PRESS_WAYS, PULL_UP_GRIPS, type FormCues } from "@/content/form-cues";
import { getExercises, type Exercise } from "@/lib/api";
import { muscleLabel } from "@/lib/exercise-groups";

import { btnPrimary } from "../../ui";

// Exercises shown with the dumbbell, cable and floor viewer, by slug.
const PRESS_SLUGS: Record<string, PressExercise> = {
  "incline-dumbbell-press": "incline",
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

export function ExerciseDetail({ slug, form: ownForm }: { slug: string; form: FormCues }) {
  const [exercise, setExercise] = useState<Exercise | null>(null);
  // The lat pulldown's grip, an option on its page; its cues and mistakes follow it.
  const [grip, setGrip] = useState(LAT_PULLDOWN_GRIPS[0].key);
  const pulldown = slug === "lat-pulldown";
  // The pull-up's grip, the same way: overhand or underhand (the chin-up).
  const [hold, setHold] = useState(PULL_UP_GRIPS[0].key);
  const pullUp = slug === "pull-up";
  // The barbell squat's bar, the same way: on the upper back or across the front of the shoulders.
  const [bar, setBar] = useState(BARBELL_SQUAT_BARS[0].key);
  const squat = slug === "barbell-squat";
  // The overhead press, the same way: seated with dumbbells or standing with a bar.
  const [way, setWay] = useState(OVERHEAD_PRESS_WAYS[0].key);
  const ohp = slug === "overhead-press";
  // The overhead triceps extension, the same way: with a dumbbell or a cable.
  const [tool, setTool] = useState(OVERHEAD_EXTENSION_TOOLS[0].key);
  const extension = slug === "overhead-triceps-extension";
  const form = pulldown
    ? LAT_PULLDOWN_GRIPS.find((g) => g.key === grip)!.form
    : pullUp
      ? PULL_UP_GRIPS.find((g) => g.key === hold)!.form
      : squat
        ? BARBELL_SQUAT_BARS.find((b) => b.key === bar)!.form
        : ohp
          ? OVERHEAD_PRESS_WAYS.find((w) => w.key === way)!.form
          : extension
            ? OVERHEAD_EXTENSION_TOOLS.find((t) => t.key === tool)!.form
            : ownForm;

  useEffect(() => {
    getExercises()
      .then((list) => setExercise(list.find((e) => e.slug === slug) ?? null))
      .catch(() => setExercise(null));
  }, [slug]);

  // With a 3D view, the form's key points sit under its controls, above the muscles.
  const steps = <FormSteps cues={form.cues} />;
  const press = PRESS_SLUGS[slug];
  const barSwitch = squat && (
    <WaySwitch ways={BARBELL_SQUAT_BARS.map((b) => [b.key, b.label] as const)} value={bar} onChange={setBar} />
  );
  const waySwitch = ohp && (
    <WaySwitch ways={OVERHEAD_PRESS_WAYS.map((w) => [w.key, w.label] as const)} value={way} onChange={setWay} />
  );
  const toolSwitch = extension && (
    <WaySwitch ways={OVERHEAD_EXTENSION_TOOLS.map((t) => [t.key, t.label] as const)} value={tool} onChange={setTool} />
  );
  const viewer =
    extension ? (
      <OverheadViewer cable={tool === "cable"} switcher={toolSwitch} steps={steps} />
    ) : ohp && way === "seated" ? (
      <PressViewer exercise="shoulder" switcher={waySwitch} steps={steps} />
    ) : ohp ? (
      // The standing press has no 3D view yet: only the switch and its key points.
      <div className="flex flex-col gap-3">
        {waySwitch}
        {steps}
      </div>
    ) : squat && bar === "back" ? (
      <SquatViewer switcher={barSwitch} steps={steps} />
    ) : squat ? (
      // The front squat has no 3D view yet: only the switch and its key points.
      <div className="flex flex-col gap-3">
        {barSwitch}
        {steps}
      </div>
    ) : pulldown ? (
      <PressViewer
        key={grip}
        exercise={grip === "neutral" ? "pulldownNeutral" : grip === "single" ? "pulldownSingle" : "pulldown"}
        steps={steps}
        switcher={<WaySwitch ways={LAT_PULLDOWN_GRIPS.map((g) => [g.key, g.label] as const)} value={grip} onChange={setGrip} />}
      />
    ) : pullUp ? (
      <PressViewer
        key={hold}
        exercise={hold === "underhand" ? "chinUp" : "pullUp"}
        steps={steps}
        switcher={<WaySwitch ways={PULL_UP_GRIPS.map((g) => [g.key, g.label] as const)} value={hold} onChange={setHold} />}
      />
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
