// The 3D barbell hip thrust must stay a pose a real body can make, frame by frame through the
// whole lift, and follow the owner's two reference photos (2026-11-16): at the top the shoulders,
// hips and knees in one level line with the shins straight up; at the bottom the hips sunk as far
// as the knees bend, the buttocks about 19 cm off the floor, which the owner accepted for now; the
// back one straight line all the way, resting on the bench's edge at one place; the feet planted;
// the bar on its pad, riding with the pelvis. Every joint angle moves one way
// only, and no joint's path doubles back into an S curve, from any view (owner, 2026-11-16).

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { BAR_RADIUS, worldPos } from "./pose";
import { HIP_THRUST, hipThrustAngle, poseHipThrust, readHipThrustRig, type HipThrustRig } from "./pose-hip-thrust";

const ARMPIT_FOLD = 0.045; // skin folding at the shoulder joint; the same allowance as the other lifts
const THROUGH = 0.01;
const FLOOR = 0.01;
const FRAMES = 100; // one frame per 1% of the lift
const MAX_FOOT_SLIDE = 0.002; // metres an ankle may move: planted
const MAX_FOOT_LIFT = 0.012; // metres the soles may float above the floor
const MAX_FINGER_GAP = 0.035; // middle finger bones to the bar's centre
const MAX_WRIST_FLEX = 10; // degrees the wrist may bend toward the palm or back: it stays straight
const MAX_WRIST_SIDE = 20; // degrees it may tip sideways as the forearm angles to the bar, inside its range of 20 toward the thumb and 30 the other way
const MAX_BACK_BEND = 3; // degrees any part of the back may be off one straight line
const MAX_LUMBAR_FLEX = 15; // degrees the lower back may round
const MAX_LUMBAR_ARCH = 10; // degrees it may arch: the pelvis tucked, no arch at the top
const MAX_SHIN_OFF_UP = 5; // degrees the shin may be off straight up at the top: photo 1
const MAX_TOP_OFF_LEVEL = 6; // degrees the back and the thighs may be off level at the top
const MAX_BUTT_GAP = 0.2; // metres the buttocks may be off the floor at the bottom: as low as the knees allow, 19 cm, accepted by the owner (2026-11-16)
const MAX_CONTACT_SLIDE = 0.01; // metres the place on the back that rests on the bench's edge may move: it stays put
const MIN_PLATE_GAP = 0; // the plates never go through the floor
const MAX_BENCH_SINK = 0.02; // metres the back's skin may press into the bench's top
const MAX_BENCH_GAP = 0.02; // metres it may be off it at the edge: it rests on it
const MAX_PAD_SINK = 0.02; // metres the pad may press into the hips
const MAX_PAD_GAP = 0.02; // and float off them: it lies on them
const MAX_ANGLE_REVERSAL = 0.5; // degrees an angle may turn back against its way over the lift
// Known and reported to the owner (2026-11-16): turning about the bench's edge, the hips first come
// a touch toward the feet before swinging down and away, so the shin leans forward 0.53 degrees over
// the first quarter and then back. Avoiding it would need the back tilted about 11 degrees at the
// top instead of level, as in photo 1.
const KNOWN_REVERSAL: Record<string, number> = { "l ankle.dorsiflexion": 0.6, "r ankle.dorsiflexion": 0.6 };
const MAX_S_CURVE = 12; // degrees a path may turn against its main direction, in any view
const MIN_PATH_STEP = 0.004; // metres a joint must move before its direction counts
const MAX_STEP = 0.02; // metres any joint may move per 1% of the lift: no jumps
const MAX_SIDES_OFF = 0.005; // metres the left and right may differ, mirrored

let root: THREE.Object3D;
let h: HipThrustRig;
let anatomy: Anatomy;
let body: Body;

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  h = readHipThrustRig(root);
  body = readBody(root);
});

