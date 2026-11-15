// The 3D upright row must stay a pose a real body can make through the whole lift, with a bar or a
// dumbbell in each hand, and follow the owner's reference clips (2026-11-15): a wider grip and a
// slight lean forward. The elbows lift and the forearms and hands follow: the hands go straight up
// close in front of the body from the thighs to the nipples, never turning back on themselves, not
// swung out like a front raise; the elbows rise out to the sides and a little forward to shoulder
// height, not above. With dumbbells the palms turn in a little and the hands are only a little
// wider than the shoulders; all else is the same.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { BAR_RADIUS, trunkLean, worldPos } from "./pose";
import { DUMBBELL } from "./pose-press";
import { poseUprightRow, readUprightRowRig, UPRIGHT_ROW, type UprightRowRig, type UprightRowTool } from "./pose-upright-row";

const ARMPIT_FOLD = 0.045; // skin folding at the shoulder joint; the same allowance as the other lifts
const THROUGH = 0.01;
const FLOOR = 0.01;
const MAX_FINGER_GAP = 0.035; // middle finger bones to the bar or handle's centre
const MAX_WRIST_BEND = 45; // degrees the wrist may bend forward or back, inside its range of 80 and 70
const MAX_WRIST_SIDE = 28; // degrees it may bend sideways: with the hands near shoulder width and the elbows out, the wrist bends toward the little finger up to 27 at the top, inside its range of 30
const MIN_WEIGHT_GAP = 0.01; // metres the bar or dumbbells stay off the thighs, belly and chest
const MAX_ELBOW_HANG = 18; // degrees the elbows stay bent with the arms hanging: straight, not locked
const MAX_ELBOW_ABOVE_SHOULDER = 0.03; // metres the elbows may rise above the shoulders at the top: level, not above, as in the owner's clip
const MIN_ELBOW_HEIGHT = -0.05; // and no lower than this below them
const MAX_TOP_BELOW_SHOULDER = 0.11; // metres the weight's middle may sit below the shoulder joints at the top: at the nipples, 7.5 cm below them on this body
// Metres the weight may be in front of the shoulder joints at the top: drawn up near the body, not
// swung out (owner, 2026-11-15). The chest is 13 cm in front of them: both come to about 29 cm.
const MAX_HAND_AHEAD = { barbell: 0.32, dumbbell: 0.32 };
// Degrees the upper arm's way at the top is forward of straight out to the side, seen from above: out
// to the sides and a little forward, the elbows a little in front of the body (owner, 2026-11-15).
const ELBOW_PLANE = { barbell: [0, 20], dumbbell: [0, 20] };
const MAX_DUMBBELL_TILT = 3; // degrees a dumbbell's handle may tilt from level: the wrist keeps it level
const MAX_TURN_BACK = 0.002; // metres the weight may move back down per 1% of the way up, and below which a move out or in doesn't count
const MIN_GRIP_PAST_SHOULDER = 0.04; // metres each hand sits outside the shoulder with a bar: a little wider, near shoulder width (owner, 2026-11-15)
const MIN_DUMBBELL_PAST_SHOULDER = 0.02; // metres each dumbbell sits outside the shoulder: a little wider
const MAX_DUMBBELL_PAST_SHOULDER = 0.08;
// Metres the hands may change their width through the lift: a bar holds them; dumbbells drift out
// up to 3.3 cm partway up, where the forearms still hang and turning them in moves the hand little,
// and the wrist turning the dumbbell level moves it a little more.
const MAX_WIDTH_WANDER = { barbell: 0.01, dumbbell: 0.035 };
const MIN_LIFT = 0.3; // metres the weight travels up: from the tops of the thighs to the lower chest is about 32-34 cm on this body
const MIN_LEAN = 6; // degrees the trunk leans forward: slightly
const MAX_LEAN = 18;
const MIN_TURN_IN = 5; // degrees the dumbbells turn the palms in, from square across: near square, as the owner asked (2026-11-15)
const MAX_TURN_IN = 30; // and no more: a little
const MAX_STEP = 0.015; // metres a hand or elbow may move per 1% of the lift: no jumps

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);
const TOOLS: UprightRowTool[] = ["barbell", "dumbbell"];

