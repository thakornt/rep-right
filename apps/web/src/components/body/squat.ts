// Back squat: what the body does at a given depth, and which muscles work.
// Pure functions so the numbers can be tested without three.js.

import type { Region, Role } from "./muscles";

export type SquatFaults = {
  forwardLean: boolean; // โน้มตัวมากเกิน
  buttWink: boolean; // หลังล่างงอที่ก้นหลุม
  kneeValgus: boolean; // เข่าบีบเข้าใน
  heelRise: boolean; // ส้นเท้ายก
};

export const NO_FAULTS: SquatFaults = { forwardLean: false, buttWink: false, kneeValgus: false, heelRise: false };

export type Phase = "down" | "up";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const deg = (d: number) => (d * Math.PI) / 180;

// Joint angles in degrees for depth 0 (standing) .. 1 (hips below the knees).
// Thigh angle is from vertical, so 90 = thigh parallel to the floor. Knees
// travel well past the toes at the bottom, which keeps the chest up.
export function legAngles(depth: number, faults: SquatFaults) {
  const shin = lerp(3, 40, depth) + (faults.heelRise ? 8 * depth : 0);
  const thigh = lerp(4, 112, depth);
  // Butt wink: the pelvis tucks under once the hips run out of flexion.
  const wink = faults.buttWink ? Math.max(0, depth - 0.6) / 0.4 : 0;
  return {
    shin,
    thigh,
    heelLift: faults.heelRise ? 16 * depth : 0,
    pelvisTuck: 22 * wink,
    // Extra trunk lean on top of the balanced angle.
    extraLean: faults.forwardLean ? 18 * depth : 0,
    kneeIn: faults.kneeValgus ? Math.min(1, depth * 1.3) : 0,
  };
}

// Hip centre relative to the ankle, in the side view (z forward, y up),
// for shin and thigh of the given lengths.
export function hipFromAnkle(shinDeg: number, thighDeg: number, shinLen: number, thighLen: number) {
  const s = deg(shinDeg);
  const t = deg(thighDeg);
  return {
    z: shinLen * Math.sin(s) - thighLen * Math.sin(t),
    y: shinLen * Math.cos(s) + thighLen * Math.cos(t),
  };
}

// Trunk lean (radians, forward positive) that puts the bar straight over
// targetZ. `bar` is the bar's offset from the hip when standing upright.
export function balancedLean(hipZ: number, targetZ: number, bar: { y: number; z: number }) {
  const r = Math.hypot(bar.y, bar.z);
  const phi = Math.atan2(bar.z, bar.y);
  const s = Math.max(-1, Math.min(1, (targetZ - hipZ) / r));
  return Math.asin(s) - phi;
}

// Setup cue pins on the body, numbered in the order they are listed. A pin
// turns red when one of the faults it guards against is switched on.
export const SQUAT_PINS: { id: string; warn: (f: SquatFaults) => boolean }[] = [
  { id: "feet", warn: (f) => f.heelRise },
  { id: "knee", warn: (f) => f.kneeValgus },
  { id: "core", warn: () => false },
  { id: "back", warn: (f) => f.buttWink || f.forwardLean },
  { id: "bar", warn: (f) => f.forwardLean },
];

export type Activation = { region: Region; role: Role; amount: number; warn?: boolean };

// General guidance on who works in a back squat, not EMG data. Prime movers
// work harder the deeper you go and while standing back up.
export function squatActivation(depth: number, phase: Phase, faults: SquatFaults): Activation[] {
  const effort = phase === "up" ? 1 : 0.8;
  const d = depth;
  const list: Activation[] = [
    { region: "quads", role: "prime", amount: (0.35 + 0.65 * d) * effort },
    { region: "glutes", role: "prime", amount: (0.2 + 0.8 * d * d) * effort },
    { region: "adductors", role: "synergist", amount: (0.15 + 0.75 * d) * effort },
    { region: "hamstrings", role: "synergist", amount: 0.15 + 0.3 * d },
    { region: "calves", role: "stabilizer", amount: 0.3 },
    { region: "erectors", role: "stabilizer", amount: 0.35 + 0.25 * d },
    { region: "abs", role: "stabilizer", amount: 0.45 },
    { region: "obliques", role: "stabilizer", amount: 0.4 },
    { region: "upper_back", role: "stabilizer", amount: 0.4 },
    { region: "lats", role: "stabilizer", amount: 0.3 },
  ];
  const warn = (r: Region) => {
    const a = list.find((x) => x.region === r);
    if (a) a.warn = true;
  };
  if (faults.forwardLean || faults.buttWink) warn("erectors");
  if (faults.kneeValgus) warn("adductors");
  if (faults.heelRise) warn("quads");
  return list;
}
