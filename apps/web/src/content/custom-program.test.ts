import { describe, expect, it } from "vitest";

import { MUSCLES } from "../lib/exercise-groups";

import {
  DAY_KINDS,
  DAY_KIND_LABELS,
  customId,
  customProgram,
  dayFor,
  parseCustomId,
  programFromCustomId,
  type DayKind,
} from "./custom-program";
import { EXERCISE_MUSCLES, EXERCISE_NAMES, EXERCISE_NAMES_EN, backToBackMuscles, localizeProgram } from "./programs";

const PPL_UL: DayKind[] = ["push", "pull", "legs", "rest", "upper", "lower", "rest"];
const MUSCLE_KEYS = new Set(MUSCLES.map(([k]) => k));

describe("custom program id", () => {
  it("round-trips a week", () => {
    expect(customId(PPL_UL)).toBe("custom:push.pull.legs.rest.upper.lower.rest");
    expect(parseCustomId(customId(PPL_UL))).toEqual(PPL_UL);
  });

  it.each([
    "ppl-2",
    "custom:",
    "custom:push.pull.legs.rest.upper.lower",
    "custom:push.pull.legs.rest.upper.lower.rest.rest",
    "custom:push.pull.legs.rest.upper.lower.yoga",
    "custom:rest.rest.rest.rest.rest.rest.rest",
  ])("rejects %s", (id) => {
    expect(parseCustomId(id)).toBeNull();
    expect(programFromCustomId(id)).toBeNull();
  });
});

describe("custom program", () => {
  const p = customProgram(PPL_UL);

  it("has the planned week, Monday first, and counts its training days", () => {
    expect(p.week).toHaveLength(7);
    expect(p.daysPerWeek).toBe(5);
    expect(p.week.map((d) => (d.rest ? "rest" : d.title))).toEqual([
      "ดัน (อก ไหล่ หลังแขน)",
      "ดึง (หลัง หน้าแขน)",
      "ขา",
      "rest",
      "ช่วงบน",
      "ช่วงล่าง",
      "rest",
    ]);
  });

  it("is named in both languages, with English day titles", () => {
    expect(p.name).toBe("โปรแกรมของฉัน");
    const en = localizeProgram(p, "en");
    expect(en.name).toBe("My own program");
    expect(en.week.map((d) => (d.rest ? "rest" : d.title))).toEqual([
      "Push (chest, shoulders, triceps)",
      "Pull (back, biceps)",
      "Legs",
      "rest",
      "Upper body",
      "Lower body",
      "rest",
    ]);
  });

  it("lets the safety check spot the same group two days running", () => {
    // Chest on Monday, push (chest again) on Tuesday.
    const week: DayKind[] = ["chest", "push", "rest", "rest", "rest", "rest", "rest"];
    expect(backToBackMuscles(customProgram(week).week).map(([i]) => i)).toContain(0);
  });
});

describe.each(DAY_KINDS.filter((k) => k !== "rest"))("day kind %s", (kind) => {
  const day = dayFor(kind);

  it("names its muscle groups with real keys", () => {
    if (day.rest) throw new Error("expected a training day");
    for (const m of [...day.focus, ...day.helpers]) expect(MUSCLE_KEYS.has(m)).toBe(true);
  });

  it("shows example exercises that train its groups and have names in both languages", () => {
    if (day.rest) throw new Error("expected a training day");
    expect(day.exercises.length).toBeGreaterThan(0);
    for (const slug of day.exercises) {
      expect(EXERCISE_NAMES[slug]).toBeTruthy();
      expect(EXERCISE_NAMES_EN[slug]).toBeTruthy();
      const groups = [...day.focus, ...day.helpers];
      expect(EXERCISE_MUSCLES[slug].some((m) => groups.includes(m))).toBe(true);
    }
  });

  it("has a label in both languages", () => {
    expect(DAY_KIND_LABELS.th[kind]).toBeTruthy();
    expect(DAY_KIND_LABELS.en[kind]).toBeTruthy();
  });
});
