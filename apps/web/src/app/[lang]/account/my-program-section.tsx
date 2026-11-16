"use client";

import { CalendarDays, ChevronDown, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { localizeProgram, weekdayIndex } from "@/content/programs";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/i18n/client";
import { MESSAGES } from "@/lib/i18n/messages";
import { clearMyProgram, useMyProgram } from "@/lib/my-program";

import { WeekTable } from "../programs/week-table";
import { btnPrimary, btnQuiet } from "../ui";

/**
 * The program chosen on /programs. Closed, it shows the name and days a week; opened, the
 * week and the buttons to change it or delete it to start over.
 */
export function MyProgramSection() {
  const router = useRouter();
  const mine = useMyProgram();
  const locale = useLocale();
  const t = MESSAGES[locale].myProgram;
  const program = mine && localizeProgram(mine, locale);
  const signedIn = useAuth().kind === "signed-in";
  if (program === undefined) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs font-medium tracking-wide text-faint">{t.title}</h2>

      {program === null ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm leading-relaxed text-muted">{t.none}</p>
          <Link href="/programs" className={btnPrimary}>
            <CalendarDays aria-hidden size={18} /> {t.help}
          </Link>
        </div>
      ) : (
        <details className="group rounded-3xl bg-surface">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-5 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xl font-semibold tracking-tight">{program.name}</span>
              <span className="text-sm text-faint">{t.summary(program.daysPerWeek, program.alias)}</span>
            </span>
            <ChevronDown
              aria-hidden
              size={22}
              className="shrink-0 text-faint transition-transform group-open:rotate-180"
            />
          </summary>

          <div className="flex flex-col gap-4 px-5 pb-5">
            <WeekTable program={program} today={weekdayIndex(new Date())} />

            <div className="grid grid-cols-2 gap-2">
              <Link href={`/programs?days=${program.daysPerWeek}`} className={btnQuiet}>
                {t.change}
              </Link>
              <button
                type="button"
                className={btnQuiet.replace("text-fg", "text-danger")}
                onClick={() => {
                  void clearMyProgram();
                  router.push("/programs");
                }}
              >
                <Trash2 aria-hidden size={18} /> {t.remove}
              </button>
            </div>
            <p className="text-xs leading-relaxed text-faint">
              {signedIn ? t.savedOnAccount : t.savedHere}
            </p>
          </div>
        </details>
      )}
    </section>
  );
}
