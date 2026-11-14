// Weekly programs for beginners who don't know what to train today.
// Plain data: the page renders it, programs.test.ts checks the safety rules
// (every week has rest days, and no muscle group is worked two days running,
// counting Sunday → Monday because the week repeats).
//
// This is general guidance, not a prescription: the page says so.

import { MUSCLES } from "../lib/exercise-groups";

export type Muscle = (typeof MUSCLES)[number][0];

export type TrainingDay = {
  rest?: false;
  /** Short Thai name for the day's session, e.g. "ดัน (อก ไหล่ หลังแขน)". */
  title: string;
  /** Muscle groups this day is built around. */
  focus: Muscle[];
  /** Groups that help in the lifts and also get tired, so they count for the rest rule. */
  helpers: Muscle[];
  /** Example exercises (slugs); the page links the ones with a 3D page. */
  exercises: string[];
};

export type RestDay = { rest: true };

export type Day = TrainingDay | RestDay;

export type Program = {
  id: string;
  /** Thai name a beginner understands. */
  name: string;
  /** The common English name, explained on the page. */
  alias: string;
  daysPerWeek: number;
  /** Monday first, 7 entries. */
  week: Day[];
  /** Why this split fits this many days. */
  why: string;
  /** Rough sets per muscle group each time it is trained. */
  setsPerSession: string;
  /** How many times a week each main group gets trained. */
  timesPerWeek: string;
  /** Extra caution for this program, if any. */
  note?: string;
};

export const WEEKDAYS = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];

const REST: RestDay = { rest: true };

// Main muscles of each example exercise, from apps/api/db/migrations/00004_exercise_muscles.sql.
export const EXERCISE_MUSCLES: Record<string, Muscle[]> = {
  "barbell-squat": ["quads", "glutes"],
  "dumbbell-squat": ["quads", "glutes"],
  "romanian-deadlift": ["hamstrings", "glutes"],
  "push-up": ["chest", "triceps"],
  "incline-dumbbell-press": ["chest", "shoulders"],
  "overhead-press": ["shoulders", "triceps"],
  "dumbbell-lateral-raise": ["shoulders"],
  "lat-pulldown": ["back", "biceps"],
  "single-arm-dumbbell-row": ["back"],
  "hammer-curl": ["biceps"],
  "rope-triceps-pushdown": ["triceps"],
  "overhead-triceps-extension": ["triceps"],
  crunch: ["abs"],
};

// Thai names of the example exercises, from apps/api/db/migrations/00002_workouts.sql and later.
export const EXERCISE_NAMES: Record<string, string> = {
  "barbell-squat": "บาร์เบลสควอท",
  "dumbbell-squat": "ดัมเบลสควอท",
  "romanian-deadlift": "โรมาเนียนเดดลิฟต์",
  "push-up": "วิดพื้น",
  "incline-dumbbell-press": "อินไคลน์ดัมเบลเพรส",
  "overhead-press": "โอเวอร์เฮดเพรส",
  "dumbbell-lateral-raise": "ดัมเบลแลตเทอรัลเรส",
  "lat-pulldown": "แลตพูลดาวน์",
  "single-arm-dumbbell-row": "ดัมเบลโรว์ แขนเดียว",
  "hammer-curl": "แฮมเมอร์เคิร์ล",
  "rope-triceps-pushdown": "ไตรเซปส์พุชดาวน์ (เชือก)",
  "overhead-triceps-extension": "ไตรเซปส์เอ็กซ์เทนชันเหนือหัว",
  crunch: "ครันช์",
};

// --- Building blocks -------------------------------------------------------

const FULL_BODY: TrainingDay = {
  title: "ทั้งตัว",
  focus: ["quads", "glutes", "hamstrings", "chest", "back", "shoulders"],
  helpers: ["triceps", "biceps", "abs", "lower_back", "traps", "calves"],
  exercises: ["dumbbell-squat", "romanian-deadlift", "push-up", "lat-pulldown", "overhead-press", "crunch"],
};

const UPPER: TrainingDay = {
  title: "ช่วงบน",
  focus: ["chest", "back", "shoulders"],
  helpers: ["triceps", "biceps", "traps"],
  exercises: [
    "incline-dumbbell-press",
    "lat-pulldown",
    "overhead-press",
    "single-arm-dumbbell-row",
    "hammer-curl",
    "rope-triceps-pushdown",
  ],
};

