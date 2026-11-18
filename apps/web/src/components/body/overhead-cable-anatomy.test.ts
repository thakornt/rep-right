// The 3D cable overhead triceps extension must stay a pose a real body can make through the whole
// lift, and follow the owner's reference clip (2026-11-14): the pulley at about the navel behind the
// lifter, a rope on it, the lifter standing tall with their back to the tower. The upper arms stand
// up beside the head, the elbows pointing up and out to the sides rather than forward, and the hands
// going down behind the head side by side, not over each other (owner, 2026-11-15). The elbows come
// in a little as the arms straighten, bringing the hands closer over the head. The rope runs from the
// hands over the back to the pulley, clear of the head and body.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { trunkLean, worldPos } from "./pose";
import { OVERHEAD_CABLE, overheadCablePulley, poseOverheadCable, readOverheadRig, type OverheadRig } from "./pose-overhead";
import { ROPE_PUSHDOWN } from "./pose-pushdown";

const ARMPIT_FOLD = 0.055; // skin folding at the raised shoulder: the dumbbell version's allowance
const THROUGH = 0.01;
const FLOOR = 0.01;
const MAX_FINGER_GAP = 0.035; // middle finger bones to the rope's centre
const MAX_WRIST_BEND = 25; // degrees the wrist may bend forward or back: it stays near straight
const MAX_WRIST_SIDE = 16; // degrees it may bend sideways, well inside its range of 20 and 30
const MIN_ROPE_GAP = 0.02; // metres the rope stays off the head, neck and back
const MIN_HAND_GAP = 0.01; // metres the hands stay off the back of the head at the bottom
// The elbow is the pivot, but it comes in about 8 cm as the arms straighten: out to the sides at the
// bottom, as the owner asked (2026-11-15), and in over the head at the top.
const MAX_ELBOW_DRIFT = 0.1;
const MIN_ELBOW_UP = 0.2; // metres the elbow sits above the shoulder throughout: pointing up
const MIN_ELBOW_TIPS_APART = 80; // degrees between the points of the two elbows seen from above, at the bottom: out to the sides
const MAX_ELBOW_TIPS_APART = 150; // and no more: wider puts the hands over each other behind the head
const MIN_LOW_BEND = 115; // degrees the elbow bends at the bottom: the hands well down behind the head
const MAX_TOP_BEND = 30; // and at most this at the top: the arms nearly straight; a little bent keeps the hands close with the elbows out
const MAX_HANDS_APART_TOP = 0.38; // metres between the wrists at the top: closer than at the shoulders. 36 cm: the elbows come in only a little on the way up (owner, 2026-11-15), so the hands stay a little apart
const MAX_STEP = 0.012; // metres a hand may move per 1% of the lift: no swings
const MAX_ROPE_STRETCH = 0.001; // metres the strands may change length
const MAX_CABLE_OFF_ARM = 10; // degrees the cable may be off the upper arm's line, seen from the side: nearly in line, not exactly (owner, 2026-11-15)
const MIN_LEAN = 3; // degrees the body leans forward against the cable: a little, as the owner asked (2026-11-15)
const MAX_LEAN = 10;
const MAX_FOOT_SLIDE = 0.005; // metres the feet may move: planted

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let root: THREE.Object3D;
let o: OverheadRig;
let anatomy: Anatomy;
let body: Body;
let pulley: THREE.Vector3;
let restHips: THREE.Vector3;

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  body = readBody(root);
  o = readOverheadRig(root);
  pulley = overheadCablePulley(o);
  restHips = worldPos(o.rig.pelvis);
});

const left = () => measure(anatomy).l as unknown as Record<string, number>;

// Lowest distance from a stretch of rope to the skin of the head, neck and trunk.
function ropeToSkin(from: THREE.Vector3, to: THREE.Vector3) {
  const p = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const line = new THREE.Line3(from, to);
  let gap = Infinity;
  body.part.forEach((part, i) => {
    if (part !== "core") return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    line.closestPointToPoint(p, true, closest);
    gap = Math.min(gap, closest.distanceTo(p) - ROPE_PUSHDOWN.ropeRadius);
  });
  return gap;
}

