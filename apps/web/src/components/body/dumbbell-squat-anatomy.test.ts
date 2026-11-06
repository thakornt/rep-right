// The 3D dumbbell squat must stay a pose a real body can make, through the whole lift,
// and hold the form in the owner's reference picture: a nearly straight stand, down to
// the hips just below the knees, trunk leaning a little, knees over the toes, heels
// flat, and the dumbbells hanging straight beside the legs.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { trunkLean, worldPos } from "./pose";
import { DUMBBELL_SQUAT, poseDumbbellSquat, readDumbbellSquatRig, type DumbbellSquatRig } from "./pose-dumbbell-squat";
import { DUMBBELL } from "./pose-press";

const ARMPIT_FOLD = 0.045; // skin folding at the shoulder joint; the same allowance as the other dumbbell lifts
const THROUGH = 0.01;
const FLOOR = 0.01;
const MAX_FINGER_GAP = 0.035; // middle finger bones to the handle's centre
const MIN_DUMBBELL_GAP = 0.04; // dumbbell to the trunk, head and legs at any point of the lift
const MAX_ANKLE = 45; // degrees, the limit under load: the trunk and hips must change before this
const MAX_KNEE_STAND = 15; // degrees the knee stays bent standing: soft, not squatting
const MAX_HIP_ABOVE_KNEE = 0; // metres: the hip joint reaches the knee's height at the bottom
const MAX_HIP_BELOW_KNEE = 0.03; // and goes only just below it
const MAX_KNEE_OFF_TOES = 3; // degrees a bent knee may be off the toes' line, seen from above
const MAX_SHOULDER_DRIFT = 0.001; // metres the shoulders may leave the middle of the foot
const MAX_WEIGHT_DRIFT = 0.02; // metres a dumbbell may move forward or back through the lift
const MAX_STEP = 0.012; // metres a joint may move per 1% of the lift
const MAX_KNEE_BACK = 0.003; // metres the knee may come back on the way down: it shouldn't show as a jerk
const MIN_FLOOR_CLEAR = 0.1; // metres of air under the dumbbells at the bottom
const MAX_TILT = 18; // degrees a dumbbell may lean from level, as in grip.test.ts
const STRAIGHT_WRIST = 2; // degrees
const BENT_ENOUGH = 0.4; // depth from which the knee is bent enough to have a clear line

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let root: THREE.Object3D;
let squat: DumbbellSquatRig;
let anatomy: Anatomy;
let body: Body;

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  squat = readDumbbellSquatRig(root);
  body = readBody(root);
});

const left = () => measure(anatomy).l as unknown as Record<string, number>;

function dumbbellToSkin(g: ReturnType<typeof poseDumbbellSquat>) {
  const p = new THREE.Vector3();
  let gap = Infinity;
  body.part.forEach((part, i) => {
    if (part !== "core" && part !== "legL" && part !== "legR") return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    for (const { grip, handle } of [g.l, g.r]) {
      const w = p.clone().sub(grip);
      const along = w.dot(handle);
      const past = Math.max(0, Math.abs(along) - (DUMBBELL.headAt + DUMBBELL.headWidth / 2));
      const out = Math.max(0, w.addScaledVector(handle, -along).length() - DUMBBELL.headRadius);
      gap = Math.min(gap, Math.hypot(past, out));
    }
  });
  return gap;
}

