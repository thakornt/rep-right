// Display order and labels shared by the exercise picker, the library and the
// home page. The lists hold the Thai labels; EN holds the English ones by key.

import type { Locale } from "./i18n/locale";

export const CATEGORIES: [string, string][] = [
  ["legs", "ขา"],
  ["hinge", "เดดลิฟต์ / สะโพก"],
  ["push", "ดัน (อก / ไหล่)"],
  ["pull", "ดึง (หลัง)"],
  ["shoulders", "ไหล่"],
  ["arms", "แขน"],
  ["core", "หน้าท้อง"],
];

// Primary muscle groups, in body order; keys match exercises.muscles in the API.
export const MUSCLES: [string, string][] = [
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

export const muscleLabel = (m: string, locale: Locale) =>
  (locale === "en" ? MUSCLES_EN[m] : MUSCLES.find(([k]) => k === m)?.[1]) ?? m;

// What loads the exercise; keys match exercises.equipment in the API (migration 00011).
// Ones no exercise uses yet (the band) stay out of the picker until one does.
export const EQUIPMENT: [string, string][] = [
  ["dumbbell", "ดัมเบล"],
  ["barbell", "บาร์เบล"],
  ["bodyweight", "น้ำหนักตัว"],
  ["band", "ยางยืด"],
  ["cable", "สายเคเบิล"],
  ["machine", "เครื่อง"],
];

// Exercises with a 3D viewer; keep in step with exercises/[slug]/exercise-detail.tsx.
export const SLUGS_WITH_3D = new Set([
  "barbell-squat",
  "incline-dumbbell-press",
  "overhead-press",
  "hammer-curl",
  "dumbbell-lateral-raise",
  "dumbbell-squat",
  "lat-pulldown",
  "rope-triceps-pushdown",
  "push-up",
  "overhead-triceps-extension",
  "crunch",
  "single-arm-dumbbell-row",
  "romanian-deadlift",
  "face-pull",
  "leg-extension",
  "pull-up",
  "upright-row",
  "hip-thrust",
  "shrug",
]);

// Muscle groups by body region, for the home page.
export const REGIONS: [string, string[]][] = [
  ["ช่วงบน", ["chest", "back", "traps", "shoulders", "biceps", "triceps"]],
  ["แกนกลาง", ["abs", "lower_back"]],
  ["ช่วงล่าง", ["glutes", "quads", "hamstrings", "calves"]],
];

// --- English labels, by key -------------------------------------------------

const CATEGORIES_EN: Record<string, string> = {
  legs: "Legs",
  hinge: "Deadlifts / hips",
  push: "Push (chest / shoulders)",
  pull: "Pull (back)",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Abs",
};

const MUSCLES_EN: Record<string, string> = {
  chest: "Chest",
  back: "Back",
  traps: "Traps",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  abs: "Abs",
  lower_back: "Lower back",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
};

const EQUIPMENT_EN: Record<string, string> = {
  dumbbell: "Dumbbell",
  barbell: "Barbell",
  bodyweight: "Bodyweight",
  band: "Resistance band",
  cable: "Cable",
  machine: "Machine",
};

const REGIONS_EN: Record<string, string> = {
  ช่วงบน: "Upper body",
  แกนกลาง: "Core",
  ช่วงล่าง: "Lower body",
};

const EN_BY_LIST = new Map<[string, string][], Record<string, string>>([
  [CATEGORIES, CATEGORIES_EN],
  [MUSCLES, MUSCLES_EN],
  [EQUIPMENT, EQUIPMENT_EN],
]);

/** One of the lists above with its labels in the given language, same order. */
export function localized(list: [string, string][], locale: Locale): [string, string][] {
  const en = EN_BY_LIST.get(list);
  return locale === "en" && en ? list.map(([k, th]) => [k, en[k] ?? th]) : list;
}

export const regionLabel = (thai: string, locale: Locale) => (locale === "en" ? (REGIONS_EN[thai] ?? thai) : thai);

/** An exercise's name in the given language: the API sends both. */
export const exerciseName = (e: { name_th: string; name_en: string }, locale: Locale) =>
  locale === "en" ? e.name_en : e.name_th;
