import { Info, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DAY_CHOICES, programsFor, type Program } from "@/content/programs";

import { ChooseProgram } from "./choose-program";
import { WeekTable } from "./week-table";

export const metadata: Metadata = {
  title: "ช่วยเลือกโปรแกรมเวทเทรนนิ่งสำหรับมือใหม่ — rep-right",
  description:
    "เลือกจำนวนวันที่ฝึกได้ต่อสัปดาห์ แล้วดูตารางว่าแต่ละวันฝึกกล้ามส่วนไหน วันไหนพัก พร้อมหลักง่ายๆ ว่าทำไมแบ่งแบบนี้ ต้องพักกี่วัน และทำกี่เซ็ต",
};

export default function ProgramsPage({ searchParams }: PageProps<"/programs">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-6 pb-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[2.1rem] leading-tight font-semibold tracking-tight">ช่วยเลือกโปรแกรม</h1>
        <p className="text-[0.95rem] leading-8 text-muted">
          บอกเราว่าสัปดาห์นี้มาฝึกได้กี่วัน แล้วดูว่าวันไหนฝึกส่วนไหน วันไหนพัก
        </p>
      </header>

      {/* Reading ?days= needs a Suspense boundary so the rest of the page can prerender. */}
      <Suspense fallback={<DayPicker chosen={null} />}>
        <ChosenPrograms searchParams={searchParams} />
      </Suspense>

      <Principles />

      <p className="flex gap-2 rounded-2xl bg-surface p-4 text-sm leading-7 text-muted">
        <ShieldCheck aria-hidden size={18} className="mt-1 shrink-0 text-primary" />
        <span>
          นี่เป็นแนวทางทั่วไปสำหรับคนเริ่มฝึก ไม่ใช่คำแนะนำทางการแพทย์ ถ้ารู้สึกเจ็บ (ไม่ใช่แค่เมื่อย) ให้หยุดท่านั้น
          และปรึกษาแพทย์หรือนักกายภาพบำบัด
        </span>
      </p>
    </main>
  );
}

async function ChosenPrograms({ searchParams }: { searchParams: PageProps<"/programs">["searchParams"] }) {
  const raw = (await searchParams).days;
  const days = Number(Array.isArray(raw) ? raw[0] : raw);
  const chosen = DAY_CHOICES.includes(days) ? days : null;
  return (
    <>
      <DayPicker chosen={chosen} />
      {chosen &&
        programsFor(chosen).map((p, i) => <ProgramCard key={p.id} program={p} alternative={i > 0} />)}
    </>
  );
}

function DayPicker({ chosen }: { chosen: number | null }) {
  return (
    <section aria-labelledby="days-q" className="flex flex-col gap-3">
      <h2 id="days-q" className="text-lg font-semibold">
        ฝึกได้สัปดาห์ละกี่วัน?
      </h2>
      <div className="grid grid-cols-5 gap-2">
        {DAY_CHOICES.map((d) => {
          const active = d === chosen;
          return (
            <Link
              key={d}
              href={`/programs?days=${d}`}
              scroll={false}
              replace
              aria-current={active ? "true" : undefined}
              className={`flex h-16 flex-col items-center justify-center rounded-2xl text-xl font-semibold num transition-colors active:scale-[0.97] ${
                active ? "btn-fill" : "bg-raised text-fg hover:bg-hover"
              }`}
            >
              {d}
              <span className={`text-[0.7rem] font-normal ${active ? "" : "text-muted"}`}>วัน</span>
            </Link>
          );
        })}
      </div>
      {!chosen && <p className="text-sm text-faint">กดเลือกจำนวนวันด้านบน ถ้าเพิ่งเริ่ม 3 วันกำลังดี</p>}
    </section>
  );
}

