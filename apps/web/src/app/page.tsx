import { ArrowRight } from "lucide-react";
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
        <AuthPanel />
      </section>

      <ApiStatus />
    </main>
  );
}
