// Incline dumbbell press: which muscles work. General guidance, not EMG data.

import type { Activation } from "./squat";

export const PRESS_PINS = ["feet", "back", "elbow", "dumbbell", "core"] as const;
export type PressPin = (typeof PRESS_PINS)[number];

export type PressExercise = "incline" | "shoulder";

// Depth 0 = arms up, 1 = dumbbells down.
export function pressActivation(exercise: PressExercise, depth: number, phase: "down" | "up"): Activation[] {
  const effort = phase === "up" ? 1 : 0.8;
  if (exercise === "shoulder") {
    return [
      { region: "delts", role: "prime", amount: (0.5 + 0.5 * depth) * effort },
      { region: "triceps", role: "synergist", amount: (0.8 - 0.3 * depth) * effort },
      { region: "upper_back", role: "synergist", amount: (0.7 - 0.2 * depth) * effort }, // rotating the shoulder blades up
      { region: "forearms", role: "stabilizer", amount: 0.45 },
      { region: "biceps", role: "stabilizer", amount: 0.25 },
      { region: "abs", role: "stabilizer", amount: 0.5 },
      { region: "obliques", role: "stabilizer", amount: 0.35 },
      { region: "erectors", role: "stabilizer", amount: 0.35 },
    ];
  }
  // The chest works hardest stretched at the bottom and while pressing up.
  return [
    { region: "chest", role: "prime", amount: (0.4 + 0.6 * depth) * effort },
    { region: "delts", role: "synergist", amount: (0.35 + 0.45 * depth) * effort },
    { region: "triceps", role: "synergist", amount: (0.75 - 0.25 * depth) * effort },
    { region: "forearms", role: "stabilizer", amount: 0.45 },
    { region: "biceps", role: "stabilizer", amount: 0.25 },
    { region: "upper_back", role: "stabilizer", amount: 0.75 }, // holding the shoulder blades back
    { region: "lats", role: "stabilizer", amount: 0.3 },
    { region: "abs", role: "stabilizer", amount: 0.35 },
  ];
}

export const PRESS_CONTENT: Record<
  PressExercise,
  { cues: Record<PressPin, string>; top: string; bottom: string; notice: string[] }
> = {
  incline: {
    cues: {
      feet: "เท้าทั้งฝ่าวางบนพื้นให้มั่นคง ลำตัวไม่ขยับระหว่างยก",
      back: "หัว หลังบน และก้นแนบเบาะ บีบสะบักเข้าหากัน ยกอกขึ้นเล็กน้อย ค้างไว้ตลอดทั้งเซ็ต หลังกลางกับหลังล่างมีช่องว่างตามธรรมชาติได้",
      elbow: "กางศอกออกจากลำตัว ตอนลงให้ดัมเบลอยู่ข้างอกแถวแนวราวนม เกือบถึงระดับอก เท่าที่ไหล่ยังสบาย",
      dumbbell: "บิดฝ่ามือเข้าหาลำตัวเล็กน้อย ข้อมือตรง ดันขึ้นเป็นเส้นตรงเฉียงไปเหนืออกส่วนบน ไม่ต้องให้ดัมเบลชนกัน",
      core: "เกร็งท้องเบา ๆ ไม่แอ่นหลังล่างเพื่อช่วยดัน",
    },
    top: "ดันขึ้นสุด",
    bottom: "ลดลงสุด",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน มุมศอกและระยะที่ลดลงจึงต่างกันได้ ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ลดลงเท่าที่ไหล่ยังสบายและสะบักยังแนบพนัก ตรงนั้นคือระยะที่เหมาะกับคุณตอนนี้",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่ไหล่ ศอก หรือข้อมือ ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
  },
  shoulder: {
    cues: {
      feet: "เท้าทั้งฝ่าวางบนพื้นให้มั่นคง ไม่ดันตัวขึ้นจากเบาะเพื่อช่วยยก",
      back: "หลังบนกับก้นแนบเบาะ มองตรงไปข้างหน้า หลังล่างมีช่องว่างตามธรรมชาติได้ แต่ไม่แอ่นเพิ่มตอนดัน",
      elbow: "ตอนลง หุบศอกมาข้างหน้าเล็กน้อย ไม่กางตรงออกข้าง ปลายแขนตั้งตรงเหนือศอก ลดดัมเบลลงเหนือไหล่ด้านหน้า เท่าที่ไหล่ยังสบาย",
      dumbbell: "บิดฝ่ามือเข้าหาลำตัวเล็กน้อย ข้อมือตรง ดันขึ้นเป็นเส้นตรงจนแขนเกือบตรงเหนือหัว ไม่ต้องให้ดัมเบลชนกัน",
      core: "เกร็งท้องให้แน่น ซี่โครงไม่บานออก ช่วยไม่ให้หลังล่างแอ่น",
    },
    top: "ดันขึ้นสุด",
    bottom: "ลดลงสุด",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ความกว้างศอกและระยะที่ลดลงจึงต่างกันได้ ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ลดลงเท่าที่ไหล่ยังสบาย และดันขึ้นโดยหลังไม่แอ่น ตรงนั้นคือระยะที่เหมาะกับคุณตอนนี้",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่ไหล่ ศอก หรือคอ ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
  },
};
