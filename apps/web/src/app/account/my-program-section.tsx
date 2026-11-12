"use client";

import { CalendarDays, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { weekdayIndex } from "@/content/programs";
import { clearMyProgram, useMyProgram } from "@/lib/my-program";

import { WeekTable } from "../programs/week-table";
import { btnPrimary, btnQuiet } from "../ui";

/** The program chosen on /programs, with its week; change it or delete it to start over. */
export function MyProgramSection() {
  const router = useRouter();
  const program = useMyProgram();
  if (program === undefined) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs font-medium tracking-wide text-faint">โปรแกรมของฉัน</h2>

      {program === null ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm leading-relaxed text-muted">ยังไม่ได้เลือกโปรแกรม ให้เราช่วยเลือกตามจำนวนวันที่คุณมาได้</p>
          <Link href="/programs" className={btnPrimary}>
            <CalendarDays aria-hidden size={18} /> ช่วยเลือกโปรแกรม
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-xl font-semibold tracking-tight">{program.name}</p>
            <p className="text-sm text-faint">
              ฝึกสัปดาห์ละ {program.daysPerWeek} วัน · ชื่อที่คนในยิมเรียก: {program.alias}
            </p>
          </div>

          <WeekTable program={program} today={weekdayIndex(new Date())} />

          <div className="grid grid-cols-2 gap-2">
            <Link href={`/programs?days=${program.daysPerWeek}`} className={btnQuiet}>
              เปลี่ยนโปรแกรม
            </Link>
            <button
              type="button"
              className={btnQuiet.replace("text-fg", "text-danger")}
              onClick={() => {
                clearMyProgram();
                router.push("/programs");
              }}
            >
              <Trash2 aria-hidden size={18} /> ลบโปรแกรม
            </button>
          </div>
          <p className="text-xs leading-relaxed text-faint">
            โปรแกรมนี้บันทึกไว้ในเครื่องนี้เท่านั้น ลบแล้วหน้าแรกจะกลับไปแสดงปุ่มช่วยเลือกโปรแกรม
          </p>
        </>
      )}
    </section>
  );
}
