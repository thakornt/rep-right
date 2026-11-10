// The 3D push-up must stay a pose a real body can make through the whole rep and follow the owner's
// description: hands planted a little wider than the shoulders, the body one straight braced line
// turning about the toes, and at the top the arm upright under the shoulder seen from the side and
// running out a little to the hand seen from the front. The body moves forward over the hands on the
// way down, so at the bottom they are by the nipples and the forearm, upright seen from the front,
// leans back toward the feet, as the owner agreed.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { worldPos } from "./pose";
import { posePushUp, PUSH_UP, readPushUpRig, type PushUpRig } from "./pose-pushup";

const ARMPIT_FOLD = 0.045; // skin folding at the shoulder joint; the same allowance as the other lifts
const THROUGH = 0.01;
const FLOOR = 0.01; // metres skin may sink into the floor
const MAX_HAND_LIFT = 0.012; // metres the palm's lowest skin may float above the floor
const MAX_TOE_LIFT = 0.012; // and the toes'
// Palm flat under an upright forearm bends the wrist back about 90 degrees, past its usual range of
// 70 (anatomy.ts). Weight-bearing on the hand takes it there; the owner accepted it as natural
// (2026-11-10). The most it reaches is 96, at the top.
const MAX_WRIST_BACK = 100;
const MAX_WRIST_SIDE = 20; // degrees the hand may turn sideways from the forearm, measured square to the bend back
const MAX_BODY_BEND = 1; // degrees the line from the shoulders through the hips to the ankles may bend from how it stands: one straight piece
const MAX_KNEE_BEND = 5;
const MAX_FOREARM_TILT_BOTTOM = 22; // degrees from upright at the bottom, all of it back toward the feet, as the owner agreed (2026-11-10); it is 21
const MAX_FOREARM_OUT_BOTTOM = 0.005; // metres the elbow may sit outside the wrist at the bottom, seen from the front: none
const MAX_ARM_TILT_TOP = 1; // degrees the arm may lean from upright at the top, seen from the side
const MIN_CHEST_GAP = 0.02; // metres from the chest to the floor at the bottom
const MAX_CHEST_GAP = 0.06;
const MAX_HAND_SLIP = 0.001; // metres a wrist may move through the rep: planted
const MAX_ELBOW_ACROSS = 0.03; // metres the elbow may stray, seen from above, from the line between its top and bottom places
// Metres the elbow may go past its place at the bottom and come back, seen from above: the chest moves
// forward over the hands at the end, which the owner accepted as natural (2026-11-10). It is 4.3.
const MAX_ELBOW_BACK = 0.05;

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let root: THREE.Object3D;
let push: PushUpRig;
let anatomy: Anatomy;
let body: Body;
let standingBend: number; // the same line standing tall: the body's own straight

// Shoulders, hips and ankles, each the middle of the two sides.
const line = () => ["upperarm", "thigh", "foot"].map((n) => bone(`${n}_l`).add(bone(`${n}_r`)).multiplyScalar(0.5));

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  push = readPushUpRig(root);
  body = readBody(root);
  const [s, h, a] = line();
  standingBend = angle(s.clone().sub(h), h.clone().sub(a));
});

const bone = (name: string) => worldPos(root.getObjectByName(name)!);
const angle = (a: THREE.Vector3, b: THREE.Vector3) => THREE.MathUtils.radToDeg(a.angleTo(b));

// Lowest skin on the bones whose names start with any of these.
function lowestSkin(prefixes: string[]) {
  const { mesh } = body;
  const { skinIndex, skinWeight } = mesh.geometry.attributes;
  const bones = mesh.skeleton.bones;
  const p = new THREE.Vector3();
  let y = Infinity;
  for (let i = 0; i < body.n; i++) {
    let best = 0;
    let at = 0;
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k);
      if (w > best) {
        best = w;
        at = skinIndex.getComponent(i, k);
      }
    }
    if (!prefixes.some((n) => bones[at].name.startsWith(n))) continue;
    y = Math.min(y, mesh.getVertexPosition(i, p).applyMatrix4(mesh.matrixWorld).y);
  }
  return y;
}

// The wrist, measured square to its bend back, which the usual measure can't do near 90 degrees.
function wrist(tag: "l" | "r") {
  const sign = tag === "l" ? 1 : -1;
  const elbow = bone(`lowerarm_${tag}`);
  const at = bone(`hand_${tag}`);
  const fore = at.clone().sub(elbow).normalize();
  const hand = bone(`middle_01_${tag}`).sub(at).normalize();
  const thumbSide = bone(`index_01_${tag}`).sub(bone(`pinky_01_${tag}`));
  const radial = thumbSide.addScaledVector(fore, -thumbSide.dot(fore)).normalize();
  const palmar = fore.clone().cross(radial).multiplyScalar(sign);
  return {
    back: THREE.MathUtils.radToDeg(Math.atan2(-hand.dot(palmar), hand.dot(fore))),
    side: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(hand.dot(radial), -1, 1))),
  };
}

