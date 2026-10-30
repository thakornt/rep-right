// Display order and Thai labels shared by the exercise picker, the library
// and the home page.

export const CATEGORIES: [string, string][] = [
  ["squat", "สควอท"],
  ["hinge", "เดดลิฟต์ / สะโพก"],
  ["push", "ดัน (อก / ไหล่)"],
  ["pull", "ดึง (หลัง)"],
  ["shoulders", "ไหล่"],
  ["arms", "แขน"],
  ["legs", "ขา"],
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
