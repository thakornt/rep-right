// The 3D hammer curl must stay a pose a real body can make, through the whole lift.
// The elbow does the work, so these also pin down how far this body's elbow can fold
// before the dumbbell reaches the body.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { DUMBBELL_GRIP } from "./grip";
import { loadBody } from "./load-body";
import { worldPos } from "./pose";
import { alternateAt, alternateTime, bicepsBulge, HAMMER_CURL, poseCurl, poseCurlArms, readCurlRig, type CurlRig } from "./pose-curl";
import { DOWN_SHARE } from "./tempo";
import { DUMBBELL } from "./pose-press";

const ARMPIT_FOLD = 0.045; // skin folding at the shoulder joint; hidden, but real overlap
const THROUGH = 0.01;
const FLOOR = 0.01;
const MAX_FINGER_GAP = 0.035; // middle finger bones to the handle's centre
const MIN_DUMBBELL_GAP = 0.04; // dumbbell to the trunk, head and legs at any point of the lift
const MAX_STEP = 0.012; // metres a hand may move per 1% of the lift
const STRAIGHT_WRIST = 2; // degrees
const MAX_ELBOW_KINK = 1; // degrees the arm may bend out at the elbow, seen from the front, arm down
const MAX_WRIST_OUT = 0.12; // metres the wrist may sit outside the shoulder, arm down; closer and the dumbbell meets the thigh

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let root: THREE.Object3D;
let curl: CurlRig;
let anatomy: Anatomy;
let body: Body;

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  curl = readCurlRig(root);
  body = readBody(root);
});

const left = () => measure(anatomy).l as unknown as Record<string, number>;

