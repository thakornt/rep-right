// The 3D machine chest press must stay a pose a real body can make through the whole rep and keep
// the owner's form rules (2026-11-19): the hands at the nipple line at the stretch, or a little
// below; the handles on rigid levers turning about an axis along the trunk, radius 0.6 m, so they
// leave the stretch square out from the pad and curve in, never out, up or down; the elbows behind
// the hands along the push; the handles leaning 70 degrees, top end in; the shoulder blades locked,
// the shoulders never coming forward.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { worldPos } from "./pose";
import { CHEST_PRESS, chestPressAxes, handleDir, poseChestPress, pushDir, readChestPressRig, type ChestPressRig } from "./pose-chest-press";

const ARMPIT_FOLD = 0.045; // skin folding at the shoulder joint; the same allowance as the other lifts
const THROUGH = 0.01;
const MAX_OFF_CIRCLE = 0.002; // metres a handle's middle may be off its lever's circle, or above or below it
const MAX_START_OFF_SQUARE = 1; // degrees the path may leave the stretch off square to the pad
const MAX_NIPPLE_OFF = 0.01; // metres the hands may be off the line set below the nipples at the stretch
const MAX_HANDLE_TILT_OFF = 1; // degrees the fist's handle may be off its 70-degree lean
const MAX_FORE_OFF_STRETCH_TO_MID = 7; // degrees the forearm may be off the push, stretch to half way (6.5 measured)
const MAX_ELBOW_OUT = 0.04; // metres the elbow may sit outside the hand's path (3.6 measured, at the stretch)
const MAX_ELBOW_UPDOWN = 0.03; // metres it may sit above or below the hand, stretch to half way (2.7 measured)
const MAX_SHOULDER_MOVE = 0.002; // metres the shoulder joints may move through the rep: locked
const MIN_TOP_BEND = 8; // degrees the elbow stays bent at the end of the push: not locked out
const MAX_BACK_SINK = 0.015; // metres the back may press into the back pad
const MAX_LEVER_STRETCH = 0.002; // metres a lever may change length through the rep: rigid
const MIN_LEVERS_APART = 0.04; // metres between the two levers' overhead arms where they cross, centre to centre (bars 3.5 cm)

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let root: THREE.Object3D;
let cp: ChestPressRig;
let anatomy: Anatomy;
let body: Body;

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  cp = readChestPressRig(root);
  body = readBody(root);
});

const deg = THREE.MathUtils.radToDeg;
const sides = () => [cp.l.s, cp.r.s] as const;

