// Every hand must truly hold its object: the axis in the palm, the fingers
// around it from outside, the thumb over them, the skin not through it, and for
// the bar, one straight bar through both hands.

import * as THREE from "three";
import { describe, expect, test } from "vitest";

import { readBody, type Body } from "./contact";
import type { Grip } from "./grip";
import { loadBody } from "./load-body";
import { BAR_RADIUS, pose, readRig, SQUAT_CLIP, worldPos, type Rig } from "./pose";
import { DUMBBELL, INCLINE_PRESS, posePress, readPressRig, SHOULDER_PRESS } from "./pose-press";
import { NO_FAULTS } from "./squat";

const DEPTHS = [0, 0.25, 0.5, 0.75, 1];
const MAX_OFF_AXIS = 0.002; // metres a hand's grip may be from the object's axis
const MAX_ANGLE = 2; // degrees between a hand's grip and the object
const FINGER_CLEAR = 0.0; // a finger's middle joints stay outside the object's surface
const FINGER_REACH = 0.02; // and within this of it: closed, not hanging open
const SKIN_THROUGH = 0.0125; // skin folding into the object where the fingers bend most
const MAX_TILT = 18; // degrees a dumbbell may lean from level through the lift
const THUMB_ON_INDEX = 0.005; // the thumb's skin rests on the index finger's, not floating over it
const PINKY_SINK = 0.007; // the little finger's skin in the handle: a tight fist, not cut off
const PINKY_REACH = -0.005; // its tip stops this far short of the handle's axis, seen from the wrist side
const PINKY_KNUCKLE = 0.015; // its knuckle stays this far off the handle, near the ring finger's level
const THUMB_REACH = 0.04; // the thumb's last joint, from the object's surface (the tip reaches further)

type Held = { at: THREE.Vector3; dir: THREE.Vector3; radius: number };

function skinOf(body: Body, names: string[]) {
  const g = body.mesh.geometry;
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < g.attributes.position.count; i++) {
    let best = 0;
    let at = 0;
    for (let k = 0; k < 4; k++) {
      const w = g.attributes.skinWeight.getComponent(i, k);
      if (w > best) {
        best = w;
        at = g.attributes.skinIndex.getComponent(i, k);
      }
    }
    if (names.includes(body.mesh.skeleton.bones[at].name)) out.push(body.mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(body.mesh.matrixWorld));
  }
  return out;
}

function check(root: THREE.Object3D, body: Body, rig: Rig, grip: Grip, tag: "l" | "r", held: Held) {
  const problems: string[] = [];
  const dist = (p: THREE.Vector3) => {
    const w = p.clone().sub(held.at);
    return w.addScaledVector(held.dir, -w.dot(held.dir)).length();
  };
  if (dist(grip.held()) > MAX_OFF_AXIS) problems.push(`${tag} grip ${(dist(grip.held()) * 100).toFixed(1)} cm off the axis`);
  const angle = THREE.MathUtils.radToDeg(Math.acos(Math.min(Math.abs(grip.dir().dot(held.dir)), 1)));
  if (angle > MAX_ANGLE) problems.push(`${tag} grip ${angle.toFixed(0)} degrees off the object`);

  for (const f of ["index", "middle", "ring", "pinky"]) {
    for (const n of ["02", "03"]) {
      const gap = dist(worldPos(root.getObjectByName(`${f}_${n}_${tag}`)!)) - held.radius;
      if (gap < FINGER_CLEAR) problems.push(`${tag} ${f} ${n} joint ${(-gap * 100).toFixed(1)} cm inside`);
      if (gap > FINGER_REACH) problems.push(`${tag} ${f} ${n} joint ${(gap * 100).toFixed(1)} cm off`);
    }
  }
  const thumb = dist(worldPos(root.getObjectByName(`thumb_03_${tag}`)!)) - held.radius;
  if (thumb > THUMB_REACH) problems.push(`${tag} thumb ${(thumb * 100).toFixed(1)} cm off`);

  const index = skinOf(body, [`index_02_${tag}`, `index_03_${tag}`]);
  let onIndex = Infinity;
  for (const p of skinOf(body, [`thumb_03_${tag}`])) for (const q of index) onIndex = Math.min(onIndex, p.distanceTo(q));
  if (onIndex > THUMB_ON_INDEX) problems.push(`${tag} thumb ${(onIndex * 100).toFixed(1)} cm off the index finger`);

  const part = tag === "l" ? "armL" : "armR";
  const wrist = worldPos(rig[tag].hand);
  const p = new THREE.Vector3();
  let through = 0;
  body.part.forEach((owner, i) => {
    if (owner !== part) return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    if (p.distanceTo(wrist) < 0.22) through = Math.max(through, held.radius - dist(p));
  });
  if (through > SKIN_THROUGH) problems.push(`${tag} skin ${(through * 100).toFixed(1)} cm through`);
  return problems;
}

const SLOW = 60000; // every case loads a body of its own

describe("the bar", () => {
  test.each(DEPTHS)("rests in both fists, depth %s", { timeout: SLOW }, async (depth) => {
    const root = await loadBody();
    const rig = readRig(root, SQUAT_CLIP);
    const body = readBody(root);
    const j = pose(rig, depth, NO_FAULTS);
    const held = { at: j.bar, dir: j.barDir, radius: BAR_RADIUS };
    expect([...check(root, body, rig, rig.l.grip, "l", held), ...check(root, body, rig, rig.r.grip, "r", held)].join("; ")).toBe("");
  });
});

describe.each([
  ["incline press", INCLINE_PRESS],
  ["shoulder press", SHOULDER_PRESS],
] as const)("the dumbbells, %s", (_, spec) => {
  test.each(DEPTHS)("rest in the fists, depth %s", { timeout: SLOW }, async (depth) => {
    const root = await loadBody();
    const press = readPressRig(root, spec);
    const g = posePress(press, depth);
    const problems = (["l", "r"] as const).flatMap((tag) =>
      check(root, press.body, press.rig, press[tag].grip, tag, { at: g[tag].grip, dir: g[tag].handle, radius: DUMBBELL.handleRadius }),
    );
    expect(problems.join("; ")).toBe("");
    for (const tag of ["l", "r"] as const) {
      const axis = (p: THREE.Vector3) => {
        const w = p.clone().sub(g[tag].grip);
        return w.addScaledVector(g[tag].handle, -w.dot(g[tag].handle));
      };
      const surface = (p: THREE.Vector3) => axis(p).length() - DUMBBELL.handleRadius;
      const toWrist = axis(worldPos(press[tag].s.hand)).normalize();
      for (const n of ["01", "02", "03"]) {
        for (const p of skinOf(press.body, [`pinky_${n}_${tag}`])) expect(surface(p)).toBeGreaterThan(-PINKY_SINK);
      }
      const reach = Math.max(...skinOf(press.body, [`pinky_03_${tag}`]).map((p) => axis(p).dot(toWrist)));
      expect(reach).toBeGreaterThan(PINKY_REACH);
      expect(surface(worldPos(root.getObjectByName(`pinky_01_${tag}`)!))).toBeGreaterThan(PINKY_KNUCKLE);
    }
    // Level enough to read as one weight in the hand.
    for (const tag of ["l", "r"] as const) {
      const tilt = THREE.MathUtils.radToDeg(Math.asin(Math.abs(g[tag].handle.y)));
      expect(tilt).toBeLessThan(MAX_TILT);
    }
  });
});
