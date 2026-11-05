// The 3D seated dumbbell shoulder press must stay a pose a real body can make,
// through the whole lift, sitting on an upright bench with the weight overhead.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact } from "./contact";
import { loadBody } from "./load-body";
import { worldPos } from "./pose";
import { benchLayout, DUMBBELL, posePress, readPressRig, SHOULDER_PRESS, type PressRig } from "./pose-press";

const ARMPIT_FOLD = 0.045; // skin folding at the shoulder joint; hidden, but real overlap
const THROUGH = 0.01;
const FLOOR = 0.01;
const ON_BENCH = 0.015;
const MAX_FOREARM_TILT = 10; // degrees from vertical at any point of the lift: the hands arc to keep it upright
const WRIST_LEVELLING = 23; // degrees of sideways wrist bend allowed
const MAX_STEP = 0.017; // metres a hand may move per 1% of the lift
const MAX_FINGER_GAP = 0.035; // middle finger bones to the handle's centre

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let root: THREE.Object3D;
let press: PressRig;
let anatomy: Anatomy;

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  press = readPressRig(root, SHOULDER_PRESS);
});

// Lowest distance from a dumbbell's heads to the skin of the trunk and head.
function dumbbellToSkin(g: ReturnType<typeof posePress>) {
  const p = new THREE.Vector3();
  let gap = Infinity;
  press.body.part.forEach((part, i) => {
    if (part !== "core") return;
    press.body.mesh.getVertexPosition(i, p).applyMatrix4(press.body.mesh.matrixWorld);
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

describe("seated dumbbell shoulder press", () => {
  test.each(DEPTHS)("depth %s", (depth) => {
    const g = posePress(press, depth);
    const problems: string[] = [];

    for (const v of violations(measure(anatomy))) {
      // Past the 20 limit near the bottom: the wrist keeps the dumbbell level, as the owner asked.
      if (v.joint.endsWith("wrist.deviation") && Math.abs(v.value) <= WRIST_LEVELLING) continue;
      problems.push(`${v.joint} ${v.value.toFixed(0)} (${v.min}..${v.max})`);
    }

    const c = contact(press.body);
    for (const t of c.through) {
      const allowed = t.pair.endsWith("/core") ? ARMPIT_FOLD : THROUGH;
      if (t.depth > allowed) problems.push(`${t.pair} ${(t.depth * 100).toFixed(1)} cm through`);
    }
    if (c.floor > FLOOR) problems.push(`skin ${(c.floor * 100).toFixed(1)} cm under the floor`);

    for (const a of [press.l, press.r]) {
      const fore = worldPos(a.s.hand).sub(worldPos(a.s.lowerarm)).normalize();
      const tilt = THREE.MathUtils.radToDeg(Math.acos(fore.y));
      if (tilt > MAX_FOREARM_TILT) problems.push(`forearm ${tilt.toFixed(0)} degrees off vertical`);
    }

    for (const tag of ["l", "r"] as const) {
      for (const f of ["index", "middle", "ring", "pinky"]) {
        const { grip, handle } = g[tag];
        const w = worldPos(root.getObjectByName(`${f}_02_${tag}`)!).sub(grip);
        const gap = w.addScaledVector(handle, -w.dot(handle)).length();
        if (gap > MAX_FINGER_GAP) problems.push(`${tag} ${f} ${(gap * 100).toFixed(1)} cm from the handle`);
      }
    }

    // The weight passes beside the head, never through it.
    if (dumbbellToSkin(g) < 0.04) problems.push("dumbbell too close to the head or chest");

    expect(problems.join("; ")).toBe("");
  });

  test("at the bottom the dumbbells are just above the shoulders, elbows out and a little forward", () => {
    const g = posePress(press, 1);
    const { s: arm } = press.l;
    const shoulder = worldPos(arm.upperarm);
    const elbow = worldPos(arm.lowerarm);

    // Above the shoulder and close to it, without touching.
    expect(g.l.grip.y).toBeGreaterThan(shoulder.y);
    const p = new THREE.Vector3();
    let gap = Infinity;
    press.body.part.forEach((part, i) => {
      if (part === "none") return;
      press.body.mesh.getVertexPosition(i, p).applyMatrix4(press.body.mesh.matrixWorld);
      if (p.distanceTo(shoulder) > 0.14) return;
      const w = p.clone().sub(g.l.grip);
      const along = w.dot(g.l.handle);
      const past = Math.max(0, Math.abs(along) - (DUMBBELL.headAt + DUMBBELL.headWidth / 2));
      gap = Math.min(gap, Math.hypot(past, Math.max(0, w.addScaledVector(g.l.handle, -along).length() - DUMBBELL.headRadius)));
    });
    expect(gap).toBeGreaterThan(0.01);
    expect(gap).toBeLessThan(0.12);

    // Not straight out to the side: forward of the body as well as out from it.
    expect(elbow.z - shoulder.z).toBeGreaterThan(0.08);
    expect(elbow.x - shoulder.x).toBeGreaterThan(0.08);
    const m = measure(anatomy) as unknown as Record<"l", Record<string, number>>;
    expect(m.l["shoulder.plane"]).toBeGreaterThan(0);
    expect(m.l["shoulder.plane"]).toBeLessThan(45);
  });

  test("the dumbbells arc up to nearly straight arms overhead", () => {
    const start = posePress(press, 1).l.grip;
    const end = posePress(press, 0).l.grip;
    const line = end.clone().sub(start);
    const length = line.length();
    expect(length).toBeGreaterThan(0.3);

    posePress(press, 0);
    const m = measure(anatomy);
    expect(m.l["elbow.flexion"]).toBeGreaterThan(8); // not locked out
    expect(m.l["elbow.flexion"]).toBeLessThan(30);
    expect(m.l["shoulder.elevation"]).toBeGreaterThan(145);
    expect(end.y).toBeGreaterThan(worldPos(root.getObjectByName("head")!).y + 0.3);
  });

  test("the forearm is upright at both ends of the rep, from the front and from the side", () => {
    for (const d of [1, 0]) {
      posePress(press, d);
      for (const a of [press.l, press.r]) {
        const f = worldPos(a.s.hand).sub(worldPos(a.s.lowerarm));
        expect(Math.abs(THREE.MathUtils.radToDeg(Math.atan2(f.x, f.y)))).toBeLessThan(7);
        expect(Math.abs(THREE.MathUtils.radToDeg(Math.atan2(f.z, f.y)))).toBeLessThan(7);
      }
    }
  });

  test("the dumbbells never come close to meeting", () => {
    for (let i = 0; i <= 10; i++) {
      const g = posePress(press, i / 10);
      const reach = (DUMBBELL.headAt + DUMBBELL.headWidth / 2) * Math.abs(g.l.handle.x);
      expect(g.l.grip.x - g.r.grip.x - 2 * reach).toBeGreaterThan(0.1);
    }
  });

  test("the back and hips rest on the bench, whatever the arms do", () => {
    const { pad, seat } = benchLayout(press);
    const padNormal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(1, 0, 0), pad.rotationX);
    const surface = pad.position.clone().addScaledVector(padNormal, pad.size[2] / 2);
    const seatTop = seat.position.y + seat.size[1] / 2;
    const headBone = root.getObjectByName("head")!;
    const p = new THREE.Vector3();
    for (const d of [0, 0.5, 1]) {
      posePress(press, d);
      const headAt = worldPos(headBone);
      let back = Infinity;
      let hips = Infinity;
      press.body.part.forEach((part, i) => {
        if (part !== "core") return;
        press.body.mesh.getVertexPosition(i, p).applyMatrix4(press.body.mesh.matrixWorld);
        if (p.distanceTo(headAt) > 0.22) back = Math.min(back, p.clone().sub(surface).dot(padNormal));
        hips = Math.min(hips, p.y - seatTop);
      });
      expect(Math.abs(back)).toBeLessThan(ON_BENCH);
      expect(Math.abs(hips)).toBeLessThan(ON_BENCH);
    }
  });

  test("the bench is upright and only the arms and shoulder blades move, smoothly and evenly", () => {
    expect(SHOULDER_PRESS.benchAngle).toBe(70);
    const { rig } = press;
    posePress(press, 0);
    const bones = [rig.pelvis, rig.spine3, rig.neck, rig.l.foot, rig.r.foot, rig.l.calf, rig.r.calf];
    const still = bones.map(worldPos);
    const n = 100;
    let prev = posePress(press, 0);
    for (let i = 1; i <= n; i++) {
      const g = posePress(press, i / n);
      expect(g.l.grip.distanceTo(prev.l.grip)).toBeLessThan(MAX_STEP);
      expect(g.r.grip.distanceTo(prev.r.grip)).toBeLessThan(MAX_STEP);
      expect(Math.abs(g.l.grip.x + g.r.grip.x)).toBeLessThan(0.01);
      prev = g;
      bones.forEach((b, k) => expect(worldPos(b).distanceTo(still[k])).toBeLessThan(0.002));
    }
  });
});
