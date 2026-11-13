"use client";

import { ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { useRef, useState } from "react";

import type { Exercise } from "@/lib/api";
import { countWith, matchesFilter, type ExerciseFilter } from "@/lib/exercise-filter";
import { CATEGORIES, EQUIPMENT, MUSCLES, SLUGS_WITH_3D, muscleLabel } from "@/lib/exercise-groups";

import { Badge3D } from "./badge-3d";
import { btnPrimary, btnQuiet } from "./ui";

type Group = "muscles" | "equipment";

const GROUPS: { group: Group; label: string; options: [string, string][] }[] = [
  { group: "equipment", label: "อุปกรณ์ที่มี", options: EQUIPMENT },
  { group: "muscles", label: "กล้ามเนื้อหลัก", options: MUSCLES },
];

export function ExercisePicker({
  exercises,
  title,
  onPick,
  initialMuscles = [],
  initialEquipment = [],
  mark3d = false,
}: {
  exercises: Exercise[];
  title?: string;
  onPick: (e: Exercise) => void;
  initialMuscles?: string[];
  initialEquipment?: string[];
  mark3d?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Record<Group, Set<string>>>(() => ({
    muscles: new Set(initialMuscles),
    equipment: new Set(initialEquipment),
  }));
  const sheet = useRef<HTMLDialogElement>(null);

  const filter: ExerciseFilter = { query, ...picked };
  const shown = exercises.filter((e) => matchesFilter(e, filter));
  const pickedCount = picked.muscles.size + picked.equipment.size;
  const toggle = (group: Group, value: string) =>
    setPicked((cur) => {
      const next = new Set(cur[group]);
      if (!next.delete(value)) next.add(value);
      return { ...cur, [group]: next };
    });
  const clear = (group?: Group) =>
    setPicked((cur) => (group ? { ...cur, [group]: new Set() } : { muscles: new Set(), equipment: new Set() }));

  // Options no exercise uses at all are left out; ones the other group rules out are dimmed.
  const options = (group: Group, list: [string, string][]) =>
    list
      .filter(([value]) => exercises.some((e) => e[group].includes(value)))
      .map(([value, label]) => ({ value, label, count: countWith(exercises, filter, group, value), on: picked[group].has(value) }));

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
            className="field bg-surface pl-10 shadow-[inset_0_0_0_1px_var(--line)]"
          />
        </label>
        <button
          type="button"
          onClick={() => sheet.current?.showModal()}
          aria-label={`ตัวกรองอุปกรณ์และกล้ามเนื้อ${pickedCount ? ` (เลือกอยู่ ${pickedCount})` : ""}`}
          className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-[background-color,transform] active:scale-95 cursor-pointer ${
            pickedCount ? "bg-primary text-primary-fg" : "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--line)] hover:bg-raised"
          }`}
        >
          <SlidersHorizontal aria-hidden size={20} />
          {pickedCount > 0 && (
            <span className="num absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-fg px-1 text-[0.7rem] font-bold text-bg">
              {pickedCount}
            </span>
          )}
        </button>
      </div>

      {shown.length === 0 && <p className="py-6 text-center text-sm text-muted">ไม่พบท่าที่ตรงกับคำค้นหรือตัวกรอง</p>}
      {CATEGORIES.map(([cat, label]) => {
        const list = shown.filter((e) => e.category === cat);
        if (list.length === 0) return null;
        return (
          <section key={cat} className="flex flex-col pt-2">
            <h3 className="flex items-baseline justify-between px-0.5 pb-2 text-[0.82rem] font-semibold text-fg">
              {label}
              <span className="num text-xs font-normal text-faint">{list.length} ท่า</span>
            </h3>
            <ul className="overflow-hidden rounded-2xl bg-surface">
              {list.map((e, i) => (
                <li key={e.id} className={i > 0 ? "shadow-[0_-1px_0_var(--line)]" : ""}>
                  <button
                    type="button"
                    onClick={() => onPick(e)}
                    className="group flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-raised cursor-pointer"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-medium">{e.name_th}</span>
                      <span className="block truncate text-xs text-faint">
                        {e.name_en} · {e.muscles.map(muscleLabel).join(", ")}
                      </span>
                    </span>
                    {mark3d && SLUGS_WITH_3D.has(e.slug) && <Badge3D />}
                    <ChevronRight
                      aria-hidden
                      size={18}
                      className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg"
                    />
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
        aria-label="ตัวกรอง"
        className="mx-auto mt-auto mb-0 max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-fg backdrop:bg-[#050506]/75 sm:m-auto sm:max-w-md sm:rounded-3xl"
        onClick={(e) => {
          if (e.target === sheet.current) sheet.current.close(); // tap outside closes
        }}
      >
        <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
        {GROUPS.map(({ group, label, options: list }) => {
          const opts = options(group, list);
          if (opts.length === 0) return null;
          return (
            <div key={group} className="mb-6">
              <p className="text-lg font-semibold">{label}</p>
              <p className="mb-3 text-sm text-muted">เลือกได้หลายอย่าง</p>
              <div className="flex flex-wrap gap-2">
                {opts.map(({ value, label: name, count, on }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={on}
                    disabled={!on && count === 0}
                    onClick={() => toggle(group, value)}
                    className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-[0.95rem] transition-colors disabled:opacity-30 cursor-pointer ${
                      on ? "bg-primary font-semibold text-primary-fg" : "bg-raised text-fg hover:bg-hover"
                    }`}
                  >
                    {name}
                    <span className={`num text-xs ${on ? "opacity-70" : "text-faint"}`}>{count}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button type="button" onClick={() => clear()} className={btnQuiet}>
            ล้าง
          </button>
          <button type="button" onClick={() => sheet.current?.close()} className={btnPrimary}>
            แสดง {shown.length} ท่า
          </button>
        </div>
      </dialog>
    </div>
  );
}
