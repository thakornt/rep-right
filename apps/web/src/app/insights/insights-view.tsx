"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getLoadInsights, getReturnPlan, type LoadReport, type ReturnPlan } from "@/lib/api";

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

  if (state.kind === "loading") return <p className="text-sm text-zinc-500">กำลังวิเคราะห์…</p>;
  if (state.kind === "error") return <p className="text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้า</p>;

  const { load, plans } = state;
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">โหลดการซ้อม</h2>
        <LoadWarnings report={load} />
        {load.exercises.length === 0 && (
          <Link href="/log" className="font-medium underline">
            เริ่มบันทึกการซ้อม
          </Link>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">แผนกลับมาซ้อม</h2>
        {plans.length === 0 ? (
          <p className="text-sm text-zinc-500">ไม่มีท่าที่หยุดไปเกิน 1 สัปดาห์</p>
        ) : (
          <>
            <p className="text-sm text-zinc-500">
              ท่าที่หยุดไปนาน ให้เริ่มเบากว่าเดิมแล้วค่อยไต่กลับขึ้นทีละสัปดาห์ (ตัวเลขคือ top set ที่แนะนำ)
            </p>
            {plans.map((p) => (
              <ReturnPlanCard key={p.exercise_id} plan={p} />
            ))}
          </>
        )}
      </section>

      <p className="text-xs text-zinc-500">{load.disclaimer}</p>
    </div>
  );
}

function ReturnPlanCard({ plan: p }: { plan: ReturnPlan }) {
  const range = p.start_percent_min === p.start_percent_max ? `${p.start_percent_min}%` : `${p.start_percent_min}-${p.start_percent_max}%`;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div>
        <h3 className="text-lg font-semibold">{p.name_th}</h3>
        <p className="text-sm text-zinc-500">
          หยุดไป {p.days_off} วัน (ล่าสุด {thDate(p.last_performed_at)}, top set {p.top_set_kg} กก.)
        </p>
      </div>
      <p className="text-base">
        เริ่มที่ <span className="font-semibold">{p.start_weight_kg} กก.</span> ({range} ของเดิม) แล้วไต่กลับภายใน{" "}
        {p.ramp_weeks} สัปดาห์
      </p>
      <table className="w-full text-sm">
        <thead className="text-zinc-500">
          <tr>
            <th className="py-1 text-left font-normal">สัปดาห์</th>
            <th className="py-1 text-right font-normal">%</th>
            <th className="py-1 text-right font-normal">กก.</th>
          </tr>
        </thead>
        <tbody>
          {p.steps.map((s) => (
            <tr key={s.week} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="py-1">{s.week === p.steps.length ? `${s.week} (กลับสู่ปกติ)` : s.week}</td>
              <td className="py-1 text-right">{Math.round(s.percent)}%</td>
              <td className="py-1 text-right font-medium">{s.weight_kg}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
