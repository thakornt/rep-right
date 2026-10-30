import Link from "next/link";

import { MUSCLES } from "@/lib/exercise-groups";

import { ApiStatus } from "./api-status";
import { AuthPanel } from "./auth-panel";
import { DeletedNotice } from "./deleted-notice";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">rep-right</h1>
        <p className="text-base text-zinc-600 dark:text-zinc-400">
          ดูฟอร์มที่ถูกต้อง บันทึกการซ้อมเร็ว และเตือนเมื่อเพิ่มโหลดเร็วเกินไป
        </p>
      </header>
      <DeletedNotice />
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">วันนี้คุณอยากพัฒนากล้ามเนื้อส่วนไหน?</h2>
        <div className="grid grid-cols-3 gap-2">
          {MUSCLES.map(([m, label]) => (
            <Link
              key={m}
              href={`/exercises?muscle=${m}`}
              className="flex h-14 items-center justify-center rounded-xl border border-zinc-300 px-2 text-center text-sm font-medium dark:border-zinc-700"
            >
              {label}
            </Link>
          ))}
        </div>
        <Link href="/exercises" className="text-sm text-zinc-500 underline">
          ดูท่าทั้งหมด
        </Link>
      </section>
      <AuthPanel />
      <Link href="/log" className="flex h-14 items-center justify-center rounded-full bg-foreground text-lg font-medium text-background">
        บันทึกการซ้อม
      </Link>
      <ApiStatus />
    </main>
  );
}
