"use client";

import { ClipboardPen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getExercises, getLoadInsights, getReturnPlan, type Exercise, type LoadReport, type ReturnPlan } from "@/lib/api";
import { useLocale } from "@/lib/i18n/client";
import { DATE_LOCALE, type Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/messages";

import { PageLoader } from "../logo-loader";
import { btnPrimary } from "../ui";
import { DISCLAIMER_EN, loadExerciseName } from "./insight-text";
import { LoadWarnings } from "./load-warnings";

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; load: LoadReport; plans: ReturnPlan[]; exercises: Exercise[] };

const shortDate = (iso: string, locale: Locale) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(DATE_LOCALE[locale], { day: "numeric", month: "short" });

export function InsightsView() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const locale = useLocale();
  const t = MESSAGES[locale].insights;

  useEffect(() => {
    Promise.all([getLoadInsights(), getReturnPlan(), getExercises()])
      .then(([load, plans, exercises]) => setState({ kind: "ready", load, plans, exercises }))
      .catch(() => setState({ kind: "error" }));
  }, []);

  if (state.kind === "loading") return <PageLoader label={t.loading} />;
  if (state.kind === "error") return <p className="text-sm text-danger">{t.loadFailed}</p>;

  const { load, plans, exercises } = state;
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium tracking-wide text-faint">{t.loadTitle}</h2>
        <LoadWarnings report={load} exercises={exercises} />
        {load.exercises.length === 0 && (
          <Link href="/log" className={`${btnPrimary} w-fit`}>
            <ClipboardPen aria-hidden size={18} /> {t.startLogging}
          </Link>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xs font-medium tracking-wide text-faint">{t.returnTitle}</h2>
          <p className="mt-1 text-sm text-muted">{plans.length === 0 ? t.noReturn : t.returnIntro}</p>
        </div>
        {plans.map((p) => (
          <ReturnPlanCard key={p.exercise_id} plan={p} exercises={exercises} locale={locale} />
        ))}
      </section>

      <p className="text-xs leading-relaxed text-faint">{locale === "en" ? DISCLAIMER_EN : load.disclaimer}</p>
    </div>
  );
}

function ReturnPlanCard({ plan: p, exercises, locale }: { plan: ReturnPlan; exercises: Exercise[]; locale: Locale }) {
  const t = MESSAGES[locale].insights;
  const kg = MESSAGES[locale].common.kg;
  const range =
    p.start_percent_min === p.start_percent_max ? `${p.start_percent_min}%` : `${p.start_percent_min}-${p.start_percent_max}%`;
  return (
    <article className="flex flex-col gap-5 rounded-3xl bg-surface p-5">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[1.05rem] font-semibold">{loadExerciseName(p, exercises, locale)}</h3>
          <p className="num mt-0.5 text-xs text-faint">
            {t.returnSummary(p.days_off, shortDate(p.last_performed_at, locale), p.top_set_kg)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted">{t.startAt}</p>
          <p className="num text-3xl leading-none font-semibold text-primary">
            {p.start_weight_kg}
            <span className="ml-1 text-sm font-normal text-muted">{kg}</span>
          </p>
          <p className="num mt-1 text-xs text-faint">{t.ofBefore(range)}</p>
        </div>
      </div>

      <ol className="flex flex-col gap-2.5" aria-label={t.rampLabel(p.ramp_weeks)}>
        {p.steps.map((s) => {
          const done = s.week === p.steps.length;
          return (
            <li key={s.week} className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-3 text-sm">
              <span className={done ? "text-health" : "text-muted"}>{done ? t.backToNormal : t.week(s.week)}</span>
              <span className="h-2 overflow-hidden rounded-full bg-inset">
                <span
                  className={`block h-full rounded-full ${done ? "bg-health" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, s.percent)}%` }}
                />
              </span>
              <span className="num text-right font-medium">{s.weight_kg}</span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
