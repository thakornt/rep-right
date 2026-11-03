// Surface muscle regions painted onto public/models/body.glb (vertex attribute
// _muscle). Ids must match MUSCLES in tools/body/build.py.

export const REGION_IDS = {
  quads: 1,
  hamstrings: 2,
  adductors: 3,
  glutes: 4,
  calves: 5,
  abs: 6,
  obliques: 7,
  erectors: 8,
  lats: 9,
  upper_back: 10,
  chest: 11,
  delts: 12,
  biceps: 13,
  triceps: 14,
  forearms: 15,
} as const;

export type Region = keyof typeof REGION_IDS;
export const REGION_COUNT = 16;

export const REGION_LABELS: Record<Region, string> = {
  quads: "ต้นขาหน้า",
  hamstrings: "ต้นขาหลัง",
  adductors: "ต้นขาด้านใน",
  glutes: "ก้น",
  calves: "น่อง",
  abs: "หน้าท้อง",
  obliques: "ท้องด้านข้าง",
  erectors: "กล้ามเนื้อข้างกระดูกสันหลัง",
  lats: "ปีก (หลังด้านข้าง)",
  upper_back: "หลังบนและบ่า",
  chest: "อก",
  delts: "ไหล่",
  biceps: "หน้าแขน",
  triceps: "หลังแขน",
  forearms: "แขนท่อนล่าง",
};

// How a muscle takes part in a lift. Every muscle that matters is shown; the
// role only decides how it is coloured.
export type Role = "prime" | "synergist" | "stabilizer";

export const ROLE_LABELS: Record<Role, { name: string; hint: string }> = {
  prime: { name: "กล้ามหลัก", hint: "ออกแรงยกเป็นหลัก" },
  synergist: { name: "กล้ามช่วย", hint: "ช่วยกล้ามหลักออกแรง" },
  stabilizer: { name: "กล้ามทรงตัว", hint: "เกร็งค้างไว้ให้ลำตัวและข้อต่อนิ่ง" },
};

// Shared by the body shader and the legend swatches.
export const ROLE_COLORS: Record<Role | "warn", string> = {
  prime: "#f97316",
  synergist: "#fdba74",
  stabilizer: "#22d3ee",
  warn: "#ef4444",
};
