// The 3D machine leg extension must stay a pose a real body can make through the whole rep and
// follow the correct-form part of the owner's reference clip (2026-11-12): seated with the back on
// the pad and the buttocks on the seat, the knee lined up with the machine's pivot, the knee bent
// past 90 degrees at the start and nearly straight at the top, only the knee moving.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { worldPos } from "./pose";
import { LEG_EXTENSION, poseLegExtension, readLegExtensionRig, seatTopAt, type LegExtensionRig } from "./pose-leg-extension";

const ARMPIT_FOLD = 0.045; // skin folding at the shoulder joint; the same allowance as the other lifts
const THROUGH = 0.01;
const MIN_KNEE_BOTTOM = 90; // degrees the knee is bent at the start: past 90, as the clip says
const MAX_KNEE_TOP = 20; // degrees it may stay bent at the top: nearly straight
const MAX_KNEE_OFF_PIVOT = 0.005; // metres the knee joint may drift from the machine's pivot
const MAX_STILL = 0.002; // metres the hips, shoulders and hands may move through the rep
const MAX_SEAT_SINK = 0.01; // metres the buttocks may press into the seat
const MAX_BACK_SINK = 0.01; // and the back into the back pad
const MAX_PAD_GAP = 0.01; // metres between the shin pad and the shin
const MAX_PAD_SINK = 0.012; // metres the pad may press into the shin
const MIN_FOOT_CLEAR = 0.03; // metres the feet stay off the floor
const SEAT_THICK = 0.08; // metres, as drawn
const MAX_SEAT_OVERLAP = 0.012; // metres the calf may press into the seat's padded front edge, the knee bent most
const MAX_ARM_OFF_TRUNK = 10; // degrees the arm, shoulder to wrist seen from the side, may be off the trunk's line: the fist slides back on the handle
const MAX_HANDLE_OFF_SEAT = 2; // degrees the handle may be off parallel to the seat
const MAX_HANDLE_FROM_SEAT_TOP = 0.05; // metres the handle's line may be off the seat's top
const MAX_S_CURVE = 12; // degrees a path may turn against its main direction, in any view
const MIN_PATH_STEP = 0.004;

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let root: THREE.Object3D;
let ext: LegExtensionRig;
let anatomy: Anatomy;
let body: Body;

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  ext = readLegExtensionRig(root);
  body = readBody(root);
});

const skin = (parts: string[]) => {
  const p = new THREE.Vector3();
  const out: THREE.Vector3[] = [];
  body.part.forEach((part, i) => {
    if (parts.includes(part)) out.push(body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld).clone());
  });
  return out;
};

const kneeBend = (tag: "l" | "r") => {
  const s = ext.rig[tag];
  const thigh = worldPos(s.calf).sub(worldPos(s.thigh));
  const shin = worldPos(s.foot).sub(worldPos(s.calf));
  return THREE.MathUtils.radToDeg(thigh.angleTo(shin));
};

