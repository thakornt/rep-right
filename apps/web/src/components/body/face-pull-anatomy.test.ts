// The 3D rope face pull must stay a pose a real body can make through the whole lift and follow
// the owner's reference clip (2026-11-12): the pulley a little above the head, the arms reaching
// to it at the start, and at the end the middle of the rope at the forehead, the elbows up at
// shoulder height, the forearms standing up and the hands spread wide beside the head, like a
// double biceps pose, the shoulder blades squeezed. Not the clip's wrong way, a hammer curl with
// the elbows low.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { worldPos } from "./pose";
import { FACE_PULL, poseFacePull, readFacePullRig, type FacePullRig } from "./pose-face-pull";

const ARMPIT_FOLD = 0.045; // skin folding at the shoulder joint; the same allowance as the pushdown
const THROUGH = 0.01;
const FLOOR = 0.01;
const MAX_FINGER_GAP = 0.035; // middle finger bones to the rope's centre
const MIN_ROPE_GAP = 0.03; // metres the rope stays off the trunk and head
const MAX_WRIST = 8; // degrees the wrist may bend any way: it stays straight
const MAX_STEP = 0.025; // metres a hand may move per 1% of the lift: no swings
const MAX_ELBOW_OFF_SHOULDER = 0.06; // metres the elbow may be below the shoulder at the end: up at shoulder height
const MIN_TURN_OUT = 40; // degrees the shoulder turns out at the end, so the forearms stand up
const MAX_FOREARM_FROM_UP = 35; // degrees the forearm may lean from straight up at the end
const MAX_HANDS_BELOW_EYES = 0.04; // metres the grip may be below the eyes at the end: at the forehead
const MAX_HANDS_ABOVE_TOP = -0.06; // and it stays at least this far below the top of the head
const MIN_HANDS_APART = 0.4; // metres between the hands at the end: spread wide, beside the head
const MAX_KNOT_FROM_FOREHEAD = 0.06; // metres the knot may be above or below the forehead's height
const MIN_LEAN_BACK = 5; // degrees the hips and the neck sit back from the ankles: leaning against the pull
const MAX_LEAN_BACK = 15; // a little, not a pull with the body weight: 12 as the owner asked (2026-11-12)
const MAX_LEAN_OFF_LINE = 3; // degrees the trunk may be off the legs' line: one straight line
const MIN_RETRACT = 0.015; // metres each shoulder joint moves back from the start, the blades squeezed

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let root: THREE.Object3D;
let fp: FacePullRig;
let anatomy: Anatomy;
let body: Body;
let top: number; // the top of the head
let eyes: number; // the head bone's height, about the eyes

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  fp = readFacePullRig(root);
  body = readBody(root);
  top = new THREE.Box3().setFromObject(fp.rig.skin).max.y;
  eyes = worldPos(root.getObjectByName("head")!).y;
});

const left = () => measure(anatomy).l as unknown as Record<string, number>;

// Lowest distance from a line of rope to the skin of the trunk and head.
function ropeToSkin(from: THREE.Vector3, to: THREE.Vector3) {
  const p = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const line = new THREE.Line3(from, to);
  let gap = Infinity;
  body.part.forEach((part, i) => {
    if (part !== "core") return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    line.closestPointToPoint(p, true, closest);
    gap = Math.min(gap, closest.distanceTo(p) - FACE_PULL.ropeRadius);
  });
  return gap;
}

