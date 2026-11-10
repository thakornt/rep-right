// The 3D crunch must stay a pose a real body can make, through the whole rep: lying on the mat
// with the feet flat and the hips still, the upper back curling off the floor while the lower
// back stays down, and the fingertips resting on the temples, palms toward the face, the elbows
// open forward of the body, without pulling on the head.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { worldPos } from "./pose";
import { CRUNCH, poseCrunch, readCrunchRig, type CrunchRig } from "./pose-crunch";

const ARMPIT_FOLD = 0.045; // skin folding at the shoulder joint; the same allowance as the other lifts
const THROUGH = 0.01;
const MAX_ON_MAT = 0.002; // metres the skin may sink into the mat
const MAX_OFF_MAT_FLAT = 0.003; // metres the back may be off the mat, lying flat
const MAX_LOWER_BACK_RISE = 0.03; // metres the lower back may rise: it stays down
const MIN_SHOULDER_RISE = 0.1; // metres the shoulders come up at the top: the blades clear the floor
const MAX_SHOULDER_RISE = 0.2; // and no more: this isn't a sit-up
const MIN_NECK_FROM_KNEE = 0.3; // metres the base of the neck stays from the knees at the top: well short of sitting up
const MAX_HAND_SINK = 0.003; // metres the hand's skin may sink into the head: it only touches
const MAX_HAND_OFF = 0.01; // metres the nearest fingertip may be from the head: it does touch
const MIN_PALM_OFF = 0.04; // metres the palm stands off the head, from the owner's photo
const ELBOW_FORWARD = 45; // degrees forward of straight out to the side the elbow opens, as the owner asked
const MAX_ELBOW_OFF = 6; // degrees it may be off that
const MIN_PALM_TO_HEAD = 0.5; // how squarely the palm faces the head, as a cosine
const MAX_S_CURVE = 12; // degrees a path may turn against its main direction, in any view
const MIN_PATH_STEP = 0.004; // metres a joint must move before its direction counts
const MAX_STEP = 0.012; // metres the neck may move per 1% of the rep: no swings
const MAX_FOOT_LIFT = 0.002; // metres the feet may move

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let root: THREE.Object3D;
let crunch: CrunchRig;
let anatomy: Anatomy;
let body: Body;

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  crunch = readCrunchRig(root);
  body = readBody(root);
});

function lowestCore(zFrom: number, zTo: number) {
  const p = new THREE.Vector3();
  let low = Infinity;
  body.part.forEach((part, i) => {
    if (part !== "core") return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    if (p.z <= zFrom && p.z >= zTo) low = Math.min(low, p.y);
  });
  return low;
}

