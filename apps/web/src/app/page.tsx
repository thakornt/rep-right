import { ArrowRight, ClipboardPen } from "lucide-react";
import Link from "next/link";

import { REGIONS, muscleLabel } from "@/lib/exercise-groups";

import { ApiStatus } from "./api-status";
import { AuthPanel } from "./auth-panel";
import { DeletedNotice } from "./deleted-notice";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-4 pt-8 pb-6">
      <DeletedNotice />

      <section className="flex flex-col gap-6">
        <h1 className="text-[1.9rem] leading-tight font-semibold tracking-tight text-balance">
          วันนี้คุณอยากพัฒนา<span className="text-primary">กล้ามเนื้อ</span>ส่วนไหน?
        </h1>
        <div className="flex flex-col gap-5">
          {REGIONS.map(([region, muscles]) => (
            <div key={region} className="flex flex-col gap-2.5">
              <p className="text-xs font-medium tracking-wide text-faint">{region}</p>
              <div className="flex flex-wrap gap-2">
                {muscles.map((m) => (
                  <Link
                    key={m}
                    href={`/exercises?muscle=${m}`}
                    className="flex h-12 items-center rounded-2xl bg-surface px-4 text-[0.95rem] font-medium text-fg transition-colors duration-150 hover:bg-raised hover:text-primary"
                  >
                    {muscleLabel(m)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Link href="/exercises" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary">
          ดูท่าทั้งหมดพร้อมวิธีทำ <ArrowRight aria-hidden size={16} />
        </Link>
      </section>

      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-[var(--shadow-lift)]">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-health/15 text-health">
            <ClipboardPen aria-hidden size={20} />
          </span>
          <div>
            <h2 className="text-lg font-semibold">บันทึกการซ้อมวันนี้</h2>
            <p className="text-sm text-muted">กด “เหมือนครั้งก่อน” แล้วแก้แค่ตัวเลข แอปจะเตือนถ้าเพิ่มโหลดเร็วเกินไป</p>
          </div>
        </div>
        <Link
          href="/log"
          className="inline-flex h-13 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-fg transition-[filter] hover:brightness-110"
        >
          เริ่มบันทึก
        </Link>
        <AuthPanel />
      </section>

      <ApiStatus />
    </main>
  );
}
