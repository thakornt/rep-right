// The 3D dumbbell shrug must stay a pose a real body can make, through the whole lift, and hold
// the form the owner set out (2026-11-17): the lateral raise's body position, the arms hanging
// straight down seen from the side and 10 degrees out seen from the front, and only the shoulders
// moving, straight up toward the ears.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { worldPos } from "./pose";
import { DUMBBELL } from "./pose-press";
import { LATERAL_RAISE } from "./pose-raise";
import { DUMBBELL_SHRUG, poseShrug, readShrugRig, SHRUG_SCULPT, shrugMush, shrugSculpt, type ShrugRig } from "./pose-shrug";

// With the shoulders up and the arms hanging, the skin under the arm would fold; the mesh can't, so
// the upper arm's skin sits up to 8.8 cm into the side of the chest near the top (2.7 cm at the
// bottom; the other dumbbell lifts allow 4.5). It is hidden between the arm and the body. The owner
// accepted it for the shrug (2026-11-17).
const SHRUG_ARMPIT_FOLD = 0.09;
const THROUGH = 0.01;
const FLOOR = 0.01;
const MAX_FINGER_GAP = 0.035; // middle finger bones to the handle's centre
const MIN_DUMBBELL_GAP = 0.01; // dumbbell to the trunk and legs: close beside the thighs (1.4 cm at the closest), not in them
const MAX_SIDE_LEAN = 1.5; // degrees the skin of the upper arm or forearm may lean from straight down, seen from the side
const STRAIGHT = 2; // degrees the wrist may bend
const MIN_RISE = 0.04; // metres the shoulders rise at the top
const MAX_STEP = 0.003; // metres a hand may move per 1% of the lift
const MAX_SCULPT_FROM_NECK = 0.2; // metres above or below the neck joint the sculpt may reach
const MAX_MIRROR_MISS = 0.003; // metres a sculpted point may be off its mirror image: it was sculpted with mirroring on

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let root: THREE.Object3D;
let shrug: ShrugRig;
let anatomy: Anatomy;
let body: Body;

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  shrug = readShrugRig(root);
  body = readBody(root);
});

const sideOf = (tag: "l" | "r") => measure(anatomy)[tag] as unknown as Record<string, number>;