describe("crunch", () => {
  test.each(DEPTHS)("depth %s", (depth) => {
    poseCrunch(crunch, depth);
    const problems: string[] = [];
    for (const v of violations(measure(anatomy))) problems.push(`${v.joint} ${v.value.toFixed(0)} (${v.min}..${v.max})`);
    const c = contact(body);
    for (const t of c.through) {
      const allowed = t.pair.endsWith("/core") ? ARMPIT_FOLD : THROUGH;
      if (t.depth > allowed) problems.push(`${t.pair} ${(t.depth * 100).toFixed(1)} cm through`);
    }
    const p = new THREE.Vector3();
    let low = Infinity;
    for (let i = 0; i < body.part.length; i++) {
      body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
      low = Math.min(low, p.y);
    }
    if (low < CRUNCH.matTop - MAX_ON_MAT) problems.push(`skin ${((CRUNCH.matTop - low) * 100).toFixed(1)} cm into the mat`);
    expect(problems.join("; ")).toBe("");
  });

  test("lying flat, the back is on the mat", () => {
    poseCrunch(crunch, 1);
    expect(Math.abs(lowestCore(0.1, -0.7) - CRUNCH.matTop)).toBeLessThan(MAX_OFF_MAT_FLAT);
  });

  test("the upper back curls up and the lower back stays down: a crunch, not a sit-up", () => {
    poseCrunch(crunch, 1);
    const flat = worldPos(crunch.l.s.upperarm).y;
    const flatLower = worldPos(crunch.rig.spine1).y;
    poseCrunch(crunch, 0);
    const rise = worldPos(crunch.l.s.upperarm).y - flat;
    expect(rise).toBeGreaterThan(MIN_SHOULDER_RISE);
    expect(rise).toBeLessThan(MAX_SHOULDER_RISE);
    expect(worldPos(crunch.rig.spine1).y - flatLower).toBeLessThan(MAX_LOWER_BACK_RISE);
    expect(worldPos(crunch.rig.neck).distanceTo(worldPos(crunch.l.s.calf))).toBeGreaterThan(MIN_NECK_FROM_KNEE);
  });

  test("the hips and feet stay put, with the knees up", () => {
    poseCrunch(crunch, 0);
    const hips = worldPos(crunch.rig.pelvis);
    const ankle = worldPos(crunch.l.s.foot);
    const ball = worldPos(crunch.rig.l.ball);
    for (const d of DEPTHS) {
      poseCrunch(crunch, d);
      expect(worldPos(crunch.rig.pelvis).distanceTo(hips)).toBeLessThan(0.001);
      expect(worldPos(crunch.l.s.foot).distanceTo(ankle)).toBeLessThan(MAX_FOOT_LIFT);
      expect(worldPos(crunch.rig.l.ball).distanceTo(ball)).toBeLessThan(MAX_FOOT_LIFT);
      expect(worldPos(crunch.l.s.calf).y).toBeGreaterThan(hips.y + 0.2);
    }
  });

  test("the hand doesn't sink into the head: only the fingertips reach it, the palm stands off", () => {
    const g = body.mesh.geometry;
    const bones = body.mesh.skeleton.bones;
    const owner = (i: number) => {
      let best = 0;
      let at = 0;
      for (let k = 0; k < 4; k++) {
        const w = g.attributes.skinWeight.getComponent(i, k);
        if (w > best) {
          best = w;
          at = g.attributes.skinIndex.getComponent(i, k);
        }
      }
      return bones[at].name;
    };
    const skin = (names: RegExp) => {
      const out: number[] = [];
      for (let i = 0; i < g.attributes.position.count; i++) if (names.test(owner(i))) out.push(i);
      return out;
    };
    const at = (i: number) => body.mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(body.mesh.matrixWorld);
    const head = skin(/^head$/);
    for (const tag of ["l", "r"]) {
      const palm = skin(new RegExp(`^hand_${tag}$`));
      const fingers = skin(new RegExp(`^(index|middle|ring|pinky|thumb)_0\\d_${tag}$`));
      for (const d of [0, 0.5, 1]) {
        poseCrunch(crunch, d);
        const headSkin = head.map(at);
        const middle = headSkin.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / headSkin.length);
        const gapTo = (p: THREE.Vector3) => {
          let near = Infinity;
          let q = headSkin[0];
          for (const h of headSkin) {
            const w = h.distanceToSquared(p);
            if (w < near) {
              near = w;
              q = h;
            }
          }
          return { gap: Math.sqrt(near), sink: q.distanceTo(middle) - p.distanceTo(middle) };
        };
        const reach = fingers.map((i) => gapTo(at(i)));
        expect(Math.max(...reach.map((r) => r.sink))).toBeLessThan(MAX_HAND_SINK);
        expect(Math.min(...reach.map((r) => r.gap))).toBeLessThan(MAX_HAND_OFF);
        expect(Math.min(...palm.map((i) => gapTo(at(i)).gap))).toBeGreaterThan(MIN_PALM_OFF);
      }
    }
  });

  test("the palms face in and the elbows open 45 degrees forward", () => {
    for (const d of DEPTHS) {
      poseCrunch(crunch, d);
      const s = crunch.l.s;
      const curl = THREE.MathUtils.degToRad((CRUNCH.curlLow + CRUNCH.curlMiddle + CRUNCH.curlHigh) * (1 - d) - 90);
      const facing = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(1, 0, 0), curl);
      const upper = worldPos(s.lowerarm).sub(worldPos(s.upperarm));
      const open = THREE.MathUtils.radToDeg(Math.atan2(upper.dot(facing), upper.x));
      expect(Math.abs(open - ELBOW_FORWARD)).toBeLessThan(MAX_ELBOW_OFF);

      for (const tag of ["l", "r"] as const) {
        const sign = tag === "l" ? 1 : -1;
        const wrist = worldPos(root.getObjectByName(`hand_${tag}`)!);
        const long = worldPos(root.getObjectByName(`middle_01_${tag}`)!).sub(wrist).normalize();
        const across = worldPos(root.getObjectByName(`index_01_${tag}`)!).sub(worldPos(root.getObjectByName(`pinky_01_${tag}`)!)).normalize();
        const palm = long.clone().cross(across).normalize().multiplyScalar(sign);
        const toHead = worldPos(root.getObjectByName("head")!).sub(worldPos(root.getObjectByName(`middle_01_${tag}`)!)).normalize();
        expect(palm.dot(toHead)).toBeGreaterThan(MIN_PALM_TO_HEAD);
      }
    }
  });

  test("no joint's path doubles back into an S curve, and it moves smoothly", () => {
    const joints = { wrist: crunch.l.s.hand, elbow: crunch.l.s.lowerarm, shoulder: crunch.l.s.upperarm, neck: crunch.rig.neck };
    const paths = Object.fromEntries(Object.keys(joints).map((k) => [k, [] as THREE.Vector3[]]));
    for (let i = 0; i <= 100; i++) {
      poseCrunch(crunch, i / 100);
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
      for (let i = 1; i < path.length; i++) expect(path[i].distanceTo(path[i - 1])).toBeLessThan(MAX_STEP);
    }
  });
});