describe("dumbbell squat", () => {
  test.each(DEPTHS)("depth %s", (depth) => {
    const g = poseDumbbellSquat(squat, depth);
    const problems: string[] = [];

    for (const v of violations(measure(anatomy))) problems.push(`${v.joint} ${v.value.toFixed(0)} (${v.min}..${v.max})`);

    const c = contact(body);
    for (const t of c.through) {
      const allowed = t.pair.endsWith("/core") ? ARMPIT_FOLD : THROUGH;
      if (t.depth > allowed) problems.push(`${t.pair} ${(t.depth * 100).toFixed(1)} cm through`);
    }
    if (c.floor > FLOOR) problems.push(`skin ${(c.floor * 100).toFixed(1)} cm under the floor`);

    for (const tag of ["l", "r"] as const) {
      for (const f of ["index", "middle", "ring", "pinky"]) {
        const { grip, handle } = g[tag];
        const w = worldPos(root.getObjectByName(`${f}_02_${tag}`)!).sub(grip);
        const gap = w.addScaledVector(handle, -w.dot(handle)).length();
        if (gap > MAX_FINGER_GAP) problems.push(`${tag} ${f} ${(gap * 100).toFixed(1)} cm from the handle`);
      }
    }

    const gap = dumbbellToSkin(g);
    if (gap < MIN_DUMBBELL_GAP) problems.push(`dumbbell ${(gap * 100).toFixed(1)} cm from the body`);
    if (left()["ankle.dorsiflexion"] > MAX_ANKLE) problems.push(`ankle ${left()["ankle.dorsiflexion"].toFixed(0)}`);

    expect(problems.join("; ")).toBe("");
  });

  test("it stands nearly straight, and goes down to the hips just below the knees", () => {
    poseDumbbellSquat(squat, 0);
    expect(left()["knee.flexion"]).toBeGreaterThan(5);
    expect(left()["knee.flexion"]).toBeLessThan(MAX_KNEE_STAND);
    poseDumbbellSquat(squat, 1);
    const below = worldPos(squat.rig.l.calf).y - worldPos(squat.rig.l.thigh).y;
    expect(below).toBeGreaterThan(MAX_HIP_ABOVE_KNEE);
    expect(below).toBeLessThan(MAX_HIP_BELOW_KNEE);
  });

  test("the trunk stays straight and leans only as far as the form asks", () => {
    for (const d of DEPTHS) {
      poseDumbbellSquat(squat, d);
      const m = measure(anatomy);
      expect(Math.abs(m.trunk["lumbar.flexion"]!)).toBeLessThan(1);
      expect(Math.abs(m.trunk["thoracic.flexion"]!)).toBeLessThan(1);
    }
    poseDumbbellSquat(squat, 0);
    const standing = trunkLean(squat.rig);
    poseDumbbellSquat(squat, 1);
    expect(THREE.MathUtils.radToDeg(trunkLean(squat.rig) - standing)).toBeCloseTo(DUMBBELL_SQUAT.leanBottom, 0);
  });

  test("the knees follow the toes", () => {
    for (const d of DEPTHS.filter((x) => x >= BENT_ENOUGH)) {
      poseDumbbellSquat(squat, d);
      for (const s of [squat.rig.l, squat.rig.r]) {
        const knee = worldPos(s.calf);
        const ankle = worldPos(s.foot);
        const line = THREE.MathUtils.radToDeg(Math.atan2(s.sign * (knee.x - ankle.x), knee.z - ankle.z));
        expect(Math.abs(line - DUMBBELL_SQUAT.toeOut)).toBeLessThan(MAX_KNEE_OFF_TOES);
      }
    }
  });

  test("the shoulders stay over the foot, so the dumbbells go straight up and down", () => {
    const gripZ: number[] = [];
    for (const d of DEPTHS) {
      const g = poseDumbbellSquat(squat, d);
      expect(Math.abs(worldPos(squat.l.s.upperarm).z - squat.midfootZ)).toBeLessThan(MAX_SHOULDER_DRIFT);
      gripZ.push(g.l.grip.z);
    }
    expect(Math.max(...gripZ) - Math.min(...gripZ)).toBeLessThan(MAX_WEIGHT_DRIFT);
  });

  test("the dumbbells hang level, palms in, wrists straight, clear of the floor", () => {
    for (const d of DEPTHS) {
      const g = poseDumbbellSquat(squat, d);
      const m = left();
      expect(m["forearm.pronation"]).toBeGreaterThan(80);
      expect(m["forearm.pronation"]).toBeLessThan(110);
      expect(Math.abs(m["wrist.flexion"])).toBeLessThan(STRAIGHT_WRIST);
      expect(Math.abs(m["wrist.deviation"])).toBeLessThan(STRAIGHT_WRIST);
      expect(m["elbow.flexion"]).toBeCloseTo(DUMBBELL_SQUAT.elbowBend, 0);
      for (const tag of ["l", "r"] as const) {
        expect(THREE.MathUtils.radToDeg(Math.asin(Math.abs(g[tag].handle.y)))).toBeLessThan(MAX_TILT);
        expect(g[tag].grip.y - DUMBBELL.headRadius).toBeGreaterThan(MIN_FLOOR_CLEAR);
      }
    }
  });

  test("it moves smoothly and evenly: no joint jumps, nothing reverses, feet flat", () => {
    const { rig } = squat;
    const n = 100;
    const track = (d: number) => {
      const g = poseDumbbellSquat(squat, d);
      return {
        g,
        hip: worldPos(rig.l.thigh),
        knee: worldPos(rig.l.calf),
        neck: worldPos(rig.neck),
      };
    };
    let prev = track(0);
    let furthestKnee = prev.knee.z;
    for (let i = 1; i <= n; i++) {
      const now = track(i / n);
      expect(now.g.l.grip.distanceTo(prev.g.l.grip)).toBeLessThan(MAX_STEP);
      expect(now.hip.distanceTo(prev.hip)).toBeLessThan(MAX_STEP);
      expect(now.neck.distanceTo(prev.neck)).toBeLessThan(MAX_STEP);
      expect(Math.abs(now.g.l.grip.x + now.g.r.grip.x)).toBeLessThan(0.01);
      // Down and back the whole way; the knee goes forward and doesn't come back.
      expect(now.hip.y).toBeLessThan(prev.hip.y);
      expect(now.hip.z).toBeLessThan(prev.hip.z);
      expect(now.neck.y).toBeLessThan(prev.neck.y);
      furthestKnee = Math.max(furthestKnee, now.knee.z);
      expect(furthestKnee - now.knee.z).toBeLessThan(MAX_KNEE_BACK);
      expect(worldPos(rig.l.foot).y).toBeCloseTo(rig.l.ankle.y, 3);
      expect(Math.abs(worldPos(rig.l.foot).x)).toBeCloseTo(DUMBBELL_SQUAT.stance, 2);
      prev = now;
    }
  });
});