const LOWER: TrainingDay = {
  title: "ช่วงล่าง + หน้าท้อง",
  focus: ["quads", "glutes", "hamstrings", "calves", "abs"],
  helpers: ["lower_back"],
  exercises: ["barbell-squat", "romanian-deadlift", "dumbbell-squat", "crunch"],
};

const PUSH: TrainingDay = {
  title: "ดัน (อก ไหล่ หลังแขน)",
  focus: ["chest", "shoulders", "triceps"],
  helpers: [],
  exercises: [
    "incline-dumbbell-press",
    "push-up",
    "overhead-press",
    "dumbbell-lateral-raise",
    "rope-triceps-pushdown",
  ],
};

const PULL: TrainingDay = {
  title: "ดึง (หลัง หน้าแขน)",
  focus: ["back", "biceps"],
  helpers: ["traps"],
  exercises: ["lat-pulldown", "single-arm-dumbbell-row", "hammer-curl"],
};

const LEGS: TrainingDay = {
  title: "ขา + หน้าท้อง",
  focus: ["quads", "glutes", "hamstrings", "calves", "abs"],
  helpers: ["lower_back"],
  exercises: ["barbell-squat", "romanian-deadlift", "dumbbell-squat", "crunch"],
};

// --- Programs ---------------------------------------------------------------

export const PROGRAMS: Program[] = [
  {
    id: "full-body-2",
    name: "ฝึกทั้งตัว สัปดาห์ละ 2 วัน",
    alias: "Full body",
    daysPerWeek: 2,
    week: [FULL_BODY, REST, REST, FULL_BODY, REST, REST, REST],
    why: "มีเวลาแค่ 2 วัน ถ้าแยกส่วน กล้ามแต่ละกลุ่มจะได้ฝึกแค่สัปดาห์ละครั้ง ฝึกทั้งตัวทุกครั้งทำให้ทุกกลุ่มได้ฝึก 2 ครั้งต่อสัปดาห์ และมีวันพักคั่นยาว ร่างกายฟื้นทัน",
    setsPerSession: "3–4 เซ็ต",
    timesPerWeek: "2 ครั้ง",
  },
  {
    id: "full-body-3",
    name: "ฝึกทั้งตัว สัปดาห์ละ 3 วัน",
    alias: "Full body",
    daysPerWeek: 3,
    week: [FULL_BODY, REST, FULL_BODY, REST, FULL_BODY, REST, REST],
    why: "เหมาะที่สุดสำหรับมือใหม่ ฝึกท่าเดิมบ่อย ฟอร์มจึงดีขึ้นเร็ว ทุกกลุ่มได้ฝึก 3 ครั้งต่อสัปดาห์ และมีวันพักคั่นทุกครั้ง กล้ามจึงไม่ถูกใช้ 2 วันติด",
    setsPerSession: "2–3 เซ็ต",
    timesPerWeek: "3 ครั้ง",
  },
  {
    id: "upper-lower",
    name: "บน / ล่าง สลับกัน × 2",
    alias: "Upper / Lower",
    daysPerWeek: 4,
    week: [UPPER, LOWER, REST, UPPER, LOWER, REST, REST],
    why: "ฝึก 4 วัน ถ้าฝึกทั้งตัวทุกวันจะต้องฝึกกล้ามเดิม 2 วันติด จึงแบ่งเป็นช่วงบนกับช่วงล่างสลับกัน วันที่ช่วงบนพัก ช่วงล่างก็ทำงานแทน ทุกกลุ่มยังได้ฝึก 2 ครั้งต่อสัปดาห์",
    setsPerSession: "3–4 เซ็ต",
    timesPerWeek: "2 ครั้ง",
  },
  {
    id: "ppl-upper-lower",
    name: "ดัน / ดึง / ขา + บน / ล่าง",
    alias: "PPL + Upper / Lower",
    daysPerWeek: 5,
    week: [PUSH, PULL, LEGS, REST, UPPER, LOWER, REST],
    why: "3 วันแรกแยกเป็นท่าดัน ท่าดึง และขา แต่ละวันจึงทำได้หลายท่าโดยไม่เหนื่อยเกิน แล้วพัก 1 วัน ต่อด้วยช่วงบนกับช่วงล่าง ทุกกลุ่มได้ฝึก 2 ครั้งต่อสัปดาห์ และไม่มีกลุ่มไหนถูกใช้ 2 วันติด",
    setsPerSession: "3–4 เซ็ต",
    timesPerWeek: "2 ครั้ง",
  },
  {
    id: "bro-split",
    name: "วันละกลุ่มกล้าม",
    alias: "Bro split",
    daysPerWeek: 5,
    week: [
      {
        title: "อก",
        focus: ["chest"],
        helpers: ["shoulders", "triceps"],
        exercises: ["incline-dumbbell-press", "push-up"],
      },
      {
        title: "หลัง + หน้าท้อง",
        focus: ["back", "abs"],
        helpers: ["biceps"],
        exercises: ["lat-pulldown", "single-arm-dumbbell-row", "crunch"],
      },
      {
        title: "ไหล่",
        focus: ["shoulders", "traps"],
        helpers: ["triceps"],
        exercises: ["overhead-press", "dumbbell-lateral-raise"],
      },
      {
        title: "ขา",
        focus: ["quads", "glutes", "hamstrings", "calves"],
        helpers: ["lower_back"],
        exercises: ["barbell-squat", "romanian-deadlift", "dumbbell-squat"],
      },
      {
        title: "แขน + หน้าท้อง",
        focus: ["biceps", "triceps", "abs"],
        helpers: [],
        exercises: ["hammer-curl", "rope-triceps-pushdown", "overhead-triceps-extension", "crunch"],
      },
      REST,
      REST,
    ],
    why: "แต่ละวันเน้นกลุ่มเดียว ทำได้หลายท่าในกลุ่มนั้น เรียงวันให้ไหล่กับหลังแขนที่ช่วยออกแรงในวันอกได้พักก่อน แต่แต่ละกลุ่มได้ฝึกแค่สัปดาห์ละครั้ง",
    setsPerSession: "6–8 เซ็ต",
    timesPerWeek: "1 ครั้ง",
    note: "สำหรับมือใหม่ แบบ ดัน / ดึง / ขา + บน / ล่าง มักได้ผลดีกว่า เพราะได้ฝึกแต่ละกลุ่มบ่อยกว่า และไม่ต้องอัดหลายเซ็ตในวันเดียว",
  },
  {
    id: "ppl-2",
    name: "ดัน / ดึง / ขา × 2",
    alias: "PPL (Push / Pull / Legs)",
    daysPerWeek: 6,
    week: [PUSH, PULL, LEGS, PUSH, PULL, LEGS, REST],
    why: "วนท่าดัน ท่าดึง และขา 2 รอบ กล้ามที่ใช้ดัน (อก ไหล่ หลังแขน) กับกล้ามที่ใช้ดึง (หลัง หน้าแขน) ไม่ซ้ำกัน จึงฝึกต่อกันได้ ทุกกลุ่มได้พัก 2 วันก่อนฝึกซ้ำ",
    setsPerSession: "2–3 เซ็ต",
    timesPerWeek: "2 ครั้ง",
    note: "6 วันต่อสัปดาห์เหนื่อยสะสมได้ง่าย ถ้าเพิ่งเริ่ม ลองแบบ 3 วันก่อนสัก 2–3 เดือน แล้วค่อยเพิ่มวัน",
  },
];

