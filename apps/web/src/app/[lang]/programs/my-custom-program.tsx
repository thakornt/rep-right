"use client";

import { ChevronRight, PencilLine } from "lucide-react";
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

/**
 * "I already have my own program": leads to /programs/custom. Hidden once the user's
 * program is their own week, since MyCustomProgram's edit link does the same then.
 */
export function OwnProgramLink() {
  const mine = useMyProgram();
  const t = MESSAGES[useLocale()].programs;
  // Before the saved choice is read (undefined), or with a custom week: nothing.
  if (mine === undefined || (mine && isCustomProgram(mine))) return null;
  return (
    <Link
      href="/programs/custom"
      className="flex items-center gap-4 rounded-3xl bg-surface p-4 transition-colors hover:bg-raised active:scale-[0.99]"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-raised text-primary">
        <PencilLine aria-hidden size={22} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold text-fg">{t.haveOwn}</span>
        <span className="text-sm leading-6 text-muted">{t.haveOwnHint}</span>
      </span>
      <ChevronRight aria-hidden size={22} className="shrink-0 text-faint" />
    </Link>
  );
}
