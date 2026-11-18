import { Info, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DAY_CHOICES, localizeProgram, programsFor, type Program } from "@/content/programs";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES, type Messages } from "@/lib/i18n/messages";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/seo";

import { ChooseProgram } from "./choose-program";
import { WeekTable } from "./week-table";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return pageMeta(await getLocale(), {
    title: t.meta.programs,
    description: t.meta.programsDescription,
    path: "/programs",
  });
}

type T = Messages["programs"];

export default async function ProgramsPage({ searchParams }: PageProps<"/[lang]/programs">) {
  const locale = await getLocale();
  const t = MESSAGES[locale].programs;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-6 pb-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[2.1rem] leading-tight font-semibold tracking-tight">{t.title}</h1>
        <p className="text-[0.95rem] leading-8 text-muted">{t.intro}</p>
      </header>

      {/* Reading ?days= needs a Suspense boundary so the rest of the page can prerender. */}
      <Suspense fallback={<DayPicker chosen={null} t={t} />}>
        <ChosenPrograms searchParams={searchParams} locale={locale} />
      </Suspense>

      {locale === "en" ? <PrinciplesEn /> : <Principles />}

      <p className="flex gap-2 rounded-2xl bg-surface p-4 text-sm leading-7 text-muted">
        <ShieldCheck aria-hidden size={18} className="mt-1 shrink-0 text-primary" />
        <span>{t.disclaimer}</span>
      </p>
    </main>
  );
}

async function ChosenPrograms({
  searchParams,
  locale,
}: {
  searchParams: PageProps<"/[lang]/programs">["searchParams"];
  locale: Locale;
}) {
  const t = MESSAGES[locale].programs;
  const raw = (await searchParams).days;
  const days = Number(Array.isArray(raw) ? raw[0] : raw);
  const chosen = DAY_CHOICES.includes(days) ? days : null;
  return (
    <>
      <DayPicker chosen={chosen} t={t} />
      {chosen &&
        programsFor(chosen).map((p, i) => (
          <ProgramCard key={p.id} program={p} text={localizeProgram(p, locale)} alternative={i > 0} t={t} />
        ))}
    </>
  );
}

function DayPicker({ chosen, t }: { chosen: number | null; t: T }) {
  return (
    <section aria-labelledby="days-q" className="flex flex-col gap-3">
      <h2 id="days-q" className="text-lg font-semibold">
        {t.daysQuestion}
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
              <span className={`text-[0.7rem] font-normal ${active ? "" : "text-muted"}`}>{t.days}</span>
            </Link>
          );
        })}
      </div>
      {!chosen && <p className="text-sm text-faint">{t.pickDays}</p>}
    </section>
  );
}

// `program` is the schedule as stored (the week table localizes it itself); `text`, its words in the page's language.
function ProgramCard({
  program,
  text: p,
  alternative,
  t,
}: {
  program: Program;
  text: Program;
  alternative: boolean;
  t: T;
}) {
  return (
    <section
      aria-labelledby={`p-${p.id}`}
      className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-[var(--shadow-lift)]"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-primary">{alternative ? t.alternative : t.recommended}</p>
        <h2 id={`p-${p.id}`} className="text-2xl font-semibold tracking-tight">
          {p.name}
        </h2>
        <p className="text-sm text-faint">{t.alias(p.alias)}</p>
      </div>

      <p className="text-[0.95rem] leading-8 text-muted">
        <span className="font-medium text-fg">{t.why}</span>
        {p.why}
      </p>

      <WeekTable program={program} />

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-raised p-3">
          <dt className="text-faint">{t.timesLabel}</dt>
          <dd className="mt-1 text-base font-semibold">{t.times(p.timesPerWeek)}</dd>
        </div>
        <div className="rounded-2xl bg-raised p-3">
          <dt className="text-faint">{t.setsLabel}</dt>
          <dd className="mt-1 text-base font-semibold">{t.sets(p.setsPerSession)}</dd>
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

function PrinciplesEn() {
  return (
    <section aria-labelledby="principles" className="flex flex-col gap-3">
      <h2 id="principles" className="text-lg font-semibold">
        The simple rules behind these schedules
      </h2>

      <Principle title="Why split the body up">
        Muscles grow and get stronger while they rest, not while you train. Train the same muscles every day and they
        never get time to repair. Splitting the body means one part trains today while another rests, so you can come in
        several days a week without working the same muscles again.
      </Principle>

      <Principle title="How much rest each muscle group needs">
        Give a muscle you trained hard at least 1 full day of rest (about 48 hours) before training it again. That&apos;s
        why no schedule on this page trains the same group 2 days in a row, and every week has whole-body rest days. If a
        muscle is still so sore it&apos;s hard to move, take another day off.
      </Principle>

      <Principle title="How many sets">
        A <span className="font-medium text-fg">set</span> is one round of lifting without a break, for example 10 lifts
        and then you put the weight down: that&apos;s 1 set. Beginners do fine with about{" "}
        <span className="font-medium text-fg">10 sets per muscle group per week</span> (all days together), shared across
        the days that group is trained. Do 8–12 lifts per set, with a weight that still leaves you{" "}
        <span className="font-medium text-fg">2–3 more lifts in reserve</span> at the end of the set. No need to lift
        until you can&apos;t, and rest 1–2 minutes between sets.
      </Principle>

      <Principle title="If you miss a day">
        No need to make up for it by training 2 days in a row. Just do the next day on the schedule, or shift the whole
        schedule by a day, so each muscle group still gets its rest days in between.
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
