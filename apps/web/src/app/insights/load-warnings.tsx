import type { LoadExercise, LoadReport } from "@/lib/api";

const ADVICE: Record<LoadExercise["advice"], { label: string; cls: string }> = {
  progress_ok: { label: "เพิ่มน้ำหนักได้ตามปกติ", cls: "text-emerald-600 dark:text-emerald-400" },
  hold: { label: "คงน้ำหนักไว้ก่อน", cls: "text-amber-600 dark:text-amber-400" },
  no_increase: { label: "ยังไม่ควรเพิ่มน้ำหนัก", cls: "text-red-600 dark:text-red-400" },
};

const LEVEL = {
  caution: { label: "ระวัง", cls: "border-amber-500/60 bg-amber-500/10" },
  risk: { label: "เสี่ยง", cls: "border-red-500/60 bg-red-500/10" },
};

/** One-line pain banner; the per-exercise pain findings would only repeat it. */
export function PainBanner() {
  return (
    <div role="alert" className="rounded-xl border border-red-500/60 bg-red-500/10 p-4">
      <p className="font-medium">คุณบันทึกว่ามีอาการเจ็บในช่วง 7 วันที่ผ่านมา</p>
      <p className="mt-1 text-sm">
        ช่วงนี้ยังไม่ควรเพิ่มน้ำหนักทุกท่า ถ้าอาการไม่ดีขึ้นหรือเจ็บมากขึ้น ควรปรึกษาแพทย์หรือนักกายภาพบำบัด
      </p>
    </div>
  );
}

/**
 * Exercises with findings as cards, the rest as a compact "fine" line.
 * Pass onlyIds to limit the report to some exercises (e.g. the session just saved).
 */
export function LoadWarnings({ report, onlyIds }: { report: LoadReport; onlyIds?: Set<number> }) {
  const list = report.exercises.filter((e) => !onlyIds || onlyIds.has(e.exercise_id));
  const flagged = list
    .map((e) => ({ ...e, findings: e.findings.filter((f) => f.rule !== "pain") }))
    .filter((e) => e.findings.length > 0);
  const fine = list.filter((e) => e.advice === "progress_ok");

  return (
    <div className="flex flex-col gap-3">
      {report.pain && <PainBanner />}
      {flagged.map((e) => (
        <section key={e.exercise_id} className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold">{e.name_th}</h3>
            <span className={`text-sm font-medium ${ADVICE[e.advice].cls}`}>{ADVICE[e.advice].label}</span>
          </div>
          {e.findings.map((f) => (
            <p key={f.rule} className={`rounded-lg border px-3 py-2 text-sm ${LEVEL[f.level].cls}`}>
              <span className="font-medium">{LEVEL[f.level].label}: </span>
              {f.message}
            </p>
          ))}
        </section>
      ))}
      {fine.length > 0 && (
        <p className="text-sm">
          <span className={ADVICE.progress_ok.cls}>✓ ไม่มีสัญญาณเตือน: </span>
          {fine.map((e) => e.name_th).join(", ")}
        </p>
      )}
      {list.length === 0 && <p className="text-sm text-zinc-500">ยังไม่มีข้อมูลการซ้อมใน 8 สัปดาห์ที่ผ่านมา</p>}
    </div>
  );
}