// Lowest distance from a dumbbell to the skin of the trunk, head and legs.
function dumbbellToSkin(g: ReturnType<typeof poseShrug>) {
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

describe("dumbbell shrug", () => {
  test.each(DEPTHS)("depth %s", (depth) => {
    const g = poseShrug(shrug, depth);
    const problems: string[] = [];

    for (const v of violations(measure(anatomy))) problems.push(`${v.joint} ${v.value.toFixed(0)} (${v.min}..${v.max})`);

    const c = contact(body);
    for (const t of c.through) {
      const allowed = t.pair.endsWith("/core") ? SHRUG_ARMPIT_FOLD : THROUGH;
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

  // Judged by the skin, as the eye sees it: the upper arm's skin runs about 5.5 degrees off its bone,
  // so the bones alone would pass an arm that looks bent backward (owner, 2026-11-17).
  test("the arms hang straight down seen from the side, the elbow looking straight", () => {
    const slice = (a: THREE.Vector3, b: THREE.Vector3, t0: number, t1: number) => {
      const ab = b.clone().sub(a);
      const length = ab.length();
      ab.normalize();
      const c = new THREE.Vector3();
      let n = 0;
      const p = new THREE.Vector3();
      body.part.forEach((part, i) => {
        if (part !== "armL") return;
        body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
        const t = p.clone().sub(a).dot(ab) / length;
        if (t < t0 || t > t1 || p.clone().sub(a).addScaledVector(ab, -t * length).length() > 0.08) return;
        c.add(p);
        n++;
      });
      return c.multiplyScalar(1 / n);
    };
    const sideLean = (d: THREE.Vector3) => THREE.MathUtils.radToDeg(Math.atan2(d.z, -d.y));
    for (const d of DEPTHS) {
      poseShrug(shrug, d);
      const s = shrug.l.s;
      const shoulder = worldPos(s.upperarm);
      const elbow = worldPos(s.lowerarm);
      const wrist = worldPos(s.hand);
      const upper = sideLean(slice(shoulder, elbow, 0.6, 0.75).sub(slice(shoulder, elbow, 0.3, 0.45)));
      const fore = sideLean(slice(elbow, wrist, 0.6, 0.75).sub(slice(elbow, wrist, 0.25, 0.4)));
      expect(Math.abs(upper)).toBeLessThan(MAX_SIDE_LEAN);
      expect(Math.abs(fore)).toBeLessThan(MAX_SIDE_LEAN);
      const m = sideOf("l");
      expect(m["elbow.flexion"]).toBeCloseTo(DUMBBELL_SHRUG.elbowBend + (DUMBBELL_SHRUG.elbowBendTop - DUMBBELL_SHRUG.elbowBend) * (1 - d), 0);
      expect(Math.abs(m["wrist.flexion"])).toBeLessThan(STRAIGHT);
      expect(Math.abs(m["wrist.deviation"])).toBeLessThan(STRAIGHT);
      expect(Math.abs(m["wrist.twist"])).toBeLessThan(STRAIGHT);
    }
  });

  test("the shoulders rise toward the ears at the top", () => {
    const at = (d: number) => {
      poseShrug(shrug, d);
      return worldPos(shrug.l.s.upperarm);
    };
    const down = at(1);
    const top = at(0);
    expect(top.y - down.y).toBeGreaterThan(MIN_RISE);
  });

  // The owner sculpted the trapezius at the top in Blender (2026-11-17): it comes in as the shoulders
  // rise, all of it at the top and none at the bottom, and only on the trunk and neck by the shoulders.
  test("the sculpted trapezius comes in as the shoulders rise, on the neck and shoulders only", () => {
    expect(shrugSculpt(0)).toBe(1);
    expect(shrugSculpt(1)).toBe(0);
    for (let i = 1; i <= 100; i++) expect(shrugSculpt(i / 100)).toBeLessThanOrEqual(shrugSculpt((i - 1) / 100));
    const at = shrug.rig.skin.geometry.getAttribute("aShrug");
    const neck = worldPos(shrug.rig.neck);
    const p = new THREE.Vector3();
    let moved = 0;
    for (let i = 0; i < at.count; i++) {
      if (!at.getX(i) && !at.getY(i) && !at.getZ(i)) continue;
      moved++;
      expect(body.part[i] === "core" || body.part[i] === "none").toBe(true);
      shrug.rig.skin.getVertexPosition(i, p).applyMatrix4(shrug.rig.skin.matrixWorld);
      expect(Math.abs(p.y - neck.y)).toBeLessThan(MAX_SCULPT_FROM_NECK);
    }
    expect(moved).toBeGreaterThan(100);
  });

  test("the sculpt's data holds together: each point once, an offset for each, unit normals", () => {
    const { index, delta, normalIndex = [], normal = [] } = SHRUG_SCULPT;
    const count = shrug.rig.skin.geometry.attributes.position.count;
    expect(new Set(index).size).toBe(index.length);
    expect(delta.length).toBe(index.length * 3);
    expect(Math.max(...index)).toBeLessThan(count);
    expect(normalIndex.length).toBeGreaterThan(0);
    expect(normal.length).toBe(normalIndex.length * 3);
    for (let k = 0; k < normalIndex.length; k++) expect(Math.hypot(normal[k * 3], normal[k * 3 + 1], normal[k * 3 + 2])).toBeCloseTo(1, 2);
  });

  // The web added the shoulders' corrective smoothing on top of the sculpt, which lowered and rounded
  // the shoulders against what the owner made in Blender (2026-11-17): it must make way exactly as the
  // sculpt comes in.
  test("the shoulders' corrective smoothing makes way as the sculpt comes in", () => {
    for (let i = 0; i <= 100; i++) expect(shrugMush(i / 100) + shrugSculpt(i / 100)).toBeCloseTo(1, 6);
    expect(shrugMush(0)).toBe(0);
    expect(shrugMush(1)).toBe(1);
  });

  // Sculpted with mirroring on, so with the sculpt on at the top the two sides mirror each other; a
  // wrong axis on the way from Blender would break it (one was flipped once, 2026-11-17).
  test("with the sculpt on at the top, the left and right mirror each other", () => {
    const g = shrug.rig.skin.geometry;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const kept = new Float32Array(pos.array);
    const a = g.getAttribute("aShrug");
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + a.getX(i), pos.getY(i) + a.getY(i), pos.getZ(i) + a.getZ(i));
    poseShrug(shrug, 0);
    const p = new THREE.Vector3();
    const at = SHRUG_SCULPT.index.map((i) => shrug.rig.skin.getVertexPosition(i, p).applyMatrix4(shrug.rig.skin.matrixWorld).clone());
    let worst = 0;
    for (const q of at) {
      let best = Infinity;
      for (const r of at) best = Math.min(best, Math.hypot(q.x + r.x, q.y - r.y, q.z - r.z));
      worst = Math.max(worst, best);
    }
    (pos.array as Float32Array).set(kept);
    pos.needsUpdate = true;
    expect(worst).toBeLessThan(MAX_MIRROR_MISS);
  });

  test("the body holds the lateral raise's position, and only the shoulders and arms move", () => {
    const { rig } = shrug;
    poseShrug(shrug, 0);
    const bones = [rig.pelvis, rig.spine3, rig.neck, rig.l.foot, rig.r.foot, rig.l.calf, rig.r.calf];
    const still = bones.map(worldPos);
    expect(worldPos(rig.pelvis).z - rig.l.ankle.z).toBeCloseTo(-LATERAL_RAISE.hipsBack, 2);
    expect(Math.abs(worldPos(rig.l.foot).x)).toBeCloseTo(LATERAL_RAISE.stance, 2);
    expect(worldPos(rig.l.foot).y).toBeCloseTo(rig.l.ankle.y, 3);
    const m = measure(anatomy);
    expect(Math.abs(m.trunk["lumbar.flexion"]!)).toBeLessThan(1);
    expect(Math.abs(m.trunk["thoracic.flexion"]!)).toBeLessThan(1);
    let prev = poseShrug(shrug, 0);
    for (let i = 1; i <= 100; i++) {
      const g = poseShrug(shrug, i / 100);
      expect(g.l.grip.distanceTo(prev.l.grip)).toBeLessThan(MAX_STEP);
      expect(Math.abs(g.l.grip.x + g.r.grip.x)).toBeLessThan(0.01);
      prev = g;
      bones.forEach((b, k) => expect(worldPos(b).distanceTo(still[k])).toBeLessThan(0.002));
    }
  });
});
