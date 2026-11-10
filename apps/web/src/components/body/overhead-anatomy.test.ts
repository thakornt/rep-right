// The 3D overhead dumbbell triceps extension must stay a pose a real body can make through the
// whole lift, in both ways the owner described (2026-11-10):
//
// One arm (the right): the upper arm as near straight up as the shoulder allows, leaning out only a
// little, and staying put while the elbow works. The dumbbell goes down behind the head and across,
// toward the other side's back. The free hand rests on the hip.
//
// Two hands: the elbows high and a little forward, the hands together under the dumbbell's top
// head, which goes down behind the head as far as it can without touching the head or neck.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { worldPos } from "./pose";
import { OVERHEAD_ONE, OVERHEAD_TWO, poseOverheadOne, poseOverheadTwo, readOverheadRig, type OverheadRig } from "./pose-overhead";
import { DUMBBELL } from "./pose-press";

const ARMPIT_FOLD = 0.045; // skin folding at the shoulder joint; the same allowance as the other lifts
const THROUGH = 0.01;
// The two hands overlap round the handle, fingers over fingers, as the owner described; their skin
// meets by this much. It is 2.1 cm.
const HANDS_OVERLAP = 0.025;
const FLOOR = 0.01;
const MIN_DUMBBELL_GAP = 0.02; // metres from the dumbbell to the head, neck and back, at any point
const MAX_ARM_OUT = 10; // degrees the raised upper arm may lean from straight up, one arm
const MAX_ELBOW_DRIFT = 0.02; // metres the elbow may move through the lift: it is the pivot
const MAX_HIP_GAP = 0.012; // metres between the resting hand's skin and the waist's

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let root: THREE.Object3D;
let o: OverheadRig;
let anatomy: Anatomy;
let body: Body;

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  o = readOverheadRig(root);
  body = readBody(root);
});

const bone = (name: string) => worldPos(root.getObjectByName(name)!);

type Held = { grip: THREE.Vector3; handle: THREE.Vector3 };

// Skin positions of each part, as posed now.
function skinOf(parts: string[]) {
  const p = new THREE.Vector3();
  const out: THREE.Vector3[] = [];
  body.part.forEach((part, i) => {
    if (parts.includes(part)) out.push(body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld).clone());
  });
  return out;
}

// Lowest distance from the dumbbell to the skin of the head, neck and trunk.
function dumbbellGap({ grip, handle }: Held) {
  let gap = Infinity;
  for (const p of skinOf(["core"])) {
    const w = p.clone().sub(grip);
    const along = w.dot(handle);
    const past = Math.max(0, Math.abs(along) - (DUMBBELL.headAt + DUMBBELL.headWidth / 2));
    const out = Math.max(0, w.addScaledVector(handle, -along).length() - DUMBBELL.headRadius);
    gap = Math.min(gap, Math.hypot(past, out));
  }
  return gap;
}

function check(g: Held, handsOverlap: number) {
  const problems: string[] = [];
  for (const v of violations(measure(anatomy))) problems.push(`${v.joint} ${v.value.toFixed(0)} (${v.min}..${v.max})`);
  const c = contact(body);
  for (const t of c.through) {
    const allowed = t.pair.endsWith("/core") ? ARMPIT_FOLD : t.pair === "armL/armR" ? handsOverlap : THROUGH;
    if (t.depth > allowed) problems.push(`${t.pair} ${(t.depth * 100).toFixed(1)} cm through`);
  }
  if (c.floor > FLOOR) problems.push(`skin ${(c.floor * 100).toFixed(1)} cm under the floor`);
  const gap = dumbbellGap(g);
  if (gap < MIN_DUMBBELL_GAP) problems.push(`dumbbell ${(gap * 100).toFixed(1)} cm from the head or neck`);
  return problems;
}