describe("leg extension", () => {
  test.each(DEPTHS)("depth %s", (depth) => {
    poseLegExtension(ext, depth);
    const problems: string[] = [];
    for (const v of violations(measure(anatomy))) problems.push(`${v.joint} ${v.value.toFixed(0)} (${v.min}..${v.max})`);
    for (const t of contact(body).through) {
      const allowed = t.pair.endsWith("/core") ? ARMPIT_FOLD : THROUGH;
      if (t.depth > allowed) problems.push(`${t.pair} ${(t.depth * 100).toFixed(1)} cm through`);
    }
    expect(problems.join("; ")).toBe("");
  });

  test("the knee bends past 90 degrees at the start and straightens nearly fully, about the pivot", () => {
    for (const tag of ["l", "r"] as const) {
      poseLegExtension(ext, 1);
      expect(kneeBend(tag)).toBeGreaterThan(MIN_KNEE_BOTTOM);
      poseLegExtension(ext, 0);
      expect(kneeBend(tag)).toBeLessThan(MAX_KNEE_TOP);
      for (const d of DEPTHS) {
        poseLegExtension(ext, d);
        const knee = worldPos(ext.rig[tag].calf);
        expect(Math.hypot(knee.y - ext.knee.y, knee.z - ext.knee.z)).toBeLessThan(MAX_KNEE_OFF_PIVOT);
      }
    }
  });

  test("only the knee moves: hips, shoulders and hands stay put", () => {
    poseLegExtension(ext, 0);
    const still = () => [ext.rig.pelvis, ext.l.s.upperarm, ext.r.s.upperarm, ext.l.s.hand, ext.r.s.hand, ext.l.s.thigh].map(worldPos);
    const top = still();
    for (const d of DEPTHS) {
      poseLegExtension(ext, d);
      still().forEach((p, i) => expect(p.distanceTo(top[i])).toBeLessThan(MAX_STILL));
    }
  });

  test("seated on the seat and back on the pad, the feet off the floor", () => {
    const chest = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(1, 0, 0), -THREE.MathUtils.degToRad(LEG_EXTENSION.lean + LEG_EXTENSION.recline));
    for (const d of DEPTHS) {
      poseLegExtension(ext, d);
      const hip = worldPos(ext.rig.pelvis);
      const core = skin(["core"]);
      expect(Math.max(...core.map((p) => seatTopAt(ext, p.z) - p.y))).toBeLessThan(MAX_SEAT_SINK);
      const backs = core.filter((p) => p.y > hip.y + 0.15).map((p) => p.clone().sub(hip).dot(chest));
      expect(ext.backAt - Math.min(...backs)).toBeLessThan(MAX_BACK_SINK);
      expect(Math.min(...skin(["legL", "legR"]).map((p) => p.y))).toBeGreaterThan(MIN_FOOT_CLEAR);
    }
  });

  test("the seat ends at the back of the knee: the calf meets its edge, no more", () => {
    for (const d of DEPTHS) {
      poseLegExtension(ext, d);
      // How far any leg skin reaches into the seat: back from its front edge, or down from its top.
      let into = 0;
      for (const p of skin(["legL", "legR"])) {
        const top = seatTopAt(ext, p.z);
        if (Math.abs(p.x) > 0.2 || p.z > ext.seatFront || p.y > top || p.y < top - SEAT_THICK) continue;
        into = Math.max(into, Math.min(ext.seatFront - p.z, top - p.y));
      }
      expect(into, `depth ${d}`).toBeLessThan(MAX_SEAT_OVERLAP);
    }
  });

  test("the arms hang along the trunk, bent a little, and the handles run parallel to the seat by it", () => {
    poseLegExtension(ext, 0.5);
    const lean = THREE.MathUtils.degToRad(LEG_EXTENSION.lean + LEG_EXTENSION.recline);
    const trunkDown = new THREE.Vector3(0, -Math.cos(lean), Math.sin(lean));
    const seat = new THREE.Vector3(0, Math.sin(THREE.MathUtils.degToRad(LEG_EXTENSION.recline)), Math.cos(THREE.MathUtils.degToRad(LEG_EXTENSION.recline)));
    for (const [tag, h] of [["l", ext.handles[0]], ["r", ext.handles[1]]] as const) {
      const s = ext[tag].s;
      const arm = worldPos(s.hand).sub(worldPos(s.upperarm)).setX(0).normalize();
      expect(THREE.MathUtils.radToDeg(arm.angleTo(trunkDown))).toBeLessThan(MAX_ARM_OFF_TRUNK);
      if (!LEG_EXTENSION.holdHandles) continue; // the handles are hidden for now
      expect(THREE.MathUtils.radToDeg(Math.min(h.dir.angleTo(seat), h.dir.clone().negate().angleTo(seat)))).toBeLessThan(MAX_HANDLE_OFF_SEAT);
      expect(Math.abs(h.at.y - seatTopAt(ext, h.at.z))).toBeLessThan(MAX_HANDLE_FROM_SEAT_TOP);
    }
  });

  test("the shin pad rests on the front of the shins, low down", () => {
    for (const d of DEPTHS) {
      const { pad } = poseLegExtension(ext, d);
      // Distance from the pad's axis (across the body) to the shins' skin, less its radius.
      const legs = skin(["legL", "legR"]).filter((p) => Math.abs(p.x) < LEG_EXTENSION.padWidth / 2);
      const gaps = legs.map((p) => Math.hypot(p.y - pad.y, p.z - pad.z) - LEG_EXTENSION.padRadius);
      const nearest = Math.min(...gaps);
      expect(nearest).toBeLessThan(MAX_PAD_GAP);
      expect(-nearest).toBeLessThan(MAX_PAD_SINK);
    }
  });

  test("no joint's path doubles back into an S curve", () => {
    const joints = { ankle: ext.l.s.foot, toes: ext.rig.l.ball };
    const paths = Object.fromEntries(Object.keys(joints).map((k) => [k, [] as THREE.Vector3[]]));
    for (let i = 0; i <= 100; i++) {
      poseLegExtension(ext, i / 100);
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
      expect(against(path.map((p) => [p.z, p.y])), `${k} from the side`).toBeLessThan(MAX_S_CURVE);
    }
  });
});
