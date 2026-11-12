import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { ApiStatus } from "./api-status";
import { AuthPanel } from "./auth-panel";
import { DeletedNotice } from "./deleted-notice";
import { ProgramCta } from "./program-cta";
import { RegionCards } from "./region-cards";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-4 pt-8 pb-6">
      <DeletedNotice />

      <section className="flex flex-col gap-6">
        <h1 className="text-[1.9rem] leading-tight font-semibold tracking-tight text-balance">
          วันนี้คุณอยากพัฒนา<span className="text-primary">กล้ามเนื้อ</span>ส่วนไหน?
        </h1>
        <RegionCards />
        <Link href="/exercises" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary">
          ดูท่าทั้งหมดพร้อมวิธีทำ <ArrowRight aria-hidden size={16} />
        </Link>
        <ProgramCta />
      </section>

      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-[var(--shadow-lift)]">
        <AuthPanel />
      </section>

      <ApiStatus />
    </main>
  );
}