/** Day counts the picker offers. 7 days is left out on purpose: every week needs a rest day. */
export const DAY_CHOICES = [2, 3, 4, 5, 6];

/** Programs for a day count, the recommended one first. */
export function programsFor(days: number): Program[] {
  return PROGRAMS.filter((p) => p.daysPerWeek === days);
}

/** Every group a training day tires, main or helping. */
export function musclesWorked(day: Day): Set<Muscle> {
  return day.rest ? new Set() : new Set([...day.focus, ...day.helpers]);
}

/** Groups worked on two days in a row (the week wraps), as [day index, muscle]. Empty means safe. */
export function backToBackMuscles(week: Day[]): [number, Muscle][] {
  const clashes: [number, Muscle][] = [];
  week.forEach((day, i) => {
    const next = musclesWorked(week[(i + 1) % week.length]);
    for (const m of musclesWorked(day)) if (next.has(m)) clashes.push([i, m]);
  });
  return clashes;
}

/** Monday-first index (0–6) of a date's weekday, matching Program.week. */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** The program's plan for a date: the weekday's Thai name and that day's session or rest. */
export function planFor(program: Program, date: Date): { weekday: string; day: Day } {
  const i = weekdayIndex(date);
  return { weekday: WEEKDAYS[i], day: program.week[i] };
}

/** Exercise library link filtered to a training day's main muscle groups. */
export function exercisesHref(day: TrainingDay): string {
  return `/exercises?${day.focus.map((m) => `muscle=${m}`).join("&")}`;
}
