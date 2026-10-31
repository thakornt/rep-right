"use client";

import { Check, CircleAlert, Minus, Plus, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { HEALTH_CONSENT_TEXT } from "@/lib/consent-text";

import { ExercisePicker } from "../exercise-picker";
import { btnPrimary, btnQuiet, btnText, iconBtn } from "../ui";
import { SavedWarnings } from "./saved-warnings";

// Inputs stay strings while typing; they are parsed on save.
type SetRow = { weight: string; reps: string; rpe: string };
type Block = { exerciseId: number; sets: SetRow[]; last?: Session | null };
type Draft = { date: string; blocks: Block[]; notes: string; pain: boolean };

const DRAFT_KEY = "rr_log_draft"; // workout draft only; never tokens
const RPE_OPTIONS = ["", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10"];
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
  const params = useSearchParams();
  const router = useRouter();
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

  // /log?add=<slug> (from an exercise page) adds that exercise. This reacts to
  // the URL rather than running once on mount, because Next keeps this page's
  // state between visits.
  const addSlug = params.get("add");
  useEffect(() => {
    if (!addSlug || exercises.length === 0) return;
    router.replace("/log", { scroll: false });
    const add = exercises.find((x) => x.slug === addSlug);
    if (!add) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus({ kind: "editing" });
    setPicking(false);
    setDraft((d) =>
      d.blocks.some((b) => b.exerciseId === add.id)
        ? d
        : { ...d, blocks: [...d.blocks, { exerciseId: add.id, sets: [{ ...emptySet }] }] },
    );
    void loadLast(add);
    // loadLast only uses setters; re-running on its identity would re-add.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSlug, exercises]);

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
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-health text-health-fg">
            <Check aria-hidden size={22} strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-lg font-semibold">บันทึกแล้ว</p>
            <p className="num text-sm text-muted">
              {thDate(status.session.performed_at)} · {status.session.sets.length} เซ็ต
            </p>
          </div>
        </div>
        <SavedWarnings session={status.session} />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={btnPrimary} onClick={() => setStatus({ kind: "editing" })}>
            บันทึกครั้งใหม่
          </button>
          <Link href="/history" className={btnQuiet}>
            ดูประวัติ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="flex items-center justify-between gap-4">
        <span className="text-sm whitespace-nowrap text-muted">วันที่ซ้อม</span>
        <input
          type="date"
          value={draft.date}
          max={localToday()}
          onChange={(e) => update((d) => ({ ...d, date: e.target.value }))}
          className="field num w-44 text-base"
          required
        />
      </label>

      {draft.blocks.map((b, i) => {
        const ex = byId.get(b.exerciseId);
        return (
          <section key={b.exerciseId} className="flex flex-col gap-4 rounded-3xl bg-surface p-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-[1.1rem] font-semibold">{ex?.name_th ?? "…"}</h2>
                {b.last && (
                  <p className="num mt-0.5 text-xs text-faint">
                    ครั้งก่อน {thDate(b.last.performed_at)} · {summarizeSets(b.last)}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label={`ลบท่า ${ex?.name_th ?? ""}`}
                className={iconBtn}
                onClick={() => update((d) => ({ ...d, blocks: d.blocks.filter((_, j) => j !== i) }))}
              >
                <Trash2 aria-hidden size={18} />
              </button>
            </div>

            {b.last && (
              <button
                type="button"
                className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-primary/12 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/20 cursor-pointer"
                onClick={() => sameAsLast(i)}
              >
                <RotateCcw aria-hidden size={16} /> เหมือนครั้งก่อน
              </button>
            )}

            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[1.75rem_1fr_1fr_1fr_2.75rem] items-center gap-2 px-0.5 text-xs text-faint">
                <span className="text-center">#</span>
                <span className="text-center">กก.</span>
                <span className="text-center">ครั้ง</span>
                <span className="text-center">RPE</span>
                <span />
              </div>
              {b.sets.map((s, k) => {
                const setField = (field: keyof SetRow) => (e: { target: { value: string } }) =>
                  updateBlock(i, (bb) => ({
                    ...bb,
                    sets: bb.sets.map((x, j) => (j === k ? { ...x, [field]: e.target.value } : x)),
                  }));
                return (
                  <div key={k} className="grid grid-cols-[1.75rem_1fr_1fr_1fr_2.75rem] items-center gap-2">
                    <span className="num text-center text-sm font-semibold text-faint">{k + 1}</span>
                    <input
                      inputMode="decimal"
                      aria-label={`น้ำหนักเซ็ต ${k + 1}`}
                      placeholder="0"
                      value={s.weight}
                      onChange={setField("weight")}
                      className="field num px-2 text-center text-lg font-medium"
                    />
                    <input
                      inputMode="numeric"
                      aria-label={`จำนวนครั้งเซ็ต ${k + 1}`}
                      placeholder="0"
                      value={s.reps}
                      onChange={setField("reps")}
                      className="field num px-2 text-center text-lg font-medium"
                    />
                    <select
                      aria-label={`RPE เซ็ต ${k + 1}`}
                      value={s.rpe}
                      onChange={setField("rpe")}
                      className="field num px-2 text-center"
                    >
                      {RPE_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o === "" ? "–" : o}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`ลบเซ็ต ${k + 1}`}
                      className={iconBtn}
                      disabled={b.sets.length === 1}
                      onClick={() => updateBlock(i, (bb) => ({ ...bb, sets: bb.sets.filter((_, j) => j !== k) }))}
                    >
                      <Minus aria-hidden size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className={btnText}
              onClick={() => updateBlock(i, (bb) => ({ ...bb, sets: [...bb.sets, { ...(bb.sets.at(-1) ?? emptySet) }] }))}
            >
              <Plus aria-hidden size={16} /> เพิ่มเซ็ต
            </button>
          </section>
        );
      })}

      {unused.length > 0 &&
        (draft.blocks.length > 0 && !picking ? (
          <button type="button" className={btnQuiet} onClick={() => setPicking(true)}>
            <Plus aria-hidden size={18} /> เพิ่มท่า
          </button>
        ) : (
          <ExercisePicker
            exercises={unused}
            title={draft.blocks.length ? "เพิ่มท่า" : "เลือกท่าที่ซ้อม"}
            onPick={addExercise}
          />
        ))}

      {draft.blocks.length > 0 && (
        <>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted">โน้ต (ไม่บังคับ)</span>
            <textarea
              value={draft.notes}
              maxLength={1000}
              rows={2}
              onChange={(e) => update((d) => ({ ...d, notes: e.target.value }))}
              className="field h-auto py-2.5 text-base"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-4 rounded-2xl bg-surface p-4">
            <span className="min-w-0 flex-1">
              <span className="block text-base font-medium">วันนี้มีอาการเจ็บ</span>
              <span className="mt-0.5 block text-sm text-muted">
                แอปจะหยุดแนะนำการเพิ่มน้ำหนักชั่วคราว ถ้าเจ็บต่อเนื่องควรปรึกษาแพทย์หรือนักกายภาพบำบัด
              </span>
            </span>
            {/* Switch: the real checkbox stays focusable for keyboards and screen readers. */}
            <input
              type="checkbox"
              checked={draft.pain}
              onChange={(e) => update((d) => ({ ...d, pain: e.target.checked }))}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="relative h-7 w-12 shrink-0 rounded-full bg-raised transition-colors after:absolute after:top-1 after:left-1 after:h-5 after:w-5 after:rounded-full after:bg-fg after:transition-transform peer-checked:bg-warn peer-checked:after:translate-x-5 peer-checked:after:bg-warn-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
            />
          </label>

          {status.kind === "needs-consent" && (
            <div className="flex flex-col gap-4 rounded-2xl bg-raised p-4">
              <p className="flex items-center gap-2 font-semibold text-warn">
                <ShieldCheck aria-hidden size={20} /> ขอความยินยอมเก็บข้อมูลสุขภาพ
              </p>
              <p className="text-sm leading-relaxed text-fg/85">{HEALTH_CONSENT_TEXT}</p>
              <div className="flex flex-col gap-1">
                <button type="button" className={btnPrimary} onClick={() => void save(true)}>
                  ยินยอมและบันทึก
                </button>
                <button
                  type="button"
                  className={`${btnText} justify-center text-muted`}
                  onClick={() => {
                    update((d) => ({ ...d, pain: false }));
                    setStatus({ kind: "editing" });
                  }}
                >
                  ไม่ยินยอม (บันทึกโดยไม่มีอาการเจ็บ)
                </button>
              </div>
            </div>
          )}

          {status.kind === "error" && (
            <p role="alert" className="flex items-start gap-2 text-sm text-danger">
              <CircleAlert aria-hidden size={18} className="mt-0.5 shrink-0" />
              {status.message}
            </p>
          )}

          <button type="submit" className={`${btnPrimary} h-14 text-lg`} disabled={status.kind === "saving"}>
            {status.kind === "saving" ? "กำลังบันทึก…" : "บันทึกการซ้อม"}
          </button>
        </>
      )}
    </form>
  );
}
