import type { Exercise } from "./api";

export type ExerciseFilter = {
  query: string;
  /** Any of these primary muscles; empty = every muscle. */
  muscles: ReadonlySet<string>;
  /** Done with any of these; empty = any equipment. */
  equipment: ReadonlySet<string>;
};

const normalize = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "");

const anyOf = (picked: ReadonlySet<string>, has: string[]) => picked.size === 0 || has.some((x) => picked.has(x));

/** Muscles and equipment narrow each other; within one group any pick matches. */
export function matchesFilter(e: Exercise, f: ExerciseFilter): boolean {
  if (!anyOf(f.muscles, e.muscles) || !anyOf(f.equipment, e.equipment)) return false;
  const q = normalize(f.query);
  return q === "" || [e.name_th, e.name_en, e.slug].some((n) => normalize(n).includes(q));
}

/**
 * How many exercises a chip would show if picked, given the other group's picks, so a
 * count never promises exercises the current filter hides (dumbbell picked: chest shows
 * only the dumbbell chest exercises).
 */
export function countWith(
  exercises: Exercise[],
  f: ExerciseFilter,
  group: "muscles" | "equipment",
  value: string,
): number {
  const only = { ...f, query: "", [group]: new Set([value]) };
  return exercises.filter((e) => matchesFilter(e, only)).length;
}