// Lowest distance from a dumbbell to the skin of the trunk, head and legs.
function dumbbellToSkin(g: ReturnType<typeof poseCurl>) {
  const p = new THREE.Vector3();
  let gap = Infinity;
  body.part.forEach((part, i) => {
    if (part !== "core" && part !== "legL" && part !== "legR") return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
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

describe("dumbbell hammer curl", () => {
  test.each(DEPTHS)("depth %s", (depth) => {
    const g = poseCurl(curl, depth);
    const problems: string[] = [];

    for (const v of violations(measure(anatomy))) problems.push(`${v.joint} ${v.value.toFixed(0)} (${v.min}..${v.max})`);

    const c = contact(body);
    for (const t of c.through) {
      const allowed = t.pair.endsWith("/core") ? ARMPIT_FOLD : THROUGH;
      if (t.depth > allowed) problems.push(`${t.pair} ${(t.depth * 100).toFixed(1)} cm through`);
    }
    if (c.floor > FLOOR) problems.push(`skin ${(c.floor * 100).toFixed(1)} cm under the floor`);

    for (const tag of ["l", "r"] as const) {
      for (const f of ["index", "middle", "ring", "pinky"]) {
        const { grip, handle } = g[tag];
        const w = worldPos(root.getObjectByName(`${f}_02_${tag}`)!).sub(grip);
        const gap = w.addScaledVector(handle, -w.dot(handle)).length();
        if (gap > MAX_FINGER_GAP) problems.push(`${tag} ${f} ${(gap * 100).toFixed(1)} cm from the handle`);
      }
    }

    const gap = dumbbellToSkin(g);
    if (gap < MIN_DUMBBELL_GAP) problems.push(`dumbbell ${(gap * 100).toFixed(1)} cm from the body`);

    expect(problems.join("; ")).toBe("");
  });

  test("the elbow goes from nearly straight to well bent, without locking", () => {
    poseCurl(curl, 1);
    expect(left()["elbow.flexion"]).toBeGreaterThan(5);
    expect(left()["elbow.flexion"]).toBeLessThan(15);
    poseCurl(curl, 0);
    expect(left()["elbow.flexion"]).toBeGreaterThan(125);
    expect(left()["elbow.flexion"]).toBeLessThan(135);
  });

  test("the elbow can't fold much past the top of the lift: the dumbbell reaches the body", () => {
    expect(dumbbellToSkin(poseCurlArms(curl, 130, HAMMER_CURL.forwardAtTop))).toBeGreaterThan(0.06);
    expect(dumbbellToSkin(poseCurlArms(curl, 155, HAMMER_CURL.forwardAtTop))).toBeLessThan(0.01);
  });

  test("the palm keeps facing in and the wrist stays straight", () => {
    for (const d of DEPTHS) {
      poseCurl(curl, d);
      const m = left();
      // 90 = thumb up from the anatomical position. A few degrees past it, as the
      // forearm's own carrying angle turns with the bend.
      expect(m["forearm.pronation"]).toBeGreaterThan(90);
      expect(m["forearm.pronation"]).toBeLessThan(110);
      expect(Math.abs(m["wrist.flexion"])).toBeLessThan(STRAIGHT_WRIST);
      expect(Math.abs(m["wrist.deviation"])).toBeLessThan(STRAIGHT_WRIST);
      expect(Math.abs(m["wrist.twist"])).toBeLessThan(STRAIGHT_WRIST);
    }
  });

  test("the upper arm stays by the side, drifting forward only near the top", () => {
    for (const d of DEPTHS) {
      poseCurl(curl, d);
      expect(left()["shoulder.elevation"]).toBeLessThan(20);
      expect(Math.abs(left()["shoulder.rotation"])).toBeLessThan(5);
    }
    const elbowZ = (d: number) => {
      poseCurl(curl, d);
      return worldPos(curl.l.s.lowerarm).z - worldPos(curl.l.s.upperarm).z;
    };
    expect(elbowZ(1)).toBeCloseTo(0, 2);
    expect(elbowZ(0.5)).toBeLessThan(0.02);
    expect(elbowZ(0)).toBeGreaterThan(0.03);
    expect(elbowZ(0)).toBeLessThan(0.07);
  });

  test("the arm hangs straight beside the body, not bowed out at the elbow", () => {
    poseCurl(curl, 1);
    const s = curl.l.s;
    const shoulder = worldPos(s.upperarm);
    const elbow = worldPos(s.lowerarm);
    const wrist = worldPos(s.hand);
    const out = (a: THREE.Vector3, b: THREE.Vector3) => THREE.MathUtils.radToDeg(Math.atan2(b.x - a.x, a.y - b.y));
    expect(Math.abs(out(elbow, wrist) - out(shoulder, elbow))).toBeLessThan(MAX_ELBOW_KINK);
    expect(wrist.x - shoulder.x).toBeLessThan(MAX_WRIST_OUT);
  });

  test("the biceps swells only on the front of the upper arm, as the elbow bends", () => {
    expect(bicepsBulge(1)).toBeLessThan(0.002);
    expect(bicepsBulge(0)).toBeCloseTo(HAMMER_CURL.bicepsBulge, 3);
    for (let d = 0.1; d <= 1; d += 0.1) expect(bicepsBulge(d)).toBeLessThanOrEqual(bicepsBulge(d - 0.1));

    const { skin } = curl.rig;
    const at = curl.biceps;
    expect(Math.max(...at)).toBeCloseTo(1, 1);
    // Both arms, and nothing else.
    const names = skin.skeleton.bones.map((b) => b.name);
    let swelling = [0, 0];
    at.forEach((w, i) => {
      if (w === 0) return;
      // Skin on the upper arm: on the arm's bone and its twist bones together, more than half.
      const share = { l: 0, r: 0 };
      for (const k of [0, 1, 2, 3]) {
        const bone = names[skin.geometry.attributes.skinIndex.getComponent(i, k)];
        const m = /^upperarm_(?:twist\d_)?([lr])$/.exec(bone);
        if (m) share[m[1] as "l" | "r"] += skin.geometry.attributes.skinWeight.getComponent(i, k);
      }
      expect(Math.max(share.l, share.r)).toBeGreaterThan(0.5);
      swelling[share.l > share.r ? 0 : 1]++;
    });
    expect(swelling[0]).toBeGreaterThan(20);
    expect(swelling[0]).toBe(swelling[1]);
    swelling = [];

    // The swelling faces the way the forearm folds.
    poseCurl(curl, 0.5);
    const s = curl.l.s;
    const middle = worldPos(s.upperarm).lerp(worldPos(s.lowerarm), 0.5);
    const fore = worldPos(s.hand).sub(worldPos(s.lowerarm)).normalize();
    const p = new THREE.Vector3();
    let onFront = 0;
    let total = 0;
    at.forEach((w, i) => {
      if (w < 0.5 || skin.getVertexPosition(i, p).applyMatrix4(skin.matrixWorld).x < 0) return;
      total++;
      if (p.sub(middle).dot(fore) > 0) onFront++;
    });
    expect(total).toBeGreaterThan(0);
    expect(onFront).toBe(total);
  });

  test("alternating, one arm finishes its rep while the other waits down", () => {
    const T = 3;
    const up = 1 - DOWN_SHARE.hammer; // the quick way up
    // The left arm's rep: from down, to the top, back down, with the right arm waiting.
    expect(alternateAt(0, T)).toEqual({ side: "l", depth: 1 });
    expect(alternateAt(T * up, T).side).toBe("l");
    expect(alternateAt(T * up, T).depth).toBeCloseTo(0, 5);
    expect(alternateAt(T * 0.99, T).side).toBe("l");
    expect(alternateAt(T * 0.99, T).depth).toBeGreaterThan(0.99);
    // Only then the right arm's.
    expect(alternateAt(T, T)).toEqual({ side: "r", depth: 1 });
    expect(alternateAt(T * (1 + up), T).side).toBe("r");
    expect(alternateAt(T * (1 + up), T).depth).toBeCloseTo(0, 5);
    expect(alternateAt(T * 2, T)).toEqual({ side: "l", depth: 1 });
    // Picking up from the slider lands on the same arm, on its way up.
    for (const side of ["l", "r"] as const) {
      for (const depth of [0.2, 0.5, 0.9]) {
        const at = alternateAt(alternateTime(depth, side, T), T);
        expect(at.side).toBe(side);
        expect(at.depth).toBeCloseTo(depth, 5);
      }
    }
  });

  test("each arm can lift alone while the other waits down, and the pose stays a real one", () => {
    const flexion = () => {
      const m = measure(anatomy) as unknown as Record<"l" | "r", Record<string, number>>;
      return { l: m.l["elbow.flexion"], r: m.r["elbow.flexion"] };
    };
    poseCurl(curl, 0, 1);
    expect(flexion().l).toBeGreaterThan(125);
    expect(flexion().r).toBeLessThan(15);
    poseCurl(curl, 1, 0);
    expect(flexion().l).toBeLessThan(15);
    expect(flexion().r).toBeGreaterThan(125);

    for (const d of DEPTHS) {
      for (const g of [poseCurl(curl, d, 1), poseCurl(curl, 1, d)]) {
        const problems = violations(measure(anatomy)).map((v) => `${v.joint} ${v.value.toFixed(0)}`);
        for (const t of contact(body).through) {
          if (t.depth > (t.pair.endsWith("/core") ? ARMPIT_FOLD : THROUGH)) problems.push(`${t.pair} ${(t.depth * 100).toFixed(1)} cm through`);
        }
        if (dumbbellToSkin(g) < MIN_DUMBBELL_GAP) problems.push(`dumbbell ${(dumbbellToSkin(g) * 100).toFixed(1)} cm from the body at depth ${d}`);
        expect(problems.join("; ")).toBe("");
      }
    }
  }, 20000); // poses the body many times; the shoulders' corrective smoothing runs each time

  test("the biceps swell apart: weights mark which arm each vertex is on", () => {
    expect(Math.max(...curl.biceps)).toBeCloseTo(1, 1);
    expect(Math.min(...curl.biceps)).toBeCloseTo(-1, 1);
  });

  test("the dumbbell turns with the forearm, at the angle the approved grip holds it", () => {
    const tilt = Math.sin(THREE.MathUtils.degToRad(DUMBBELL_GRIP.diagonal));
    for (const d of DEPTHS) {
      const g = poseCurl(curl, d);
      const fore = worldPos(curl.l.s.hand).sub(worldPos(curl.l.s.lowerarm)).normalize();
      expect(Math.abs(g.l.handle.dot(fore))).toBeCloseTo(tilt, 2);
    }
  });

  test("only the arms move, smoothly and evenly, with the feet flat about hip width", () => {
    const { rig } = curl;
    poseCurl(curl, 0);
    const bones = [rig.pelvis, rig.spine3, rig.neck, rig.l.foot, rig.r.foot, rig.l.calf, rig.r.calf];
    const still = bones.map(worldPos);
    expect(Math.abs(worldPos(rig.l.foot).x)).toBeCloseTo(HAMMER_CURL.stance, 2);
    expect(worldPos(rig.l.foot).y).toBeCloseTo(rig.l.ankle.y, 3);
    const n = 100;
    let prev = poseCurl(curl, 0);
    for (let i = 1; i <= n; i++) {
      const g = poseCurl(curl, i / n);
      expect(g.l.grip.distanceTo(prev.l.grip)).toBeLessThan(MAX_STEP);
      expect(g.r.grip.distanceTo(prev.r.grip)).toBeLessThan(MAX_STEP);
      expect(Math.abs(g.l.grip.x + g.r.grip.x)).toBeLessThan(0.01);
      prev = g;
      bones.forEach((b, k) => expect(worldPos(b).distanceTo(still[k])).toBeLessThan(0.002));
    }
  });
});
