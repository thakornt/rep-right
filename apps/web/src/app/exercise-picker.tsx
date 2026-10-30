"use client";

import { ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { useRef, useState } from "react";

import type { Exercise } from "@/lib/api";
import { CATEGORIES, MUSCLES, muscleLabel } from "@/lib/exercise-groups";

import { btnPrimary, btnQuiet } from "./ui";

const normalize = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "");

function matches(e: Exercise, query: string, muscles: Set<string>): boolean {
  if (muscles.size > 0 && !e.muscles.some((m) => muscles.has(m))) return false;
  const q = normalize(query);
  return q === "" || [e.name_th, e.name_en, e.slug].some((n) => normalize(n).includes(q));
}

export function ExercisePicker({
  exercises,
  title,
  onPick,
  initialMuscles = [],
}: {
  exercises: Exercise[];
  title?: string;
  onPick: (e: Exercise) => void;
  initialMuscles?: string[];
}) {
  const [query, setQuery] = useState("");
  const [muscles, setMuscles] = useState<Set<string>>(() => new Set(initialMuscles));
  const sheet = useRef<HTMLDialogElement>(null);

  const shown = exercises.filter((e) => matches(e, query, muscles));
  const toggle = (m: string) =>
    setMuscles((cur) => {
      const next = new Set(cur);
      if (!next.delete(m)) next.add(m);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      {title && <p className="text-base font-semibold">{title}</p>}
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search aria-hidden size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาท่า เช่น เบนช์ หรือ curl"
            aria-label="ค้นหาท่า"
            className="field pl-10"
          />
        </label>
        <button
          type="button"
          onClick={() => sheet.current?.showModal()}
          aria-label={`กรองตามกล้ามเนื้อ${muscles.size ? ` (เลือกอยู่ ${muscles.size})` : ""}`}
          className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-colors cursor-pointer ${
            muscles.size ? "bg-primary text-primary-fg" : "bg-raised text-fg hover:bg-[#1f3035]"
          }`}
        >
          <SlidersHorizontal aria-hidden size={20} />
          {muscles.size > 0 && (
            <span className="num absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-fg px-1 text-[0.7rem] font-bold text-bg">
              {muscles.size}
            </span>
          )}
        </button>
      </div>

      {muscles.size > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {MUSCLES.filter(([m]) => muscles.has(m)).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => toggle(m)}
              className="inline-flex h-9 items-center gap-1 rounded-full bg-primary/15 pr-2 pl-3 text-sm text-primary cursor-pointer"
            >
              {label} <X aria-label="เอาออก" size={14} />
            </button>
          ))}
          <button type="button" onClick={() => setMuscles(new Set())} className="h-9 px-2 text-sm text-muted cursor-pointer">
            ล้างทั้งหมด
          </button>
        </div>
      )}

      {shown.length === 0 && <p className="py-6 text-center text-sm text-muted">ไม่พบท่าที่ตรงกับคำค้นหรือตัวกรอง</p>}
      {CATEGORIES.map(([cat, label]) => {
        const list = shown.filter((e) => e.category === cat);
        if (list.length === 0) return null;
        return (
          <section key={cat} className="flex flex-col">
            <h3 className="pb-1.5 text-xs font-medium tracking-wide text-faint">{label}</h3>
            <ul className="overflow-hidden rounded-2xl bg-surface">
              {list.map((e, i) => (
                <li key={e.id} className={i > 0 ? "shadow-[0_-1px_0_var(--line)]" : ""}>
                  <button
                    type="button"
                    onClick={() => onPick(e)}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-raised cursor-pointer"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.98rem] font-medium">{e.name_th}</span>
                      <span className="block truncate text-xs text-faint">
                        {e.name_en} · {e.muscles.map(muscleLabel).join(", ")}
                      </span>
                    </span>
                    <ChevronRight aria-hidden size={18} className="shrink-0 text-faint" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {/* Bottom sheet on phones, centred dialog on wider screens. */}
      <dialog
        ref={sheet}
        aria-label="กรองตามกล้ามเนื้อ"
        className="mx-auto mt-auto mb-0 w-full max-w-xl rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-fg backdrop:bg-black/70 sm:m-auto sm:max-w-md sm:rounded-3xl"
        onClick={(e) => {
          if (e.target === sheet.current) sheet.current.close(); // tap outside closes
        }}
      >
        <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
        <p className="text-lg font-semibold">กล้ามเนื้อหลัก</p>
        <p className="mb-4 text-sm text-muted">เลือกได้หลายกลุ่ม</p>
        <div className="flex flex-wrap gap-2">
          {MUSCLES.map(([m, label]) => {
            const count = exercises.filter((e) => e.muscles.includes(m)).length;
            const on = muscles.has(m);
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                disabled={count === 0}
                onClick={() => toggle(m)}
                className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-[0.95rem] transition-colors disabled:opacity-30 cursor-pointer ${
                  on ? "bg-primary text-primary-fg" : "bg-raised text-fg hover:bg-[#1f3035]"
                }`}
              >
                {label}
                <span className={`num text-xs ${on ? "opacity-70" : "text-faint"}`}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-6 grid grid-cols-[auto_1fr] gap-2">
          <button type="button" onClick={() => setMuscles(new Set())} className={btnQuiet}>
            ล้าง
          </button>
          <button type="button" onClick={() => sheet.current?.close()} className={btnPrimary}>
            แสดง {exercises.filter((e) => matches(e, query, muscles)).length} ท่า
          </button>
        </div>
      </dialog>
    </div>
  );
}
