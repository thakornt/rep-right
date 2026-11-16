"use client";

import { Moon } from "lucide-react";
import Link from "next/link";

import { exerciseNames, localizeProgram, weekdays, type Program } from "@/content/programs";
import { SLUGS_WITH_3D, muscleLabel } from "@/lib/exercise-groups";
import { useLocale } from "@/lib/i18n/client";
import { MESSAGES } from "@/lib/i18n/messages";

import { Badge3D } from "../badge-3d";

/** Monday-to-Sunday table of a program: each day's muscle groups and example exercises, or rest. */
export function WeekTable({ program: source, today }: { program: Program; today?: number }) {
  const locale = useLocale();
  const t = MESSAGES[locale].programs;
  const program = localizeProgram(source, locale);
  const names = exerciseNames(locale);
  return (
    <ol className="flex flex-col gap-2">
      {program.week.map((day, i) => (
        <li
          key={i}
          aria-current={i === today ? "date" : undefined}
          className={`grid grid-cols-[4.75rem_1fr] gap-3 rounded-2xl p-3 ${day.rest ? "bg-bg/40" : "bg-raised"} ${
            i === today ? "ring-1 ring-primary" : ""
          }`}
        >
          <span className={`pt-0.5 text-sm font-medium ${day.rest ? "text-faint" : "text-fg"}`}>
            {weekdays(locale)[i]}
            {i === today && <span className="block text-xs font-normal text-primary">{t.today}</span>}
          </span>
          {day.rest ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-faint">
              <Moon aria-hidden size={15} /> {t.rest}
            </span>
          ) : (
            <div className="flex min-w-0 flex-col gap-2">
              <p className="font-semibold text-fg">{day.title}</p>
              <ul className="flex flex-wrap gap-1.5">
                {day.focus.map((m) => (
                  <li key={m}>
                    <Link
                      href={`/exercises?muscle=${m}`}
                      className="inline-flex h-9 items-center rounded-full border border-primary/40 bg-primary/10 px-3 text-sm text-primary-hi"
                    >
                      {muscleLabel(m, locale)}
                    </Link>
                  </li>
                ))}
              </ul>
              {day.helpers.length > 0 && (
                <p className="text-xs leading-6 text-faint">{t.helpers(day.helpers.map((m) => muscleLabel(m, locale)).join(" · "))}</p>
              )}
              <details className="group">
                <summary className="cursor-pointer text-sm text-muted marker:text-faint">{t.examples}</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {day.exercises.map((slug) =>
                    SLUGS_WITH_3D.has(slug) ? (
                      <li key={slug}>
                        <Link
                          href={`/exercises/${slug}`}
                          className="inline-flex min-h-10 items-center gap-2 text-sm text-fg underline-offset-4 hover:underline"
                        >
                          {names[slug]} <Badge3D />
                        </Link>
                      </li>
                    ) : (
                      <li key={slug} className="text-sm text-fg">
                        {names[slug]}
                      </li>
                    ),
                  )}
                </ul>
              </details>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
