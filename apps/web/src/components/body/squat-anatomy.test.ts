// The 3D back squat must stay a pose a real body can make, at every depth and
// with every form fault switched on: joints inside human range, no part
// through another, the bar on the shoulders, the feet on the floor.

import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { BAR_RADIUS, pose, readRig, type Rig } from "./pose";
import { NO_FAULTS, type SquatFaults } from "./squat";

// Past a limit today, by this much at most (degrees from neutral, or metres).
// Each entry is a real problem with the current pose, kept here so it cannot
// get worse and nothing new slips in; fix the pose and delete the entry.
const KNOWN: Record<string, Record<string, number>> = {
  // every pose
  "*": {
    // The clip's shins lean ~55 degrees at the bottom (limit 45).
    "ankle.dorsiflexion": 58,
    // Elbows close to the sides need the shoulders turned out past 90.
    "shoulder.rotation": 113,
    // Inner upper arm folds 2-4.5 cm into the chest at the armpit (hidden in
    // the crease, but real overlap).
    "armL/core": 0.047,
    "armR/core": 0.04,
  },
  // Leaning the pelvis forward on top of the clip's deepest hip bend.
  "forward lean": { "hip.flexion": 130 },
  "heels up": { "hip.flexion": 127 },
  // Tucking the pelvis swings the hips, and the legs follow it: shins lean
  // ~74 degrees and the knees twist. A real butt wink keeps the hips put.
  "butt wink": { "ankle.dorsiflexion": 76, "knee.rotation": 43, "knee.varus": 12 },
  // The knees go in by twisting the shins over planted feet.
  "knees in": { "ankle.toeOut": 31, "ankle.dorsiflexion": 61 },
  "all faults": { "knee.rotation": 34 },
};

const THROUGH = 0.01; // skin may press 1 cm into skin
const BAR_SINK = 0.015; // the bar may press 1.5 cm into the traps
const FLOOR = 0.01;

const FAULTS: [string, SquatFaults][] = [
  ["no faults", NO_FAULTS],
  ["forward lean", { ...NO_FAULTS, forwardLean: true }],
  ["butt wink", { ...NO_FAULTS, buttWink: true }],
  ["knees in", { ...NO_FAULTS, kneeValgus: true }],
  ["heels up", { ...NO_FAULTS, heelRise: true }],
  ["all faults", { forwardLean: true, buttWink: true, kneeValgus: true, heelRise: true }],
];
const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let rig: Rig;
let anatomy: Anatomy;
let body: Body;

beforeAll(async () => {
  const root = await loadBody();
  anatomy = readAnatomy(root);
  body = readBody(root);
  rig = readRig(root);
});

describe.each(FAULTS)("back squat, %s", (name, faults) => {
  const known: Record<string, number> = { ...KNOWN["*"], ...KNOWN[name] };
  test.each(DEPTHS)("depth %s", (depth) => {
    const j = pose(rig, depth, faults);
    const problems: string[] = [];

    for (const v of violations(measure(anatomy))) {
      const motion = v.joint.replace(/^[lr] /, "");
      if (!(Math.abs(v.value) <= (known[motion] ?? 0))) problems.push(`${v.joint} ${v.value.toFixed(0)} (allowed ${v.min}..${v.max})`);
    }

    const c = contact(body, { at: j.bar, dir: j.barDir, radius: BAR_RADIUS, halfWidth: 0.3 });
    for (const t of c.through) {
      const allowed = known[t.pair] ?? THROUGH;
      if (t.depth > allowed) problems.push(`${t.pair} ${(t.depth * 100).toFixed(1)} cm through`);
    }
    if (c.barSink > BAR_SINK) problems.push(`bar ${(c.barSink * 100).toFixed(1)} cm into the shoulders`);
    if (c.floor > FLOOR) problems.push(`skin ${(c.floor * 100).toFixed(1)} cm under the floor`);

    expect(problems.join("; ")).toBe("");
  });
});
