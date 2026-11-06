// The 3D lat pulldown must stay a pose a real body can make, through the whole lift, with
// the bar in both hands, and follow the rep measured off the owner's chosen video: the trunk
// from upright to leaning well back, the bar a steady distance in front of the shoulders, and
// the elbow out in front. No joint's path may double back into an S curve, from any view. The
// thighs stay locked under the pads, and in the thumbless grip the thumb only touches the bar.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { BAR_RADIUS, worldPos } from "./pose";
import { LAT_PULLDOWN, posePulldown, pulleyAt, readPulldownRig, type PulldownRig } from "./pose-pulldown";

const ARMPIT_FOLD = 0.045; // skin folding at the shoulder joint; the same allowance as the other lifts
const THROUGH = 0.01;
const FLOOR = 0.01;
const MAX_FINGER_GAP = 0.035; // middle finger bones to the bar's centre
const MAX_GRIP_MISS = 0.004; // metres a fist may be off its place on the bar
const MIN_BAR_GAP = 0.03; // metres the bar stays off the face and chest
const MAX_BAR_GAP_BOTTOM = 0.1; // and how far from the chest it stops at the bottom
const MAX_THUMB_SINK = 0.003; // metres the thumb's skin may sink in the bar: it rests there, it doesn't grip
const MAX_THUMB_TOUCH = 0.006; // metres its last bone may be off the bar: it does touch
const MIN_TIP_CLEAR = 0.015; // metres the tip stands clear of the bar, leaning away along it as in the owner's photo
const MIN_TIP_ABOVE = 0.003; // metres the tip shows above the top of the bar
const MAX_TIP_ABOVE = 0.018; // and no more: the owner's photo shows a short thumb, not one standing tall
const MAX_TIP_ROUND = 30; // degrees past the top of the bar the tip may reach: it doesn't wrap down like the fingers
const MAX_THUMB_MIDDLE_BEND = 35; // degrees the thumb's middle joint bends: relaxed
const MAX_THUMB_LAST_BEND = 50; // and its last joint: folded a little more, as the owner asked, well inside its range
const MAX_THUMB_TO_INDEX = 0.015; // metres from the thumb's last bone to the index finger: spread away from it, as the owner asked
const MAX_ELBOW_TOP = 35; // degrees the elbow stays bent at the top: nearly straight, not locked
const MIN_ELBOW_TOP = 10;
const MAX_WRIST_BEND = 20; // degrees the wrist may bend forward or back: a little back at the bottom, under the pull
const MAX_WRIST_SIDE = 16; // degrees it may bend sideways, well inside its range of 20 and 30
const MAX_CABLE_TILT_TOP = 8; // degrees the cable slants at the top: near upright, as measured
const MIN_CABLE_TILT_BOTTOM = 8; // and at the bottom, slanting in toward the lifter
const MAX_CABLE_TILT_BOTTOM = 20;
const MAX_FRONT_LEAN = 8; // degrees the forearm may lean from upright seen from the front: it doesn't fold in
const MAX_OFF_CABLE = 15; // degrees the forearm may be off the cable's slant seen from the side
const MIN_ELBOW_FORWARD = 0.12; // metres the elbow comes out in front of the shoulder through the middle, as measured
const MIN_BAR_AHEAD = 0.19; // metres the bar stays in front of the shoulders at every height, as measured
const MAX_BAR_AHEAD = 0.25;
const MAX_LEAN_OFF = 1.5; // degrees the trunk may be off the lean asked for
const MAX_S_CURVE = 12; // degrees a path may turn against its main direction, in any view, before it counts as an S curve
const MIN_PATH_STEP = 0.004; // metres a joint must move before its direction counts: stillness has no direction
const MAX_ELBOW_BACK = 0.01; // metres the elbow may sit behind the shoulder: the owner wants it pressed down, not driven back
const PAD_LINE = 0.015; // metres either side of the pad's line that count as under it
const MIN_PAD_PRESS = 0.005; // metres the pad presses into the thigh at the least: no gap
const MAX_PAD_PRESS = 0.02; // and at the most
const MAX_STEP = 0.012; // metres a hand or elbow may move per 1% of the lift: no swings
const MAX_ROTATION_STEP = 6; // degrees the shoulder may turn per 1% of the lift: the arm mustn't twist suddenly

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let root: THREE.Object3D;
let pull: PulldownRig;
let anatomy: Anatomy;
let body: Body;

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  pull = readPulldownRig(root);
  body = readBody(root);
});

