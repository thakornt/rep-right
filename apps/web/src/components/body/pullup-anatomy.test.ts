// The 3D pull-up and chin-up must stay a pose a real body can make, through the whole rep, with the
// bar in both hands, and follow the owner's reference clips (2026-11-14): from the dead hang with
// the shoulders up by the ears, the shoulder blades pressing down, then the pull until the chin
// clears the bar. Overhand the hands are a little wider than the shoulders and the elbows go out to
// the sides; underhand the hands are about shoulder width and the elbows come down in front.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { BAR_RADIUS, trunkLean, worldPos } from "./pose";
import { posePullUp, PULL_UP_GRIPS, readPullUpRig, type PullUpGrip, type PullUpRig } from "./pose-pullup";

const ARMPIT_FOLD = 0.045; // skin folding at the shoulder joint; the same allowance as the other lifts
const THROUGH = 0.01;
const MAX_FINGER_GAP = 0.035; // middle finger bones to the bar's centre
const MAX_GRIP_MISS = 0.004; // metres a fist may be off its place on the bar
const MIN_BAR_GAP = 0.02; // metres the bar stays off the face, neck and chest
const MAX_WRIST_BEND = 20; // degrees the wrist may bend forward or back
const MAX_WRIST_SIDE = 16; // degrees it may bend sideways, well inside its range of 20 and 30
const MAX_ELBOW_HANG = 18; // degrees the elbows stay bent in the dead hang: straight, not locked
const MIN_CHIN_OVER = 0.01; // metres the chin clears the top of the bar at the top
const MAX_CHIN_OVER = 0.08; // and no more: just over it, as in the clip
const MIN_SHRUG_DROP = 0.06; // metres the shoulders come down from the dead hang by halfway up
const MAX_SHRUG_STEP = 0.006; // metres they may come down per 1% of the rep: gradually, no step
const MIN_ELBOW_DOWN = 0.15; // metres the elbows sit below the shoulders at the top, along the trunk
const MAX_ELBOW_BACK = 0.02; // metres they may sit behind the shoulders then, in the trunk's frame
const MAX_FIST_TURN = 0.5; // degrees the fist may turn on the bar through the rep: it holds still
const MIN_FEET_CLEAR = 0.3; // metres the feet hang off the floor
const MAX_STEP = 0.02; // metres a hand, elbow or head may move per 1% of the rep: no jumps
const MIN_OVERHAND_ELBOW_OUT = 0.1; // metres the elbows sit out from the shoulders at the top, overhand: down and a little out
const MAX_UNDERHAND_ELBOW_OUT = 0.07; // and no more than this underhand: down in front, by the ribs

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);
const GRIPS: PullUpGrip[] = ["overhand", "underhand"];

const rigs = {} as Record<PullUpGrip, { root: THREE.Object3D; pull: PullUpRig; anatomy: Anatomy; body: Body; chin: number }>;

beforeAll(async () => {
  // A body each: a rig reads its rest from the body as it finds it.
  for (const grip of GRIPS) {
    const root = await loadBody();
    const body = readBody(root);
    const chin = findChin(root, body);
    rigs[grip] = { root, pull: readPullUpRig(root, grip), anatomy: readAnatomy(root), body, chin };
  }
});

// Lowest distance from the bar to the skin of the trunk and head.
function barToSkin(body: Body, bar: THREE.Vector3) {
  const p = new THREE.Vector3();
  let gap = Infinity;
  body.part.forEach((part, i) => {
    if (part !== "core") return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    if (Math.abs(p.x) > 0.12) return; // the trunk and head between the arms, not the shoulders by the hands
    gap = Math.min(gap, Math.hypot(p.y - bar.y, p.z - bar.z) - BAR_RADIUS);
  });
  return gap;
}

// The tip of the chin: picked once at rest, the skin furthest forward on the middle line between
// 6 and 12 cm below the head joint, then followed as the body poses.
function findChin(root: THREE.Object3D, body: Body) {
  const head = worldPos(root.getObjectByName("head")!);
  const p = new THREE.Vector3();
  let best = -1;
  let front = -Infinity;
  body.part.forEach((part, i) => {
    if (part !== "core") return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    if (Math.abs(p.x) > 0.01 || p.y > head.y - 0.06 || p.y < head.y - 0.12) return;
    if (p.z > front) {
      front = p.z;
      best = i;
    }
  });
  return best;
}

function lowestSkin(body: Body) {
  const p = new THREE.Vector3();
  let low = Infinity;
  body.part.forEach((_, i) => {
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    low = Math.min(low, p.y);
  });
  return low;
}

