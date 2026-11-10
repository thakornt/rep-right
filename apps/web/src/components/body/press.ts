// Dumbbell lifts: which muscles work. General guidance, not EMG data.

import type { Activation } from "./squat";

export const PRESS_PINS = ["feet", "back", "elbow", "dumbbell", "core"] as const;
export type PressPin = (typeof PRESS_PINS)[number];

export type PressExercise = "incline" | "shoulder" | "hammer" | "raise" | "squat" | "pulldown" | "pushdown" | "pushup" | "overheadOne" | "overheadTwo";

// Depth 0 = dumbbells up, 1 = dumbbells down.
export function pressActivation(exercise: PressExercise, depth: number, phase: "down" | "up"): Activation[] {
  const effort = phase === "up" ? 1 : 0.8;
  if (exercise === "overheadOne" || exercise === "overheadTwo") {
    // The back of the arm straightens the elbow against the weight, its long head stretched most
    // with the dumbbell low behind the head; the shoulder holds the arm up meanwhile.
    return [
      { region: "triceps", role: "prime", amount: (0.6 + 0.4 * depth) * effort },
      { region: "delt_front", role: "stabilizer", amount: 0.35 }, // holding the upper arm up
      { region: "delt_side", role: "stabilizer", amount: 0.3 },
      { region: "upper_back", role: "stabilizer", amount: 0.4 }, // the shoulder blade turned up under the arm
      { region: "forearms", role: "stabilizer", amount: exercise === "overheadOne" ? 0.4 : 0.3 },
      { region: "abs", role: "stabilizer", amount: 0.45 }, // keeping the ribs down, the lower back from arching
      { region: "obliques", role: "stabilizer", amount: exercise === "overheadOne" ? 0.4 : 0.3 }, // one arm loaded pulls the trunk to one side
    ];
  }
  if (exercise === "pushup") {
    // The chest and the back of the arm press the body up, hardest near the bottom; the trunk and
    // legs hold the body in one straight line throughout.
    return [
      { region: "chest_mid", role: "prime", amount: (0.4 + 0.6 * depth) * effort },
      { region: "chest_lower", role: "prime", amount: (0.35 + 0.55 * depth) * effort },
      { region: "chest_upper", role: "synergist", amount: (0.3 + 0.4 * depth) * effort },
      { region: "triceps", role: "prime", amount: (0.75 - 0.15 * depth) * effort },
      { region: "delt_front", role: "synergist", amount: (0.35 + 0.45 * depth) * effort },
      { region: "abs", role: "stabilizer", amount: 0.6 }, // holding the hips from sagging
      { region: "obliques", role: "stabilizer", amount: 0.45 },
      { region: "glutes", role: "stabilizer", amount: 0.45 },
      { region: "quads", role: "stabilizer", amount: 0.35 }, // straight knees
      { region: "upper_back", role: "stabilizer", amount: 0.35 },
      { region: "forearms", role: "stabilizer", amount: 0.3 },
    ];
  }
  if (exercise === "pushdown") {
    // Here the work is on the way down, hardest pressing the arm straight.
    const press = phase === "down" ? 1 : 0.8;
    return [
      { region: "triceps", role: "prime", amount: (0.55 + 0.45 * depth) * press },
      { region: "forearms", role: "stabilizer", amount: 0.4 }, // the grip on the rope
      { region: "lats", role: "stabilizer", amount: 0.3 }, // holding the upper arm still by the ribs
      { region: "delt_rear", role: "stabilizer", amount: 0.2 },
      { region: "abs", role: "stabilizer", amount: 0.4 }, // holding the trunk still under the pull
      { region: "erectors", role: "stabilizer", amount: 0.25 },
    ];
  }
  if (exercise === "pulldown") {
    // Here the work is on the way down, and hardest with the bar coming into the chest.
    const pull = phase === "down" ? 1 : 0.8;
    return [
      { region: "lats", role: "prime", amount: (0.45 + 0.55 * depth) * pull },
      { region: "teres", role: "prime", amount: (0.45 + 0.55 * depth) * pull }, // the owner's call: done right, this lift should reach it
      { region: "upper_back", role: "synergist", amount: (0.3 + 0.5 * depth) * pull }, // the shoulder blades coming down and back
      { region: "biceps", role: "synergist", amount: (0.25 + 0.5 * depth) * pull },
      { region: "delt_rear", role: "synergist", amount: (0.2 + 0.4 * depth) * pull },
      { region: "forearms", role: "stabilizer", amount: 0.25 }, // the thumbless grip asks less of them
      { region: "abs", role: "stabilizer", amount: 0.35 },
      { region: "erectors", role: "stabilizer", amount: 0.3 },
    ];
  }
  if (exercise === "squat") {
    // The legs work hardest deep down; the weight hangs, so the back and grip just hold on.
    return [
      { region: "quads", role: "prime", amount: (0.35 + 0.65 * depth) * effort },
      { region: "glutes", role: "prime", amount: (0.2 + 0.8 * depth * depth) * effort },
      { region: "adductors", role: "synergist", amount: (0.15 + 0.75 * depth) * effort },
      { region: "hamstrings", role: "synergist", amount: 0.15 + 0.3 * depth },
      { region: "calves", role: "stabilizer", amount: 0.35 },
      { region: "erectors", role: "stabilizer", amount: 0.35 + 0.2 * depth },
      { region: "abs", role: "stabilizer", amount: 0.45 },
      { region: "obliques", role: "stabilizer", amount: 0.35 },
      { region: "upper_back", role: "stabilizer", amount: 0.5 }, // holding the shoulders down under the weight
      { region: "forearms", role: "stabilizer", amount: 0.5 }, // the grip
    ];
  }
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
  { cues: Record<PressPin, string>; top: string; bottom: string; rising: string; lowering?: string; notice: string[] }
> = {
  overheadOne: {
    cues: {
      feet: "ยืนเท้ากว้างประมาณช่วงสะโพก น้ำหนักลงเต็มเท้า มือข้างที่ว่างเท้าเอวไว้ช่วยให้ลำตัวนิ่ง",
      back: "ยืนตัวตรง ไม่แอ่นหลังล่างตอนดันขึ้น ไม่เอียงตัวไปข้างที่ยก",
      elbow: "ต้นแขนตั้งขึ้นให้แนวไหล่กับศอกตรงที่สุดเท่าที่ไหล่ทำได้ ถ้าไหล่ตึงให้ศอกเอียงออกได้เล็กน้อย ศอกอยู่ที่เดิมเป็นจุดหมุน ขึ้นสุดแขนเกือบตรงแต่ไม่ล็อกศอก",
      dumbbell: "ลดดัมเบลลงเฉียงไปข้างหลังฝั่งตรงข้าม ยกแขนขวาให้ลดไปทางหลังซ้าย ลงเท่าที่ดัมเบลยังไม่แตะต้นคอหรือหลัง",
      core: "เกร็งท้องเบา ๆ ซี่โครงไม่บานออก ดันขึ้นให้เร็วกว่าตอนลง แล้วลดลงช้า ๆ",
    },
    top: "ดันขึ้นสุด",
    bottom: "ลดลงสุด",
    rising: "กำลังดันขึ้น",
    lowering: "กำลังลดลง",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ไหล่ยกตรงได้ไม่เท่ากัน ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ลดลงเท่าที่ศอกยังอยู่ที่เดิมและไหล่ยังสบาย ตรงนั้นคือระยะที่เหมาะกับคุณตอนนี้",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่ศอก ไหล่ หรือคอ ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
  },
  overheadTwo: {
    cues: {
      feet: "ยืนเท้ากว้างประมาณช่วงสะโพก น้ำหนักลงเต็มเท้า ตัวไม่โยกเพื่อช่วยดัน",
      back: "ยืนตัวตรง ไม่แอ่นหลังล่างตอนดันขึ้น ศีรษะตั้งตรง ไม่ก้มหลบดัมเบล",
      elbow: "ศอกยกสูง เฉียงไปข้างหน้าตามธรรมชาติ ไม่กางออกกว้าง ศอกอยู่ที่เดิมเป็นจุดหมุน ขึ้นสุดแขนไม่ต้องตรงเป๊ะ",
      dumbbell: "ใช้อุ้งมือสองข้างประสานกันประคองแผ่นดัมเบลด้านบนจากข้างใน ให้ด้ามสอดอยู่ระหว่างนิ้วโป้งกับนิ้วชี้ของสองมือ ลดลงหลังหัวให้ลึกเท่าที่ทำได้ ระวังอย่าให้ดัมเบลชนท้ายทอยหรือต้นคอ",
      core: "เกร็งท้องเบา ๆ ซี่โครงไม่บานออก ดันขึ้นให้เร็วกว่าตอนลง แล้วลดลงช้า ๆ",
    },
    top: "ดันขึ้นสุด",
    bottom: "ลดลงสุด",
    rising: "กำลังดันขึ้น",
    lowering: "กำลังลดลง",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ศอกงอและไหล่ยกได้ไม่เท่ากัน ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ลดลงเท่าที่ศอกยังอยู่ที่เดิมและดัมเบลยังห่างท้ายทอย ตรงนั้นคือระยะที่เหมาะกับคุณตอนนี้",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่ศอก ไหล่ หรือข้อมือ ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
  },
  pushup: {
    cues: {
      feet: "ปลายเท้าจิกพื้น เท้ากว้างประมาณช่วงสะโพก ขาเหยียดตรง",
      back: "ลำตัวเป็นเส้นตรงตั้งแต่หัวถึงส้นเท้า หลังตรง สะโพกไม่ตกและไม่โด่ง มองพื้นข้างหน้ามือเล็กน้อย",
      elbow: "ตอนลงสุด มองจากด้านหน้าปลายแขนตั้งตรง ศอกไม่กางออกนอกข้อมือ ศอกเยื้องไปทางเท้า ตอนขึ้นสุดแขนเกือบเหยียดแต่ไม่ล็อกศอก",
      dumbbell: "วางมือกว้างกว่าไหล่เล็กน้อย ตอนขึ้นสุดมองจากด้านข้างแขนตั้งตรงใต้ไหล่ ตอนลงสุดมือจะอยู่แถวราวนม นิ้วชี้ไปข้างหน้า มองจากด้านหน้าแขนจากไหล่ถึงมือจะเฉียงออกนิด ๆ",
      core: "เกร็งท้องและก้นให้ตัวแข็งเป็นแผ่นเดียว ดันขึ้นเร็วพร้อมหายใจออก ลงช้า ๆ พร้อมหายใจเข้า",
    },
    top: "ดันขึ้นสุด",
    bottom: "ลงสุด",
    rising: "กำลังดันขึ้น",
    lowering: "กำลังลดลง",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ความกว้างมือและระยะที่ลงได้จึงต่างกันได้ ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ลงเท่าที่ตัวยังตรงเป็นแผ่นเดียวและไหล่ยังสบาย ถ้ายังลงไม่ได้ เริ่มจากวางเข่าหรือดันกับขอบโต๊ะก่อน",
      "ท่านี้ข้อมือจะกระดกขึ้นมาก ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่ข้อมือ ไหล่ หรือศอก ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
  },
  pushdown: {
    cues: {
      feet: "ยืนหันหน้าเข้าหาเครื่อง เท้ากว้างประมาณช่วงสะโพก ย่อเข่าเล็กน้อย น้ำหนักลงเต็มเท้า",
      back: "โน้มลำตัวมาข้างหน้าเล็กน้อย หลังตรง ไหล่ลงไม่ยักขึ้นหาหู ค้างท่านี้ไว้ตลอดเซ็ต ไม่ใช้น้ำหนักตัวกด",
      elbow: "ต้นแขนห้อยนิ่ง ศอกอยู่ใต้ไหล่เป็นจุดหมุน ไม่ขยับไปหน้าหรือหลัง กดลงจนแขนเกือบเหยียดเป็นแนวเดียวจากไหล่ถึงข้อมือ แบบควบคุม ไม่กระแทกศอก ให้ข้อมืออยู่ใต้ไหล่ แขนไม่กางออก แล้วบิดให้ศอกหันออกนอกลำตัวเล็กน้อย",
      dumbbell: "กำเชือกเหนือปลายเชือก นิ้วโป้งอยู่ด้านบน ตอนขึ้นให้มือกลับมาชิดกันระดับอก",
      core: "เกร็งท้องเบา ๆ ให้ลำตัวนิ่ง กดลงให้เร็วกว่าตอนขึ้น แล้วปล่อยขึ้นช้า ๆ โดยศอกอยู่ที่เดิม",
    },
    top: "ปล่อยขึ้นสุด",
    bottom: "กดลงสุด",
    rising: "กำลังปล่อยขึ้น",
    lowering: "กำลังกดลง",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ระยะที่มือขึ้นถึงจึงต่างกันได้ ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ปล่อยขึ้นเท่าที่ศอกยังอยู่ที่เดิม ถ้าศอกเริ่มเลื่อนไปข้างหน้า ตรงนั้นคือจุดที่ควรหยุดขึ้น",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่ศอก ข้อมือ หรือไหล่ ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
  },
  pulldown: {
    cues: {
      feet: "นั่งให้เท้าวางเต็มพื้น ปรับแผ่นรองให้กดแนบต้นขาแน่น ไม่มีช่องว่าง ช่วงล่างที่นิ่งช่วยให้ดึงได้เต็มแรง",
      back: "ตอนบนตัวเกือบตรงและยืดให้สุด แล้วเอนหลังไปพร้อมกับการดึง อกยกขึ้น ไม่เหวี่ยงตัวเพื่อใช้น้ำหนักตัวช่วยดึง",
      elbow: "พับศอกมาข้างหน้าแล้วกดลง ให้ปลายแขนอยู่ใกล้แนวสายเคเบิล ไม่แทงศอกไปข้างหลัง",
      dumbbell: "จับกว้างกว่าไหล่ นิ้วโป้งอยู่ฝั่งเดียวกับนิ้วอื่น แค่แตะบาร์แล้วชี้ขึ้น ไม่ต้องโอบ ช่วยลดการใช้แขนท่อนล่าง แต่ต้องจับให้มั่นคงเสมอ",
      core: "เกร็งท้องเบา ๆ ดึงบาร์ลงมาหาไหปลาร้าหรืออกส่วนบน แล้วปล่อยขึ้นช้า ๆ อย่าให้บาร์ดีดขึ้น",
    },
    top: "ปล่อยขึ้นสุด",
    bottom: "ดึงลงสุด",
    rising: "กำลังปล่อยขึ้น",
    lowering: "กำลังดึงลง",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ความกว้างมือและระยะที่ดึงลงจึงต่างกันได้ ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ดึงลงเท่าที่ไหล่ยังสบายและอกยังยกอยู่ ตรงนั้นคือระยะที่เหมาะกับคุณตอนนี้",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่ไหล่ ศอก หรือข้อมือ ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
  },
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
  squat: {
    cues: {
      feet: "เท้ากว้างประมาณช่วงไหล่ ปลายเท้าเปิดออกเล็กน้อย ส้นเท้าติดพื้นตลอด เข่าชี้ตามปลายเท้า ไม่บีบเข้าใน",
      back: "หลังตรง อกผาย มองไปข้างหน้า โน้มลำตัวลงเล็กน้อยตอนนั่ง ไม่ปล่อยหลังงอ",
      elbow: "ปล่อยแขนห้อยสบาย ๆ เหมือนตะขอเกี่ยวดัมเบล ไม่ต้องงอศอกหรือยกช่วย",
      dumbbell: "ฝ่ามือหันเข้าหาลำตัว ดัมเบลขึ้นลงเป็นเส้นตรงข้างขา ลงจนสะโพกต่ำกว่าเข่าเล็กน้อย หรือเท่าที่หลังยังตรงและส้นเท้ายังติดพื้น",
      core: "เกร็งท้องก่อนลง แล้วดันพื้นขึ้นทั้งฝ่าเท้าจนยืนตรง",
    },
    top: "ยืนขึ้นสุด",
    bottom: "นั่งลงสุด",
    rising: "กำลังลุกขึ้น",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ความกว้างเท้าและความลึกจึงต่างกันได้ ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ลงลึกเท่าที่หลังยังตรงและส้นเท้ายังติดพื้น ตรงนั้นคือระยะที่เหมาะกับคุณตอนนี้",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่เข่า สะโพก หรือหลัง ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
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
