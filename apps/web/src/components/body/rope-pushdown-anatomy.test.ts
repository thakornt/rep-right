// The 3D rope pushdown must stay a pose a real body can make, through the whole lift, with the
// rope in both hands, and follow the rep measured off the owner's chosen video: the body still,
// the upper arm hanging with the elbow under the shoulder, and the hand going round one arc from
// chest height to the hips. The owner's reference photo replaces the video at the bottom of the
// lift: the arm in one nearly straight line, the wrist under the shoulder, bent well back, and
// the elbow turned out without spreading the arm. No joint's path may double back into an S curve, from any view.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { worldPos } from "./pose";
import { posePushdown, pushdownPulley, readPushdownRig, ROPE_PUSHDOWN, tricepsGather, type PushdownRig } from "./pose-pushdown";

const ARMPIT_FOLD = 0.045; // skin folding at the shoulder joint; the same allowance as the other lifts
const THROUGH = 0.01;
const FLOOR = 0.01;
const MAX_FINGER_GAP = 0.035; // middle finger bones to the rope's centre
const MAX_WRIST_FLEX = 8; // degrees the wrist may bend toward the palm: it doesn't
const MAX_WRIST_BACK = 60; // degrees it may bend back: at the bottom, from the owner's photo, inside its range of 70
const MIN_WRIST_BACK = 50; // and at least this at the very bottom, so it shows
const MAX_WRIST_SIDE = 16; // degrees it may bend sideways, well inside its range of 20 and 30
const MIN_ROPE_GAP = 0.03; // metres the rope stays off the trunk and head
const MAX_S_CURVE = 12; // degrees a path may turn against its main direction, in any view, before it counts as an S curve
const MIN_PATH_STEP = 0.004; // metres a joint must move before its direction counts: stillness has no direction
const MAX_ELBOW_DRIFT = 0.002; // metres the elbow may move before the squeeze: it is the pivot
const MIN_ELBOW_FACING_OUT = 0.01; // metres the elbow sits outside the shoulder-to-wrist line at the bottom, seen from the front
const MAX_ELBOW_OFF_LINE = 0.025; // metres it may be off that line, in any direction: the arm reads as one line
const MAX_WRIST_SIDEWAYS = 0.015; // metres the wrist may be to the side of the shoulder at the bottom, seen from the front
const MAX_WRIST_AHEAD = 0.07; // metres ahead of it, seen from the side: as near as the thigh allows
const MAX_SHOULDER_TURN = 30; // degrees the shoulder joint turns through the lift: only what turning the elbow out takes
const MIN_SHOULDER_TURN = 20; // and at least this, so it shows
const MAX_ROTATION_STEP = 2; // degrees it may turn per 1% of the lift: smoothly
const MAX_STEP = 0.012; // metres a hand may move per 1% of the lift: no swings
const MAX_TRICEPS_GATHER = 0.01; // metres the belly of the triceps may stand out: a little, as the owner asked
const MIN_GATHERING_VERTICES = 50; // vertices it moves on each arm, so it shows at all
const MAX_ROPE_STRETCH = 0.001; // metres the strands may change length
const MAX_ELBOW_OFF_SHOULDER = 0.03; // metres the elbow may be ahead of or behind the shoulder: most is 2.5, around 80% of the way down, as it turns out
const MIN_FLARE_TURN = 30; // degrees the palms turn toward the floor near the bottom, as the owner asked
const MIN_FLARE_WIDER = 0.1; // metres each hand ends up further out than at the top

// Where the video's rep has the hand at the top, from the shoulder, in metres, about 5 cm either way.
const CLIP_TOP = { below: 0.12, ahead: 0.25 };
const MAX_OFF_CLIP = 0.05;
const MAX_LEAN_OFF = 1.5;
const MAX_CABLE_TILT_OFF = 4; // degrees the cable may be off the video's 14 degrees at the top
const CLIP_CABLE_TILT = 14;

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let root: THREE.Object3D;
let push: PushdownRig;
let anatomy: Anatomy;
let body: Body;

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  push = readPushdownRig(root);
  body = readBody(root);
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
    gap = Math.min(gap, closest.distanceTo(p) - ROPE_PUSHDOWN.ropeRadius);
  });
  return gap;
}