describe("overhead triceps extension, one arm", () => {
  test.each(DEPTHS)("depth %s", (depth) => {
    const g = poseOverheadOne(o, depth);
    expect(check(g.r, THROUGH).join("; ")).toBe("");
  });

  test("the upper arm stands near straight up and stays put", () => {
    const at = DEPTHS.map((d) => (poseOverheadOne(o, d), bone("lowerarm_r")));
    for (const p of at) expect(p.distanceTo(at[0])).toBeLessThan(MAX_ELBOW_DRIFT);
    const arm = bone("lowerarm_r").sub(bone("upperarm_r")).normalize();
    expect(THREE.MathUtils.radToDeg(arm.angleTo(new THREE.Vector3(0, 1, 0)))).toBeLessThan(MAX_ARM_OUT);
  });

  test("the dumbbell goes down behind the head and across to the left", () => {
    const top = poseOverheadOne(o, 0).r.grip.clone();
    const low = poseOverheadOne(o, 1).r.grip.clone();
    expect(low.x - top.x).toBeGreaterThan(0.15); // toward the left
    expect(top.z - low.z).toBeGreaterThan(0.15); // and back
    expect(low.z).toBeLessThan(bone("head").z);
  });

  test("the elbow goes from nearly straight to well bent", () => {
    poseOverheadOne(o, 0);
    const m = () => (measure(anatomy).r as Record<string, number>)["elbow.flexion"];
    expect(Math.abs(m() - OVERHEAD_ONE.topBend)).toBeLessThan(1);
    poseOverheadOne(o, 1);
    expect(Math.abs(m() - OVERHEAD_ONE.lowBend)).toBeLessThan(1);
  });

  test("the free hand rests on the hip", () => {
    poseOverheadOne(o, 0.5);
    const hand = skinOf(["armL"]).filter((p) => p.y < bone("hand_l").y + 0.02 && p.y > bone("thigh_l").y);
    const waist = skinOf(["core"]).filter((p) => p.x > 0.05);
    let gap = Infinity;
    for (const h of hand) for (const w of waist) gap = Math.min(gap, h.distanceTo(w));
    expect(gap).toBeLessThan(MAX_HIP_GAP);
  });
});

describe("overhead triceps extension, two hands", () => {
  test.each(DEPTHS)("depth %s", (depth) => {
    const g = poseOverheadTwo(o, depth);
    expect(check(g.r, HANDS_OVERLAP).join("; ")).toBe("");
  });

  test("the elbows stay high, a little forward, and nearly still", () => {
    const at = DEPTHS.map((d) => (poseOverheadTwo(o, d), bone("lowerarm_l")));
    for (const p of at) expect(p.distanceTo(at[0])).toBeLessThan(MAX_ELBOW_DRIFT);
    for (const d of [0, 1]) {
      poseOverheadTwo(o, d);
      for (const tag of ["l", "r"]) {
        const arm = bone(`lowerarm_${tag}`).sub(bone(`upperarm_${tag}`));
        const forward = THREE.MathUtils.radToDeg(Math.atan2(arm.z, arm.y));
        expect(forward).toBeGreaterThan(5);
        expect(forward).toBeLessThan(30);
        expect(bone(`lowerarm_${tag}`).y).toBeGreaterThan(bone("head").y);
      }
    }
  });

  test("the dumbbell goes down behind the head", () => {
    const top = poseOverheadTwo(o, 0).r.grip.clone();
    const low = poseOverheadTwo(o, 1).r.grip.clone();
    expect(top.y - low.y).toBeGreaterThan(0.25);
    expect(low.z).toBeLessThan(bone("head").z - 0.08);
    poseOverheadTwo(o, 1);
    expect((measure(anatomy).l as Record<string, number>)["elbow.flexion"]).toBeGreaterThan(OVERHEAD_TWO.lowBend - 1);
  });

  test("the hands stay together round the handle", () => {
    for (const d of DEPTHS) {
      const g = poseOverheadTwo(o, d).r;
      for (const tag of ["l", "r"]) {
        // The web between thumb and first finger, beside the handle.
        const web = bone(`index_01_${tag}`).lerp(bone(`thumb_02_${tag}`), 0.5).sub(g.grip);
        expect(web.addScaledVector(g.handle, -web.dot(g.handle)).length()).toBeLessThan(0.05);
      }
    }
  });
});
