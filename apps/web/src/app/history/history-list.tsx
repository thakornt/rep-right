"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { deleteSession, getExercises, listSessions, type Exercise, type Session } from "@/lib/api";

type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; sessions: Session[] };

const thDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });

export function HistoryList() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const names = useMemo(() => new Map(exercises.map((e) => [e.id, e.name_th])), [exercises]);

  useEffect(() => {
    Promise.all([listSessions(), getExercises()])
      .then(([sessions, ex]) => {
        setExercises(ex);
        setState({ kind: "ready", sessions });
      })
      .catch(() => setState({ kind: "error" }));
  }, []);

  if (state.kind === "loading") return <p className="text-sm text-zinc-500">กำลังโหลด…</p>;
  if (state.kind === "error") return <p className="text-sm text-red-600">โหลดประวัติไม่สำเร็จ ลองรีเฟรชหน้า</p>;
  if (state.sessions.length === 0) {
    return (
      <p className="text-base">
        ยังไม่มีการซ้อมใน 90 วันที่ผ่านมา{" "}
        <Link href="/log" className="font-medium underline">
          บันทึกครั้งแรก
        </Link>
      </p>
    );
  }

  async function remove(s: Session) {
    if (!window.confirm(`ลบการซ้อมวันที่ ${thDate(s.performed_at)}?`)) return;
    try {
      await deleteSession(s.id);
      setState((st) => (st.kind === "ready" ? { ...st, sessions: st.sessions.filter((x) => x.id !== s.id) } : st));
    } catch {
      window.alert("ลบไม่สำเร็จ ลองอีกครั้ง");
    }
  }

  return (
    <ul className="flex flex-col gap-3">
      {state.sessions.map((s) => {
        // Group sets by exercise, keeping the logged order.
        const groups = new Map<number, string[]>();
        for (const set of s.sets) {
          groups.set(set.exercise_id, [...(groups.get(set.exercise_id) ?? []), `${set.weight_kg}×${set.reps}`]);
        }
        return (
          <li key={s.id} className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">
                {thDate(s.performed_at)}
                {s.pain_flag && <span className="ml-2 text-sm text-amber-600">มีอาการเจ็บ</span>}
              </p>
              <button
                type="button"
                className="h-11 rounded-full px-4 text-sm text-zinc-500"
                onClick={() => void remove(s)}
              >
                ลบ
              </button>
            </div>
            {[...groups].map(([id, sets]) => (
              <p key={id} className="text-sm">
                <span className="font-medium">{names.get(id) ?? `#${id}`}</span>{" "}
                <span className="text-zinc-500">{sets.join(", ")}</span>
              </p>
            ))}
            {s.notes && <p className="text-sm text-zinc-500">{s.notes}</p>}
          </li>
        );
      })}
    </ul>
  );
}
