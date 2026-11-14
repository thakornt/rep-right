// Dumbbell lifts: which muscles work. General guidance, not EMG data.

import type { Activation } from "./squat";

export const PRESS_PINS = ["feet", "back", "elbow", "dumbbell", "core"] as const;
export type PressPin = (typeof PRESS_PINS)[number];

export type PressExercise = "incline" | "shoulder" | "hammer" | "raise" | "squat" | "pulldown" | "pushdown" | "pushup" | "overheadOne" | "overheadTwo" | "overheadCable" | "row" | "crunch" | "rdl" | "facePull" | "legExtension" | "pulldownNeutral" | "pulldownSingle" | "pullUp" | "chinUp";

// Depth 0 = dumbbells up, 1 = dumbbells down.
export function pressActivation(exercise: PressExercise, depth: number, phase: "down" | "up"): Activation[] {
  // The pulldown's other grips work the same muscles.
  if (exercise === "pulldownNeutral" || exercise === "pulldownSingle") exercise = "pulldown";
  const effort = phase === "up" ? 1 : 0.8;
  if (exercise === "pullUp" || exercise === "chinUp") {
    // The back lifts the body, hardest near the top with the elbows coming down to the sides. The
    // underhand grip turns the front of the upper arm to pull with it, so it works more; overhand,
    // the back leads. The grip holds the whole body. The work is on the way up.
    const pull = phase === "down" ? 1 : 0.8;
    const under = exercise === "chinUp";
    return [
      { region: "lats", role: "prime", amount: (0.5 + 0.5 * depth) * pull },
      { region: "teres", role: "prime", amount: (0.45 + 0.5 * depth) * pull },
      { region: "biceps", role: under ? "prime" : "synergist", amount: ((under ? 0.4 : 0.25) + 0.5 * depth) * pull },
      { region: "upper_back", role: "synergist", amount: (0.35 + 0.5 * depth) * pull }, // the shoulder blades pressing down and back
      { region: "delt_rear", role: "synergist", amount: (0.2 + 0.4 * depth) * pull },
      { region: "forearms", role: "synergist", amount: 0.6 }, // holding the whole body on the bar
      { region: "abs", role: "stabilizer", amount: 0.4 }, // the body still, not swinging
      { region: "chest_lower", role: "stabilizer", amount: 0.2 },
    ];
  }
  if (exercise === "legExtension") {
    // The front of the thigh straightens the knee, hardest near straight; the rest of the body
    // just holds still on the seat.
    const straight = 1 - depth;
    return [
      { region: "quads", role: "prime", amount: (0.45 + 0.55 * straight) * effort },
      { region: "abs", role: "stabilizer", amount: 0.25 }, // the trunk still on the back pad
      { region: "forearms", role: "stabilizer", amount: 0.3 }, // holding the handles, pulling into the seat
    ];
  }
  if (exercise === "facePull") {
    // The back of the shoulder and the upper back pull the elbows out and back, and the shoulder
    // turns the forearms up; hardest pulled in, with the shoulder blades squeezed. The work is on
    // the way in.
    const pull = phase === "down" ? 1 : 0.8;
    return [
      { region: "delt_rear", role: "prime", amount: (0.45 + 0.55 * depth) * pull },
      { region: "upper_back", role: "prime", amount: (0.4 + 0.6 * depth) * pull }, // the shoulder blades squeezed together
      { region: "teres", role: "synergist", amount: (0.3 + 0.5 * depth) * pull }, // turning the upper arm out
      { region: "delt_side", role: "synergist", amount: (0.25 + 0.4 * depth) * pull }, // holding the elbows up
      { region: "biceps", role: "stabilizer", amount: 0.2 }, // only holding the bend: the clip's point, not a curl
      { region: "forearms", role: "stabilizer", amount: 0.3 }, // the grip on the rope
      { region: "abs", role: "stabilizer", amount: 0.35 }, // the trunk still, not leaning back to pull
      { region: "erectors", role: "stabilizer", amount: 0.3 },
    ];
  }
  if (exercise === "rdl") {
    // The hamstrings and glutes lengthen under load going down and drive the hips forward coming
    // up, hardest near the bottom; the back holds its line throughout.
    return [
      { region: "hamstrings", role: "prime", amount: (0.4 + 0.6 * depth) * effort },
      { region: "glutes", role: "prime", amount: (0.35 + 0.6 * depth) * effort },
      { region: "adductors", role: "synergist", amount: (0.2 + 0.4 * depth) * effort },
      { region: "erectors", role: "stabilizer", amount: 0.4 + 0.3 * depth }, // holding the back straight
      { region: "upper_back", role: "stabilizer", amount: 0.4 }, // shoulders back, not rounded
      { region: "lats", role: "stabilizer", amount: 0.35 }, // keeping the dumbbells close to the legs
      { region: "forearms", role: "stabilizer", amount: 0.45 }, // the grip
      { region: "abs", role: "stabilizer", amount: 0.35 },
    ];
  }
  if (exercise === "row") {
    // The back pulls the elbow back to the hip, hardest at the top; the arm bends only as far as the
    // forearm hanging straight down needs, so the biceps helps without leading.
    return [
      { region: "lats", role: "prime", amount: (0.5 + 0.5 * (1 - depth)) * effort },
      { region: "teres", role: "prime", amount: (0.45 + 0.45 * (1 - depth)) * effort },
      { region: "upper_back", role: "synergist", amount: (0.35 + 0.45 * (1 - depth)) * effort }, // the shoulder blade drawn back
      { region: "delt_rear", role: "synergist", amount: (0.3 + 0.4 * (1 - depth)) * effort },
      { region: "biceps", role: "synergist", amount: (0.25 + 0.3 * (1 - depth)) * effort },
      { region: "forearms", role: "stabilizer", amount: 0.4 }, // the grip
      { region: "erectors", role: "stabilizer", amount: 0.45 }, // holding the back straight in the lean
      { region: "abs", role: "stabilizer", amount: 0.35 },
      { region: "obliques", role: "stabilizer", amount: 0.4 }, // keeping the trunk from twisting open
      { region: "glutes", role: "stabilizer", amount: 0.3 },
      { region: "hamstrings", role: "stabilizer", amount: 0.3 },
    ];
  }
  if (exercise === "overheadOne" || exercise === "overheadTwo" || exercise === "overheadCable") {
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
  if (exercise === "crunch") {
    // Hardest curled up; the hips and legs just stay put.
    const curled = 1 - depth;
    return [
      { region: "abs", role: "prime", amount: (0.45 + 0.55 * curled) * effort },
      { region: "obliques", role: "synergist", amount: (0.2 + 0.4 * curled) * effort },
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

// How the pull-up's two grips differ, from the owner's reference clip (2026-11-14). General
// guidance, shown on both grips so each can be read against the other.
const PULL_UP_GRIP_NOTES = [
  {
    label: "คว่ำมือ (Pull-up)",
    text: "ฝ่ามือหันออก จับกว้างกว่าไหล่เล็กน้อย ศอกลงมาข้างลำตัว ใช้หลังและปีกเป็นหลัก แขนหน้าช่วยน้อยกว่า จึงดึงยากกว่า เหมาะกับการเสริมความแข็งแรงของหลังโดยตรง",
  },
  {
    label: "หงายมือ (Chin-up)",
    text: "ฝ่ามือหันเข้าหาตัว จับประมาณช่วงไหล่ ศอกลงมาข้างหน้าลำตัว ใช้หลังคู่กับแขนหน้า (ไบเซ็ปส์) แขนช่วยได้มากกว่า จึงดึงง่ายกว่า เหมาะกับคนเริ่มฝึกดึงข้อ",
  },
];

export const PRESS_CONTENT: Record<
  PressExercise,
  {
    cues: Record<PressPin, string>;
    top: string;
    bottom: string;
    rising: string;
    lowering?: string;
    notice: string[];
    grips?: { label: string; text: string }[]; // how the lift's grips differ, under the muscles
  }
> = {
  pulldownNeutral: {
    cues: {
      feet: "นั่งให้เท้าวางเต็มพื้น ปรับแผ่นรองให้กดแนบต้นขาแน่น ไม่มีช่องว่าง ช่วงล่างที่นิ่งช่วยให้ดึงได้เต็มแรง",
      back: "ตอนบนตัวเกือบตรงและยืดให้สุด แล้วเอนหลังเล็กน้อยไปพร้อมกับการดึง อกยกขึ้น ไม่เหวี่ยงตัวช่วยดึง",
      elbow: "ศอกลงมาข้างหน้าลำตัว ชิดตัว ไม่กางออกข้าง และไม่แทงศอกไปข้างหลัง",
      dumbbell: "จับด้ามจับคู่ขนาน ฝ่ามือหันเข้าหากัน ดึงลงมาที่อกส่วนบน",
      core: "เกร็งท้องเบา ๆ ดึงลงเร็วพร้อมหายใจออก แล้วปล่อยขึ้นช้า ๆ พร้อมหายใจเข้า อย่าให้ด้ามจับดีดขึ้น",
    },
    top: "ปล่อยขึ้นสุด",
    bottom: "ดึงลงสุด",
    rising: "กำลังปล่อยขึ้น",
    lowering: "กำลังดึงลง",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ระยะที่ดึงลงได้จึงต่างกัน ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ดึงลงเท่าที่ไหล่ยังสบายและอกยังยกอยู่ ตรงนั้นคือระยะที่เหมาะกับคุณตอนนี้",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่ไหล่ ศอก หรือข้อมือ ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
  },
  pulldownSingle: {
    cues: {
      feet: "นั่งให้เท้าวางเต็มพื้น ปรับแผ่นรองให้กดแนบต้นขาแน่น มืออีกข้างวางบนต้นขา",
      back: "ลำตัวเกือบตรงตลอด ไม่บิดตัวหรือเอียงตัวไปข้างที่ดึงเพื่อช่วยดึง",
      elbow: "ดึงศอกลงมาข้างลำตัว ชิดซี่โครง ให้มือมาอยู่ข้างไหล่",
      dumbbell: "จับด้ามจับข้างเดียว ฝ่ามือหันเข้าหาตัว ตอนบนแขนเกือบตรงและรู้สึกยืดข้างลำตัว",
      core: "เกร็งท้องให้ลำตัวนิ่ง ดึงลงเร็วพร้อมหายใจออก แล้วปล่อยขึ้นช้า ๆ พร้อมหายใจเข้า ทำครบแล้วสลับข้าง",
    },
    top: "ปล่อยขึ้นสุด",
    bottom: "ดึงลงสุด",
    rising: "กำลังปล่อยขึ้น",
    lowering: "กำลังดึงลง",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ระยะที่ดึงลงได้จึงต่างกัน ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ดึงลงเท่าที่ไหล่ยังสบายและลำตัวยังไม่บิด ตรงนั้นคือระยะที่เหมาะกับคุณตอนนี้",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่ไหล่ ศอก หรือข้อมือ ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
  },
  pullUp: {
    cues: {
      feet: "งอเข่าให้หน้าแข้งไปทางหลัง ขาสองข้างชิดกันนิ่ง ๆ ถ้าบาร์สูงพอจะเหยียดขาตรงก็ได้ แต่อย่าเตะหรือเหวี่ยงขาช่วยดึง",
      back: "ตอนห้อยตัว ปล่อยไหล่และลำตัวยืดให้สุด แล้วกดไหล่ลงไปทางกระเป๋ากางเกงก่อนเริ่มดึง ตอนขึ้นเอนลำตัวไปข้างหลังเล็กน้อย อกเข้าหาบาร์",
      elbow: "ดึงศอกลงมาข้างลำตัว ศอกชี้ลงพื้นและกางออกข้างเล็กน้อย ไม่ยักไหล่ขึ้นหาหูตอนอยู่บน",
      dumbbell: "จับแบบคว่ำมือ ฝ่ามือหันออกจากตัว กว้างกว่าหัวไหล่เล็กน้อย กำรอบบาร์ปกติ ไม่อ้อมมือไปหลังบาร์มากเกิน และข้อมือไม่มุดอยู่ใต้บาร์",
      core: "หายใจเข้าเตรียมไว้ก่อนดึง เกร็งท้องให้ตัวนิ่ง ดึงขึ้นจนคางพ้นบาร์ คอตรง ไม่ยื่นคางหรือก้มหน้า แล้วลดตัวลงช้า ๆ 4-5 วินาที",
    },
    top: "ห้อยตัวยืดสุด",
    bottom: "ดึงขึ้นสุด",
    rising: "กำลังลดตัวลง",
    lowering: "กำลังดึงขึ้น",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ความกว้างมือที่สบายจึงต่างกันได้ ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ถ้ายังดึงไม่ขึ้น เริ่มจากห้อยตัวแล้วฝึกกดไหล่ลง หรือขึ้นไปค้างด้านบนแล้วค่อย ๆ ลดตัวลงช้า ๆ ก่อน",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่ไหล่ ศอก หรือข้อมือ ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
    grips: PULL_UP_GRIP_NOTES,
  },
  chinUp: {
    cues: {
      feet: "งอเข่าให้หน้าแข้งไปทางหลัง ขาสองข้างชิดกันนิ่ง ๆ ถ้าบาร์สูงพอจะเหยียดขาตรงก็ได้ แต่อย่าเตะหรือเหวี่ยงขาช่วยดึง",
      back: "ตอนห้อยตัว ปล่อยไหล่และลำตัวยืดให้สุด แล้วกดไหล่ลงไปทางกระเป๋ากางเกงก่อนเริ่มดึง ตอนขึ้นเอนลำตัวไปข้างหลังเล็กน้อย อกเข้าหาบาร์",
      elbow: "ดึงศอกลงมาข้างหน้าลำตัว ให้ต้นแขนเข้าชิดซี่โครง ไม่กางศอกออกข้าง และไม่ยักไหล่ขึ้นหาหูตอนอยู่บน",
      dumbbell: "จับแบบหงายมือ ฝ่ามือหันเข้าหาตัว กว้างประมาณช่วงไหล่ ไม่ต้องกว้างกว่านี้ จับกว้างแบบหงายมือจะฝืนข้อมือและศอก",
      core: "หายใจเข้าเตรียมไว้ก่อนดึง เกร็งท้องให้ตัวนิ่ง ดึงขึ้นจนคางพ้นบาร์ คอตรง ไม่ยื่นคางหรือก้มหน้า แล้วลดตัวลงช้า ๆ 4-5 วินาที",
    },
    top: "ห้อยตัวยืดสุด",
    bottom: "ดึงขึ้นสุด",
    rising: "กำลังลดตัวลง",
    lowering: "กำลังดึงขึ้น",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ความกว้างมือที่สบายจึงต่างกันได้ ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ถ้าข้อมือหรือศอกฝืนตอนหงายมือ ลองขยับมือเข้าหรือออกเล็กน้อยจนสบาย หรือเปลี่ยนไปจับแบบคว่ำมือ",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่ไหล่ ศอก หรือข้อมือ ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
    grips: PULL_UP_GRIP_NOTES,
  },
  legExtension: {
    cues: {
      feet: "ปรับเบาะรองให้อยู่หน้าแข้งส่วนล่าง เหนือข้อเท้าเล็กน้อย ตอนเริ่มให้เข่างออย่างน้อย 90 องศา",
      back: "นั่งหลังพิงพนัก ดึงตัวเข้าหาเบาะให้ก้นแนบเบาะตลอด ไม่ยกก้นขึ้นตอนเหยียดขา",
      elbow: "ปรับเบาะนั่งเข้าออกจนเข่าตรงกับแกนหมุนของเครื่อง (จุดกลมที่แขนเครื่องหมุนรอบ)",
      dumbbell: "จับที่จับข้างเบาะไว้แน่น ใช้ดึงตัวเข้าหาเบาะให้นิ่ง",
      core: "เหยียดขาขึ้นเร็วพร้อมหายใจออกจนเกือบตรง เกร็งต้นขาหน้าค้างไว้ครู่หนึ่ง แล้วลดลงช้า ๆ พร้อมหายใจเข้า ไม่เตะด้วยแรงเหวี่ยง",
    },
    top: "เหยียดขาสุด",
    bottom: "งอเข่าสุด",
    rising: "กำลังเหยียดขา",
    lowering: "กำลังลดลง",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ความยาวขาไม่เท่ากัน จึงต้องปรับเบาะนั่งและเบาะรองหน้าแข้งทุกครั้งที่ใช้เครื่อง",
      "เหยียดขาเท่าที่เข่ายังสบาย ไม่ต้องล็อกเข่าตึงสุด",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่เข่า ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
  },
  facePull: {
    cues: {
      feet: "ตั้งรอกให้สูงกว่าหัวเล็กน้อย แล้วถอยออกมาหนึ่งถึงสองก้าว เท้ากว้างประมาณช่วงสะโพก ย่อเข่าเล็กน้อย น้ำหนักลงส้นเท้ามากหน่อย",
      back: "เอนตัวไปข้างหลังเล็กน้อยเป็นเส้นตรงจากข้อเท้าถึงหัว เพื่อสู้แรงสายที่ดึงตัวไปข้างหน้า แต่ไม่เหวี่ยงตัวช่วยดึง อกผาย ตอนดึงเข้าสุดให้บีบสะบักสองข้างเข้าหากัน",
      elbow: "ศอกนำ ดึงศอกออกข้างและไปข้างหลังให้สูงระดับไหล่ ไม่ให้ศอกตกต่ำกว่ามือ ถ้าศอกตกจะกลายเป็นการงอแขนแบบท่าค้อน (Hammer curl) ที่ไปโดนต้นแขนกับแขนท่อนล่างแทน",
      dumbbell: "จับเชือกแบบคว่ำมือ ดึงให้กลางเชือกเข้ามาเหมือนจะชนหน้าผาก แล้วแหวกมือออกให้กว้างที่สุดไปข้างหัว ปลายแขนตั้งขึ้น เหมือนกำลังเบ่งกล้ามแขนสองข้าง",
      core: "ดึงเข้าให้เร็วและหายใจออก แล้วต้านกลับช้า ๆ หายใจเข้า เกร็งท้องให้ลำตัวนิ่ง ใช้น้ำหนักที่ยังทำท่าได้ถูกและรู้สึกที่หลังไหล่ก่อน",
    },
    top: "ปล่อยแขนออกสุด",
    bottom: "ดึงเข้าสุด",
    rising: "กำลังปล่อยกลับ",
    lowering: "กำลังดึงเข้า",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ไหล่หมุนออกได้ไม่เท่ากัน ไม่ต้องแหวกมือกว้างเท่าโมเดล",
      "ดึงเข้าเท่าที่ศอกยังสูงระดับไหล่และไหล่ยังสบาย ตรงนั้นคือระยะที่เหมาะกับคุณตอนนี้",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่ไหล่หรือคอ ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
  },
  rdl: {
    cues: {
      feet: "ยืนเท้ากว้างประมาณช่วงสะโพก น้ำหนักลงกลางเท้าถึงส้นเท้า ย่อเข่านิดเดียวและคงมุมนี้ไว้ ไม่นั่งลงแบบสควอท",
      back: "หลังตรงเป็นเส้นเดียวจากสะโพกถึงคอ ไม่ห่อหลังและไม่แอ่นหลังล่าง อกผาย ไหล่ไม่ห่อ มองพื้นข้างหน้าเล็กน้อย",
      elbow: "แขนห้อยตรงเหมือนตะขอ ไม่งอศอกดึง ไหล่ดึงไปข้างหลังเล็กน้อยให้ดัมเบลอยู่ชิดขา",
      dumbbell: "ดัมเบลไถลลงชิดหน้าขาตลอดทาง ลงจนประมาณกลางหน้าแข้ง หรือเท่าที่หลังยังตรงและรู้สึกตึงต้นขาด้านหลัง",
      core: "เริ่มด้วยการดันสะโพกไปข้างหลัง ไม่ใช่ก้มตัว เกร็งท้องให้หลังนิ่ง ขึ้นโดยดันสะโพกมาข้างหน้าและบีบก้น ลงช้า ๆ",
    },
    top: "ยืนขึ้นสุด",
    bottom: "ลงสุด",
    rising: "กำลังยืนขึ้น",
    lowering: "กำลังลดลง",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ความลึกที่ลงได้ขึ้นกับความยืดหยุ่นของต้นขาด้านหลัง ไม่ต้องลงเท่าโมเดล",
      "ลงเท่าที่หลังยังตรง ถ้าหลังเริ่มห่อ ตรงนั้นคือจุดที่ควรหยุดแล้วดันสะโพกกลับขึ้น",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่หลังล่างหรือต้นขาด้านหลัง ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
  },
  row: {
    cues: {
      feet: "เท้าข้างเดียวกับมือที่ค้ำอยู่ข้างหน้า ถอยเท้าข้างที่ถือดัมเบลไปข้างหลังตรง ๆ เท้าทั้งสองข้างวางเต็มพื้น ย่อเข่าเล็กน้อย ให้ตัวมั่นคงไม่โยก",
      back: "พับตัวจากสะโพกให้ลำตัวโน้มต่ำ หลังตรงเป็นเส้นเดียว มองพื้นข้างหน้าเล็กน้อย ไม่ยืนตัวตั้ง เพราะจะดึงด้วยบ่าแทนหลัง",
      elbow: "ดึงศอกไปข้างหลังเข้าหาสะโพก ต้นแขนแนบข้างลำตัว ไม่กางศอกออก ตอนลงให้แขนห้อยเกือบตรงแต่ไม่ล็อกศอก",
      dumbbell: "ฝ่ามือหันเข้าหาลำตัว ปลายแขนห้อยตรงลงพื้นตลอดทาง ดัมเบลเคลื่อนเป็นแนวโค้งจากใต้ไหล่ไปทางสะโพก ไม่กระชากขึ้นตรง ๆ หาอก",
      core: "มืออีกข้างค้ำไว้ให้มั่นคง เกร็งท้องไม่ให้ลำตัวบิดเปิดตามแขนที่ดึง ดึงขึ้นเร็วกว่าตอนลง แล้วลดลงช้า ๆ",
    },
    top: "ดึงขึ้นสุด",
    bottom: "ลดลงสุด",
    rising: "กำลังดึงขึ้น",
    lowering: "กำลังลดลง",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ความสูงของที่ค้ำและระยะที่ถอยเท้าจึงต่างกันได้ ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ดึงเท่าที่หลังยังตรงและลำตัวไม่บิด ตรงนั้นคือระยะที่เหมาะกับคุณตอนนี้",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่หลังล่าง ไหล่ หรือศอก ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
    ],
  },
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
  overheadCable: {
    cues: {
      feet: "ตั้งรอกไว้ประมาณระดับสะดือ ใส่เชือก จับปลายเชือกสองข้างแล้วหมุนตัวหันหลังให้เครื่อง ยกเชือกข้ามขึ้นไปไว้หลังหัว ยืนห่างเครื่องประมาณหนึ่งก้าว เท้ากว้างประมาณช่วงสะโพก",
      back: "ยืนตัวตรง ไม่ต้องโน้มตัวหรือบิดตัว ไม่แอ่นหลังล่างตอนดันขึ้น ศีรษะตั้งตรง",
      elbow: "ต้นแขนตั้งขึ้นข้างหัว ศอกชี้ขึ้นและเก็บเข้า ไม่กางออกด้านข้าง ศอกอยู่ที่เดิมเป็นจุดหมุน ขึ้นสุดแขนเกือบตรงแต่ไม่ล็อกศอก",
      dumbbell: "กำปลายเชือกแบบฝ่ามือหันเข้าหากัน ลดมือลงไปหลังหัวจนรู้สึกยืดหลังแขน แล้วดันขึ้นจนมือเข้ามาใกล้กันเหนือหัว",
      core: "เกร็งท้องเบา ๆ ซี่โครงไม่บานออก ดันขึ้นหายใจออก ผ่อนลงช้า ๆ หายใจเข้า",
    },
    top: "ดันขึ้นสุด",
    bottom: "ลดลงสุด",
    rising: "กำลังดันขึ้น",
    lowering: "กำลังลดลง",
    notice: [
      "ตั้งรอกต่ำสุดจะต้องก้มหยิบ ตั้งสูงจะต้องโน้มตัวและบิดตัว ระดับสะดือหมุนตัวเข้าท่าได้ง่ายและปลอดภัยกว่า",
      "ลดลงเท่าที่ศอกยังอยู่ที่เดิมและไหล่ยังสบาย ตรงนั้นคือระยะที่เหมาะกับคุณตอนนี้",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่ศอก ไหล่ หรือคอ ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
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
  crunch: {
    cues: {
      feet: "นอนหงาย ชันเข่า เท้าวางเต็มพื้นกว้างประมาณช่วงสะโพก เท้าไม่ลอยตอนขึ้น",
      back: "ค่อย ๆ ม้วนหลังส่วนบนขึ้นจนสะบักพ้นพื้น หลังล่างแนบพื้นอยู่ ไม่ต้องลุกขึ้นนั่ง",
      elbow: "เปิดศอกไปทางหน้าลำตัวประมาณ 45 องศา ไม่ต้องกางราบ และไม่หุบศอกเข้าหากันตอนขึ้น",
      dumbbell: "ฝ่ามือหันเข้าหาใบหน้า ปลายนิ้วแตะขมับเบา ๆ ไม่ประสานมือดึงคอ",
      core: "เกร็งท้องแล้วม้วนซี่โครงเข้าหาสะโพกเร็ว ๆ พร้อมหายใจออก แล้วลงช้า ๆ พร้อมหายใจเข้า เว้นระยะคางกับอกประมาณหนึ่งกำปั้น",
    },
    top: "ม้วนขึ้นสุด",
    bottom: "นอนราบ",
    rising: "กำลังม้วนขึ้น",
    notice: [
      "ร่างกายแต่ละคนไม่เหมือนกัน ระยะที่ม้วนขึ้นได้จึงต่างกัน ไม่ต้องให้เหมือนโมเดลเป๊ะ",
      "ม้วนขึ้นเท่าที่หลังล่างยังแนบพื้น และคอยังสบาย ตรงนั้นคือระยะที่เหมาะกับคุณตอนนี้",
      "ถ้ารู้สึกเจ็บแปลบหรือปวดผิดปกติที่หลังหรือคอ ให้หยุดทันที และปรึกษาผู้เชี่ยวชาญ",
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
