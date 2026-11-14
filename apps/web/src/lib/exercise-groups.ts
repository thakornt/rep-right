// Display order and Thai labels shared by the exercise picker, the library
// and the home page.

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

export const muscleLabel = (m: string) => MUSCLES.find(([k]) => k === m)?.[1] ?? m;

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
  "back-squat",
  "incline-dumbbell-press",
  "seated-dumbbell-shoulder-press",
  "hammer-curl",
  "dumbbell-lateral-raise",
  "dumbbell-squat",
  "lat-pulldown",
  "rope-triceps-pushdown",
  "push-up",
  "overhead-dumbbell-triceps-extension",
  "crunch",
  "single-arm-dumbbell-row",
  "romanian-deadlift",
  "face-pull",
  "leg-extension",
]);

// Muscle groups by body region, for the home page.
export const REGIONS: [string, string[]][] = [
  ["ช่วงบน", ["chest", "back", "traps", "shoulders", "biceps", "triceps"]],
  ["แกนกลาง", ["abs", "lower_back"]],
  ["ช่วงล่าง", ["glutes", "quads", "hamstrings", "calves"]],
];