describe.each(GRIPS)("pull-up, %s", (grip) => {
  test.each(DEPTHS)("depth %s", (depth) => {
    const { root, pull, anatomy, body } = rigs[grip];
    const g = posePullUp(pull, depth);
    const problems: string[] = [];

    for (const v of violations(measure(anatomy))) problems.push(`${v.joint} ${v.value.toFixed(0)} (${v.min}..${v.max})`);

    const c = contact(body);
    for (const t of c.through) {
      const allowed = t.pair.endsWith("/core") ? ARMPIT_FOLD : THROUGH;
      if (t.depth > allowed) problems.push(`${t.pair} ${(t.depth * 100).toFixed(1)} cm through`);
    }
    const low = lowestSkin(body);
    if (low < MIN_FEET_CLEAR) problems.push(`feet ${(low * 100).toFixed(0)} cm off the floor`);

    for (const tag of ["l", "r"] as const) {
      const { grip: fist, handle } = g[tag];
      const sign = tag === "l" ? 1 : -1;
      const miss = fist.distanceTo(g.bar.clone().setX(sign * PULL_UP_GRIPS[grip].gripHalf));
      if (miss > MAX_GRIP_MISS) problems.push(`${tag} fist ${(miss * 100).toFixed(1)} cm off the bar`);
      for (const f of ["index", "middle", "ring", "pinky"]) {
        const w = worldPos(root.getObjectByName(`${f}_02_${tag}`)!).sub(fist);
        const gap = w.addScaledVector(handle, -w.dot(handle)).length();
        if (gap > MAX_FINGER_GAP) problems.push(`${tag} ${f} ${(gap * 100).toFixed(1)} cm from the bar`);
      }
      const m = measure(anatomy)[tag] as unknown as Record<string, number>;
      if (Math.abs(m["wrist.flexion"]) > MAX_WRIST_BEND) problems.push(`${tag} wrist bent ${m["wrist.flexion"].toFixed(0)}`);
      if (Math.abs(m["wrist.deviation"]) > MAX_WRIST_SIDE) problems.push(`${tag} wrist sideways ${m["wrist.deviation"].toFixed(0)}`);
    }

    const gap = barToSkin(body, g.bar);
    if (gap < MIN_BAR_GAP) problems.push(`bar ${(gap * 100).toFixed(1)} cm from the face, neck or chest`);

    expect(problems.join("; ")).toBe("");
  });

  test("from the dead hang, the shoulders come down gradually with the pull", () => {
    const { root, pull, anatomy } = rigs[grip];
    posePullUp(pull, 0);
    expect((measure(anatomy).l as unknown as Record<string, number>)["elbow.flexion"]).toBeLessThan(MAX_ELBOW_HANG);
    // The head comes up out from between the arms as the shoulders drop away from the ears, a
    // little more each step: no step of its own.
    const ears = () => worldPos(root.getObjectByName("head")!).y - worldPos(pull.l.s.upperarm).y;
    const hang = ears();
    let last = hang;
    for (let i = 1; i <= 50; i++) {
      posePullUp(pull, i / 100);
      const now = ears();
      expect(now).toBeGreaterThanOrEqual(last - 1e-4);
      expect(now - last).toBeLessThan(MAX_SHRUG_STEP);
      last = now;
    }
    expect(last - hang).toBeGreaterThan(MIN_SHRUG_DROP);
  });

  test("at the top the elbows drive down, never back", () => {
    const { pull } = rigs[grip];
    posePullUp(pull, 1);
    const lean = -trunkLean(pull.rig);
    const d = worldPos(pull.l.s.lowerarm).sub(worldPos(pull.l.s.upperarm));
    // In the trunk's own frame: down along it, and forward of it.
    expect(-(d.y * Math.cos(lean) - d.z * Math.sin(lean))).toBeGreaterThan(MIN_ELBOW_DOWN);
    expect(d.z * Math.cos(lean) + d.y * Math.sin(lean)).toBeGreaterThan(-MAX_ELBOW_BACK);
  });

  test("the fist doesn't turn on the bar", () => {
    const { pull } = rigs[grip];
    posePullUp(pull, 0);
    const hang = pull.l.s.hand.getWorldQuaternion(new THREE.Quaternion());
    for (const d of DEPTHS) {
      posePullUp(pull, d);
      const now = pull.l.s.hand.getWorldQuaternion(new THREE.Quaternion());
      expect((now.angleTo(hang) * 180) / Math.PI).toBeLessThan(MAX_FIST_TURN);
    }
  });

  test("the chin clears the bar at the top", () => {
    const { pull, body, chin } = rigs[grip];
    const g = posePullUp(pull, 1);
    const tip = body.mesh.getVertexPosition(chin, new THREE.Vector3()).applyMatrix4(body.mesh.matrixWorld);
    expect(tip.y - (g.bar.y + BAR_RADIUS)).toBeGreaterThan(MIN_CHIN_OVER);
    expect(tip.y - (g.bar.y + BAR_RADIUS)).toBeLessThan(MAX_CHIN_OVER);
  });

  test("the bar stays put and nothing jumps through the rep", () => {
    const { root, pull } = rigs[grip];
    const head = root.getObjectByName("head")!;
    let last: THREE.Vector3[] | null = null;
    for (let i = 0; i <= 100; i++) {
      const g = posePullUp(pull, i / 100);
      expect(g.bar.y).toBeCloseTo(pull.barY, 6);
      const now = [g.l.grip, g.r.grip, worldPos(pull.l.s.lowerarm), worldPos(pull.r.s.lowerarm), worldPos(head)];
      if (last) now.forEach((p, k) => expect(p.distanceTo(last![k])).toBeLessThan(MAX_STEP));
      last = now;
    }
  });
});

test("underhand the hands are narrower than overhand, and the elbows come down in front", () => {
  const width = (grip: PullUpGrip) => {
    const g = posePullUp(rigs[grip].pull, 0.5);
    return g.l.grip.distanceTo(g.r.grip);
  };
  expect(width("underhand")).toBeLessThan(width("overhand"));
  const elbowOut = (grip: PullUpGrip) => {
    const { pull } = rigs[grip];
    posePullUp(pull, 1);
    return worldPos(pull.l.s.lowerarm).x - worldPos(pull.l.s.upperarm).x;
  };
  expect(elbowOut("overhand")).toBeGreaterThan(MIN_OVERHAND_ELBOW_OUT);
  expect(elbowOut("underhand")).toBeLessThan(MAX_UNDERHAND_ELBOW_OUT);
});
