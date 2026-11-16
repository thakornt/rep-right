// English wording for the load report. The API writes its messages and
// disclaimer in Thai (apps/api/internal/domain/load), so in Thai they are shown
// as sent; in English they are written here from each finding's rule and value.

import type { Exercise, Finding, LoadExercise } from "@/lib/api";
import type { Locale } from "@/lib/i18n/locale";

// Same as DefaultConfig in apps/api/internal/domain/load/load.go.
const LOWER_BODY_JUMP_PCT = 10;
const UPPER_BODY_JUMP_PCT = 5;
const CHRONIC_WEEKS = 4;

export const DISCLAIMER_EN =
  "This is general guidance to help you train safely. It is not a diagnosis or medical advice.";

/** The report only names exercises in Thai; English takes the name from the exercise list. */
export function loadExerciseName(
  e: { exercise_id: number; name_th: string },
  exercises: Exercise[],
  locale: Locale,
): string {
  if (locale !== "en") return e.name_th;
  return exercises.find((x) => x.id === e.exercise_id)?.name_en ?? e.name_th;
}

export function findingMessage(f: Finding, e: LoadExercise, exercises: Exercise[], locale: Locale): string {
  if (locale !== "en") return f.message;
  switch (f.rule) {
    case "weight_jump": {
      const lower = exercises.find((x) => x.id === e.exercise_id)?.is_lower_body;
      const limit = lower === false ? UPPER_BODY_JUMP_PCT : LOWER_BODY_JUMP_PCT;
      return `Your heaviest set went up ${Math.round(f.value)}% from last time (we suggest no more than ${limit}%). Try staying at this weight until your form feels steady.`;
    }
    case "volume_spike":
      return `This week you lifted ${f.value.toFixed(1)} times your average over the previous ${CHRONIC_WEEKS} weeks (counting weight × reps). Build up a little at a time.`;
    case "high_rpe_streak":
      return `Your last ${Math.round(f.value)} workouts went close to your limit (1 rep or fewer left). Keep the same weight for now.`;
    case "pain":
      return "You noted pain recently. Don't add weight yet, and consider seeing a doctor or physiotherapist.";
  }
}
