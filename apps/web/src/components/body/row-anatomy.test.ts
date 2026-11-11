// The 3D single-arm dumbbell row must stay a pose a real body can make through the whole lift and
// follow the owner's description (2026-11-11): braced on the free hand with the back straight (no
// arch at the lower back: the skin runs from the buttocks to the upper back without dipping) and
// the trunk leaning well forward, turning a little toward the dumbbell at the bottom, the working side's foot stepped straight back and both feet flat,
// and the elbow sweeping back toward the hip rather than the hand pulling straight up.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { worldPos } from "./pose";
import { DUMBBELL } from "./pose-press";
import { DUMBBELL_ROW, poseRow, readRowRig, type RowRig } from "./pose-row";

const ARMPIT_FOLD = 0.055; // skin folding at the shoulder joint, as in the other lifts
const THROUGH = 0.01;
const FLOOR = 0.01;
const MAX_FOOT_LIFT = 0.012; // metres either foot's lowest skin may float above the floor: planted
const MIN_DUMBBELL_GAP = 0.03; // metres from the dumbbell to the trunk and legs
const MAX_FOREARM_TILT = 12; // degrees from straight down, once the elbow has bent past its bottom bend
const MIN_SWEEP_BACK = 0.25; // metres the dumbbell moves back toward the hip from the bottom to the top
const MAX_RISE_PER_BACK = 1; // it moves back at least as far as it rises: an arc to the hip, not straight up

const MAX_BACK_DIP = 0.01; // metres the skin of the lower back may sink below the buttocks and upper back
const MIN_TURN_DROP = 0.02; // metres the working shoulder drops at the bottom, turning toward the dumbbell
const MAX_BACK_BEND = 2; // degrees any part of the back, hips to neck, may lean off the one straight line

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let root: THREE.Object3D;
let row: RowRig;
let anatomy: Anatomy;
let body: Body;

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  row = readRowRig(root);
  body = readBody(root);
});

const bone = (name: string) => worldPos(root.getObjectByName(name)!);

function skin(parts: string[]) {
  const p = new THREE.Vector3();
  const out: THREE.Vector3[] = [];
  body.part.forEach((part, i) => {
    if (parts.includes(part)) out.push(body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld).clone());
  });
  return out;
}

function dumbbellGap({ grip, handle }: { grip: THREE.Vector3; handle: THREE.Vector3 }) {
  let gap = Infinity;
  for (const p of skin(["core", "legL", "legR"])) {
    const w = p.clone().sub(grip);
    const along = w.dot(handle);
    const past = Math.max(0, Math.abs(along) - (DUMBBELL.headAt + DUMBBELL.headWidth / 2));
    const out = Math.max(0, w.addScaledVector(handle, -along).length() - DUMBBELL.headRadius);
    gap = Math.min(gap, Math.hypot(past, out));
  }
  return gap;
}

