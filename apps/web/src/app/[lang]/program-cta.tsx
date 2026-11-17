"use client";

import { CalendarDays, ChevronRight, Dumbbell, Moon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { exercisesHref, localizeProgram, planFor } from "@/content/programs";
import { useLocale } from "@/lib/i18n/client";
import { MESSAGES } from "@/lib/i18n/messages";
import { useMyProgram } from "@/lib/my-program";

/**
 * Home card under the region cards: offers the program guide, or, once a
 * program is chosen, today's session from it (or that today is a rest day).
 */
export function ProgramCta() {
  const mine = useMyProgram();
  const locale = useLocale();
  const t = MESSAGES[locale].programCta;
  const program = mine && localizeProgram(mine, locale);

  // Before the browser's saved choice is read: hold the space so nothing jumps.
  if (program === undefined) return <div aria-hidden className="h-[5.5rem]" />;

  if (program === null) {
    return (
      <Card href="/programs" icon={<CalendarDays aria-hidden size={24} />}>
        <span className="text-base font-semibold text-fg">{t.noneTitle}</span>
        <span className="text-sm leading-6 text-muted">{t.noneBody}</span>
      </Card>
    );
  }

  const { weekday, day } = planFor(program, new Date(), locale);
  return (
    <div className="flex flex-col gap-2">
      {day.rest ? (
        <Card href="/settings" icon={<Moon aria-hidden size={24} />}>
          <span className="text-base font-semibold text-fg">{t.restTitle(weekday)}</span>
          <span className="text-sm leading-6 text-muted">{t.restBody}</span>
        </Card>
      ) : (
        <Card href={exercisesHref(day)} icon={<Dumbbell aria-hidden size={24} />}>
          <span className="text-base font-semibold text-fg">{t.trainTitle(weekday, day.title)}</span>
          <span className="text-sm leading-6 text-muted">{t.trainBody}</span>
        </Card>
      )}
      <p className="px-1 text-xs text-faint">
        {t.program} {program.name} ·{" "}
        <Link href="/settings" className="text-primary underline-offset-4 hover:underline">
          {t.change}
        </Link>
      </p>
    </div>
  );
}

function Card({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-3xl bg-surface p-4 shadow-[var(--shadow-lift)] ring-1 ring-primary/35 transition-colors hover:bg-raised active:scale-[0.99]"
    >
      <span className="btn-fill flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</span>
      <ChevronRight aria-hidden size={22} className="shrink-0 text-primary" />
    </Link>
  );
}
