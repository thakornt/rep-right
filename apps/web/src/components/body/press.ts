// Dumbbell lifts: which muscles work. General guidance, not EMG data.

import type { Activation } from "./squat";

export const PRESS_PINS = ["feet", "back", "elbow", "dumbbell", "core"] as const;
export type PressPin = (typeof PRESS_PINS)[number];

export type PressExercise = "incline" | "shoulder" | "hammer" | "raise";

// Depth 0 = dumbbells up, 1 = dumbbells down.
export function pressActivation(exercise: PressExercise, depth: number, phase: "down" | "up"): Activation[] {
  const effort = phase === "up" ? 1 : 0.8;
  if (exercise === "raise") {
    // Hardest at the top, with the arm level and the weight furthest out from the shoulder.
    const load = Math.sin(((1 - depth) * Math.PI) / 2);
    return [
      { region: "delt_side", role: "prime", amount: (0.4 + 0.6 * load) * effort },
      { region: "delt_front", role: "synergist", amount: (0.25 + 0.4 * load) * effort },
      { region: "upper_back", role: "synergist", amount: (0.25 + 0.45 * load) * effort }, // rotating the shoulder blades up
      { region: "delt_rear", role: "stabilizer", amount: 0.3 },
      { region: "forearms", role: "stabilizer", amount: 0.4 },
      { region: "abs", role: "stabilizer", amount: 0.35 },
      { region: "erectors", role: "stabilizer", amount: 0.5 }, // holding the lean
      { region: "glutes", role: "stabilizer", amount: 0.3 },
      { region: "hamstrings", role: "stabilizer", amount: 0.3 },
    ];
  }
  if (exercise === "hammer") {
    // Hardest with the forearm level, when the weight pulls straight across it.
    const hold = Math.sin(Math.PI * Math.min(1, depth * 1.1));
    return [
      { region: "biceps", role: "prime", amount: (0.5 + 0.5 * hold) * effort },
      { region: "forearms", role: "prime", amount: (0.5 + 0.4 * hold) * effort }, // the thumb-side forearm works hardest with the palm facing in
      { region: "delt_front", role: "stabilizer", amount: 0.3 },
      { region: "upper_back", role: "stabilizer", amount: 0.35 },
      { region: "abs", role: "stabilizer", amount: 0.35 },
      { region: "erectors", role: "stabilizer", amount: 0.35 },
    ];
  }
  if (exercise === "shoulder") {
    return [
      { region: "delt_front", role: "prime", amount: (0.55 + 0.45 * depth) * effort },
      { region: "delt_side", role: "prime", amount: (0.5 + 0.4 * depth) * effort },
      { region: "triceps", role: "synergist", amount: (0.8 - 0.3 * depth) * effort },
      { region: "chest_upper", role: "synergist", amount: (0.25 + 0.5 * depth) * effort }, // elbows forward, bench reclined
      { region: "upper_back", role: "synergist", amount: (0.7 - 0.2 * depth) * effort }, // rotating the shoulder blades up
      { region: "forearms", role: "stabilizer", amount: 0.45 },
      { region: "biceps", role: "stabilizer", amount: 0.25 },
      { region: "delt_rear", role: "stabilizer", amount: 0.3 },
      { region: "abs", role: "stabilizer", amount: 0.5 },
      { region: "obliques", role: "stabilizer", amount: 0.35 },
      { region: "erectors", role: "stabilizer", amount: 0.35 },
    ];
  }
  // The chest works hardest stretched at the bottom and while pressing up.
  return [
    { region: "chest_upper", role: "prime", amount: (0.45 + 0.55 * depth) * effort },
    { region: "chest_mid", role: "prime", amount: (0.3 + 0.5 * depth) * effort },
    { region: "chest_lower", role: "synergist", amount: (0.2 + 0.3 * depth) * effort },
    { region: "delt_front", role: "synergist", amount: (0.35 + 0.45 * depth) * effort },
    { region: "triceps", role: "synergist", amount: (0.75 - 0.25 * depth) * effort },
    { region: "forearms", role: "stabilizer", amount: 0.45 },
    { region: "biceps", role: "stabilizer", amount: 0.25 },
    { region: "delt_side", role: "stabilizer", amount: 0.3 },
    { region: "delt_rear", role: "stabilizer", amount: 0.3 },
    { region: "upper_back", role: "stabilizer", amount: 0.75 }, // holding the shoulder blades back
    { region: "lats", role: "stabilizer", amount: 0.3 },
    { region: "abs", role: "stabilizer", amount: 0.35 },
  ];
}

