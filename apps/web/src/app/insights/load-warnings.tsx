import { CircleCheck, HeartPulse, OctagonAlert, TriangleAlert } from "lucide-react";

import type { LoadExercise, LoadReport } from "@/lib/api";

// Advice is the headline, so it gets a solid pill; findings below are plain text.
const ADVICE: Record<LoadExercise["advice"], { label: string; cls: string }> = {
  progress_ok: { label: "เพิ่มน้ำหนักได้", cls: "bg-health text-health-fg" },
  hold: { label: "คงน้ำหนักไว้ก่อน", cls: "bg-warn text-warn-fg" },
  no_increase: { label: "ยังไม่ควรเพิ่มน้ำหนัก", cls: "bg-danger text-danger-fg" },
};

const LEVEL = {
  caution: { label: "ระวัง", cls: "text-warn", Icon: TriangleAlert },
  risk: { label: "เสี่ยง", cls: "text-danger", Icon: OctagonAlert },
};

/** The one solid red block in the app: pain overrides every other advice. */
export function PainBanner() {
  return (
    <div role="alert" className="flex gap-3 rounded-2xl bg-danger-solid p-4 text-white">
      <HeartPulse aria-hidden size={22} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold text-balance">คุณบันทึกว่ามีอาการเจ็บในช่วง 7 วันที่ผ่านมา</p>
        <p className="mt-1 text-sm leading-relaxed text-white/90">
          ช่วงนี้ยังไม่ควรเพิ่มน้ำหนักทุกท่า ถ้าอาการไม่ดีขึ้นหรือเจ็บมากขึ้น ควรปรึกษาแพทย์หรือนักกายภาพบำบัด
        </p>
      </div>
    </div>
  );
}

/**
 * Exercises with findings first, the rest on one "no warning" line.
 * Pass onlyIds to limit the report to some exercises (e.g. the session just saved).
 */
export function LoadWarnings({ report, onlyIds }: { report: LoadReport; onlyIds?: Set<number> }) {
  const list = report.exercises.filter((e) => !onlyIds || onlyIds.has(e.exercise_id));
  const flagged = list
    .map((e) => ({ ...e, findings: e.findings.filter((f) => f.rule !== "pain") }))
    .filter((e) => e.findings.length > 0);
  const fine = list.filter((e) => e.advice === "progress_ok");

  return (
    <div className="flex flex-col gap-4">
      {report.pain && <PainBanner />}
      {flagged.length > 0 && (
        <ul className="overflow-hidden rounded-3xl bg-surface">
          {flagged.map((e, i) => (
            <li key={e.exercise_id} className={`flex flex-col gap-3 p-4 ${i > 0 ? "shadow-[0_-1px_0_var(--line)]" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[1.05rem] font-semibold">{e.name_th}</h3>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${ADVICE[e.advice].cls}`}>
                  {ADVICE[e.advice].label}
                </span>
              </div>
              <ul className="flex flex-col gap-2.5">
                {e.findings.map((f) => {
                  const { label, cls, Icon } = LEVEL[f.level];
                  return (
                    <li key={f.rule} className="flex gap-2.5 text-sm leading-relaxed">
                      <Icon aria-hidden size={18} className={`mt-0.5 shrink-0 ${cls}`} />
                      <span>
                        <span className={`font-semibold ${cls}`}>{label}</span>{" "}
                        <span className="text-fg/90">{f.message}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {fine.length > 0 && (
        <p className="flex gap-2 text-sm leading-relaxed">
          <CircleCheck aria-hidden size={18} className="mt-0.5 shrink-0 text-health" />
          <span>
            <span className="font-medium text-health">ไม่มีสัญญาณเตือน</span>{" "}
            <span className="text-muted">{fine.map((e) => e.name_th).join(", ")}</span>
          </span>
        </p>
      )}
      {list.length === 0 && <p className="text-sm text-muted">ยังไม่มีข้อมูลการซ้อมใน 8 สัปดาห์ที่ผ่านมา</p>}
    </div>
  );
}