// Lowest distance from the hands' skin to the head and neck's.
function handsToHead() {
  const p = new THREE.Vector3();
  const head: THREE.Vector3[] = [];
  const hands: THREE.Vector3[] = [];
  const neck = worldPos(root.getObjectByName("neck_01")!).y;
  body.part.forEach((part, i) => {
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    if (part === "core" && p.y > neck) head.push(p.clone());
    else if (part === "armL" || part === "armR") hands.push(p.clone());
  });
  const wrists = [worldPos(o.l.s.hand), worldPos(o.r.s.hand)];
  let gap = Infinity;
  for (const h of hands) {
    if (Math.min(...wrists.map((w) => w.distanceTo(h))) > 0.12) continue; // the hands only
    for (const q of head) gap = Math.min(gap, h.distanceTo(q));
  }
  return gap;
}

describe("cable overhead triceps extension", () => {
  test.each(DEPTHS)("depth %s", (depth) => {
    const g = poseOverheadCable(o, depth, pulley);
    const problems: string[] = [];

    for (const v of violations(measure(anatomy))) problems.push(`${v.joint} ${v.value.toFixed(0)} (${v.min}..${v.max})`);
    const c = contact(body);
    for (const t of c.through) {
      const allowed = t.pair.endsWith("/core") ? ARMPIT_FOLD : THROUGH;
      if (t.depth > allowed) problems.push(`${t.pair} ${(t.depth * 100).toFixed(1)} cm through`);
    }
    if (c.floor > FLOOR) problems.push(`skin ${(c.floor * 100).toFixed(1)} cm under the floor`);

    for (const tag of ["l", "r"] as const) {
      const { grip, handle, enter } = g[tag];
      for (const f of ["index", "middle", "ring", "pinky"]) {
        const w = worldPos(root.getObjectByName(`${f}_02_${tag}`)!).sub(grip);
        const gap = w.addScaledVector(handle, -w.dot(handle)).length();
        if (gap > MAX_FINGER_GAP) problems.push(`${tag} ${f} ${(gap * 100).toFixed(1)} cm from the rope`);
      }
      const strand = ropeToSkin(g.knot, enter);
      if (strand < MIN_ROPE_GAP) problems.push(`${tag} strand ${(strand * 100).toFixed(1)} cm from the head or back`);
      const m = measure(anatomy)[tag] as unknown as Record<string, number>;
      if (Math.abs(m["wrist.flexion"]) > MAX_WRIST_BEND) problems.push(`${tag} wrist bent ${m["wrist.flexion"].toFixed(0)}`);
      if (Math.abs(m["wrist.deviation"]) > MAX_WRIST_SIDE) problems.push(`${tag} wrist sideways ${m["wrist.deviation"].toFixed(0)}`);
    }
    const cable = ropeToSkin(g.knot, pulley);
    if (cable < MIN_ROPE_GAP) problems.push(`cable ${(cable * 100).toFixed(1)} cm from the head or back`);
    const hands = handsToHead();
    if (hands < MIN_HAND_GAP) problems.push(`hands ${(hands * 100).toFixed(1)} cm from the head`);

    expect(problems.join("; ")).toBe("");
  });

  test("the elbows point up and stay nearly put; the elbow goes from nearly straight to well bent", () => {
    poseOverheadCable(o, 0, pulley);
    const start = worldPos(o.l.s.lowerarm);
    expect(left()["elbow.flexion"]).toBeLessThan(MAX_TOP_BEND);
    for (const d of DEPTHS) {
      poseOverheadCable(o, d, pulley);
      const shoulder = worldPos(o.l.s.upperarm);
      const elbow = worldPos(o.l.s.lowerarm);
      expect(elbow.y - shoulder.y).toBeGreaterThan(MIN_ELBOW_UP);
      expect(elbow.distanceTo(start)).toBeLessThan(MAX_ELBOW_DRIFT);
    }
    expect(left()["elbow.flexion"]).toBeGreaterThan(MIN_LOW_BEND);
  });

  test("at the bottom the points of the elbows face out to the sides, not forward", () => {
    poseOverheadCable(o, 1, pulley);
    // The point of the elbow faces away from both the upper arm and the forearm.
    const tip = (s: typeof o.l) => {
      const elbow = worldPos(s.s.lowerarm);
      const up = elbow.clone().sub(worldPos(s.s.upperarm)).normalize();
      const fore = worldPos(s.s.hand).sub(elbow).normalize();
      return up.sub(fore).setY(0);
    };
    const apart = THREE.MathUtils.radToDeg(tip(o.l).angleTo(tip(o.r)));
    expect(apart).toBeGreaterThan(MIN_ELBOW_TIPS_APART);
    expect(apart).toBeLessThan(MAX_ELBOW_TIPS_APART);
  });

  test("the hands go down behind the head and come close together at the top", () => {
    poseOverheadCable(o, 1, pulley);
    const head = worldPos(root.getObjectByName("head")!);
    expect(worldPos(o.l.s.hand).z).toBeLessThan(head.z);
    poseOverheadCable(o, 0, pulley);
    expect(worldPos(o.l.s.hand).distanceTo(worldPos(o.r.s.hand))).toBeLessThan(MAX_HANDS_APART_TOP);
    expect(worldPos(o.l.s.hand).y).toBeGreaterThan(head.y);
  });

  test("the rope runs back and down to the pulley behind, at about the navel; its strands keep their length", () => {
    expect(pulley.z).toBeLessThan(restHips.z - 0.2);
    expect(pulley.y - restHips.y).toBeCloseTo(OVERHEAD_CABLE.pulleyAboveHips, 6);
    for (const d of DEPTHS) {
      const g = poseOverheadCable(o, d, pulley);
      expect(g.knot.z).toBeLessThan(Math.min(g.l.enter.z, g.r.enter.z));
      for (const tag of ["l", "r"] as const) {
        expect(Math.abs(g.knot.distanceTo(g[tag].enter) - OVERHEAD_CABLE.strand)).toBeLessThan(MAX_ROPE_STRETCH);
      }
    }
  });

  test("seen from the side, the cable runs on nearly in line with the upper arm", () => {
    const side = (v: THREE.Vector3) => THREE.MathUtils.radToDeg(Math.atan2(v.z, v.y));
    for (const d of DEPTHS) {
      const g = poseOverheadCable(o, d, pulley);
      const arm = worldPos(o.l.s.lowerarm).sub(worldPos(o.l.s.upperarm));
      const cable = g.knot.clone().sub(pulley);
      expect(Math.abs(side(cable) - side(arm))).toBeLessThan(MAX_CABLE_OFF_ARM);
    }
  });

  test("the body leans a little forward against the cable, the feet planted", () => {
    poseOverheadCable(o, 0, pulley);
    const feet = worldPos(o.rig.l.ball);
    for (const d of DEPTHS) {
      poseOverheadCable(o, d, pulley);
      const lean = Math.abs(THREE.MathUtils.radToDeg(trunkLean(o.rig)));
      expect(lean).toBeGreaterThan(MIN_LEAN);
      expect(lean).toBeLessThan(MAX_LEAN);
      expect(worldPos(o.rig.l.ball).distanceTo(feet)).toBeLessThan(MAX_FOOT_SLIDE);
    }
    // Forward: the shoulders ahead of the hips.
    expect(worldPos(o.l.s.upperarm).z).toBeGreaterThan(worldPos(o.rig.pelvis).z);
  });

  test("nothing jumps through the lift, and both sides match", () => {
    let last: THREE.Vector3[] | null = null;
    for (let i = 0; i <= 100; i++) {
      const g = poseOverheadCable(o, i / 100, pulley);
      const now = [g.l.grip, g.r.grip, g.knot];
      if (last) now.forEach((p, k) => expect(p.distanceTo(last![k])).toBeLessThan(MAX_STEP));
      last = now;
      expect(g.l.grip.x + g.r.grip.x).toBeCloseTo(0, 2);
      expect(g.l.grip.y - g.r.grip.y).toBeCloseTo(0, 2);
    }
  });
});
