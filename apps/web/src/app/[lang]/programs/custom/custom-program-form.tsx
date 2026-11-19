"use client";

import { ChevronDown, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  DAY_KINDS,
  DAY_KIND_LABELS,
  customId,
  dayFor,
  parseCustomId,
  type DayKind,
} from "@/content/custom-program";
import { backToBackMuscles, weekdays } from "@/content/programs";
import { muscleLabel } from "@/lib/exercise-groups";
import { useLocale } from "@/lib/i18n/client";
import { MESSAGES } from "@/lib/i18n/messages";
import { saveMyProgram, useMyProgram } from "@/lib/my-program";

import { btnPrimary, btnText } from "../../ui";

const EMPTY_WEEK: DayKind[] = ["rest", "rest", "rest", "rest", "rest", "rest", "rest"];

/** Seven rows, Monday first: a select of session kinds per day, then safety notes and save. */
export function CustomProgramForm() {
  const mine = useMyProgram();
  // Before the saved choice is read, hold the space so the rows don't jump.
  if (mine === undefined) return <div aria-hidden className="h-[34rem]" />;
  // Editing an existing custom week starts from it; otherwise from an all-rest week.
  return <Form initial={(mine && parseCustomId(mine.id)) ?? EMPTY_WEEK} />;
}

function Form({ initial }: { initial: DayKind[] }) {
  const router = useRouter();
  const locale = useLocale();
  const t = MESSAGES[locale].customProgram;
  const labels = DAY_KIND_LABELS[locale];
  const names = weekdays(locale);
  const [kinds, setKinds] = useState<DayKind[]>(initial);
  const [saving, setSaving] = useState(false);

  const week = kinds.map(dayFor);
  const training = week.filter((d) => !d.rest).length;
  // Group the back-to-back clashes per pair of days: "Mon → Tue: Chest, Triceps".
  const clashes = new Map<number, string[]>();
  for (const [i, m] of backToBackMuscles(week)) clashes.set(i, [...(clashes.get(i) ?? []), muscleLabel(m, locale)]);

  const set = (i: number, kind: DayKind) => setKinds((cur) => cur.map((k, j) => (j === i ? kind : k)));

  async function save() {
    setSaving(true);
    await saveMyProgram(customId(kinds));
    router.push("/programs");
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-2">
        {kinds.map((kind, i) => {
          const id = `day-${i}`;
          return (
            <li
              key={i}
              className={`grid grid-cols-[5.5rem_1fr] items-center gap-3 rounded-2xl p-3 ${kind === "rest" ? "bg-bg/40" : "bg-raised"}`}
            >
              <label htmlFor={id} className={`text-sm font-medium ${kind === "rest" ? "text-faint" : "text-fg"}`}>
                {t.dayLabel(names[i])}
              </label>
              <span className="relative">
                <select
                  id={id}
                  value={kind}
                  onChange={(e) => set(i, e.target.value as DayKind)}
                  className="field h-12 cursor-pointer appearance-none pr-10 text-base"
                >
                  {DAY_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {labels[k]}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden
                  size={18}
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-faint"
                />
              </span>
            </li>
          );
        })}
      </ol>

      <p className="num text-sm text-muted">{t.trainingDays(training)}</p>

      {(training === 7 || clashes.size > 0) && (
        <div role="status" className="flex flex-col gap-2 rounded-2xl border border-warn/40 p-4 text-sm leading-7">
          {training === 7 && (
            <p className="flex gap-2 text-fg">
              <TriangleAlert aria-hidden size={18} className="mt-1 shrink-0 text-warn" />
              {t.noRest}
            </p>
          )}
          {clashes.size > 0 && (
            <>
              <p className="flex gap-2 text-fg">
                <TriangleAlert aria-hidden size={18} className="mt-1 shrink-0 text-warn" />
                {t.backToBack}
              </p>
              <ul className="flex flex-col gap-1 pl-7 text-muted">
                {[...clashes].map(([i, muscles]) => (
                  <li key={i}>{t.clash(names[i], names[(i + 1) % 7], muscles.join(", "))}</li>
                ))}
              </ul>
            </>
          )}
          <p className="pl-7 text-xs text-faint">{t.saveAnyway}</p>
        </div>
      )}

      {training === 0 && <p className="text-sm text-faint">{t.noTraining}</p>}

      <div className="flex flex-col gap-2">
        <button type="button" className={btnPrimary} disabled={training === 0 || saving} onClick={() => void save()}>
          {saving ? t.saving : t.save}
        </button>
        <Link href="/programs" className={`${btnText} justify-center text-muted`}>
          {t.cancel}
        </Link>
      </div>
    </div>
  );
}
