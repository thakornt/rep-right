"use client";

import { ClipboardPen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getLoadInsights, getReturnPlan, type LoadReport, type ReturnPlan } from "@/lib/api";

import { btnPrimary } from "../ui";
import { LoadWarnings } from "./load-warnings";

type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; load: LoadReport; plans: ReturnPlan[] };

const thDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" });

export function InsightsView() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    Promise.all([getLoadInsights(), getReturnPlan()])
      .then(([load, plans]) => setState({ kind: "ready", load, plans }))
      .catch(() => setState({ kind: "error" }));
  }, []);

  if (state.kind === "loading") return <p className="text-sm text-muted">กำลังวิเคราะห์…</p>;
  if (state.kind === "error") return <p className="text-sm text-danger">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้า</p>;

  const { load, plans } = state;
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium tracking-wide text-faint">โหลดการซ้อม 8 สัปดาห์ล่าสุด</h2>
        <LoadWarnings report={load} />
        {load.exercises.length === 0 && (
          <Link href="/log" className={`${btnPrimary} w-fit`}>
            <ClipboardPen aria-hidden size={18} /> เริ่มบันทึกการซ้อม
          </Link>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xs font-medium tracking-wide text-faint">แผนกลับมาซ้อม</h2>
          <p className="mt-1 text-sm text-muted">
            {plans.length === 0
              ? "ไม่มีท่าที่หยุดไปเกิน 1 สัปดาห์"
              : "ท่าที่หยุดไปนาน เริ่มเบากว่าเดิมแล้วไต่กลับทีละสัปดาห์ (ตัวเลขคือน้ำหนักของเซ็ตที่หนักที่สุดที่แนะนำ)"}
          </p>
        </div>
        {plans.map((p) => (
          <ReturnPlanCard key={p.exercise_id} plan={p} />
        ))}
      </section>

      <p className="text-xs leading-relaxed text-faint">{load.disclaimer}</p>
    </div>
  );
}

function ReturnPlanCard({ plan: p }: { plan: ReturnPlan }) {
  const range =
    p.start_percent_min === p.start_percent_max ? `${p.start_percent_min}%` : `${p.start_percent_min}-${p.start_percent_max}%`;
  return (
    <article className="flex flex-col gap-5 rounded-3xl bg-surface p-5">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[1.05rem] font-semibold">{p.name_th}</h3>
          <p className="num mt-0.5 text-xs text-faint">
            หยุดไป {p.days_off} วัน · ล่าสุด {thDate(p.last_performed_at)} · เดิม {p.top_set_kg} กก.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted">เริ่มที่</p>
          <p className="num text-3xl leading-none font-semibold text-primary">
            {p.start_weight_kg}
            <span className="ml-1 text-sm font-normal text-muted">กก.</span>
          </p>
          <p className="num mt-1 text-xs text-faint">{range} ของเดิม</p>
        </div>
      </div>

      <ol className="flex flex-col gap-2.5" aria-label={`ไต่กลับภายใน ${p.ramp_weeks} สัปดาห์`}>
        {p.steps.map((s) => {
          const done = s.week === p.steps.length;
          return (
            <li key={s.week} className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-3 text-sm">
              <span className={done ? "text-health" : "text-muted"}>{done ? "กลับปกติ" : `สัปดาห์ ${s.week}`}</span>
              <span className="h-2 overflow-hidden rounded-full bg-inset">
                <span
                  className={`block h-full rounded-full ${done ? "bg-health" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, s.percent)}%` }}
                />
              </span>
              <span className="num text-right font-medium">{s.weight_kg}</span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