describe("rope pushdown", () => {
  test.each(DEPTHS)("depth %s", (depth) => {
    const g = posePushdown(push, depth);
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

    const bend = left()["wrist.flexion"];
    if (bend > MAX_WRIST_FLEX || bend < -MAX_WRIST_BACK) problems.push(`wrist bent ${bend.toFixed(0)}`);
    const sideways = left()["wrist.deviation"];
    if (Math.abs(sideways) > MAX_WRIST_SIDE) problems.push(`wrist sideways ${sideways.toFixed(0)}`);

    expect(problems.join("; ")).toBe("");
  });

  test("the hand starts where the measured rep has it, from the shoulder", () => {
    const g = posePushdown(push, 0);
    const shoulder = worldPos(push.l.s.upperarm);
    expect(Math.abs(shoulder.y - g.l.grip.y - CLIP_TOP.below)).toBeLessThan(MAX_OFF_CLIP);
    expect(Math.abs(g.l.grip.z - shoulder.z - CLIP_TOP.ahead)).toBeLessThan(MAX_OFF_CLIP);
  });

  test("at the very bottom the arm is one line with the wrist under the shoulder, the elbow just outside it", () => {
    posePushdown(push, 1);
    const s = push.l.s;
    const shoulder = worldPos(s.upperarm);
    const elbow = worldPos(s.lowerarm);
    const wrist = worldPos(s.hand);
    expect(left()["elbow.flexion"]).toBeCloseTo(ROPE_PUSHDOWN.bendBottom, 0);
    expect(Math.abs(wrist.x - shoulder.x)).toBeLessThan(MAX_WRIST_SIDEWAYS);
    expect(Math.abs(wrist.z - shoulder.z)).toBeLessThan(MAX_WRIST_AHEAD);
    const line = new THREE.Line3(shoulder, wrist);
    const onLine = line.closestPointToPoint(elbow, true, new THREE.Vector3());
    expect(onLine.distanceTo(elbow)).toBeLessThan(MAX_ELBOW_OFF_LINE);
    expect(elbow.x - onLine.x).toBeGreaterThan(MIN_ELBOW_FACING_OUT);
  });

  test("the elbow is the pivot: it stays under the shoulder, and goes from well bent to nearly straight", () => {
    posePushdown(push, 0);
    const start = worldPos(push.l.s.lowerarm);
    expect(left()["elbow.flexion"]).toBeCloseTo(ROPE_PUSHDOWN.bendTop, 0);
    for (const d of DEPTHS) {
      posePushdown(push, d);
      const elbow = worldPos(push.l.s.lowerarm);
      if (d <= ROPE_PUSHDOWN.squeezeFrom) expect(elbow.distanceTo(start)).toBeLessThan(MAX_ELBOW_DRIFT);
      expect(Math.abs(elbow.z - worldPos(push.l.s.upperarm).z)).toBeLessThan(MAX_ELBOW_OFF_SHOULDER);
    }
  });

  test("near the bottom the hands flare out: the palms turn toward the floor and the hands go wider", () => {
    const pronation = (d: number) => {
      posePushdown(push, d);
      return left()["forearm.pronation"];
    };
    // Neutral until the flare starts, then turning one way.
    expect(pronation(0)).toBeCloseTo(pronation(ROPE_PUSHDOWN.flareFrom), 0);
    let last = pronation(ROPE_PUSHDOWN.flareFrom);
    for (let d = ROPE_PUSHDOWN.flareFrom + 0.05; d <= 1; d += 0.05) {
      const now = pronation(d);
      expect(now).toBeGreaterThan(last);
      last = now;
    }
    expect(pronation(1) - pronation(0)).toBeGreaterThan(MIN_FLARE_TURN);
    expect(posePushdown(push, 1).l.grip.x - posePushdown(push, 0).l.grip.x).toBeGreaterThan(MIN_FLARE_WIDER);
  });

  test("the upper arm only turns in on the way down, smoothly, and the blades stay put", () => {
    const rotation = (d: number) => {
      posePushdown(push, d);
      return left()["shoulder.rotation"];
    };
    const start = rotation(0);
    const shoulder = worldPos(push.l.s.upperarm);
    let last = start;
    for (let i = 1; i <= 100; i++) {
      const now = rotation(i / 100);
      expect(now).toBeLessThan(last + 0.1);
      expect(Math.abs(now - last)).toBeLessThan(MAX_ROTATION_STEP);
      expect(worldPos(push.l.s.upperarm).distanceTo(shoulder)).toBeLessThan(0.001);
      last = now;
    }
    expect(start - last).toBeGreaterThan(MIN_SHOULDER_TURN);
    expect(start - last).toBeLessThan(MAX_SHOULDER_TURN);
  });

  test("the wrist bends back near the bottom, as the owner asked, and not before the flare", () => {
    posePushdown(push, ROPE_PUSHDOWN.flareFrom);
    expect(Math.abs(left()["wrist.flexion"])).toBeLessThan(MAX_WRIST_FLEX);
    posePushdown(push, 1);
    expect(-left()["wrist.flexion"]).toBeGreaterThan(MIN_WRIST_BACK);
  });

  test("the triceps gathers as it shortens: nothing stretched, a little pressed down, the belly out and the part near the elbow in", () => {
    expect(tricepsGather(0)).toBe(0);
    let last = 0;
    for (let i = 1; i <= 100; i++) {
      const now = tricepsGather(i / 100);
      expect(now).toBeGreaterThanOrEqual(last);
      last = now;
    }
    expect(last).toBeCloseTo(ROPE_PUSHDOWN.tricepsGather, 6);
    expect(last).toBeLessThan(MAX_TRICEPS_GATHER);

    const at = push.rig.skin.geometry.getAttribute("aTriceps");
    const g = push.rig.skin.geometry.attributes.position;
    expect(at.count).toBe(g.count);
    for (const read of [(i: number) => at.getX(i), (i: number) => at.getY(i)]) {
      let out = 0;
      let inward = 0;
      for (let i = 0; i < at.count; i++) {
        const w = read(i);
        expect(Math.abs(w)).toBeLessThanOrEqual(1);
        if (w > 0) out++;
        if (w < 0) inward++;
      }
      expect(out).toBeGreaterThan(MIN_GATHERING_VERTICES);
      expect(inward).toBeGreaterThan(0);
    }
    // Each vertex belongs to one arm.
    for (let i = 0; i < at.count; i++) expect(Math.abs(at.getX(i) * at.getY(i))).toBe(0);
  });

  test("the body holds one position: the trunk at its lean, hips and feet still", () => {
    const { rig } = push;
    posePushdown(push, 0);
    const hips = worldPos(rig.pelvis);
    for (const d of DEPTHS) {
      posePushdown(push, d);
      const q = rig.pelvis.getWorldQuaternion(new THREE.Quaternion()).multiply(rig.pelvisRestQ.clone().invert());
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      expect(Math.abs(THREE.MathUtils.radToDeg(Math.atan2(up.z, up.y)) - ROPE_PUSHDOWN.trunkLean)).toBeLessThan(MAX_LEAN_OFF);
      expect(worldPos(rig.pelvis).distanceTo(hips)).toBeLessThan(0.001);
      expect(worldPos(rig.l.foot).y).toBeCloseTo(rig.l.ankle.y, 3);
    }
  });

  test("the rope hangs straight from the pulley, its strands one length, the fists together at the top and apart at the bottom", () => {
    const tilt = (knot: THREE.Vector3) => {
      const run = pushdownPulley().sub(knot);
      return THREE.MathUtils.radToDeg(Math.atan2(run.z, run.y));
    };
    for (const d of DEPTHS) {
      const g = posePushdown(push, d);
      expect(Math.abs(g.knot.x)).toBeLessThan(0.002);
      for (const hand of [g.l, g.r]) expect(Math.abs(g.knot.distanceTo(hand.enter) - ROPE_PUSHDOWN.strand)).toBeLessThan(MAX_ROPE_STRETCH);
      // Pulley, knot and the middle of the fists on one line.
      const mid = g.l.enter.clone().add(g.r.enter).multiplyScalar(0.5);
      const toKnot = g.knot.clone().sub(mid).normalize();
      expect(toKnot.distanceTo(pushdownPulley().sub(g.knot).normalize())).toBeLessThan(0.01);
    }
    const top = posePushdown(push, 0);
    expect(Math.abs(tilt(top.knot) - CLIP_CABLE_TILT)).toBeLessThan(MAX_CABLE_TILT_OFF);
    const topApart = top.l.grip.x - top.r.grip.x;
    const bottom = posePushdown(push, 1);
    expect(bottom.l.grip.x - bottom.r.grip.x).toBeGreaterThan(topApart);
  });

  test("no joint's path doubles back into an S curve, from above, the side or the front", () => {
    const joints = { hand: push.l.s.hand, elbow: push.l.s.lowerarm, shoulder: push.l.s.upperarm };
    const paths = Object.fromEntries(Object.keys(joints).map((k) => [k, [] as THREE.Vector3[]]));
    for (let i = 0; i <= 100; i++) {
      posePushdown(push, i / 100);
      for (const [k, b] of Object.entries(joints)) paths[k].push(worldPos(b));
    }
    const against = (pts: number[][]) => {
      const moves: number[][] = [];
      let last = pts[0];
      for (const q of pts) {
        if (Math.hypot(q[0] - last[0], q[1] - last[1]) > MIN_PATH_STEP) {
          moves.push([q[0] - last[0], q[1] - last[1]]);
          last = q;
        }
      }
      let one = 0;
      let other = 0;
      for (let i = 1; i < moves.length; i++) {
        const [a, b] = [moves[i - 1], moves[i]];
        const turn = Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
        if (turn > 0) one += turn;
        else other -= turn;
      }
      return THREE.MathUtils.radToDeg(Math.min(one, other));
    };
    for (const [k, path] of Object.entries(paths)) {
      expect(against(path.map((p) => [p.x, p.z])), `${k} from above`).toBeLessThan(MAX_S_CURVE);
      expect(against(path.map((p) => [p.z, p.y])), `${k} from the side`).toBeLessThan(MAX_S_CURVE);
      expect(against(path.map((p) => [p.x, p.y])), `${k} from the front`).toBeLessThan(MAX_S_CURVE);
    }
    // The hand comes down all the way, without rising on the way.
    for (let i = 1; i < paths.hand.length; i++) expect(paths.hand[i].y).toBeLessThan(paths.hand[i - 1].y + 0.001);
  });

  test("it moves smoothly and evenly, and both sides match", () => {
    let g = posePushdown(push, 0);
    for (let i = 1; i <= 100; i++) {
      const now = posePushdown(push, i / 100);
      expect(now.l.grip.distanceTo(g.l.grip)).toBeLessThan(MAX_STEP);
      expect(Math.abs(now.l.grip.x + now.r.grip.x)).toBeLessThan(0.01);
      g = now;
    }
  });
});
