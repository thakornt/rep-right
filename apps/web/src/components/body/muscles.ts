// Surface muscle regions painted into public/models/muscles.png, one id per
// pixel. Ids must match MUSCLES in tools/body/build.py.

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
  chest_mid: 11,
  delt_front: 12,
  biceps: 13,
  triceps: 14,
  forearms: 15,
  chest_upper: 16,
  chest_lower: 17,
  delt_side: 18,
  delt_rear: 19,
  teres: 20,
} as const;

export type Region = keyof typeof REGION_IDS;
// The teres is painted over two muscles, so a lift that doesn't call on it still shows
// each pixel as the muscle it replaced: id 20 follows upper_back, this id follows lats.
export const TERES_OVER_LATS = 21;
export const REGION_COUNT = 22;

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
  chest_upper: "อกส่วนบน",
  chest_mid: "อกส่วนกลาง",
  chest_lower: "อกส่วนล่าง",
  delt_front: "ไหล่หน้า",
  delt_side: "ไหล่กลาง",
  delt_rear: "ไหล่หลัง",
  teres: "หลังใต้รักแร้ (เทอเรส)",
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
  synergist: "#facc15",
  stabilizer: "#22d3ee",
  warn: "#ef4444",
};

// Muscles holding still stay in the background of the ones doing the lift.
export const ROLE_STRENGTH: Record<Role, number> = {
  prime: 1,
  synergist: 1,
  stabilizer: 0.55,
};
