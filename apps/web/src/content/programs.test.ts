import { describe, expect, it } from "vitest";

import { MUSCLES, SLUGS_WITH_3D } from "../lib/exercise-groups";

import {
  DAY_CHOICES,
  EXERCISE_MUSCLES,
  EXERCISE_NAMES,
  PROGRAMS,
  backToBackMuscles,
  exercisesHref,
  planFor,
  weekdayIndex,
  musclesWorked,
  programsFor,
  type Day,
  type Muscle,
} from "./programs";

const MUSCLE_KEYS = new Set(MUSCLES.map(([k]) => k));

describe.each(PROGRAMS)("program $id", (p) => {
  it("covers a full week, Monday to Sunday", () => {
    expect(p.week).toHaveLength(7);
  });

  it("trains on as many days as it says", () => {
    expect(p.week.filter((d) => !d.rest)).toHaveLength(p.daysPerWeek);
  });

  it("has at least one rest day", () => {
    expect(p.week.some((d) => d.rest)).toBe(true);
  });

  it("never works the same muscle group two days in a row, Sunday to Monday included", () => {
    expect(backToBackMuscles(p.week)).toEqual([]);
  });

  it("uses only known muscle groups", () => {
    for (const day of p.week) for (const m of musclesWorked(day)) expect(MUSCLE_KEYS).toContain(m);
  });

  it("only suggests exercises for groups that day trains, each with a 3D page and a Thai name", () => {
    for (const day of p.week) {
      if (day.rest) continue;
      expect(day.exercises.length).toBeGreaterThan(0);
      const worked = musclesWorked(day);
      for (const slug of day.exercises) {
        expect(SLUGS_WITH_3D).toContain(slug);
        expect(EXERCISE_NAMES[slug]).toBeTruthy();
        for (const m of EXERCISE_MUSCLES[slug]) expect(worked).toContain(m);
      }
    }
  });
});

describe("day picker", () => {
  it("offers no 7-day option, so there is always a rest day", () => {
    expect(DAY_CHOICES).not.toContain(7);
  });

  it("has a program for every choice", () => {
    for (const d of DAY_CHOICES) expect(programsFor(d).length).toBeGreaterThan(0);
  });
});

describe("backToBackMuscles", () => {
  const day = (focus: Muscle[]): Day => ({
    title: "x",
    focus,
    helpers: [],
    exercises: [],
  });
  const rest: Day = { rest: true };

  it("flags the same group on consecutive days", () => {
    expect(backToBackMuscles([day(["chest"]), day(["chest"]), rest, rest, rest, rest, rest])).toEqual([[0, "chest"]]);
  });

  it("flags Sunday followed by Monday, because the week repeats", () => {
    expect(backToBackMuscles([day(["back"]), rest, rest, rest, rest, rest, day(["back"])])).toEqual([[6, "back"]]);
  });

  it("allows different groups on consecutive days", () => {
    expect(backToBackMuscles([day(["chest"]), day(["back"]), rest, rest, rest, rest, rest])).toEqual([]);
  });
});

describe("planFor", () => {
  const ppl = PROGRAMS.find((p) => p.id === "ppl-2")!;

  it("maps Monday to the first day of the week", () => {
    // 2026-11-09 is a Monday.
    expect(weekdayIndex(new Date(2026, 10, 9))).toBe(0);
    expect(planFor(ppl, new Date(2026, 10, 9)).weekday).toBe("จันทร์");
  });

  it("maps Sunday to the last day, a rest day in every program", () => {
    expect(weekdayIndex(new Date(2026, 10, 15))).toBe(6);
    for (const p of PROGRAMS) expect(planFor(p, new Date(2026, 10, 15)).day.rest).toBe(true);
  });

  it("links a training day to the exercise library filtered by its main groups", () => {
    const { day } = planFor(ppl, new Date(2026, 10, 10)); // Tuesday: pull
    expect(day.rest).toBeFalsy();
    if (!day.rest) expect(exercisesHref(day)).toBe("/exercises?muscle=back&muscle=biceps");
  });
});
