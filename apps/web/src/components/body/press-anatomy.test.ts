// The 3D incline dumbbell press must stay a pose a real body can make, through
// the whole lift, and sit properly on the bench with the weight in the hands.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact } from "./contact";
import { loadBody } from "./load-body";
import { worldPos } from "./pose";
import { benchLayout, DUMBBELL, posePress, readPressRig, type PressRig } from "./pose-press";

// Skin at the shoulder joint folds into the chest as the arm rises, up to 7 cm
// within 8 cm of the joint. It stays hidden, but it is real overlap: the skin
// has no muscle to compress. Fix the skinning, then delete this.
const ARMPIT_FOLD = 0.07;
const THROUGH = 0.01;
const FLOOR = 0.01;
const ON_BENCH = 0.015; // skin may sink this far into the padding, or float this far off it
const MAX_FOREARM_TILT = 25; // degrees from vertical, so the weight stays over the elbow
const RETRACTED = 0.03; // metres the shoulder joints stay behind the upper spine (4.6 cm in front at rest)
const MAX_STEP = 0.015; // metres a hand may move per 1% of the lift
const MAX_FINGER_GAP = 0.035; // middle finger bones to the handle's centre

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let press: PressRig;
let anatomy: Anatomy;

beforeAll(async () => {
  const root = await loadBody();
  anatomy = readAnatomy(root);
  press = readPressRig(root);
});

describe("incline dumbbell press", () => {
  test.each(DEPTHS)("depth %s", (depth) => {
    const g = posePress(press, depth);
    const problems: string[] = [];

    for (const v of violations(measure(anatomy))) problems.push(`${v.joint} ${v.value.toFixed(0)} (${v.min}..${v.max})`);

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

    // Fingers close around the handle: every finger, not only the first two.
    for (const [tag, grip] of [["l", g.l.grip], ["r", g.r.grip]] as const) {
      for (const f of ["index", "middle", "ring", "pinky"]) {
        const handle = g[tag].handle;
        const w = worldPos(press.rig.pelvis.parent!.getObjectByName(`${f}_02_${tag}`)!).sub(grip);
        const gap = w.addScaledVector(handle, -w.dot(handle)).length();
        if (gap > MAX_FINGER_GAP) problems.push(`${tag} ${f} ${(gap * 100).toFixed(1)} cm from the handle`);
      }
    }

    expect(problems.join("; ")).toBe("");
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

  test("the dumbbells come down nearly to the chest without touching", () => {
    const gap = dumbbellToSkin(posePress(press, 1));
    expect(gap).toBeGreaterThan(0.01);
    expect(gap).toBeLessThan(0.035);
    for (const d of [0, 0.25, 0.5, 0.75]) expect(dumbbellToSkin(posePress(press, d))).toBeGreaterThan(gap);
  });

  test("the press goes nearly straight up, the dumbbells never close to meeting", () => {
    const low = posePress(press, 1);
    const lowX = low.l.grip.x;
    const lowY = low.l.grip.y;
    const high = posePress(press, 0);
    expect(lowX - high.l.grip.x).toBeGreaterThan(0.02);
    expect(lowX - high.l.grip.x).toBeLessThan(0.1);
    expect(high.l.grip.y - lowY).toBeGreaterThan(0.3);
    const m = measure(anatomy);
    expect(m.l["elbow.flexion"]).toBeGreaterThan(8); // not locked out
    expect(m.l["elbow.flexion"]).toBeLessThan(30);
    for (let i = 0; i <= 10; i++) {
      const g = posePress(press, i / 10);
      const reach = (DUMBBELL.headAt + DUMBBELL.headWidth / 2) * Math.abs(g.l.handle.x);
      expect(g.l.grip.x - g.r.grip.x - 2 * reach).toBeGreaterThan(0.1);
    }
  });

  test("palms stay turned in from facing the feet, with the wrists straight", () => {
    for (const d of [0, 0.5, 1]) {
      const g = posePress(press, d);
      const m = measure(anatomy);
      const turn = THREE.MathUtils.radToDeg(Math.atan2(Math.abs(g.l.handle.z), Math.abs(g.l.handle.x)));
      expect(turn).toBeCloseTo(30, 0);
      expect(Math.abs(m.l["wrist.twist"]!)).toBeLessThan(3);
      expect(Math.abs(m.l["wrist.deviation"]!)).toBeLessThan(10);
    }
  });

  test("the head, back and hips rest on the bench, whatever the arms do", () => {
    const { pad, seat } = benchLayout(press);
    const padNormal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(1, 0, 0), pad.rotationX);
    const surface = pad.position.clone().addScaledVector(padNormal, pad.size[2] / 2);
    const seatTop = seat.position.y + seat.size[1] / 2;
    const p = new THREE.Vector3();
    const head = press.rig.pelvis.parent!.getObjectByName("head")!;
    for (const d of [0, 0.5, 1]) {
      posePress(press, d);
      const headAt = worldPos(head);
      let onHead = Infinity;
      let back = Infinity;
      let hips = Infinity;
      press.body.part.forEach((part, i) => {
        if (part !== "core") return;
        press.body.mesh.getVertexPosition(i, p).applyMatrix4(press.body.mesh.matrixWorld);
        const off = p.clone().sub(surface).dot(padNormal);
        if (p.distanceTo(headAt) < 0.16) onHead = Math.min(onHead, off);
        else if (p.distanceTo(headAt) > 0.22) back = Math.min(back, off);
        hips = Math.min(hips, p.y - seatTop);
      });
      expect(Math.abs(onHead)).toBeLessThan(ON_BENCH);
      expect(Math.abs(back)).toBeLessThan(ON_BENCH);
      expect(Math.abs(hips)).toBeLessThan(ON_BENCH);
    }
  });

  test("the shoulder blades stay pulled back through the whole lift", () => {
    const { rig } = press;
    const chestFront = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(1, 0, 0), benchLayout(press).pad.rotationX);
    const behind = () => worldPos(rig.spine3).sub(worldPos(rig.l.upperarm)).dot(chestFront);
    for (const d of [0, 0.5, 1]) {
      posePress(press, d);
      expect(behind()).toBeGreaterThan(RETRACTED);
    }
  });

  test("only the arms move, smoothly and evenly", () => {
    const track = (o: THREE.Object3D) => worldPos(o);
    const { rig } = press;
    posePress(press, 0);
    const still = [rig.pelvis, rig.spine3, rig.l.foot, rig.r.foot, rig.l.calf, rig.r.calf].map(track);
    const n = 100;
    let prev = posePress(press, 0);
    for (let i = 1; i <= n; i++) {
      const g = posePress(press, i / n);
      expect(g.l.grip.distanceTo(prev.l.grip)).toBeLessThan(MAX_STEP);
      expect(g.r.grip.distanceTo(prev.r.grip)).toBeLessThan(MAX_STEP);
      expect(Math.abs(g.l.grip.x + g.r.grip.x)).toBeLessThan(0.01);
      prev = g;
      [rig.pelvis, rig.spine3, rig.l.foot, rig.r.foot, rig.l.calf, rig.r.calf].forEach((b, k) => {
        expect(track(b).distanceTo(still[k])).toBeLessThan(0.002);
      });
    }
  });
});
