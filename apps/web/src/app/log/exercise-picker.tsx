"use client";

import { useRef, useState } from "react";

import type { Exercise } from "@/lib/api";

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

// Primary muscle groups, in body order, with Thai labels.
const MUSCLES: [string, string][] = [
  ["chest", "อก"],
  ["back", "หลัง"],
  ["traps", "บ่า (ทราปีเซียส)"],
  ["shoulders", "ไหล่"],
  ["biceps", "หน้าแขน"],
  ["triceps", "หลังแขน"],
  ["abs", "หน้าท้อง"],
  ["lower_back", "หลังล่าง"],
  ["glutes", "ก้น"],
  ["quads", "ต้นขาหน้า"],
  ["hamstrings", "ต้นขาหลัง"],
  ["calves", "น่อง"],
];

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
}: {
  exercises: Exercise[];
  title: string;
  onPick: (e: Exercise) => void;
}) {
  const [query, setQuery] = useState("");
  const [muscles, setMuscles] = useState<Set<string>>(new Set());
  const dialog = useRef<HTMLDialogElement>(null);

  const shown = exercises.filter((e) => matches(e, query, muscles));
  const toggle = (m: string) =>
    setMuscles((cur) => {
      const next = new Set(cur);
      if (!next.delete(m)) next.add(m);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base font-medium">{title}</p>
      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาท่า เช่น เบนช์ หรือ curl"
          aria-label="ค้นหาท่า"
          className="h-12 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 text-base dark:border-zinc-700"
        />
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          className="h-12 shrink-0 rounded-lg border border-zinc-300 px-4 text-base dark:border-zinc-700"
        >
          ตัวกรอง{muscles.size > 0 && ` (${muscles.size})`}
        </button>
      </div>

      {muscles.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {MUSCLES.filter(([m]) => muscles.has(m)).map(([m, label]) => (
            <button key={m} type="button" onClick={() => toggle(m)} className="h-9 rounded-full bg-zinc-200 px-3 dark:bg-zinc-800">
              {label} ×
            </button>
          ))}
          <button type="button" onClick={() => setMuscles(new Set())} className="h-9 px-2 text-zinc-500 underline">
            ล้างตัวกรอง
          </button>
        </div>
      )}

      {shown.length === 0 && <p className="text-sm text-zinc-500">ไม่พบท่าที่ตรงกับคำค้นหรือตัวกรอง</p>}
      {CATEGORIES.map(([cat, label]) => {
        const list = shown.filter((e) => e.category === cat);
        if (list.length === 0) return null;
        return (
          <div key={cat} className="flex flex-col gap-2">
            <p className="text-sm text-zinc-500">{label}</p>
            <div className="flex flex-wrap gap-2">
              {list.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onPick(e)}
                  className="h-11 rounded-full border border-zinc-300 px-4 text-base dark:border-zinc-700"
                >
                  {e.name_th}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <dialog
        ref={dialog}
        aria-label="กรองตามกล้ามเนื้อ"
        className="m-auto w-[min(100%-2rem,28rem)] rounded-xl bg-background p-4 text-foreground backdrop:bg-black/60"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close(); // tap outside closes
        }}
      >
        <p className="mb-1 text-lg font-semibold">กล้ามเนื้อหลัก</p>
        <p className="mb-4 text-sm text-zinc-500">แสดงท่าที่เน้นกล้ามเนื้อที่เลือก (เลือกได้หลายกลุ่ม)</p>
        <div className="grid grid-cols-2 gap-2">
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
                className={`flex h-12 items-center justify-between rounded-lg border px-3 text-base disabled:opacity-30 ${
                  on ? "border-foreground bg-foreground text-background" : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                <span>{label}</span>
                <span className="text-sm opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMuscles(new Set())}
            className="h-12 flex-1 rounded-full border border-zinc-300 font-medium dark:border-zinc-700"
          >
            ล้าง
          </button>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="h-12 flex-1 rounded-full bg-foreground font-medium text-background"
          >
            แสดง {exercises.filter((e) => matches(e, query, muscles)).length} ท่า
          </button>
        </div>
      </dialog>
    </div>
  );
}