const rigs = {} as Record<UprightRowTool, { root: THREE.Object3D; row: UprightRowRig; anatomy: Anatomy; body: Body }>;

beforeAll(async () => {
  // A body each: a rig reads its rest from the body as it finds it.
  for (const tool of TOOLS) {
    const root = await loadBody();
    rigs[tool] = { root, row: readUprightRowRig(root, tool), anatomy: readAnatomy(root), body: readBody(root) };
  }
});

// Lowest distance from the weight to the skin of the trunk and legs.
function weightGap(body: Body, tool: UprightRowTool, g: ReturnType<typeof poseUprightRow>) {
  const p = new THREE.Vector3();
  let gap = Infinity;
  body.part.forEach((part, i) => {
    if (part !== "core" && part !== "legL" && part !== "legR") return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    if (tool === "barbell") {
      const bar = g.barbell!;
      if (Math.abs(p.x) > UPRIGHT_ROW.barLength / 2) return;
      gap = Math.min(gap, Math.hypot(p.y - bar.y, p.z - bar.z) - BAR_RADIUS);
    } else {
      for (const h of [g.l, g.r]) {
        const w = p.clone().sub(h.grip);
        const along = w.dot(h.handle);
        const past = Math.max(0, Math.abs(along) - (DUMBBELL.headAt + DUMBBELL.headWidth / 2));
        const out = Math.max(0, w.addScaledVector(h.handle, -along).length() - DUMBBELL.headRadius);
        gap = Math.min(gap, Math.hypot(past, out));
      }
    }
  });
  return gap;
}