const bone = (name: string) => worldPos(root.getObjectByName(name)!);
const deg = (r: number) => THREE.MathUtils.radToDeg(r);

function skin(parts: string[]) {
  const p = new THREE.Vector3();
  const out: THREE.Vector3[] = [];
  body.part.forEach((part, i) => {
    if (parts.includes(part)) out.push(body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld).clone());
  });
  return out;
}

const JOINTS = ["pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head", "thigh_l", "calf_l", "foot_l", "ball_l", "upperarm_l", "lowerarm_l", "hand_l", "thigh_r", "calf_r", "foot_r", "upperarm_r", "lowerarm_r", "hand_r"];

describe("barbell hip thrust", () => {
  test("every frame: joints in range, no skin through skin, feet planted, the bar held on its pad, the back on the bench", () => {
    const ankles = h.ankles.map((a) => a.clone());
    const problems: string[] = [];
    for (let f = 0; f <= FRAMES; f++) {
      const d = f / FRAMES;
      const g = poseHipThrust(h, d);
      const at = `at ${f}%`;
      for (const v of violations(measure(anatomy))) problems.push(`${at} ${v.joint} ${v.value.toFixed(0)} (${v.min}..${v.max})`);
      const c = contact(body);
      for (const t of c.through) {
        const allowed = t.pair.endsWith("/core") ? ARMPIT_FOLD : THROUGH;
        if (t.depth > allowed) problems.push(`${at} ${t.pair} ${(t.depth * 100).toFixed(1)} cm through`);
      }
      if (c.floor > FLOOR) problems.push(`${at} skin ${(c.floor * 100).toFixed(1)} cm under the floor`);
      ["foot_l", "foot_r"].forEach((n, i) => {
        if (bone(n).distanceTo(ankles[i]) > MAX_FOOT_SLIDE) problems.push(`${at} ${n} slides`);
      });
      for (const leg of ["legL", "legR"]) {
        const low = Math.min(...skin([leg]).filter((p) => p.z > ankles[0].z - 0.15).map((p) => p.y));
        if (low > MAX_FOOT_LIFT) problems.push(`${at} ${leg} sole ${(low * 100).toFixed(1)} cm off the floor`);
      }
      // The hands on the bar, the wrists straight.
      for (const tag of ["l", "r"] as const) {
        const { grip } = g[tag];
        if (Math.abs(grip.y - g.barbell.y) > 0.005 || Math.abs(grip.z - g.barbell.z) > 0.005) problems.push(`${at} ${tag} hand off the bar`);
        for (const fi of ["index", "middle", "ring", "pinky"]) {
          const w = bone(`${fi}_02_${tag}`).sub(g.barbell);
          const gap = Math.hypot(w.y, w.z);
          if (gap > MAX_FINGER_GAP) problems.push(`${at} ${tag} ${fi} ${(gap * 100).toFixed(1)} cm from the bar`);
        }
        const m = measure(anatomy)[tag] as unknown as Record<string, number>;
        if (Math.abs(m["wrist.flexion"]) > MAX_WRIST_FLEX) problems.push(`${at} ${tag} wrist bent ${m["wrist.flexion"].toFixed(0)}`);
        if (Math.abs(m["wrist.deviation"]) > MAX_WRIST_SIDE) problems.push(`${at} ${tag} wrist sideways ${m["wrist.deviation"].toFixed(0)}`);
      }
      // The plates stay above the floor.
      if (g.barbell.y - HIP_THRUST.plateRadius < MIN_PLATE_GAP) problems.push(`${at} plates through the floor`);
      // The pad lies on the hips: the skin under it neither through it nor away from it.
      const padSkin = skin(["core", "legL", "legR"]).filter((p) => Math.abs(p.x) < HIP_THRUST.padLength / 2 - 0.05);
      let padGap = Infinity;
      for (const p of padSkin) padGap = Math.min(padGap, Math.hypot(p.y - g.barbell.y, p.z - g.barbell.z) - HIP_THRUST.padRadius);
      if (padGap < -MAX_PAD_SINK) problems.push(`${at} pad ${(-padGap * 100).toFixed(1)} cm into the hips`);
      if (padGap > MAX_PAD_GAP) problems.push(`${at} pad ${(padGap * 100).toFixed(1)} cm off the hips`);
      // The back rests on the bench: on its top while the back lies level, on its edge once it
      // tilts up. The skin over the bench comes to it, and doesn't go into it.
      let benchGap = Infinity;
      let sink = 0;
      for (const p of skin(["core"])) {
        if (Math.abs(p.x) > 0.12 || p.z < h.edge.z - HIP_THRUST.benchDepth) continue;
        const over = p.z <= h.edge.z;
        // Distance to the bench: straight down to its top over it, to the edge's corner beyond it.
        const gap = over ? p.y - h.edge.y : Math.hypot(p.y - h.edge.y, p.z - h.edge.z) * Math.sign(p.y - h.edge.y + 1e-9);
        benchGap = Math.min(benchGap, gap);
        if (over) sink = Math.max(sink, h.edge.y - p.y);
      }
      if (sink > MAX_BENCH_SINK) problems.push(`${at} back ${(sink * 100).toFixed(1)} cm into the bench`);
      if (benchGap > MAX_BENCH_GAP) problems.push(`${at} back ${(benchGap * 100).toFixed(1)} cm off the bench`);
      // The back one straight line from the hips to the neck.
      const p = ["spine_01", "spine_02", "spine_03", "neck_01"].map(bone);
      const dirs = p.slice(1).map((q, i) => q.clone().sub(p[i]).normalize());
      for (const dir of dirs) if (deg(dir.angleTo(dirs[0])) > MAX_BACK_BEND) problems.push(`${at} back bends ${deg(dir.angleTo(dirs[0])).toFixed(1)}`);
      const lumbar = measure(anatomy).trunk["lumbar.flexion"] ?? 0;
      if (lumbar > MAX_LUMBAR_FLEX || lumbar < -MAX_LUMBAR_ARCH) problems.push(`${at} lower back ${lumbar.toFixed(0)}`);
    }
    expect(problems.slice(0, 20).join("; ")).toBe("");
  }, 30000); // 101 frames, each skinned in full

  test("at the top the shins stand straight up and the shoulders, hips and knees are one level line (photo 1)", () => {
    poseHipThrust(h, 0);
    for (const side of ["l", "r"]) {
      const shin = bone(`foot_${side}`).sub(bone(`calf_${side}`)).normalize();
      expect(deg(shin.angleTo(new THREE.Vector3(0, -1, 0)))).toBeLessThan(MAX_SHIN_OFF_UP);
      const thigh = bone(`calf_${side}`).sub(bone(`thigh_${side}`));
      expect(Math.abs(deg(Math.atan2(thigh.y, thigh.z)))).toBeLessThan(MAX_TOP_OFF_LEVEL);
    }
    const back = bone("spine_03").sub(bone("pelvis"));
    expect(Math.abs(deg(Math.atan2(back.y, -back.z)))).toBeLessThan(MAX_TOP_OFF_LEVEL);
  });

  test("at the bottom the hips sink as far as the knees bend, toward photo 2", () => {
    const g = poseHipThrust(h, 1);
    const hips = bone("thigh_l").add(bone("thigh_r")).multiplyScalar(0.5);
    const butt = Math.min(...skin(["core", "legL", "legR"]).filter((p) => Math.abs(p.z - hips.z) < 0.2).map((p) => p.y));
    expect(butt).toBeLessThan(MAX_BUTT_GAP);
    expect(butt).toBeGreaterThan(0);
    expect(g.barbell.y - HIP_THRUST.plateRadius).toBeGreaterThanOrEqual(MIN_PLATE_GAP);
    expect(hipThrustAngle(h, 1)).toBeGreaterThan(30);
    expect(h.bottomLimit).toBe("knee");
  });

  test("frame by frame, every joint angle moves one way only", () => {
    const series = new Map<string, number[]>();
    for (let f = 0; f <= FRAMES; f++) {
      poseHipThrust(h, f / FRAMES);
      const m = measure(anatomy) as unknown as Record<string, Record<string, number>>;
      for (const [group, angles] of Object.entries(m)) for (const [k, v] of Object.entries(angles)) {
        const key = `${group} ${k}`;
        if (!series.has(key)) series.set(key, []);
        series.get(key)!.push(v);
      }
    }
    const bad: string[] = [];
    for (const [key, s] of series) {
      const way = Math.sign(s[s.length - 1] - s[0]);
      let back = 0;
      let peak = s[0];
      for (const v of s) {
        // How far it has come back from the furthest it got, against its way.
        if (way >= 0) {
          peak = Math.max(peak, v);
          back = Math.max(back, peak - v);
        } else {
          peak = Math.min(peak, v);
          back = Math.max(back, v - peak);
        }
      }
      if (back > (KNOWN_REVERSAL[key] ?? MAX_ANGLE_REVERSAL)) bad.push(`${key} turns back ${back.toFixed(1)}`);
    }
    expect(bad.join("; ")).toBe("");
  });

  test("frame by frame, no joint's path doubles back into an S curve, from above, the side or the front, and nothing jumps", () => {
    const paths: Record<string, THREE.Vector3[]> = Object.fromEntries(JOINTS.map((j) => [j, []]));
    paths.bar = [];
    for (let f = 0; f <= FRAMES; f++) {
      const g = poseHipThrust(h, f / FRAMES);
      for (const j of JOINTS) paths[j].push(bone(j));
      paths.bar.push(g.barbell.clone());
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
      return deg(Math.min(one, other));
    };
    const bad: string[] = [];
    for (const [k, path] of Object.entries(paths)) {
      for (const [view, pick] of [
        ["above", (p: THREE.Vector3) => [p.x, p.z]],
        ["side", (p: THREE.Vector3) => [p.z, p.y]],
        ["front", (p: THREE.Vector3) => [p.x, p.y]],
      ] as const) {
        const s = against(path.map(pick));
        if (s > MAX_S_CURVE) bad.push(`${k} from the ${view} ${s.toFixed(0)}`);
      }
      for (let i = 1; i < path.length; i++) if (path[i].distanceTo(path[i - 1]) > MAX_STEP) bad.push(`${k} jumps at ${i}%`);
    }
    expect(bad.join("; ")).toBe("");
  });

  test("the back rests on the bench's edge at the same place all the way: it turns, it doesn't slide", () => {
    const along = (d: number) => {
      poseHipThrust(h, d);
      const hips = bone("thigh_l").add(bone("thigh_r")).multiplyScalar(0.5);
      const line = bone("spine_03").sub(bone("spine_01")).normalize();
      return h.edge.clone().sub(hips).dot(line);
    };
    const top = along(0);
    for (let f = 1; f <= FRAMES; f++) expect(Math.abs(along(f / FRAMES) - top)).toBeLessThan(MAX_CONTACT_SLIDE);
  });

  test("the left and right mirror each other", () => {
    for (const d of [0, 0.5, 1]) {
      const g = poseHipThrust(h, d);
      expect(Math.abs(g.l.grip.x + g.r.grip.x)).toBeLessThan(MAX_SIDES_OFF);
      for (const n of ["thigh", "calf", "foot", "upperarm", "lowerarm", "hand"]) {
        const l = bone(`${n}_l`);
        const r = bone(`${n}_r`);
        expect(l.distanceTo(r.setX(-r.x))).toBeLessThan(MAX_SIDES_OFF);
      }
    }
  });

  test("the bar is a bar's thickness", () => {
    expect(BAR_RADIUS).toBeLessThan(HIP_THRUST.padRadius);
  });
});