describe("single-arm dumbbell row", () => {
  test.each(DEPTHS)("depth %s", (depth) => {
    const { work } = poseRow(row, depth);
    const problems: string[] = [];
    for (const v of violations(measure(anatomy))) problems.push(`${v.joint} ${v.value.toFixed(0)} (${v.min}..${v.max})`);
    const c = contact(body);
    for (const t of c.through) {
      const allowed = t.pair.endsWith("/core") ? ARMPIT_FOLD : THROUGH;
      if (t.depth > allowed) problems.push(`${t.pair} ${(t.depth * 100).toFixed(1)} cm through`);
    }
    if (c.floor > FLOOR) problems.push(`skin ${(c.floor * 100).toFixed(1)} cm under the floor`);
    for (const leg of ["legL", "legR"]) {
      const low = Math.min(...skin([leg]).map((p) => p.y));
      if (low > MAX_FOOT_LIFT) problems.push(`${leg} foot ${(low * 100).toFixed(1)} cm off the floor`);
    }
    const gap = dumbbellGap(work);
    if (gap < MIN_DUMBBELL_GAP) problems.push(`dumbbell ${(gap * 100).toFixed(1)} cm from the body`);
    expect(problems.join("; ")).toBe("");
  });

  test("the back is one straight line leaning well forward, and holds still", () => {
    const names = ["pelvis", "spine_01", "spine_02", "spine_03", "neck_01"];
    const first = (poseRow(row, 0), bone("neck_01"));
    for (const d of DEPTHS) {
      poseRow(row, d);
      const p = names.map(bone);
      for (let i = 1; i < p.length - 1; i++) {
        const lean = THREE.MathUtils.radToDeg(p[i + 1].clone().sub(p[i]).angleTo(new THREE.Vector3(0, 1, 0)));
        expect(Math.abs(lean - DUMBBELL_ROW.trunkLean)).toBeLessThan(MAX_BACK_BEND);
      }
      expect(p[4].distanceTo(first)).toBeLessThan(0.001);
    }
  });

  test("the lower back doesn't arch: its skin doesn't dip below the buttocks and upper back", () => {
    poseRow(row, 0.5);
    const along = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(DUMBBELL_ROW.trunkLean));
    const out = along.clone().cross(new THREE.Vector3(1, 0, 0)).normalize(); // out of the back
    const hips = bone("pelvis");
    const length = bone("neck_01").sub(hips).dot(along);
    const bins = new Array<number>(14).fill(-Infinity);
    for (const p of skin(["core", "legL", "legR", "none"])) {
      if (Math.abs(p.x) > 0.03) continue;
      const w = p.clone().sub(hips);
      const k = Math.floor(((w.dot(along) / length + 0.35) / 1.35) * 14);
      if (k >= 0 && k < 14) bins[k] = Math.max(bins[k], w.dot(out));
    }
    const buttocks = Math.max(bins[2], bins[3], bins[4]);
    const lower = Math.min(bins[5], bins[6], bins[7]);
    const upper = Math.max(bins[9], bins[10], bins[11]);
    expect(Math.min(buttocks, upper) - lower).toBeLessThan(MAX_BACK_DIP);
  });

  test("at the bottom the upper back turns toward the dumbbell, the support hand staying put", () => {
    const top = (poseRow(row, 0), [bone("upperarm_l"), bone("hand_r")]);
    const low = (poseRow(row, 1), [bone("upperarm_l"), bone("hand_r")]);
    expect(top[0].y - low[0].y).toBeGreaterThan(MIN_TURN_DROP);
    expect(low[1].distanceTo(top[1])).toBeLessThan(0.002);
  });

  test("the working side's foot is stepped straight back, the other forward", () => {
    poseRow(row, 0.5);
    const back = bone("foot_l");
    const front = bone("foot_r");
    expect(front.z - back.z).toBeGreaterThan(0.5);
    expect(Math.abs(Math.abs(back.x) - Math.abs(front.x))).toBeLessThan(0.03); // straight back, not across
  });

  test("the forearm hangs straight down and the elbow sweeps back toward the hip", () => {
    for (const d of DEPTHS.filter((d) => d < 0.9)) {
      poseRow(row, d);
      const fore = bone("hand_l").sub(bone("lowerarm_l")).normalize();
      expect(THREE.MathUtils.radToDeg(fore.angleTo(new THREE.Vector3(0, -1, 0)))).toBeLessThan(MAX_FOREARM_TILT);
    }
    const low = poseRow(row, 1).work.grip.clone();
    const top = poseRow(row, 0).work.grip.clone();
    const hip = bone("thigh_l");
    const shoulder = bone("upperarm_l");
    const elbow = bone("lowerarm_l");
    expect(low.z - top.z).toBeGreaterThan(MIN_SWEEP_BACK);
    expect((top.y - low.y) / (low.z - top.z)).toBeLessThan(MAX_RISE_PER_BACK);
    // At the top the elbow is back between the shoulder and the hip, up by the back.
    expect(elbow.z).toBeLessThan(shoulder.z - 0.15);
    expect(elbow.z).toBeGreaterThan(hip.z);
    expect(elbow.y).toBeGreaterThan(shoulder.y - 0.08);
  });
});
