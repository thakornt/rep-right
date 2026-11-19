// Each exercise page's name, kept here so the page's title, description and heading are in the
// prerendered HTML (search engines and link previews read that, not what the browser fetches
// later). Same names as the exercises table after the latest migration in apps/api/db/migrations;
// a test checks every exercise with form content has one.

export type ExerciseName = { th: string; en: string };

export const EXERCISE_NAMES: Record<string, ExerciseName> = {
  "barbell-squat": { th: "บาร์เบลสควอท", en: "Barbell Squat" },
  "dumbbell-squat": { th: "ดัมเบลสควอท", en: "Dumbbell Squat" },
  deadlift: { th: "เดดลิฟต์", en: "Deadlift" },
  "romanian-deadlift": { th: "โรมาเนียนเดดลิฟต์", en: "Romanian Deadlift" },
  "hip-thrust": { th: "ฮิปทรัสต์", en: "Hip Thrust" },
  "leg-extension": { th: "เลกเอ็กซ์เทนชัน", en: "Leg Extension" },
  "leg-curl": { th: "เลกเคิร์ล", en: "Leg Curl" },
  "calf-raise": { th: "คาล์ฟเรส", en: "Calf Raise" },
  "bench-press": { th: "เบนช์เพรส", en: "Bench Press" },
  "machine-chest-press": { th: "แมชชีนเชสต์เพรส", en: "Machine Chest Press" },
  "incline-dumbbell-press": { th: "อินไคลน์ดัมเบลเพรส", en: "Incline Dumbbell Press" },
  "push-up": { th: "วิดพื้น", en: "Push-up" },
  "overhead-press": { th: "โอเวอร์เฮดเพรส", en: "Overhead Press" },
  "barbell-row": { th: "บาร์เบลโรว์", en: "Barbell Row" },
  "chest-supported-row": { th: "เชสต์ซัพพอร์ตโรว์", en: "Chest-Supported Row" },
  "single-arm-dumbbell-row": { th: "ดัมเบลโรว์ แขนเดียว", en: "Single-Arm Dumbbell Row" },
  "pull-up": { th: "พูลอัพ", en: "Pull-up" },
  "lat-pulldown": { th: "แลตพูลดาวน์", en: "Lat Pulldown" },
  shrug: { th: "ชรัก", en: "Shrug" },
  "face-pull": { th: "เฟซพูล", en: "Face Pull" },
  "single-arm-cable-rear-delt-fly": { th: "เคเบิลรีเออร์เดลต์ฟลาย แขนเดียว", en: "Single-Arm Cable Rear Delt Fly" },
  "dumbbell-lateral-raise": { th: "ดัมเบลแลตเทอรัลเรส", en: "Dumbbell Lateral Raise" },
  "cable-lateral-raise": { th: "เคเบิลแลตเทอรัลเรส", en: "Cable Lateral Raise" },
  "incline-dumbbell-lateral-raise": { th: "อินไคลน์แลตเทอรัลเรส", en: "Incline Dumbbell Lateral Raise" },
  "upright-row": { th: "อัพไรต์โรว์", en: "Upright Row" },
  "dumbbell-curl": { th: "ดัมเบลเคิร์ล", en: "Dumbbell Curl" },
  "hammer-curl": { th: "แฮมเมอร์เคิร์ล", en: "Hammer Curl" },
  "incline-dumbbell-curl": { th: "อินไคลน์ดัมเบลเคิร์ล", en: "Incline Dumbbell Curl" },
  "cable-curl": { th: "เคเบิลเคิร์ล", en: "Cable Curl" },
  "rope-triceps-pushdown": { th: "ไตรเซปส์พุชดาวน์ (เชือก)", en: "Rope Triceps Pushdown" },
  "overhead-triceps-extension": { th: "ไตรเซปส์เอ็กซ์เทนชันเหนือหัว", en: "Overhead Triceps Extension" },
  crunch: { th: "ครันช์", en: "Crunch" },
  "cable-crunch": { th: "เคเบิลครันช์", en: "Cable Crunch" },
  "leg-raise": { th: "เลกเรส", en: "Leg Raise" },
};

/**
 * Exercises whose page opens on a 3D figure (see exercise-detail.tsx), so their title can say so.
 * The barbell squat and overhead press count: their first option (bar on the back, seated) has one.
 */
export const HAS_3D = new Set([
  "barbell-squat",
  "overhead-press",
  "overhead-triceps-extension",
  "upright-row",
  "lat-pulldown",
  "pull-up",
  "incline-dumbbell-press",
  "hammer-curl",
  "dumbbell-lateral-raise",
  "dumbbell-squat",
  "rope-triceps-pushdown",
  "push-up",
  "crunch",
  "leg-extension",
  "single-arm-dumbbell-row",
  "romanian-deadlift",
  "face-pull",
  "hip-thrust",
  "shrug",
  "machine-chest-press",
]);
