import { describe, expect, it } from "vitest";

import type { Exercise } from "./api";
import { countWith, matchesFilter, type ExerciseFilter } from "./exercise-filter";

const ex = (slug: string, muscles: string[], equipment: string[]): Exercise => ({
  id: slug.length,
  slug,
  name_th: slug,
  name_en: slug.replace(/-/g, " "),
  category: "push",
  is_lower_body: false,
  muscles,
  equipment,
});

const bench = ex("bench-press", ["chest", "triceps"], ["barbell"]);
const incline = ex("incline-dumbbell-press", ["chest", "shoulders"], ["dumbbell"]);
const pushUp = ex("push-up", ["chest", "triceps"], ["bodyweight"]);
const shrug = ex("shrug", ["traps"], ["barbell", "dumbbell"]);
const all = [bench, incline, pushUp, shrug];

const filter = (f: Partial<{ query: string; muscles: string[]; equipment: string[] }>): ExerciseFilter => ({
  query: f.query ?? "",
  muscles: new Set(f.muscles ?? []),
  equipment: new Set(f.equipment ?? []),
});

const slugs = (f: ExerciseFilter) => all.filter((e) => matchesFilter(e, f)).map((e) => e.slug);

describe("matchesFilter", () => {
  it("keeps everything with no filter", () => {
    expect(slugs(filter({}))).toEqual(["bench-press", "incline-dumbbell-press", "push-up", "shrug"]);
  });

  it("lists only what can be done with dumbbells", () => {
    expect(slugs(filter({ equipment: ["dumbbell"] }))).toEqual(["incline-dumbbell-press", "shrug"]);
  });

  it("matches any picked equipment", () => {
    expect(slugs(filter({ equipment: ["dumbbell", "bodyweight"] }))).toEqual(["incline-dumbbell-press", "push-up", "shrug"]);
  });

  it("narrows by muscle and equipment together", () => {
    expect(slugs(filter({ muscles: ["chest"], equipment: ["dumbbell"] }))).toEqual(["incline-dumbbell-press"]);
  });

  it("finds none for equipment no exercise uses", () => {
    expect(slugs(filter({ equipment: ["band"] }))).toEqual([]);
  });

  it("still searches by name inside the filter", () => {
    expect(slugs(filter({ query: "Push Up", equipment: ["bodyweight"] }))).toEqual(["push-up"]);
  });
});

describe("countWith", () => {
  it("counts a muscle within the picked equipment", () => {
    expect(countWith(all, filter({ equipment: ["dumbbell"] }), "muscles", "chest")).toBe(1);
  });

  it("counts equipment within the picked muscles, ignoring the search box", () => {
    expect(countWith(all, filter({ query: "zzz", muscles: ["chest"] }), "equipment", "barbell")).toBe(1);
  });
});