describe("rope face pull", () => {
  test.each(DEPTHS)("depth %s", (depth) => {
    const g = poseFacePull(fp, depth);
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
      const gap = ropeToSkin(g.knot, enter);
      if (gap < MIN_ROPE_GAP) problems.push(`${tag} strand ${(gap * 100).toFixed(1)} cm from the trunk or head`);
    }
    const m = left();
    for (const k of ["wrist.flexion", "wrist.deviation"]) if (Math.abs(m[k]) > MAX_WRIST) problems.push(`${k} ${m[k].toFixed(0)}`);
    expect(problems.join("; ")).toBe("");
  });

  test("the strands keep their length and the knot stays between the hands and the pulley", () => {
    for (const d of DEPTHS) {
      const g = poseFacePull(fp, d);
      expect(g.knot.distanceTo(g.l.enter)).toBeCloseTo(FACE_PULL.strand, 3);
      expect(g.knot.distanceTo(g.r.enter)).toBeCloseTo(FACE_PULL.strand, 3);
      expect(g.knot.z).toBeLessThan(fp.pulley.z);
      expect(g.knot.z).toBeGreaterThan(Math.max(g.l.grip.z, g.r.grip.z));
    }
  });

  test("the body leans back a little in one line from the ankles, against the cable", () => {
    for (const d of [0, 0.5, 1]) {
      poseFacePull(fp, d);
      const ankle = worldPos(fp.l.s.foot);
      const lean = (o: string) => {
        const up = worldPos(root.getObjectByName(o)!).sub(ankle).setX(0);
        return THREE.MathUtils.radToDeg(Math.atan2(-up.z, up.y));
      };
      expect(lean("pelvis")).toBeGreaterThan(MIN_LEAN_BACK);
      expect(lean("neck_01")).toBeGreaterThan(MIN_LEAN_BACK);
      expect(lean("neck_01")).toBeLessThan(MAX_LEAN_BACK);
      expect(Math.abs(lean("neck_01") - lean("pelvis"))).toBeLessThan(MAX_LEAN_OFF_LINE);
    }
  });

  test("the pulley sits a little above the head", () => {
    expect(fp.pulley.y - top).toBeCloseTo(FACE_PULL.pulleyAbove, 3);
  });

  test("at the start the arms reach up toward the pulley, nearly straight", () => {
    const g = poseFacePull(fp, 0);
    const shoulder = worldPos(fp.l.s.upperarm);
    expect(g.l.grip.y).toBeGreaterThan(shoulder.y);
    expect(g.l.grip.z - shoulder.z).toBeGreaterThan(0.45);
    expect(left()["elbow.flexion"]).toBeLessThan(15);
  });

  test("at the end: elbows at shoulder height, forearms up, hands wide at the forehead, rope at the forehead", () => {
    poseFacePull(fp, 0);
    const reach = worldPos(fp.l.s.upperarm);
    const g = poseFacePull(fp, 1);
    for (const s of [fp.l.s, fp.r.s]) {
      const shoulder = worldPos(s.upperarm);
      const elbow = worldPos(s.lowerarm);
      expect(shoulder.y - elbow.y).toBeLessThan(MAX_ELBOW_OFF_SHOULDER);
      const fore = worldPos(s.hand).sub(elbow).normalize();
      expect(THREE.MathUtils.radToDeg(fore.angleTo(new THREE.Vector3(0, 1, 0)))).toBeLessThan(MAX_FOREARM_FROM_UP);
    }
    expect(left()["shoulder.rotation"]).toBeGreaterThan(MIN_TURN_OUT);
    for (const h of [g.l, g.r]) {
      expect(eyes - h.grip.y).toBeLessThan(MAX_HANDS_BELOW_EYES);
      expect(h.grip.y - top).toBeLessThan(MAX_HANDS_ABOVE_TOP);
    }
    expect(g.l.grip.distanceTo(g.r.grip)).toBeGreaterThan(MIN_HANDS_APART);
    const forehead = (eyes + top) / 2;
    expect(Math.abs(g.knot.y - forehead)).toBeLessThan(MAX_KNOT_FROM_FOREHEAD);
    // The shoulder blades squeeze back from where they reached forward.
    expect(reach.z - worldPos(fp.l.s.upperarm).z).toBeGreaterThan(MIN_RETRACT);
  });

  test("the hands move smoothly through the pull", () => {
    let last = poseFacePull(fp, 0).l.grip.clone();
    for (let i = 1; i <= 100; i++) {
      const now = poseFacePull(fp, i / 100).l.grip.clone();
      expect(now.distanceTo(last)).toBeLessThan(MAX_STEP);
      last = now;
    }
  });
});
