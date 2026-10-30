"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  ApiError,
  HEALTH_CONSENT_VERSION,
  createSession,
  getExercises,
  getLastSession,
  grantConsent,
  type Exercise,
  type Session,
} from "@/lib/api";

// Inputs stay strings while typing; they are parsed on save.
type SetRow = { weight: string; reps: string; rpe: string };
type Block = { exerciseId: number; sets: SetRow[]; last?: Session | null };
type Draft = { date: string; blocks: Block[]; notes: string; pain: boolean };

const DRAFT_KEY = "rr_log_draft"; // workout draft only; never tokens
const RPE_OPTIONS = ["", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10"];
// Display order and Thai headings for exercise categories.
const CATEGORIES: [string, string][] = [
  ["squat", "สควอท"],
  ["hinge", "เดดลิฟต์ / สะโพก"],
  ["push", "ดัน (อก / ไหล่)"],
  ["pull", "ดึง (หลัง)"],
  ["shoulders", "ไหล่"],
  ["arms", "แขน"],
  ["legs", "ขา"],
  ["core", "หน้าท้อง"],
];
const emptySet: SetRow = { weight: "", reps: "", rpe: "" };

function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyDraft(): Draft {
  return { date: localToday(), blocks: [], notes: "", pain: false };
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return { ...emptyDraft(), ...(JSON.parse(raw) as Draft) };
  } catch {
    // storage unavailable or corrupt: start fresh
  }
  return emptyDraft();
}

