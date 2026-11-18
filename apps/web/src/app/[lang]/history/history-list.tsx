"use client";

import { ClipboardPen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { deleteSession, getExercises, listSessions, type Exercise, type Session } from "@/lib/api";
import { exerciseName } from "@/lib/exercise-groups";
import { useLocale } from "@/lib/i18n/client";
import { DATE_LOCALE } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/messages";

import { PageLoader } from "../logo-loader";
import { btnPrimary, iconBtn } from "../ui";

type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; sessions: Session[] };

const toDate = (iso: string) => new Date(`${iso}T00:00:00`);

export function HistoryList() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const locale = useLocale();
  const t = MESSAGES[locale].history;
  const names = useMemo(() => new Map(exercises.map((e) => [e.id, exerciseName(e, locale)])), [exercises, locale]);
  const dateTag = DATE_LOCALE[locale];
  const longDate = (iso: string) =>
    toDate(iso).toLocaleDateString(dateTag, { weekday: "short", day: "numeric", month: "short" });

  useEffect(() => {
    Promise.all([listSessions(), getExercises()])
      .then(([sessions, ex]) => {
        setExercises(ex);
        setState({ kind: "ready", sessions });
      })
      .catch(() => setState({ kind: "error" }));
  }, []);

  if (state.kind === "loading") return <PageLoader label={t.loading} />;
  if (state.kind === "error") return <p className="text-sm text-danger">{t.loadFailed}</p>;
  if (state.sessions.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 py-6">
        <p className="text-muted">{t.empty}</p>
        <Link href="/log" className={btnPrimary}>
          <ClipboardPen aria-hidden size={18} /> {t.first}
        </Link>
      </div>
    );
  }

  async function remove(s: Session) {
    if (!window.confirm(t.confirmDelete(longDate(s.performed_at)))) return;
    try {
      await deleteSession(s.id);
      setState((st) => (st.kind === "ready" ? { ...st, sessions: st.sessions.filter((x) => x.id !== s.id) } : st));
    } catch {
      window.alert(t.deleteFailed);
    }
  }

  return (
    <ol className="flex flex-col">
      {state.sessions.map((s, idx) => {
        const d = toDate(s.performed_at);
        // Group sets by exercise, keeping the logged order.
        const groups = new Map<number, { weight: number; reps: number }[]>();
        for (const set of s.sets) {
          groups.set(set.exercise_id, [...(groups.get(set.exercise_id) ?? []), { weight: set.weight_kg, reps: set.reps }]);
        }
        const last = idx === state.sessions.length - 1;
        return (
          <li key={s.id} className="grid grid-cols-[3.25rem_1fr] gap-x-4">
            {/* Date rail */}
            <div className="relative flex flex-col items-center">
              <span className="num text-2xl leading-none font-semibold">{d.getDate()}</span>
              <span className="mt-1 text-xs text-faint">
                {d.toLocaleDateString(dateTag, { weekday: "short" })} {d.toLocaleDateString(dateTag, { month: "short" })}
              </span>
              {!last && <span aria-hidden className="mt-2 w-px flex-1 bg-line" />}
            </div>

            <div className={`flex flex-col gap-3 ${last ? "" : "pb-8"}`}>
              <div className="flex items-center gap-2">
                <p className="num min-w-0 flex-1 text-sm text-muted">
                  {t.summary(groups.size, s.sets.length)}
                </p>
                {s.pain_flag && (
                  <span className="rounded-full bg-warn px-2.5 py-0.5 text-xs font-semibold text-warn-fg">{t.pain}</span>
                )}
                <button
                  type="button"
                  aria-label={t.deleteLabel(longDate(s.performed_at))}
                  className={`${iconBtn} -my-2 h-9 w-9`}
                  onClick={() => void remove(s)}
                >
                  <Trash2 aria-hidden size={16} />
                </button>
              </div>
              {[...groups].map(([id, sets]) => (
                <div key={id} className="flex flex-col gap-1.5">
                  <p className="font-medium">{names.get(id) ?? `#${id}`}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sets.map((x, i) => (
                      <span key={i} className="num rounded-lg bg-surface px-2.5 py-1 text-sm">
                        {x.weight}
                        <span className="text-faint"> × </span>
                        {x.reps}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {s.notes && <p className="text-sm text-muted italic">“{s.notes}”</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
