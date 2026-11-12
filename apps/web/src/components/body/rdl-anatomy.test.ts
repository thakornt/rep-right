// The 3D dumbbell Romanian deadlift must stay a pose a real body can make through the whole lift
// and follow the owner's reference clip (2026-11-11): a hinge at the hips with soft knees, the back
// one straight line with no rounding and no arch, the arms hanging straight so the dumbbells slide
// down close to the legs to around mid-shin, and the lifter balanced over the feet.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { worldPos } from "./pose";
import { DUMBBELL } from "./pose-press";
import { DUMBBELL_RDL, poseRdl, readRdlRig, type RdlRig } from "./pose-rdl";

const ARMPIT_FOLD = 0.055;
const THROUGH = 0.01;
const FLOOR = 0.01;
const MAX_FOOT_LIFT = 0.012; // metres the soles may float above the floor: planted
const MAX_DUMBBELL_GAP_BOTTOM = 0.04; // metres from the dumbbell to the legs at the bottom: close
const MIN_KNEE = 3; // degrees: knees never locked
const MAX_KNEE = 45; // degrees: bent more as the owner asked (2026-11-12), still a hinge rather than a squat
const MAX_BACK_DIP = 0.01; // metres the lower back's skin may sink below the buttocks and upper back: no arch
const MAX_LUMBAR_FLEX = 15; // degrees the lower back may round from standing to lose its arch; the row was accepted at 23
const MAX_BACK_BEND = 3; // degrees any part of the back may lean off one straight line at the bottom
const MAX_DUMBBELL_HEIGHT_BOTTOM = 0.45; // metres: the dumbbells reach below the knee, toward mid-shin

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let root: THREE.Object3D;
let rdl: RdlRig;
let anatomy: Anatomy;
let body: Body;

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  rdl = readRdlRig(root);
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

function gapToLegs({ grip, handle }: { grip: THREE.Vector3; handle: THREE.Vector3 }) {
  let gap = Infinity;
  for (const p of skin(["legL", "legR"])) {
    const w = p.clone().sub(grip);
    const along = w.dot(handle);
    const past = Math.max(0, Math.abs(along) - (DUMBBELL.headAt + DUMBBELL.headWidth / 2));
    const out = Math.max(0, w.addScaledVector(handle, -along).length() - DUMBBELL.headRadius);
    gap = Math.min(gap, Math.hypot(past, out));
  }
  return gap;
}

describe("dumbbell Romanian deadlift", () => {
  test.each(DEPTHS)("depth %s", (depth) => {
    poseRdl(rdl, depth);
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
    const m = measure(anatomy) as unknown as Record<string, Record<string, number>>;
    for (const s of ["l", "r"]) {
      const k = m[s]["knee.flexion"];
      if (k < MIN_KNEE || k > MAX_KNEE) problems.push(`${s} knee ${k.toFixed(0)}`);
    }
    if (m.trunk["lumbar.flexion"] > MAX_LUMBAR_FLEX) problems.push(`lower back rounds ${m.trunk["lumbar.flexion"].toFixed(0)}`);
    expect(problems.join("; ")).toBe("");
  });

  test("at the bottom the back is one straight line, and its skin doesn't arch", () => {
    poseRdl(rdl, 1);
    const p = ["spine_01", "spine_02", "spine_03", "neck_01"].map(bone);
    const dirs = p.slice(1).map((q, i) => q.clone().sub(p[i]).normalize());
    for (const d of dirs) expect(THREE.MathUtils.radToDeg(d.angleTo(dirs[0]))).toBeLessThan(MAX_BACK_BEND);
    const along = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(DUMBBELL_RDL.leanBottom));
    const out = along.clone().cross(new THREE.Vector3(1, 0, 0)).normalize();
    const hips = bone("pelvis");
    const length = bone("neck_01").sub(hips).dot(along);
    const bins = new Array<number>(14).fill(-Infinity);
    for (const q of skin(["core", "legL", "legR", "none"])) {
      if (Math.abs(q.x) > 0.03) continue;
      const w = q.clone().sub(hips);
      const k = Math.floor(((w.dot(along) / length + 0.35) / 1.35) * 14);
      if (k >= 0 && k < 14) bins[k] = Math.max(bins[k], w.dot(out));
    }
    const buttocks = Math.max(bins[2], bins[3], bins[4]);
    const lower = Math.min(bins[5], bins[6], bins[7]);
    const upper = Math.max(bins[9], bins[10], bins[11]);
    expect(Math.min(buttocks, upper) - lower).toBeLessThan(MAX_BACK_DIP);
  });

  test("the dumbbells hang straight and slide down close to the legs, below the knees", () => {
    const top = poseRdl(rdl, 0).l.grip.clone();
    const g = poseRdl(rdl, 1);
    expect(gapToLegs(g.l)).toBeLessThan(MAX_DUMBBELL_GAP_BOTTOM);
    expect(g.l.grip.y).toBeLessThan(MAX_DUMBBELL_HEIGHT_BOTTOM);
    expect(g.l.grip.y).toBeLessThan(bone("calf_l").y);
    expect(top.y - g.l.grip.y).toBeGreaterThan(0.3);
    const fore = bone("hand_l").sub(bone("lowerarm_l")).normalize();
    expect(THREE.MathUtils.radToDeg(fore.angleTo(new THREE.Vector3(0, -1, 0)))).toBeLessThan(20); // the elbows point out, so the forearms come in a little (owner, 2026-11-12)
  });

  test("the hips go back while the feet stay put", () => {
    const top = (poseRdl(rdl, 0), [bone("pelvis"), bone("foot_l")]);
    const low = (poseRdl(rdl, 1), [bone("pelvis"), bone("foot_l")]);
    expect(top[0].z - low[0].z).toBeGreaterThan(0.12);
    expect(low[1].distanceTo(top[1])).toBeLessThan(0.002);
  });
});
