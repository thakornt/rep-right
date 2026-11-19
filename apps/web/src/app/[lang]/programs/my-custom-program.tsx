"use client";

import { PencilLine } from "lucide-react";
import Link from "next/link";

import { isCustomProgram } from "@/content/custom-program";
import { localizeProgram, weekdayIndex } from "@/content/programs";
import { useLocale } from "@/lib/i18n/client";
import { MESSAGES } from "@/lib/i18n/messages";
import { useMyProgram } from "@/lib/my-program";

import { btnQuiet } from "../ui";
import { WeekTable } from "./week-table";

/** On /programs, the user's own planned week, if that is their program: the week with its exercises, and an edit link. */
export function MyCustomProgram() {
  const mine = useMyProgram();
  const locale = useLocale();
  const t = MESSAGES[locale].programs;
  if (!mine || !isCustomProgram(mine)) return null;
  const p = localizeProgram(mine, locale);
  return (
    <section
      aria-labelledby="my-custom"
      className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-[var(--shadow-lift)] ring-1 ring-primary/35"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-primary">{t.mine}</p>
        <h2 id="my-custom" className="text-2xl font-semibold tracking-tight">
          {p.name}
        </h2>
        <p className="num text-sm text-faint">{MESSAGES[locale].customProgram.trainingDays(p.daysPerWeek)}</p>
      </div>
      <WeekTable program={mine} today={weekdayIndex(new Date())} />
      <Link href="/programs/custom" className={btnQuiet}>
        <PencilLine aria-hidden size={18} /> {t.edit}
      </Link>
    </section>
  );
}