const left = () => measure(anatomy).l as unknown as Record<string, number>;

function skinOf(names: string[]) {
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

// Lowest distance from the bar to the skin of the trunk and head.
function barToSkin(bar: THREE.Vector3) {
  const p = new THREE.Vector3();
  let gap = Infinity;
  body.part.forEach((part, i) => {
    if (part !== "core") return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    gap = Math.min(gap, Math.hypot(p.y - bar.y, p.z - bar.z) - BAR_RADIUS);
  });
  return gap;
}

describe("lat pulldown", () => {
  test.each(DEPTHS)("depth %s", (depth) => {
    const g = posePulldown(pull, depth);
    const problems: string[] = [];

    for (const v of violations(measure(anatomy))) problems.push(`${v.joint} ${v.value.toFixed(0)} (${v.min}..${v.max})`);

    const c = contact(body);
    for (const t of c.through) {
      const allowed = t.pair.endsWith("/core") ? ARMPIT_FOLD : THROUGH;
      if (t.depth > allowed) problems.push(`${t.pair} ${(t.depth * 100).toFixed(1)} cm through`);
    }
    if (c.floor > FLOOR) problems.push(`skin ${(c.floor * 100).toFixed(1)} cm under the floor`);

    for (const tag of ["l", "r"] as const) {
      const { grip, handle } = g[tag];
      const sign = tag === "l" ? 1 : -1;
      const miss = grip.distanceTo(g.bar.clone().setX(sign * LAT_PULLDOWN.gripHalf));
      if (miss > MAX_GRIP_MISS) problems.push(`${tag} fist ${(miss * 100).toFixed(1)} cm off the bar`);
      for (const f of ["index", "middle", "ring", "pinky"]) {
        const w = worldPos(root.getObjectByName(`${f}_02_${tag}`)!).sub(grip);
        const gap = w.addScaledVector(handle, -w.dot(handle)).length();
        if (gap > MAX_FINGER_GAP) problems.push(`${tag} ${f} ${(gap * 100).toFixed(1)} cm from the bar`);
      }
    }

    const bend = left()["wrist.flexion"];
    if (Math.abs(bend) > MAX_WRIST_BEND) problems.push(`wrist bent ${bend.toFixed(0)}`);

    const sideways = left()["wrist.deviation"];
    if (Math.abs(sideways) > MAX_WRIST_SIDE) problems.push(`wrist sideways ${sideways.toFixed(0)}`);

    const gap = barToSkin(g.bar);
    if (gap < MIN_BAR_GAP) problems.push(`bar ${(gap * 100).toFixed(1)} cm from the face or chest`);

    expect(problems.join("; ")).toBe("");
  });

  test("the bar sweeps in from well out in front, from nearly straight arms to the collarbones", () => {
    posePulldown(pull, 0);
    expect(left()["elbow.flexion"]).toBeGreaterThan(MIN_ELBOW_TOP);
    expect(left()["elbow.flexion"]).toBeLessThan(MAX_ELBOW_TOP);
    let last = Infinity;
    for (const d of DEPTHS) {
      const g = posePulldown(pull, d);
      // Always coming in toward the body, at about the same distance in front of the shoulders.
      expect(g.bar.z).toBeLessThan(last);
      last = g.bar.z;
      const ahead = g.bar.z - worldPos(pull.l.s.upperarm).z;
      expect(ahead).toBeGreaterThan(MIN_BAR_AHEAD);
      expect(ahead).toBeLessThan(MAX_BAR_AHEAD);
    }
    const tilt = (bar: THREE.Vector3) => THREE.MathUtils.radToDeg(Math.atan2(pulleyAt().z - bar.z, pulleyAt().y - bar.y));
    expect(Math.abs(tilt(posePulldown(pull, 0).bar))).toBeLessThan(MAX_CABLE_TILT_TOP);
    const g = posePulldown(pull, 1);
    expect(tilt(g.bar)).toBeGreaterThan(MIN_CABLE_TILT_BOTTOM);
    expect(tilt(g.bar)).toBeLessThan(MAX_CABLE_TILT_BOTTOM);
    expect(barToSkin(g.bar)).toBeLessThan(MAX_BAR_GAP_BOTTOM);
    expect(g.bar.y).toBeGreaterThan(worldPos(pull.l.s.upperarm).y);
    expect(g.bar.y).toBeLessThan(worldPos(pull.rig.neck).y);
  });

  test("the trunk goes from nearly upright to leaning well back, evenly", () => {
    const leanAt = (d: number) => {
      posePulldown(pull, d);
      const q = pull.rig.pelvis.getWorldQuaternion(new THREE.Quaternion()).multiply(pull.rig.pelvisRestQ.clone().invert());
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      return THREE.MathUtils.radToDeg(Math.atan2(-up.z, up.y));
    };
    for (const d of DEPTHS) {
      expect(Math.abs(leanAt(d) - (LAT_PULLDOWN.leanTop + (LAT_PULLDOWN.leanBottom - LAT_PULLDOWN.leanTop) * d))).toBeLessThan(MAX_LEAN_OFF);
    }
  });

  test("seen from the front the forearm stands upright, and from the side it stays near the cable", () => {
    for (const d of DEPTHS) {
      const g = posePulldown(pull, d);
      const s = pull.l.s;
      const fore = worldPos(s.hand).sub(worldPos(s.lowerarm));
      expect(Math.abs(THREE.MathUtils.radToDeg(Math.atan2(fore.x, fore.y)))).toBeLessThan(MAX_FRONT_LEAN);
      const cable = pulleyAt().sub(g.bar);
      const off = THREE.MathUtils.radToDeg(Math.atan2(fore.z, fore.y) - Math.atan2(cable.z, cable.y));
      expect(Math.abs(off)).toBeLessThan(MAX_OFF_CABLE);
    }
  });

  test("no joint's path doubles back into an S curve, from above, the side or the front", () => {
    const joints = { hand: pull.l.s.hand, elbow: pull.l.s.lowerarm, shoulder: pull.l.s.upperarm };
    const paths = Object.fromEntries(Object.keys(joints).map((k) => [k, [] as THREE.Vector3[]]));
    for (let i = 0; i <= 100; i++) {
      posePulldown(pull, i / 100);
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
      // And each comes down all the way, without rising on the way.
      for (let i = 1; i < path.length; i++) expect(path[i].y).toBeLessThan(path[i - 1].y + 0.001);
    }
  });

  test("the elbow comes forward through the middle of the lift, then presses down", () => {
    posePulldown(pull, 0.5);
    expect(worldPos(pull.l.s.lowerarm).z - worldPos(pull.l.s.upperarm).z).toBeGreaterThan(MIN_ELBOW_FORWARD);
  });

  test("at the bottom the elbows press down under the shoulders, not back", () => {
    posePulldown(pull, 1);
    const s = pull.l.s;
    const shoulder = worldPos(s.upperarm);
    const elbow = worldPos(s.lowerarm);
    expect(elbow.y).toBeLessThan(shoulder.y - 0.15);
    expect(elbow.x).toBeGreaterThan(shoulder.x);
    expect(elbow.z - shoulder.z).toBeGreaterThan(-MAX_ELBOW_BACK);
    // And never further back on the way there.
    for (const d of DEPTHS) {
      posePulldown(pull, d);
      expect(worldPos(s.lowerarm).z - worldPos(s.upperarm).z).toBeGreaterThan(-MAX_ELBOW_BACK);
    }
  });

  test("the pads press onto both thighs all the way, with no gap", () => {
    for (const d of [0, 0.5, 1]) {
      posePulldown(pull, d);
      const p = new THREE.Vector3();
      let top = -Infinity;
      body.part.forEach((part, i) => {
        if (part !== "legL") return;
        body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
        if (Math.abs(p.z - LAT_PULLDOWN.padAhead) < PAD_LINE) top = Math.max(top, p.y);
      });
      const press = top - (pull.padY - LAT_PULLDOWN.padRadius);
      expect(press).toBeGreaterThan(MIN_PAD_PRESS);
      expect(press).toBeLessThan(MAX_PAD_PRESS);
    }
  });

  test("the shoulder blades come down and the shoulders with them", () => {
    posePulldown(pull, 0);
    const up = worldPos(pull.l.s.upperarm).y;
    posePulldown(pull, 1);
    expect(worldPos(pull.l.s.upperarm).y).toBeLessThan(up - 0.05);
  });

  test("the thumb just touches the bar and carries on up: it doesn't wrap, and its joints stay natural", () => {
    const held = posePulldown(pull, 0.5).l;
    const axis = held.handle;
    const flat = (p: THREE.Vector3) => {
      const w = p.clone().sub(held.grip);
      return w.addScaledVector(axis, -w.dot(axis));
    };
    const toWrist = flat(worldPos(pull.l.s.hand)).normalize();
    // The side of the bar away from the palm.
    const away = axis.clone().cross(toWrist).normalize();
    if (flat(worldPos(root.getObjectByName("middle_01_l")!)).dot(away) > 0) away.negate();
    const round = (p: THREE.Vector3) => {
      const w = flat(p);
      return THREE.MathUtils.radToDeg(Math.atan2(w.dot(away), -w.dot(toWrist)));
    };

    const joint = (n: string) => worldPos(root.getObjectByName(`${n}_l`)!);
    const last = skinOf(["thumb_03_l"]);
    const tip = last.reduce((far, p) => (p.distanceTo(joint("thumb_03")) > far.distanceTo(joint("thumb_03")) ? p : far), last[0]);

    // It reaches the bar, but no skin sinks in: it rests there.
    const gaps = [...skinOf(["thumb_02_l"]), ...last].map((p) => flat(p).length() - BAR_RADIUS);
    expect(Math.min(...gaps)).toBeGreaterThan(-MAX_THUMB_SINK);
    expect(Math.min(...last.map((p) => flat(p).length() - BAR_RADIUS))).toBeLessThan(MAX_THUMB_TOUCH);

    // The tip stands clear, short of the top of the bar's far side: on the fingers' side, not wrapping.
    expect(flat(tip).length() - BAR_RADIUS).toBeGreaterThan(MIN_TIP_CLEAR);
    const above = -flat(tip).dot(toWrist) - BAR_RADIUS;
    expect(above).toBeGreaterThan(MIN_TIP_ABOVE);
    expect(above).toBeLessThan(MAX_TIP_ABOVE);
    expect(round(tip)).toBeLessThan(MAX_TIP_ROUND);
    expect(round(tip)).toBeGreaterThan(-90); // past the palm's side: above the bar, not under it

    // Bones, not rubber: each joint bends only as far as a relaxed thumb does.
    const bend = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => THREE.MathUtils.radToDeg(b.clone().sub(a).angleTo(c.clone().sub(b)));
    expect(bend(joint("thumb_01"), joint("thumb_02"), joint("thumb_03"))).toBeLessThan(MAX_THUMB_MIDDLE_BEND);
    expect(bend(joint("thumb_02"), joint("thumb_03"), tip)).toBeLessThan(MAX_THUMB_LAST_BEND);

    // Beside the index finger.
    const index = skinOf(["index_02_l", "index_03_l"]);
    let near = Infinity;
    for (const p of last) for (const q of index) near = Math.min(near, p.distanceTo(q));
    expect(near).toBeLessThan(MAX_THUMB_TO_INDEX);
  });

  test("it moves smoothly and evenly: no jumps, nothing twists, hips and feet stay", () => {
    const { rig } = pull;
    const n = 100;
    let g = posePulldown(pull, 0);
    let elbow = worldPos(pull.l.s.lowerarm);
    let rotation = left()["shoulder.rotation"];
    const hips = worldPos(rig.pelvis);
    for (let i = 1; i <= n; i++) {
      const now = posePulldown(pull, i / n);
      const elbowNow = worldPos(pull.l.s.lowerarm);
      const rotationNow = left()["shoulder.rotation"];
      expect(now.l.grip.distanceTo(g.l.grip)).toBeLessThan(MAX_STEP);
      expect(elbowNow.distanceTo(elbow)).toBeLessThan(MAX_STEP);
      expect(Math.abs(rotationNow - rotation)).toBeLessThan(MAX_ROTATION_STEP);
      expect(Math.abs(now.l.grip.x + now.r.grip.x)).toBeLessThan(0.01);
      expect(worldPos(rig.pelvis).distanceTo(hips)).toBeLessThan(0.001);
      expect(worldPos(rig.l.foot).y).toBeCloseTo(rig.l.ankle.y, 3);
      g = now;
      elbow = elbowNow;
      rotation = rotationNow;
    }
  });

  test("the seat and pads fit the body: the hips on the seat, the pads on the thighs", () => {
    expect(pull.seatY).toBeGreaterThan(0.3);
    expect(pull.seatY).toBeLessThan(LAT_PULLDOWN.hipHeight);
    expect(pull.padY).toBeGreaterThan(pull.seatY);
  });
});
