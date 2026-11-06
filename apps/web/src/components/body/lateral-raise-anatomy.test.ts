// The 3D lateral raise must stay a pose a real body can make, through the whole lift,
// and hold the form in the owner's reference photo: knees soft, hips back, trunk
// leaning forward, and the elbow a little bent and leading the hand.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { worldPos } from "./pose";
import { DUMBBELL } from "./pose-press";
import { LATERAL_RAISE, poseRaise, readRaiseRig, type RaiseRig } from "./pose-raise";

const ARMPIT_FOLD = 0.045; // skin folding at the shoulder joint; the same allowance as the other dumbbell lifts
const THROUGH = 0.01;
const FLOOR = 0.01;
const MAX_FINGER_GAP = 0.035; // middle finger bones to the handle's centre
const MIN_DUMBBELL_GAP = 0.04; // dumbbell to the trunk, head and legs at any point of the lift
const MAX_STEP = 0.012; // metres a hand may move per 1% of the lift
const STRAIGHT_WRIST = 2; // degrees
const MAX_TILT = 18; // degrees the dumbbell may lean from level at the top, as in grip.test.ts
const MIN_ELBOW_LEAD = 0.03; // metres the elbow stays above the wrist at every height
const TOP_ELBOW_OFF_SHOULDER = 0.03; // metres the elbow may be off the shoulder's height at the top
const TOP_BELOW_SHOULDER = 0.08; // metres the wrist may be below the shoulder at the top
const MIN_KNEE = 15; // degrees: bent, as in the owner's photo
const MAX_KNEE = 40; // and only a little: not a squat

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let root: THREE.Object3D;
let raise: RaiseRig;
let anatomy: Anatomy;
let body: Body;

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  raise = readRaiseRig(root);
  body = readBody(root);
});

const left = () => measure(anatomy).l as unknown as Record<string, number>;

// Lowest distance from a dumbbell to the skin of the trunk, head and legs.
function dumbbellToSkin(g: ReturnType<typeof poseRaise>) {
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

describe("dumbbell lateral raise", () => {
  test.each(DEPTHS)("depth %s", (depth) => {
    const g = poseRaise(raise, depth);
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

    expect(problems.join("; ")).toBe("");
  });

  test("the elbow keeps the same small bend, and the wrist stays straight", () => {
    for (const d of DEPTHS) {
      poseRaise(raise, d);
      const m = left();
      expect(m["elbow.flexion"]).toBeCloseTo(LATERAL_RAISE.elbowBend, 0);
      expect(Math.abs(m["wrist.flexion"])).toBeLessThan(STRAIGHT_WRIST);
      expect(Math.abs(m["wrist.deviation"])).toBeLessThan(STRAIGHT_WRIST);
      expect(Math.abs(m["wrist.twist"])).toBeLessThan(STRAIGHT_WRIST);
    }
  });

  test("the elbow leads: it stays above the hand all the way up, the upper arm turned in", () => {
    for (const d of DEPTHS) {
      poseRaise(raise, d);
      const { s } = raise.l;
      expect(worldPos(s.lowerarm).y - worldPos(s.hand).y).toBeGreaterThan(MIN_ELBOW_LEAD);
      // Negative = turned in.
      expect(left()["shoulder.rotation"]).toBeLessThan(0);
    }
  });

  test("the elbow stops about shoulder height, the hand just below it", () => {
    poseRaise(raise, 0);
    const { s } = raise.l;
    const elbow = worldPos(s.lowerarm).y - worldPos(s.upperarm).y;
    expect(Math.abs(elbow)).toBeLessThan(TOP_ELBOW_OFF_SHOULDER);
    expect(worldPos(s.hand).y - worldPos(s.upperarm).y).toBeGreaterThan(-TOP_BELOW_SHOULDER);
  });

  test("the body holds the reference's position: knees soft, hips back, back straight, leaning forward", () => {
    for (const d of DEPTHS) {
      poseRaise(raise, d);
      const { rig } = raise;
      const fromAnkle = (o: THREE.Object3D) => worldPos(o).z - rig.l.ankle.z;
      expect(fromAnkle(rig.pelvis)).toBeCloseTo(-LATERAL_RAISE.hipsBack, 2);
      expect(fromAnkle(rig.l.calf)).toBeGreaterThan(0.02); // knee over the toes' side of the ankle
      expect(fromAnkle(raise.l.s.upperarm)).toBeGreaterThan(0.01); // shoulders ahead of the ankles, over the foot
      const m = measure(anatomy);
      expect(left()["knee.flexion"]).toBeGreaterThan(MIN_KNEE);
      expect(left()["knee.flexion"]).toBeLessThan(MAX_KNEE);
      expect(Math.abs(m.trunk["lumbar.flexion"]!)).toBeLessThan(1);
      expect(Math.abs(m.trunk["thoracic.flexion"]!)).toBeLessThan(1);
    }
  });

  test("the palm faces in at the bottom and down at the top, the thumb side forward", () => {
    const facing = (d: number) => {
      poseRaise(raise, d);
      const { s } = raise.l;
      const fore = worldPos(s.hand).sub(worldPos(s.lowerarm)).normalize();
      const thumbs = worldPos(root.getObjectByName("index_01_l")!).sub(worldPos(root.getObjectByName("ring_01_l")!));
      // Which way the palm faces, on the left arm.
      return { palm: fore.clone().cross(thumbs).normalize(), thumbs: thumbs.normalize() };
    };
    const low = facing(1);
    expect(low.palm.x).toBeLessThan(-0.7); // toward the body
    expect(low.thumbs.z).toBeGreaterThan(0.5);
    const high = facing(0);
    expect(high.palm.y).toBeLessThan(-0.7); // toward the floor
    expect(high.thumbs.z).toBeGreaterThan(0.5);
  });

  test("the dumbbell sits near level at the top", () => {
    const g = poseRaise(raise, 0);
    for (const tag of ["l", "r"] as const) {
      expect(THREE.MathUtils.radToDeg(Math.asin(Math.abs(g[tag].handle.y)))).toBeLessThan(MAX_TILT);
    }
  });

  test("only the arms and shoulders move, smoothly and evenly, with the feet flat and the body held", () => {
    const { rig } = raise;
    poseRaise(raise, 0);
    const bones = [rig.pelvis, rig.spine3, rig.neck, rig.l.foot, rig.r.foot, rig.l.calf, rig.r.calf];
    const still = bones.map(worldPos);
    expect(Math.abs(worldPos(rig.l.foot).x)).toBeCloseTo(LATERAL_RAISE.stance, 2);
    expect(worldPos(rig.l.foot).y).toBeCloseTo(rig.l.ankle.y, 3);
    const n = 100;
    let prev = poseRaise(raise, 0);
    for (let i = 1; i <= n; i++) {
      const g = poseRaise(raise, i / n);
      expect(g.l.grip.distanceTo(prev.l.grip)).toBeLessThan(MAX_STEP);
      expect(g.r.grip.distanceTo(prev.r.grip)).toBeLessThan(MAX_STEP);
      expect(Math.abs(g.l.grip.x + g.r.grip.x)).toBeLessThan(0.01);
      prev = g;
      bones.forEach((b, k) => expect(worldPos(b).distanceTo(still[k])).toBeLessThan(0.002));
    }
  });
});
