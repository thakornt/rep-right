import { describe, expect, it } from "vitest";

import type { Exercise, Finding, LoadExercise } from "@/lib/api";

import { findingMessage, loadExerciseName } from "./insight-text";

const squat: Exercise = {
  id: 1,
  slug: "barbell-squat",
  name_th: "บาร์เบลสควอท",
  name_en: "Barbell Squat",
  category: "legs",
  is_lower_body: true,
  muscles: ["quads"],
  equipment: ["barbell"],
};
const curl: Exercise = { ...squat, id: 2, slug: "hammer-curl", name_th: "แฮมเมอร์เคิร์ล", name_en: "Hammer Curl", is_lower_body: false };

const report = (id: number, finding: Finding): LoadExercise => ({
  exercise_id: id,
  slug: "",
  name_th: "ชื่อไทย",
  advice: "hold",
  findings: [finding],
});

describe("load report wording", () => {
  it("keeps the API's Thai as it is", () => {
    const f: Finding = { rule: "weight_jump", level: "caution", value: 12, message: "ข้อความไทย" };
    expect(findingMessage(f, report(1, f), [squat], "th")).toBe("ข้อความไทย");
    expect(loadExerciseName(report(1, f), [squat], "th")).toBe("ชื่อไทย");
  });

  it("writes English from the rule and value", () => {
    const jump: Finding = { rule: "weight_jump", level: "caution", value: 12.4, message: "" };
    expect(findingMessage(jump, report(1, jump), [squat, curl], "en")).toContain("went up 12% ");
    expect(findingMessage(jump, report(1, jump), [squat, curl], "en")).toContain("no more than 10%");
    expect(findingMessage(jump, report(2, jump), [squat, curl], "en")).toContain("no more than 5%");

    const volume: Finding = { rule: "volume_spike", level: "risk", value: 1.62, message: "" };
    expect(findingMessage(volume, report(1, volume), [squat], "en")).toContain("1.6 times");

    const streak: Finding = { rule: "high_rpe_streak", level: "caution", value: 2, message: "" };
    expect(findingMessage(streak, report(1, streak), [squat], "en")).toContain("last 2 workouts");
  });

  it("names exercises in English from the list, or falls back to the Thai name", () => {
    const f: Finding = { rule: "pain", level: "risk", value: 0, message: "" };
    expect(loadExerciseName(report(1, f), [squat], "en")).toBe("Barbell Squat");
    expect(loadExerciseName(report(9, f), [squat], "en")).toBe("ชื่อไทย");
  });
});