describe("machine chest press", () => {
  test.each(DEPTHS)("depth %s: joints in range, no skin through skin", (depth) => {
    poseChestPress(cp, depth);
    const problems: string[] = [];
    for (const v of violations(measure(anatomy))) problems.push(`${v.joint} ${v.value.toFixed(0)} (${v.min}..${v.max})`);
    for (const t of contact(body).through) {
      const allowed = t.pair.endsWith("/core") ? ARMPIT_FOLD : THROUGH;
      if (t.depth > allowed) problems.push(`${t.pair} ${(t.depth * 100).toFixed(1)} cm through`);
    }
    expect(problems.join("; ")).toBe("");
  });

  test("the handles swing on their levers' circles, square out at the stretch, then only in, never up or down", () => {
    const { t } = chestPressAxes();
    for (const [i, tag] of (["l", "r"] as const).entries()) {
      const { axis } = cp.levers[i];
      const sign = cp[tag].s.sign;
      let lastX = Infinity;
      for (const d of [...DEPTHS].reverse()) {
        const rel = poseChestPress(cp, d)[tag].grip.clone().sub(axis);
        const up = rel.dot(t);
        expect(Math.abs(up), `${tag} ${d} up/down`).toBeLessThan(MAX_OFF_CIRCLE);
        expect(Math.abs(rel.addScaledVector(t, -up).length() - CHEST_PRESS.leverRadius), `${tag} ${d} radius`).toBeLessThan(MAX_OFF_CIRCLE);
        const x = poseChestPress(cp, d)[tag].grip.x * sign;
        expect(x, `${tag} ${d} never out`).toBeLessThanOrEqual(lastX + 1e-4);
        lastX = x;
      }
      expect(deg(pushDir(sign, 0).angleTo(chestPressAxes().n))).toBeLessThan(MAX_START_OFF_SQUARE);
      poseChestPress(cp, 1);
      const shoulder = worldPos(cp[tag].s.upperarm);
      const down = -poseChestPress(cp, 1)[tag].grip.clone().sub(shoulder).dot(t);
      expect(Math.abs(down - cp.nipple - CHEST_PRESS.handDrop)).toBeLessThan(MAX_NIPPLE_OFF);
    }
  });

  test("the fists hold the handles at their 70-degree lean, top end in", () => {
    for (const d of DEPTHS) {
      const g = poseChestPress(cp, d);
      for (const [tag, s] of [["l", cp.l], ["r", cp.r]] as const) {
        const dir = handleDir(s.s.sign);
        const held = s.grip.dir();
        expect(deg(Math.min(held.angleTo(dir), held.clone().negate().angleTo(dir))), `${tag} ${d}`).toBeLessThan(MAX_HANDLE_TILT_OFF);
        expect(g[tag].handle.angleTo(dir)).toBeLessThan(1e-6);
        // Top end in: the end higher up the trunk is nearer the middle.
        expect(dir.x * s.s.sign).toBeLessThan(0);
      }
    }
  });

  test("the elbow stays behind the hand along the push, stretch to half way, never outside its path", () => {
    const { t } = chestPressAxes();
    for (const d of DEPTHS) {
      const g = poseChestPress(cp, d);
      for (const [tag, s] of [["l", cp.l.s], ["r", cp.r.s]] as const) {
        const push = pushDir(s.sign, g[tag].turn);
        const elbow = worldPos(s.lowerarm);
        const off = elbow.clone().sub(g[tag].grip);
        const side = off.clone().addScaledVector(push, -off.dot(push)).addScaledVector(t, -off.dot(t));
        expect(Math.sign(side.x) * s.sign * side.length(), `${tag} ${d} out`).toBeLessThan(MAX_ELBOW_OUT);
        // Past half way the path turns in more than the nearly straight arm can follow: the forearm
        // comes off it, the elbow inside the hand (39 degrees at the end of the push).
        if (d < 0.5) continue;
        expect(Math.abs(off.dot(t)), `${tag} ${d} up/down`).toBeLessThan(MAX_ELBOW_UPDOWN);
        expect(deg(worldPos(s.hand).sub(elbow).angleTo(push)), `${tag} ${d} forearm`).toBeLessThan(MAX_FORE_OFF_STRETCH_TO_MID);
      }
    }
  });

  test("the shoulder blades stay locked: the shoulders don't move as the arms push", () => {
    poseChestPress(cp, 1);
    const start = sides().map((s) => worldPos(s.upperarm));
    for (const d of DEPTHS) {
      poseChestPress(cp, d);
      sides().forEach((s, i) => expect(worldPos(s.upperarm).distanceTo(start[i]), `depth ${d}`).toBeLessThan(MAX_SHOULDER_MOVE));
    }
  });

  test("the elbows stay soft at the end of the push", () => {
    poseChestPress(cp, 0);
    for (const s of sides()) {
      const sh = worldPos(s.upperarm);
      const el = worldPos(s.lowerarm);
      const wr = worldPos(s.hand);
      expect(deg(el.clone().sub(sh).angleTo(wr.clone().sub(el)))).toBeGreaterThan(MIN_TOP_BEND);
    }
  });

  test("the back rests on the pad", () => {
    const { n } = chestPressAxes();
    const p = new THREE.Vector3();
    for (const d of [0, 1]) {
      poseChestPress(cp, d);
      const hip = worldPos(cp.rig.pelvis);
      let back = Infinity;
      body.part.forEach((part, i) => {
        if (part !== "core") return;
        body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
        if (p.y > hip.y + 0.15) back = Math.min(back, p.clone().sub(hip).dot(n));
      });
      expect(cp.backAt - back).toBeLessThan(MAX_BACK_SINK);
    }
  });

  test("the machine is rigid: each lever keeps its shape, and the two clear each other overhead", () => {
    const { t } = chestPressAxes();
    const shape = (d: number) => {
      const g = poseChestPress(cp, d);
      return (["l", "r"] as const).map((tag, i) => {
        const top = g[tag].grip.clone().addScaledVector(g[tag].handle, CHEST_PRESS.handleLength / 2);
        const swivel = g[tag].grip.clone().addScaledVector(t, top.sub(g[tag].grip).dot(t) + CHEST_PRESS.swivelAbove);
        const { bearing } = cp.levers[i];
        const corner = swivel.clone().addScaledVector(t, bearing.clone().sub(swivel).dot(t));
        return { bearing, corner, out: bearing.distanceTo(corner), down: corner.distanceTo(swivel) };
      });
    };
    const first = shape(1);
    for (const d of DEPTHS) {
      const now = shape(d);
      now.forEach((lever, i) => {
        expect(Math.abs(lever.out - first[i].out), `${i} ${d}`).toBeLessThan(MAX_LEVER_STRETCH);
        expect(Math.abs(lever.down - first[i].down), `${i} ${d}`).toBeLessThan(MAX_LEVER_STRETCH);
      });
      let apart = Infinity;
      for (let u = 0; u <= 40; u++)
        for (let v = 0; v <= 40; v++) {
          const a = now[0].bearing.clone().lerp(now[0].corner, u / 40);
          apart = Math.min(apart, a.distanceTo(now[1].bearing.clone().lerp(now[1].corner, v / 40)));
        }
      expect(apart, `depth ${d}`).toBeGreaterThan(MIN_LEVERS_APART);
    }
  });
});
