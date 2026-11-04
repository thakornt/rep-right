// The 3D back squat must stay a pose a real body can make, at every depth and
// with each form fault: joints inside human range, no part
// through another, the bar on the shoulders, the feet on the floor.

import * as THREE from "three";
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
    // Elbows close to the sides need the shoulders turned out past 90, a little
    // more with the bar down off the neck (accepted for the bar's position).
    "shoulder.rotation": 116,
    // Inner upper arm folds 2-5 cm into the chest at the armpit (hidden in
    // the crease, but real overlap).
    "armL/core": 0.048,
    "armR/core": 0.048,
  },
};

const THROUGH = 0.01; // skin may press 1 cm into skin
const BAR_SINK = 0.008; // the bar may press under 1 cm into the skin (traps, base of the neck)
const BAR_ON_TRAPS = 0.01; // and rest within 1 cm of the traps, not float over them
const FLOOR = 0.01;
const KNEE_GAP = 0.16; // between knee joint centres; about a knee's width of clear air
const MAX_KNEE_STEP = 0.004; // per 0.5% of depth
const MAX_KNEE_BACK_IN = 0.01; // once out, a knee may come back in 1 cm
const MAX_KNEE_UNEVEN = 0.015;
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

// Motion, not single poses: a smooth path with no pop near full standing, and
// knees moving the same way on both sides.
test("the knees move smoothly and evenly through the squat", () => {
  const n = 200;
  const l: THREE.Vector3[] = [];
  const r: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    pose(rig, i / n, NO_FAULTS);
    l.push(worldPos(rig.l.calf));
    r.push(worldPos(rig.r.calf));
  }
  const problems: string[] = [];
  for (const [side, path] of [["l", l], ["r", r]] as const) {
    const sign = side === "l" ? 1 : -1;
    let widest = -Infinity;
    let backIn = 0;
    path.forEach((p, i) => {
      if (i > 0 && p.distanceTo(path[i - 1]) > MAX_KNEE_STEP) problems.push(`${side} knee jumps at depth ${i / n}`);
      widest = Math.max(widest, sign * p.x);
      backIn = Math.max(backIn, widest - sign * p.x);
    });
    if (backIn > MAX_KNEE_BACK_IN) problems.push(`${side} knee comes back in ${(backIn * 100).toFixed(1)} cm`);
  }
  const centre = rig.l.ankle.x + rig.r.ankle.x; // twice the middle of the feet
  l.forEach((p, i) => {
    if (Math.abs(p.x + r[i].x - centre) > MAX_KNEE_UNEVEN) problems.push(`knees uneven at depth ${i / n}`);
  });
  expect(problems.join("; ")).toBe("");
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
    // Riding up onto the neck: the bar must stay below the base of the neck.
    const chestUp = worldPos(rig.neck).sub(worldPos(rig.spine3)).normalize();
    if (worldPos(rig.neck).sub(j.bar).dot(chestUp) < 0) problems.push("bar above the base of the neck");
    let onTraps = Infinity;
    const p = new THREE.Vector3();
    for (const i of rig.traps) {
      rig.skin.getVertexPosition(i, p).applyMatrix4(rig.skin.matrixWorld).sub(j.bar);
      onTraps = Math.min(onTraps, p.addScaledVector(j.barDir, -p.dot(j.barDir)).length() - BAR_RADIUS);
    }
    if (onTraps > BAR_ON_TRAPS) problems.push(`bar floats ${(onTraps * 100).toFixed(1)} cm over the traps`);
    // Knees must not knock together, even when caving in.
    const kneeGap = worldPos(rig.l.calf).x - worldPos(rig.r.calf).x;
    if (kneeGap < KNEE_GAP) problems.push(`knees only ${(kneeGap * 100).toFixed(0)} cm apart`);
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