function ProgramCard({ program: p, alternative }: { program: Program; alternative: boolean }) {
  return (
    <section
      aria-labelledby={`p-${p.id}`}
      className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-[var(--shadow-lift)]"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-primary">{alternative ? "อีกแบบที่ทำได้" : "โปรแกรมที่แนะนำ"}</p>
        <h2 id={`p-${p.id}`} className="text-2xl font-semibold tracking-tight">
          {p.name}
        </h2>
        <p className="text-sm text-faint">ชื่อที่คนในยิมเรียก: {p.alias}</p>
      </div>

      <p className="text-[0.95rem] leading-8 text-muted">
        <span className="font-medium text-fg">ทำไมแบบนี้: </span>
        {p.why}
      </p>

      <WeekTable program={p} />

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-raised p-3">
          <dt className="text-faint">แต่ละกลุ่มได้ฝึก</dt>
          <dd className="mt-1 text-base font-semibold">สัปดาห์ละ {p.timesPerWeek}</dd>
        </div>
        <div className="rounded-2xl bg-raised p-3">
          <dt className="text-faint">กลุ่มละประมาณ</dt>
          <dd className="mt-1 text-base font-semibold">{p.setsPerSession} ต่อวัน</dd>
        </div>
      </dl>

      {p.note && <p className="rounded-2xl border border-primary/30 p-3 text-sm leading-7 text-muted">{p.note}</p>}

      <ChooseProgram id={p.id} />
    </section>
  );
}

function Principles() {
  return (
    <section aria-labelledby="principles" className="flex flex-col gap-3">
      <h2 id="principles" className="text-lg font-semibold">
        หลักง่ายๆ ที่ใช้จัดตาราง
      </h2>

      <Principle title="ทำไมต้องแบ่งส่วน">
        กล้ามจะโตและแข็งแรงขึ้นตอนพัก ไม่ใช่ตอนฝึก ถ้าฝึกกล้ามเดิมทุกวัน มันจะไม่มีเวลาซ่อมตัวเอง
        การแบ่งส่วนทำให้วันนี้ส่วนหนึ่งฝึก อีกส่วนได้พัก จึงมาฝึกได้หลายวันโดยไม่ใช้กล้ามเดิมซ้ำ
      </Principle>

      <Principle title="กล้ามแต่ละกลุ่มต้องพักแค่ไหน">
        ให้กล้ามที่ฝึกหนักได้พักอย่างน้อย 1 วันเต็ม (ราว 48 ชั่วโมง) ก่อนฝึกกลุ่มเดิมอีก ทุกตารางในหน้านี้จึงไม่ฝึกกลุ่มเดียวกัน 2
        วันติด และมีวันพักทั้งตัวทุกสัปดาห์ ถ้ากล้ามยังระบมมากจนขยับลำบาก ให้พักเพิ่มอีกวันได้
      </Principle>

      <Principle title="ทำกี่เซ็ต">
        <span className="font-medium text-fg">เซ็ต</span> คือการยกต่อเนื่องหนึ่งรอบ เช่น ยก 10 ครั้งแล้ววางพัก นับเป็น 1 เซ็ต
        มือใหม่เริ่มที่ราว <span className="font-medium text-fg">10 เซ็ตต่อกลุ่มกล้ามต่อสัปดาห์</span> (รวมทุกวัน) ก็พอ
        แบ่งตามจำนวนวันที่ได้ฝึกกลุ่มนั้น ทำเซ็ตละ 8–12 ครั้ง ด้วยน้ำหนักที่จบเซ็ตแล้วยัง
        <span className="font-medium text-fg">เหลือแรงอีก 2–3 ครั้ง</span> ไม่ต้องยกจนหมดแรง และพักระหว่างเซ็ต 1–2 นาที
      </Principle>

      <Principle title="ถ้าพลาดไปวันหนึ่ง">
        ไม่ต้องฝึกชดเชย 2 วันติด แค่ทำวันถัดไปตามตารางต่อ หรือเลื่อนทั้งตารางไปหนึ่งวัน
        ให้กล้ามกลุ่มเดิมยังมีวันพักคั่นเหมือนเดิม
      </Principle>
    </section>
  );
}

function Principle({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl bg-surface p-4">
      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
        <Info aria-hidden size={17} className="shrink-0 text-primary" />
        {title}
      </summary>
      <p className="mt-3 text-[0.95rem] leading-8 text-muted">{children}</p>
    </details>
  );
}