describe("push-up", () => {
  test.each(DEPTHS)("depth %s", (depth) => {
    posePushUp(push, depth);
    const problems: string[] = [];

    for (const v of violations(measure(anatomy))) {
      if (v.joint.endsWith("wrist.flexion") || v.joint.endsWith("wrist.deviation")) continue; // measured below
      problems.push(`${v.joint} ${v.value.toFixed(0)} (${v.min}..${v.max})`);
    }
    for (const tag of ["l", "r"] as const) {
      const w = wrist(tag);
      if (w.back > MAX_WRIST_BACK) problems.push(`${tag} wrist bent back ${w.back.toFixed(0)}`);
      if (Math.abs(w.side) > MAX_WRIST_SIDE) problems.push(`${tag} wrist sideways ${w.side.toFixed(0)}`);
    }

    const c = contact(body);
    for (const t of c.through) {
      const allowed = t.pair.endsWith("/core") ? ARMPIT_FOLD : THROUGH;
      if (t.depth > allowed) problems.push(`${t.pair} ${(t.depth * 100).toFixed(1)} cm through`);
    }
    if (c.floor > FLOOR) problems.push(`skin ${(c.floor * 100).toFixed(1)} cm under the floor`);

    const palm = lowestSkin(["hand_", "index_", "middle_", "ring_", "pinky_"]);
    if (palm > MAX_HAND_LIFT) problems.push(`hand ${(palm * 100).toFixed(1)} cm off the floor`);
    const toes = lowestSkin(["ball_"]);
    if (toes > MAX_TOE_LIFT) problems.push(`toes ${(toes * 100).toFixed(1)} cm off the floor`);

    // One straight line from the shoulders through the hips to the ankles, knees straight.
    const [shoulders, hips, ankles] = line();
    const bend = angle(shoulders.clone().sub(hips), hips.clone().sub(ankles)) - standingBend;
    if (Math.abs(bend) > MAX_BODY_BEND) problems.push(`body bends ${bend.toFixed(1)} degrees at the hips from standing`);
    const knee = (measure(anatomy).l as unknown as Record<string, number>)["knee.flexion"];
    if (Math.abs(knee) > MAX_KNEE_BEND) problems.push(`knee bent ${knee.toFixed(0)}`);

    expect(problems.join("; ")).toBe("");
  });

  test("the hands stay planted", () => {
    const at = DEPTHS.map((d) => (posePushUp(push, d), bone("hand_l")));
    for (const p of at) expect(p.distanceTo(at[0])).toBeLessThan(MAX_HAND_SLIP);
  });

  test("the hands sit a little wider than the shoulders, under them at the top seen from the side", () => {
    posePushUp(push, 0);
    for (const tag of ["l", "r"] as const) {
      const sign = tag === "l" ? 1 : -1;
      expect(sign * (bone(`hand_${tag}`).x - bone(`upperarm_${tag}`).x)).toBeGreaterThan(0);
      const arm = bone(`upperarm_${tag}`).sub(bone(`hand_${tag}`));
      expect(Math.abs(THREE.MathUtils.radToDeg(Math.atan2(arm.z, arm.y)))).toBeLessThan(MAX_ARM_TILT_TOP);
    }
  });

  test("at the bottom the forearm stands nearly upright and the chest is just off the floor", () => {
    posePushUp(push, 1);
    for (const tag of ["l", "r"] as const) {
      const fore = bone(`hand_${tag}`).sub(bone(`lowerarm_${tag}`)).normalize();
      expect(angle(fore, new THREE.Vector3(0, -1, 0))).toBeLessThan(MAX_FOREARM_TILT_BOTTOM);
      expect(Math.abs(bone(`lowerarm_${tag}`).x - bone(`hand_${tag}`).x)).toBeLessThan(MAX_FOREARM_OUT_BOTTOM);
    }
    const chest = lowestSkin(["spine_02", "spine_03", "clavicle"]);
    expect(chest).toBeGreaterThan(MIN_CHEST_GAP);
    expect(chest).toBeLessThan(MAX_CHEST_GAP);
  });

  test("at the top the arm runs out a little from the shoulder to the hand, the elbow just short of straight", () => {
    posePushUp(push, 0);
    const m = measure(anatomy).l as unknown as Record<string, number>;
    expect(Math.abs(m["elbow.flexion"] - PUSH_UP.topBend)).toBeLessThan(1);
    const arm = bone("hand_l").sub(bone("upperarm_l"));
    const out = THREE.MathUtils.radToDeg(Math.atan2(arm.x, -arm.y));
    expect(out).toBeGreaterThan(5);
    expect(out).toBeLessThan(30);
  });

  test("the elbow doubles back no further than accepted", () => {
    // Seen from above, the elbow's way from its place at the top to its place at the bottom: how far
    // it goes past the bottom's place and has to come back.
    const at = DEPTHS.map((d) => (posePushUp(push, d), bone("lowerarm_l").setY(0)));
    const way = at[at.length - 1].clone().sub(at[0]);
    const length = way.length();
    way.normalize();
    const furthest = Math.max(...at.map((p) => p.clone().sub(at[0]).dot(way)));
    const across = Math.max(...at.map((p) => p.clone().sub(at[0]).addScaledVector(way, -p.clone().sub(at[0]).dot(way)).length()));
    expect(Math.max(0, furthest - length)).toBeLessThan(MAX_ELBOW_BACK);
    expect(across).toBeLessThan(MAX_ELBOW_ACROSS);
  });
});