function saveDraft(d: Draft) {
  try {
    // "last" is fetched again on demand; keep the stored draft small.
    const blocks = d.blocks.map((b) => ({ exerciseId: b.exerciseId, sets: b.sets }));
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, blocks }));
  } catch {
    // ignore
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

const thDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" });

function summarizeSets(s: Session): string {
  return s.sets.map((x) => `${x.weight_kg}×${x.reps}`).join(", ");
}

type Status =
  | { kind: "editing" }
  | { kind: "saving" }
  | { kind: "needs-consent" }
  | { kind: "error"; message: string }
  | { kind: "saved"; session: Session };

export function LogForm() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "editing" });
  // The exercise picker is open on an empty log and behind "+ เพิ่มท่า" after that.
  const [picking, setPicking] = useState(false);

  async function loadLast(e: Exercise) {
    try {
      const last = await getLastSession(e.slug);
      setDraft((d) => ({ ...d, blocks: d.blocks.map((b) => (b.exerciseId === e.id ? { ...b, last } : b)) }));
    } catch {
      // the hint is optional
    }
  }

  useEffect(() => {
    // Restoring the saved draft must happen after mount (localStorage is client-only).
    const restored = loadDraft();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(restored);
    setLoaded(true);
    getExercises()
      .then((list) => {
        setExercises(list);
        // Restored blocks get their "last time" hint back.
        for (const b of restored.blocks) {
          const e = list.find((x) => x.id === b.exerciseId);
          if (e) void loadLast(e);
        }
      })
      .catch(() => setStatus({ kind: "error", message: "โหลดรายชื่อท่าไม่สำเร็จ ลองรีเฟรชหน้า" }));
  }, []);

  useEffect(() => {
    if (loaded) saveDraft(draft);
  }, [draft, loaded]);

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const unused = exercises.filter((e) => !draft.blocks.some((b) => b.exerciseId === e.id));

  const update = (fn: (d: Draft) => Draft) => {
    setDraft(fn);
    if (status.kind === "error" || status.kind === "saved") setStatus({ kind: "editing" });
  };
  const updateBlock = (i: number, fn: (b: Block) => Block) =>
    update((d) => ({ ...d, blocks: d.blocks.map((b, j) => (j === i ? fn(b) : b)) }));

  function addExercise(e: Exercise) {
    setPicking(false);
    update((d) => ({ ...d, blocks: [...d.blocks, { exerciseId: e.id, sets: [{ ...emptySet }] }] }));
    void loadLast(e);
  }

  function sameAsLast(i: number) {
    updateBlock(i, (b) =>
      b.last
        ? {
            ...b,
            sets: b.last.sets.map((s) => ({
              weight: String(s.weight_kg),
              reps: String(s.reps),
              rpe: s.rpe == null ? "" : String(s.rpe),
            })),
          }
        : b,
    );
  }

  async function save(withConsent = false) {
    const sets = draft.blocks.flatMap((b) =>
      b.sets
        .filter((s) => s.reps.trim() !== "")
        .map((s) => ({
          exercise_id: b.exerciseId,
          weight_kg: Number(s.weight || 0),
          reps: Number(s.reps),
          rpe: s.rpe === "" ? null : Number(s.rpe),
        })),
    );
    if (sets.length === 0) {
      setStatus({ kind: "error", message: "ใส่จำนวนครั้งอย่างน้อย 1 เซ็ต" });
      return;
    }
    if (sets.some((s) => !Number.isFinite(s.weight_kg) || !Number.isInteger(s.reps) || s.reps < 1)) {
      setStatus({ kind: "error", message: "น้ำหนักต้องเป็นตัวเลข และจำนวนครั้งต้องเป็นจำนวนเต็มตั้งแต่ 1" });
      return;
    }
    setStatus({ kind: "saving" });
    try {
      if (withConsent) await grantConsent("health_data", HEALTH_CONSENT_VERSION);
      const session = await createSession({
        performed_at: draft.date,
        notes: draft.notes.trim(),
        pain_flag: draft.pain,
        sets,
      });
      clearDraft();
      setDraft(emptyDraft());
      setStatus({ kind: "saved", session });
    } catch (e) {
      if (e instanceof ApiError && e.code === "consent_required") {
        setStatus({ kind: "needs-consent" });
      } else if (e instanceof ApiError && e.status === 401) {
        setStatus({ kind: "error", message: "หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง (ข้อมูลที่กรอกยังอยู่)" });
      } else if (e instanceof ApiError && e.code === "validation_failed") {
        setStatus({ kind: "error", message: `ข้อมูลไม่ถูกต้อง: ${e.message}` });
      } else {
        setStatus({ kind: "error", message: "บันทึกไม่สำเร็จ ลองอีกครั้ง (ข้อมูลที่กรอกยังอยู่)" });
      }
    }
  }

  if (status.kind === "saved") {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-emerald-600/40 p-4">
        <p className="text-lg font-medium">บันทึกแล้ว ✓</p>
        <p className="text-sm text-zinc-500">
          {thDate(status.session.performed_at)} · {status.session.sets.length} เซ็ต
        </p>
        <div className="flex gap-3">
          <button type="button" className={primaryBtn} onClick={() => setStatus({ kind: "editing" })}>
            บันทึกครั้งใหม่
          </button>
          <Link href="/history" className={secondaryBtn}>
            ดูประวัติ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="flex items-center justify-between gap-4">
        <span className="whitespace-nowrap text-base font-medium">วันที่ซ้อม</span>
        <input
          type="date"
          value={draft.date}
          max={localToday()}
          onChange={(e) => update((d) => ({ ...d, date: e.target.value }))}
          className={`${inputCls} w-44`}
          required
        />
      </label>

      {draft.blocks.map((b, i) => {
        const ex = byId.get(b.exerciseId);
        return (
          <section key={b.exerciseId} className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{ex?.name_th ?? "…"}</h2>
                {b.last && (
                  <p className="text-sm text-zinc-500">
                    ครั้งก่อน ({thDate(b.last.performed_at)}): {summarizeSets(b.last)}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label={`ลบท่า ${ex?.name_th ?? ""}`}
                className="h-11 w-11 shrink-0 rounded-full text-xl text-zinc-500"
                onClick={() => update((d) => ({ ...d, blocks: d.blocks.filter((_, j) => j !== i) }))}
              >
                ×
              </button>
            </div>

            {b.last && (
              <button type="button" className={secondaryBtn} onClick={() => sameAsLast(i)}>
                เหมือนครั้งก่อน
              </button>
            )}

            <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2.75rem] items-center gap-2 text-sm text-zinc-500">
              <span>เซ็ต</span>
              <span>กก.</span>
              <span>ครั้ง</span>
              <span>RPE</span>
              <span />
            </div>
            {b.sets.map((s, k) => {
              const setField = (field: keyof SetRow) => (e: { target: { value: string } }) =>
                updateBlock(i, (bb) => ({
                  ...bb,
                  sets: bb.sets.map((x, j) => (j === k ? { ...x, [field]: e.target.value } : x)),
                }));
              return (
                <div key={k} className="grid grid-cols-[2rem_1fr_1fr_1fr_2.75rem] items-center gap-2">
                  <span className="text-center text-zinc-500">{k + 1}</span>
                  <input
                    inputMode="decimal"
                    aria-label={`น้ำหนักเซ็ต ${k + 1}`}
                    placeholder="0"
                    value={s.weight}
                    onChange={setField("weight")}
                    className={inputCls}
                  />
                  <input
                    inputMode="numeric"
                    aria-label={`จำนวนครั้งเซ็ต ${k + 1}`}
                    placeholder="0"
                    value={s.reps}
                    onChange={setField("reps")}
                    className={inputCls}
                  />
                  <select aria-label={`RPE เซ็ต ${k + 1}`} value={s.rpe} onChange={setField("rpe")} className={inputCls}>
                    {RPE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o === "" ? "–" : o}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label={`ลบเซ็ต ${k + 1}`}
                    className="h-11 w-11 rounded-full text-lg text-zinc-500 disabled:opacity-30"
                    disabled={b.sets.length === 1}
                    onClick={() => updateBlock(i, (bb) => ({ ...bb, sets: bb.sets.filter((_, j) => j !== k) }))}
                  >
                    ×
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => updateBlock(i, (bb) => ({ ...bb, sets: [...bb.sets, { ...(bb.sets.at(-1) ?? emptySet) }] }))}
            >
              + เพิ่มเซ็ต
            </button>
          </section>
        );
      })}

      {unused.length > 0 &&
        (draft.blocks.length > 0 && !picking ? (
          <button type="button" className={secondaryBtn} onClick={() => setPicking(true)}>
            + เพิ่มท่า
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-base font-medium">{draft.blocks.length ? "เพิ่มท่า" : "เลือกท่าที่ซ้อม"}</p>
            {CATEGORIES.map(([cat, label]) => {
              const list = unused.filter((e) => e.category === cat);
              if (list.length === 0) return null;
              return (
                <div key={cat} className="flex flex-col gap-2">
                  <p className="text-sm text-zinc-500">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    {list.map((e) => (
                      <button key={e.id} type="button" className={chipBtn} onClick={() => addExercise(e)}>
                        {e.name_th}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {draft.blocks.length > 0 && (
        <>
          <label className="flex flex-col gap-2">
            <span className="text-base font-medium">โน้ต (ไม่บังคับ)</span>
            <textarea
              value={draft.notes}
              maxLength={1000}
              rows={2}
              onChange={(e) => update((d) => ({ ...d, notes: e.target.value }))}
              className={`${inputCls} h-auto py-2`}
            />
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={draft.pain}
              onChange={(e) => update((d) => ({ ...d, pain: e.target.checked }))}
              className="mt-1 h-6 w-6 shrink-0"
            />
            <span>
              <span className="text-base font-medium">วันนี้มีอาการเจ็บ</span>
              <span className="block text-sm text-zinc-500">
                แอปจะหยุดแนะนำการเพิ่มน้ำหนักชั่วคราว ถ้าเจ็บต่อเนื่องควรปรึกษาแพทย์หรือนักกายภาพบำบัด
              </span>
            </span>
          </label>

          {status.kind === "needs-consent" && (
            <div className="flex flex-col gap-3 rounded-xl border border-amber-500/50 p-4">
              <p className="text-sm">
                การบันทึกว่ามีอาการเจ็บถือเป็นข้อมูลสุขภาพ เราจะเก็บไว้เพียงว่า “มี/ไม่มี” ต่อการซ้อมหนึ่งครั้ง
                เพื่อใช้หยุดแนะนำการเพิ่มน้ำหนัก และคุณถอนความยินยอมได้ทุกเมื่อ (ข้อมูลอาการเจ็บจะถูกลบ)
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" className={primaryBtn} onClick={() => void save(true)}>
                  ยินยอมและบันทึก
                </button>
                <button
                  type="button"
                  className={secondaryBtn}
                  onClick={() => {
                    update((d) => ({ ...d, pain: false }));
                    setStatus({ kind: "editing" });
                  }}
                >
                  ไม่ยินยอม (ไม่บันทึกอาการเจ็บ)
                </button>
              </div>
            </div>
          )}

          {status.kind === "error" && (
            <p role="alert" className="text-sm text-red-600">
              {status.message}
            </p>
          )}

          <button type="submit" className={`${primaryBtn} h-14 text-lg`} disabled={status.kind === "saving"}>
            {status.kind === "saving" ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </>
      )}
    </form>
  );
}

const inputCls =
  "h-12 w-full min-w-0 rounded-lg border border-zinc-300 bg-transparent px-3 text-lg dark:border-zinc-700";
const primaryBtn =
  "flex h-12 items-center justify-center rounded-full bg-foreground px-6 font-medium text-background disabled:opacity-50";
const secondaryBtn =
  "flex h-12 items-center justify-center rounded-full border border-zinc-300 px-5 font-medium dark:border-zinc-700";
const chipBtn = "h-11 rounded-full border border-zinc-300 px-4 text-base dark:border-zinc-700";