describe.each(TOOLS)("upright row, %s", (tool) => {
  test.each(DEPTHS)("depth %s", (depth) => {
    const { root, row, anatomy, body } = rigs[tool];
    const g = poseUprightRow(row, depth);
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
      for (const f of ["index", "middle", "ring", "pinky"]) {
        const w = worldPos(root.getObjectByName(`${f}_02_${tag}`)!).sub(grip);
        const gap = w.addScaledVector(handle, -w.dot(handle)).length();
        if (gap > MAX_FINGER_GAP) problems.push(`${tag} ${f} ${(gap * 100).toFixed(1)} cm from the ${tool === "barbell" ? "bar" : "handle"}`);
      }
      const m = measure(anatomy)[tag] as unknown as Record<string, number>;
      if (Math.abs(m["wrist.flexion"]) > MAX_WRIST_BEND) problems.push(`${tag} wrist bent ${m["wrist.flexion"].toFixed(0)}`);
      if (Math.abs(m["wrist.deviation"]) > MAX_WRIST_SIDE) problems.push(`${tag} wrist sideways ${m["wrist.deviation"].toFixed(0)}`);
    }
    const gap = weightGap(body, tool, g);
    if (gap < MIN_WEIGHT_GAP) problems.push(`weight ${(gap * 100).toFixed(1)} cm from the body`);

    expect(problems.join("; ")).toBe("");
  });

  test("the weight comes straight up near the body, from the thighs to the nipples", () => {
    const { row } = rigs[tool];
    const bottom = poseUprightRow(row, 1).l.grip.clone();
    expect((measure(rigs[tool].anatomy).l as unknown as Record<string, number>)["elbow.flexion"]).toBeLessThan(MAX_ELBOW_HANG);
    const top = poseUprightRow(row, 0).l.grip.clone();
    const shoulder = worldPos(row.l.s.upperarm);
    expect(shoulder.y - top.y).toBeLessThan(MAX_TOP_BELOW_SHOULDER);
    expect(top.z - shoulder.z).toBeLessThan(MAX_HAND_AHEAD[tool]);
    expect(top.y - bottom.y).toBeGreaterThan(MIN_LIFT);
    // Up all the way; seen from the side it goes out from the thighs and, with a bar, comes back in
    // toward the chest near the top: it changes its way out or in once at most, no S curve.
    let last = bottom;
    let way = 0;
    let turns = 0;
    for (let i = 99; i >= 0; i--) {
      const p = poseUprightRow(row, i / 100).l.grip.clone();
      expect(p.y - last.y).toBeGreaterThan(-MAX_TURN_BACK);
      const dz = p.z - last.z;
      if (Math.abs(dz) > MAX_TURN_BACK) {
        if (way !== 0 && Math.sign(dz) !== way) turns++;
        way = Math.sign(dz);
      }
      expect(Math.abs(p.x - bottom.x)).toBeLessThan(MAX_WIDTH_WANDER[tool]);
      last = p;
    }
    expect(turns).toBeLessThanOrEqual(1);
  });

  test("the grip is wider than the shoulders; at the top the elbows are level with them, out to the sides", () => {
    const { row } = rigs[tool];
    for (const d of DEPTHS) {
      const g = poseUprightRow(row, d);
      const past = g.l.grip.x - worldPos(row.l.s.upperarm).x;
      if (tool === "barbell") expect(past).toBeGreaterThan(MIN_GRIP_PAST_SHOULDER);
      else {
        expect(past).toBeGreaterThan(MIN_DUMBBELL_PAST_SHOULDER);
        expect(past).toBeLessThan(MAX_DUMBBELL_PAST_SHOULDER);
      }
    }
    poseUprightRow(row, 0);
    const shoulder = worldPos(row.l.s.upperarm);
    const elbow = worldPos(row.l.s.lowerarm);
    expect(elbow.y - shoulder.y).toBeLessThan(MAX_ELBOW_ABOVE_SHOULDER);
    expect(elbow.y - shoulder.y).toBeGreaterThan(MIN_ELBOW_HEIGHT);
    const d = elbow.clone().sub(shoulder);
    const plane = THREE.MathUtils.radToDeg(Math.atan2(d.z, d.x));
    expect(plane).toBeGreaterThan(ELBOW_PLANE[tool][0]);
    expect(plane).toBeLessThan(ELBOW_PLANE[tool][1]);
  });

  test("the trunk leans slightly forward and holds still; nothing jumps", () => {
    const { row } = rigs[tool];
    let last: THREE.Vector3[] | null = null;
    for (let i = 0; i <= 100; i++) {
      const g = poseUprightRow(row, i / 100);
      const lean = THREE.MathUtils.radToDeg(trunkLean(row.rig));
      expect(lean).toBeGreaterThan(MIN_LEAN);
      expect(lean).toBeLessThan(MAX_LEAN);
      const now = [g.l.grip, g.r.grip, worldPos(row.l.s.lowerarm), worldPos(row.r.s.lowerarm)];
      if (last) now.forEach((p, k) => expect(p.distanceTo(last![k])).toBeLessThan(MAX_STEP));
      last = now;
      expect(g.l.grip.x + g.r.grip.x).toBeCloseTo(0, 2);
    }
  });
});

test("the dumbbells stay level all the way", () => {
  for (const d of DEPTHS) {
    const g = poseUprightRow(rigs.dumbbell.row, d);
    for (const h of [g.l.handle, g.r.handle]) expect(THREE.MathUtils.radToDeg(Math.asin(Math.abs(h.y)))).toBeLessThan(MAX_DUMBBELL_TILT);
  }
});

test("with dumbbells the palms turn in a little toward the body; the bar lies straight across", () => {
  const turn = (tool: UprightRowTool) => {
    const g = poseUprightRow(rigs[tool].row, 1); // with the arms hanging, the hands straight down
    const h = g.l.handle.clone().setY(0).normalize();
    return THREE.MathUtils.radToDeg(Math.asin(Math.min(1, Math.abs(h.z))));
  };
  expect(turn("barbell")).toBeLessThan(3);
  expect(turn("dumbbell")).toBeGreaterThan(MIN_TURN_IN);
  expect(turn("dumbbell")).toBeLessThan(MAX_TURN_IN);
});
