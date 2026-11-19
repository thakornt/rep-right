// A week the user plans themself on /programs/custom: one kind of session (or rest)
// per weekday. It is stored like a ready-made program, as one id string:
// "custom:" + the 7 day kinds, Monday first, joined by "." — e.g.
// "custom:push.pull.legs.rest.upper.lower.rest". The API checks the same format
// (apps/api/internal/domain/program), so no new storage is needed.

import type { Locale } from "../lib/i18n/locale";
import { FULL_BODY, PULL, PUSH, UPPER, type Day, type Program, type TrainingDay } from "./programs";

export const CUSTOM_PREFIX = "custom:";

// Day kinds the planner offers, in the order of the select box.
// Keep in step with CustomDayKinds in apps/api/internal/domain/program (a Go test checks).
export const DAY_KINDS = [
  "full_body",
  "upper",
  "lower",
  "push",
  "pull",
  "legs",
  "chest",
  "back",
  "shoulders",
  "arms",
  "core",
  "rest",
] as const;

export type DayKind = (typeof DAY_KINDS)[number];

const LOWER_BODY: TrainingDay = {
  title: "ช่วงล่าง",
  focus: ["quads", "glutes", "hamstrings", "calves"],
  helpers: ["lower_back"],
  exercises: ["barbell-squat", "romanian-deadlift", "dumbbell-squat"],
};

// Each kind's session: the muscle groups it is built around, the ones that help,
// and example exercises, so the week table and today's card show the right moves.
const SESSIONS: Record<Exclude<DayKind, "rest">, TrainingDay> = {
  full_body: FULL_BODY,
  upper: UPPER,
  lower: LOWER_BODY,
  push: PUSH,
  pull: PULL,
  legs: { ...LOWER_BODY, title: "ขา" },
  chest: {
    title: "อก",
    focus: ["chest"],
    helpers: ["shoulders", "triceps"],
    exercises: ["incline-dumbbell-press", "push-up"],
  },
  back: {
    title: "หลัง",
    focus: ["back"],
    helpers: ["biceps", "traps"],
    exercises: ["lat-pulldown", "single-arm-dumbbell-row"],
  },
  shoulders: {
    title: "ไหล่",
    focus: ["shoulders", "traps"],
    helpers: ["triceps"],
    exercises: ["overhead-press", "dumbbell-lateral-raise"],
  },
  arms: {
    title: "แขน",
    focus: ["biceps", "triceps"],
    helpers: [],
    exercises: ["hammer-curl", "rope-triceps-pushdown", "overhead-triceps-extension"],
  },
  core: {
    title: "หน้าท้อง",
    focus: ["abs"],
    helpers: ["lower_back"],
    exercises: ["crunch"],
  },
};

/** What the select box says for each kind. */
export const DAY_KIND_LABELS: Record<Locale, Record<DayKind, string>> = {
  th: {
    full_body: "ทั้งตัว",
    upper: "ช่วงบน",
    lower: "ช่วงล่าง",
    push: "ดัน (อก ไหล่ หลังแขน)",
    pull: "ดึง (หลัง หน้าแขน)",
    legs: "ขา",
    chest: "อก",
    back: "หลัง",
    shoulders: "ไหล่",
    arms: "แขน",
    core: "หน้าท้อง",
    rest: "พัก",
  },
  en: {
    full_body: "Full body",
    upper: "Upper body",
    lower: "Lower body",
    push: "Push (chest, shoulders, triceps)",
    pull: "Pull (back, biceps)",
    legs: "Legs",
    chest: "Chest",
    back: "Back",
    shoulders: "Shoulders",
    arms: "Arms",
    core: "Core (abs)",
    rest: "Rest",
  },
};

const isKind = (k: string): k is DayKind => (DAY_KINDS as readonly string[]).includes(k);

/** The stored id for a week of day kinds, Monday first. */
export function customId(kinds: DayKind[]): string {
  return CUSTOM_PREFIX + kinds.join(".");
}

/** The 7 day kinds in a custom id, or null if the id is not a valid custom week. */
export function parseCustomId(id: string): DayKind[] | null {
  if (!id.startsWith(CUSTOM_PREFIX)) return null;
  const kinds = id.slice(CUSTOM_PREFIX.length).split(".");
  if (kinds.length !== 7 || !kinds.every(isKind)) return null;
  // A week of only rest is not a program (the API refuses it too).
  if (kinds.every((k) => k === "rest")) return null;
  return kinds as DayKind[];
}

export const isCustomProgram = (p: Pick<Program, "id">) => p.id.startsWith(CUSTOM_PREFIX);

/** The day a kind stands for: rest, or that kind's session. */
export function dayFor(kind: DayKind): Day {
  return kind === "rest" ? { rest: true } : SESSIONS[kind];
}

/** A program built from a planned week, so every page can show it like a ready-made one. */
export function customProgram(kinds: DayKind[]): Program {
  const week = kinds.map(dayFor);
  return {
    id: customId(kinds),
    name: "โปรแกรมของฉัน",
    alias: "Custom",
    daysPerWeek: week.filter((d) => !d.rest).length,
    week,
    why: "",
    setsPerSession: "",
    timesPerWeek: "",
  };
}

/** The program a stored custom id stands for, or null if it is not one. */
export function programFromCustomId(id: string): Program | null {
  const kinds = parseCustomId(id);
  return kinds && customProgram(kinds);
}
