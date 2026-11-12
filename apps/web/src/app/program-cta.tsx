"use client";

import { CalendarDays, ChevronRight, Dumbbell, Moon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { exercisesHref, planFor } from "@/content/programs";
import { useMyProgram } from "@/lib/my-program";

/**
 * Home card under the region cards: offers the program guide, or, once a
 * program is chosen, today's session from it (or that today is a rest day).
 */
export function ProgramCta() {
  const program = useMyProgram();

  // Before the browser's saved choice is read: hold the space so nothing jumps.
  if (program === undefined) return <div aria-hidden className="h-[5.5rem]" />;

  if (program === null) {
    return (
      <Card href="/programs" icon={<CalendarDays aria-hidden size={24} />}>
        <span className="text-base font-semibold text-fg">ไม่รู้จะเล่นอะไรวันนี้?</span>
        <span className="text-sm leading-6 text-muted">ให้เราช่วยเลือกโปรแกรม ตามจำนวนวันที่คุณมาได้</span>
      </Card>
    );
  }

  const { weekday, day } = planFor(program, new Date());
  return (
    <div className="flex flex-col gap-2">
      {day.rest ? (
        <Card href="/account" icon={<Moon aria-hidden size={24} />}>
          <span className="text-base font-semibold text-fg">วันนี้เป็นวัน{weekday} เป็นวันพักของโปรแกรมคุณ</span>
          <span className="text-sm leading-6 text-muted">ให้กล้ามได้ฟื้นตัว ดูตารางทั้งสัปดาห์ได้ที่นี่</span>
        </Card>
      ) : (
        <Card href={exercisesHref(day)} icon={<Dumbbell aria-hidden size={24} />}>
          <span className="text-base font-semibold text-fg">
            วันนี้เป็นวัน{weekday} มาเริ่มเล่น {day.title} กันเลยไหม?
          </span>
          <span className="text-sm leading-6 text-muted">กดเพื่อดูท่าของกล้ามที่ฝึกวันนี้</span>
        </Card>
      )}
      <p className="px-1 text-xs text-faint">
        โปรแกรม: {program.name} ·{" "}
        <Link href="/account" className="text-primary underline-offset-4 hover:underline">
          เปลี่ยนในโปรไฟล์
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
