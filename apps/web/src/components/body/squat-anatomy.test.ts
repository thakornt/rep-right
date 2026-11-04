// The 3D back squat must stay a pose a real body can make, at every depth and
// with each form fault: joints inside human range, no part
// through another, the bar on the shoulders, the feet on the floor.

import type * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { BAR_RADIUS, pose, readRig, worldPos, type Rig } from "./pose";
import { NO_FAULTS, type SquatFaults } from "./squat";

// Past a limit today, by this much at most (degrees from neutral, or metres).
// Each entry is a real problem with the current pose, kept here so it cannot
// get worse and nothing new slips in; fix the pose and delete the entry.
const KNOWN: Record<string, Record<string, number>> = {
  // every pose
  "*": {
    // Elbows close to the sides need the shoulders turned out past 90.
    "shoulder.rotation": 113,
    // Inner upper arm folds 2-4 cm into the chest at the armpit (hidden in
    // the crease, but real overlap).
    "armL/core": 0.042,
    "armR/core": 0.04,
  },
};

const THROUGH = 0.01; // skin may press 1 cm into skin
const BAR_SINK = 0.015; // the bar may press 1.5 cm into the traps
const FLOOR = 0.01;
const STRAIGHT_BACK = 15; // correct form: degrees the whole back may round
const PLANTED = 0.01; // heel and toes stay within 1 cm of where they stand

// One at a time, as the app shows them: mixed, they stop showing any one
// mistake.
const FAULTS: [string, SquatFaults][] = [
  ["no faults", NO_FAULTS],
  ["forward lean", { ...NO_FAULTS, forwardLean: true }],
  ["butt wink", { ...NO_FAULTS, buttWink: true }],
  ["knees in", { ...NO_FAULTS, kneeValgus: true }],
  ["heels up", { ...NO_FAULTS, heelRise: true }],
];
const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let rig: Rig;
let anatomy: Anatomy;
let body: Body;
let stand: Record<"l" | "r", { heel: THREE.Vector3; toes: THREE.Vector3 }>;

beforeAll(async () => {
  const root = await loadBody();
  anatomy = readAnatomy(root);
  body = readBody(root);
  rig = readRig(root);
  pose(rig, 0, NO_FAULTS);
  stand = {
    l: { heel: worldPos(rig.l.foot), toes: worldPos(rig.l.ball) },
    r: { heel: worldPos(rig.r.foot), toes: worldPos(rig.r.ball) },
  };
});

describe.each(FAULTS)("back squat, %s", (name, faults) => {
  const known: Record<string, number> = { ...KNOWN["*"], ...KNOWN[name] };
  test.each(DEPTHS)("depth %s", (depth) => {
    const j = pose(rig, depth, faults);
    const problems: string[] = [];

    const m = measure(anatomy);
    const rounding = m.trunk["lumbar.flexion"]! + m.trunk["thoracic.flexion"]!;
    if (name === "no faults" && rounding > STRAIGHT_BACK) problems.push(`back rounds ${rounding.toFixed(0)} degrees`);

    for (const v of violations(m)) {
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
    for (const [side, s] of [["l", rig.l], ["r", rig.r]] as const) {
      for (const [part, bone] of [["heel", s.foot], ["toes", s.ball]] as const) {
        if (part === "heel" && faults.heelRise) continue; // the heel lifting is the fault
        const moved = worldPos(bone).distanceTo(stand[side][part]);
        if (moved > PLANTED) problems.push(`${side} ${part} moved ${(moved * 100).toFixed(1)} cm`);
      }
    }

    expect(problems.join("; ")).toBe("");
  });
});
