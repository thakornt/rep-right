// Incline dumbbell press: which muscles work. General guidance, not EMG data.

import type { Activation } from "./squat";

export const PRESS_PINS = ["feet", "back", "elbow", "dumbbell", "core"] as const;
export type PressPin = (typeof PRESS_PINS)[number];

// Depth 0 = arms up, 1 = dumbbells down beside the upper chest. The chest works
// hardest stretched at the bottom and while pressing up.
export function pressActivation(depth: number, phase: "down" | "up"): Activation[] {
  const effort = phase === "up" ? 1 : 0.8;
  return [
    { region: "chest", role: "prime", amount: (0.4 + 0.6 * depth) * effort },
    { region: "delts", role: "synergist", amount: (0.35 + 0.45 * depth) * effort },
    { region: "triceps", role: "synergist", amount: (0.75 - 0.25 * depth) * effort },
    { region: "forearms", role: "stabilizer", amount: 0.45 },
    { region: "biceps", role: "stabilizer", amount: 0.25 },
    { region: "upper_back", role: "stabilizer", amount: 0.75 }, // holding the shoulder blades back,
    { region: "lats", role: "stabilizer", amount: 0.3 },
    { region: "abs", role: "stabilizer", amount: 0.35 },
  ];
}
