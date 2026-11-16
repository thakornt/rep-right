"use client";

import { CircleCheck, HeartPulse, OctagonAlert, TriangleAlert } from "lucide-react";

import type { Exercise, LoadExercise, LoadReport } from "@/lib/api";
import { useLocale, useMessages } from "@/lib/i18n/client";

import { findingMessage, loadExerciseName } from "./insight-text";

// Advice is the headline, so it gets a solid pill; findings below are plain text.
const ADVICE_CLS: Record<LoadExercise["advice"], string> = {
  progress_ok: "bg-health text-health-fg",
  hold: "bg-warn text-warn-fg",
  no_increase: "bg-danger text-danger-fg",
};

const LEVEL = {
  caution: { cls: "text-warn", Icon: TriangleAlert },
  risk: { cls: "text-danger", Icon: OctagonAlert },
};

/** The one solid red block in the app: pain overrides every other advice. */
export function PainBanner() {
  const t = useMessages().insights;
  return (
    <div role="alert" className="flex gap-3 rounded-2xl bg-danger-solid p-4 text-white">
      <HeartPulse aria-hidden size={22} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold text-balance">{t.painTitle}</p>
        <p className="mt-1 text-sm leading-relaxed text-white/90">{t.painBody}</p>
      </div>
    </div>
  );
}

/**
 * Exercises with findings first, the rest on one "no warning" line.
 * Pass onlyIds to limit the report to some exercises (e.g. the session just saved).
 */
export function LoadWarnings({
  report,
  exercises,
  onlyIds,
}: {
  report: LoadReport;
  /** For names and per-exercise limits in English; the report itself carries Thai only. */
  exercises: Exercise[];
  onlyIds?: Set<number>;
}) {
  const locale = useLocale();
  const t = useMessages().insights;
  const name = (e: LoadExercise) => loadExerciseName(e, exercises, locale);
  const list = report.exercises.filter((e) => !onlyIds || onlyIds.has(e.exercise_id));
  const flagged = list
    .map((e) => ({ ...e, findings: e.findings.filter((f) => f.rule !== "pain") }))
    .filter((e) => e.findings.length > 0);
  const fine = list.filter((e) => e.advice === "progress_ok");

  return (
    <div className="flex flex-col gap-4">
      {report.pain && <PainBanner />}
      {flagged.length > 0 && (
        <ul className="overflow-hidden rounded-3xl bg-surface">
          {flagged.map((e, i) => (
            <li key={e.exercise_id} className={`flex flex-col gap-3 p-4 ${i > 0 ? "shadow-[0_-1px_0_var(--line)]" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[1.05rem] font-semibold">{name(e)}</h3>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${ADVICE_CLS[e.advice]}`}>
                  {t.advice[e.advice]}
                </span>
              </div>
              <ul className="flex flex-col gap-2.5">
                {e.findings.map((f) => {
                  const { cls, Icon } = LEVEL[f.level];
                  return (
                    <li key={f.rule} className="flex gap-2.5 text-sm leading-relaxed">
                      <Icon aria-hidden size={18} className={`mt-0.5 shrink-0 ${cls}`} />
                      <span>
                        <span className={`font-semibold ${cls}`}>{t.level[f.level]}</span>{" "}
                        <span className="text-fg/90">{findingMessage(f, e, exercises, locale)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {fine.length > 0 && (
        <p className="flex gap-2 text-sm leading-relaxed">
          <CircleCheck aria-hidden size={18} className="mt-0.5 shrink-0 text-health" />
          <span>
            <span className="font-medium text-health">{t.noWarning}</span>{" "}
            <span className="text-muted">{fine.map(name).join(", ")}</span>
          </span>
        </p>
      )}
      {list.length === 0 && <p className="text-sm text-muted">{t.noData}</p>}
    </div>
  );
}