export const PRESS_CONTENT: Record<
  PressExercise,
  { cues: Record<PressPin, string>; top: string; bottom: string; rising: string; notice: string[] }
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
    rising: "กำลังดันขึ้น",
    bottom: "ลดลงสุด",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน มุมศอกและระยะที่ลดลงจึงต่างกันได้ ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ลดลงเท่าที่ไหล่ยังสบายและสะบักยังแนบพนัก ตรงนั้นคือระยะที่เหมาะกับคุณตอนนี้",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่ไหล่ ศอก หรือข้อมือ ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
  },
  hammer: {
    cues: {
      feet: "ยืนเท้ากว้างประมาณช่วงสะโพก น้ำหนักลงเต็มเท้า ตัวไม่โยกเพื่อช่วยยก",
      back: "ยืนตัวตรง ไหล่ลงไม่ห่อ ไม่เอนตัวไปข้างหลังตอนยก",
      elbow: "ศอกอยู่ข้างลำตัวเป็นจุดหมุน ขยับไปข้างหน้าได้นิดเดียวตอนใกล้ยกสุด ลดลงจนแขนเกือบตรงแต่ไม่ล็อกศอก",
      dumbbell: "ฝ่ามือหันเข้าหาลำตัวตลอดทาง ไม่บิดมือ ข้อมือตรง ยกจนดัมเบลเข้าใกล้ไหล่ ไม่ต้องให้แตะ",
      core: "เกร็งท้องเบา ๆ ให้ลำตัวนิ่ง ถ้าต้องเหวี่ยงตัวช่วย แปลว่าน้ำหนักอาจมากไป",
    },
    top: "ยกขึ้นสุด",
    bottom: "ลดลงสุด",
    rising: "กำลังยกขึ้น",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ศอกงอได้ไม่เท่ากัน ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ยกเท่าที่ศอกยังอยู่ข้างลำตัวและข้อมือยังตรง ตรงนั้นคือระยะที่เหมาะกับคุณตอนนี้",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่ศอก ข้อมือ หรือไหล่ ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
  },
  raise: {
    cues: {
      feet: "ยืนเท้ากว้างประมาณช่วงสะโพก ย่อเข่าเล็กน้อย น้ำหนักลงเต็มเท้า ตัวไม่โยกเพื่อช่วยยก",
      back: "ถอยก้นไปข้างหลังแล้วโน้มลำตัวมาข้างหน้าเล็กน้อย หลังตรง ไหล่ลงไม่ยักขึ้นหาหู ค้างท่านี้ไว้ตลอดเซ็ต",
      elbow: "งอศอกเล็กน้อยและคงมุมนี้ไว้ ให้ศอกขึ้นนำปลายแขน ยกออกข้างเยื้องมาทางหน้าเล็กน้อย จนศอกสูงประมาณระดับไหล่",
      dumbbell: "มืออยู่ต่ำกว่าศอกเล็กน้อยตลอดทาง ฝ่ามือหันลงพื้นตอนอยู่ด้านบน ข้อมือตรง",
      core: "เกร็งท้องเบา ๆ ให้ลำตัวนิ่งในท่าโน้ม ถ้าต้องเหวี่ยงตัวช่วย แปลว่าน้ำหนักอาจมากไป",
    },
    top: "ยกขึ้นสุด",
    bottom: "ลดลงสุด",
    rising: "กำลังยกขึ้น",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ระยะที่ยกได้สบายจึงต่างกันได้ ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ยกเท่าที่ไหล่ยังไม่ยักขึ้น ศอกยังนำมือ และตัวยังนิ่ง ตรงนั้นคือระยะที่เหมาะกับคุณตอนนี้",
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
    rising: "กำลังดันขึ้น",
    bottom: "ลดลงสุด",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ความกว้างศอกและระยะที่ลดลงจึงต่างกันได้ ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ลดลงเท่าที่ไหล่ยังสบาย และดันขึ้นโดยหลังไม่แอ่น ตรงนั้นคือระยะที่เหมาะกับคุณตอนนี้",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่ไหล่ ศอก หรือคอ ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
  },
};
