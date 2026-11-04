// Turn one UI-PRMD deep squat rep (Vicon Plug-in Gait markers) into a clip
// for our rig, in the same format as extract_clip.py writes.
//
//   node tools/body/prmd_clip.mjs <positions.txt> <mixamo-clip.json> <out.json>
//
// UI-PRMD (University of Idaho Physical Rehabilitation Movement Data) is
// public domain (ODC PDDL 1.0). Vakanski et al., Data 2018, 3(1):2.
//
// The trunk comes from the markers as each segment's rotation since the
// standing frame of the rep. The legs come from the joint centres: thigh and
// shin point along hip-knee-ankle and bend as a hinge about the measured knee
// axis, so the knee can't twist or bend sideways. The feet stay flat, as they
// do in a correct squat (the heel and toe markers move under 5 degrees). The arms in UI-PRMD hold a dowel overhead, so the
// arms come from the Mixamo clip instead, kept where they were relative to the
// chest at the same depth.

import fs from "node:fs";

import * as THREE from "../../apps/web/node_modules/three/build/three.module.js";
import { GLTFLoader } from "../../apps/web/node_modules/three/examples/jsm/loaders/GLTFLoader.js";

const [posFile, mixFile, outFile] = process.argv.slice(2);
if (!outFile) throw new Error("usage: prmd_clip.mjs <positions.txt> <mixamo-clip.json> <out.json>");

const MARKERS =
  "LFHD RFHD LBHD RBHD C7 T10 CLAV STRN RBAK LSHO LUPA LELB LFRM LWRA LWRB LFIN RSHO RUPA RELB RFRM RWRA RWRB RFIN LASI RASI LPSI RPSI LTHI LKNE LTIB LANK LHEE LTOE RTHI RKNE RTIB RANK RHEE RTOE".split(" ");
const KNEE_OFFSET = 55; // mm from the knee marker to the joint centre (half knee width + marker)
const ANKLE_OFFSET = 45;
const FPS = 30;
const SMOOTH = 5; // frames (at 100 Hz) of moving average on the markers
// The subject's lower back rounds at the bottom. Correct form keeps it straight,
// so the pelvis tips forward with the chest: 0 = as recorded, 1 = no bend at all.
const STRAIGHT_BACK = Number(process.env.STRAIGHT_BACK ?? 0.7);

// Vicon: x forward, y left, z up (mm). Ours (glTF): X left, Y up, Z forward (m).
const toOurs = (x, y, z) => new THREE.Vector3(y, z, x);

const rows = fs
  .readFileSync(posFile, "utf8")
  .trim()
  .split(/\r?\n/)
  .map((l) => l.split(",").map(Number));
const smooth = rows.map((_, i) => {
  const lo = Math.max(0, i - (SMOOTH >> 1));
  const hi = Math.min(rows.length - 1, i + (SMOOTH >> 1));
  return rows[0].map((_, c) => {
    let s = 0;
    for (let k = lo; k <= hi; k++) s += rows[k][c];
    return s / (hi - lo + 1);
  });
});
const frames = smooth.map((r) => {
  const m = {};
  MARKERS.forEach((n, i) => (m[n] = toOurs(r[i * 3], r[i * 3 + 1], r[i * 3 + 2])));
  return m;
});

const mid = (a, b) => a.clone().add(b).multiplyScalar(0.5);
const unit = (v) => v.clone().normalize();
const reject = (v, axis) => unit(v.clone().addScaledVector(axis, -v.dot(axis)));
// Rotation whose columns are the segment's left, up and forward axes.
function basis(up, fwdHint) {
  const U = unit(up);
  const F = reject(fwdHint, U);
  const L = U.clone().cross(F);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(L, U, F));
}
function basisLU(left, up) {
  const U = unit(up);
  const L = reject(left, U);
  const F = L.clone().cross(U);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(L, U, F));
}
const smoothstep = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Joint centres and segment orientations for one frame.
function segments(m) {
  const midASI = mid(m.LASI, m.RASI);
  const midPSI = mid(m.LPSI, m.RPSI);
  const left = unit(m.LASI.clone().sub(m.RASI));
  const fwd = reject(midASI.clone().sub(midPSI), left);
  const up = fwd.clone().cross(left);
  const pw = m.LASI.distanceTo(m.RASI);
  const pd = midASI.distanceTo(midPSI);
  // Hip joint centres, Harrington et al. 2007 (mm).
  const hjc = (s) =>
    midASI
      .clone()
      .addScaledVector(fwd, -(0.24 * pd + 9.9))
      .addScaledVector(left, s * (0.33 * pw + 7.3))
      .addScaledVector(up, -(0.3 * pw + 10.9));
  const pelvis = basis(up, fwd);

  const leg = (s) => {
    const P = s === 1 ? "L" : "R";
    const hip = hjc(s);
    const kne = m[`${P}KNE`];
    const ank = m[`${P}ANK`];
    // Knee hinge axis, pointing to the body's left: from the bend when the
    // knee is bent, the pelvis' side-to-side axis when it is near straight.
    const bend = unit(hip.clone().sub(kne)).angleTo(unit(ank.clone().sub(kne)));
    let axis = hip.clone().sub(kne).cross(ank.clone().sub(kne)).normalize();
    if (axis.dot(left) < 0) axis.negate();
    const w = smoothstep(THREE.MathUtils.degToRad(10), THREE.MathUtils.degToRad(35), Math.PI - bend);
    axis = unit(left.clone().multiplyScalar(1 - w).addScaledVector(axis, w));
    const kjc = kne.clone().addScaledVector(axis, -s * KNEE_OFFSET);
    const ajc = ank.clone().addScaledVector(axis, -s * ANKLE_OFFSET);
    return { hip, knee: kjc, ankle: ajc, axis, toes: m[`${P}TOE`].clone().sub(m[`${P}HEE`]) };
  };

  const thUp = mid(m.C7, m.CLAV).sub(mid(m.T10, m.STRN));
  const thFwd = mid(m.CLAV, m.STRN).sub(mid(m.C7, m.T10));
  const hdFwd = mid(m.LFHD, m.RFHD).sub(mid(m.LBHD, m.RBHD));
  const hdLeft = mid(m.LFHD, m.LBHD).sub(mid(m.RFHD, m.RBHD));
  return {
    hips: mid(hjc(1), hjc(-1)),
    pelvis,
    thorax: basis(thUp, thFwd),
    head: basisLU(hdLeft, hdFwd.clone().cross(hdLeft)),
    l: leg(1),
    r: leg(-1),
  };
}

const segs = frames.map(segments);
// The rep starts and ends standing; descend from the highest hips to the lowest.
let top = 0;
let bottom = 0;
segs.forEach((s, i) => {
  if (i < segs.length / 2 && s.hips.y > segs[top].hips.y) top = i;
  if (s.hips.y < segs[bottom].hips.y) bottom = i;
});
const ref = segs[top];
const legLen = (l) => l.hip.distanceTo(l.knee) + l.knee.distanceTo(l.ankle);
const OUR_LEG = 0.83; // m, thigh + shin of body.glb
const scale = OUR_LEG / ((legLen(ref.l) + legLen(ref.r)) / 2);

// Rotation since the standing frame, in world axes.
const since = (q, q0) => q.clone().multiply(q0.clone().invert());

// Our rig at rest: where each leg segment points and which way its front faces.
const glb = fs.readFileSync(new URL("../../apps/web/public/models/body.glb", import.meta.url));
const root = await new Promise((res, rej) =>
  new GLTFLoader().parse(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), "", (g) => res(g.scene), rej),
);
root.updateMatrixWorld(true);
const wpos = (n) => root.getObjectByName(n).getWorldPosition(new THREE.Vector3());
const Z = new THREE.Vector3(0, 0, 1);
const restSeg = (from, to) => {
  const dir = unit(wpos(to).sub(wpos(from)));
  return basis(dir.clone().negate(), reject(Z, dir));
};
const REST = Object.fromEntries(
  ["l", "r"].flatMap((s) => [
    [`thigh_${s}`, restSeg(`thigh_${s}`, `calf_${s}`)],
    [`calf_${s}`, restSeg(`calf_${s}`, `foot_${s}`)],
  ]),
);
// Which way a foot points about the vertical; + = toward the body's left.
const footYaw = (v) => Math.atan2(v.x, v.z);
const REST_YAW = { l: footYaw(wpos("ball_l").sub(wpos("foot_l"))), r: footYaw(wpos("ball_r").sub(wpos("foot_r"))) };
// Turn a leg segment from rest to point along dir, its front square to the knee axis.
const aimSeg = (bone, dir, axis) => {
  const d = unit(dir);
  return basis(d.clone().negate(), d.clone().cross(axis)).multiply(REST[bone].clone().invert());
};

const mix = JSON.parse(fs.readFileSync(mixFile, "utf8"));
const bi = Object.fromEntries(mix.bones.map((b, i) => [b, i]));
let mixBottom = 0;
mix.frames.forEach((f, i) => {
  if (f.hips[1] < mix.frames[mixBottom].hips[1]) mixBottom = i;
});
const mixRot = (frame, bone) => {
  const i = Math.min(Math.floor(frame), mix.frames.length - 1);
  const j = Math.min(i + 1, mix.frames.length - 1);
  const a = new THREE.Quaternion().fromArray(mix.frames[i].rot[bi[bone]]);
  return a.slerp(new THREE.Quaternion().fromArray(mix.frames[j].rot[bi[bone]]), frame - i);
};
const ARM = /^(clavicle|upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)_/;

const out = [];
const step = 100 / FPS;
for (let t = top; t <= bottom + 1e-6; t += step) {
  const i = Math.min(Math.floor(t), bottom);
  const k = Math.min(t - i, 1);
  const a = segs[i];
  const b = segs[Math.min(i + 1, bottom)];
  const q = (get) => get(a).clone().slerp(get(b), k);
  const thorax = since(q((s) => s.thorax), ref.thorax);
  const pelvis = since(q((s) => s.pelvis), ref.pelvis).slerp(thorax, STRAIGHT_BACK);
  const head = since(q((s) => s.head), ref.head);
  const v = (get) => get(a).clone().lerp(get(b), k);
  ref.toes = { l: ref.l.toes, r: ref.r.toes };
  const legQ = (side, part) => {
    const axis = unit(v((s) => s[side].axis));
    if (part === "thigh") return aimSeg(`thigh_${side}`, v((s) => s[side].knee).sub(v((s) => s[side].hip)), axis);
    if (part === "calf") return aimSeg(`calf_${side}`, v((s) => s[side].ankle).sub(v((s) => s[side].knee)), axis);
    // Feet flat, toes turned out as the subject stands.
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), footYaw(ref.toes[side]) - REST_YAW[side]);
  };
  const hips = a.hips.clone().lerp(b.hips, k);
  const depth = (ref.hips.y - hips.y) / (ref.hips.y - segs[bottom].hips.y);
  const mf = THREE.MathUtils.clamp(depth, 0, 1) * mixBottom;

  const rot = mix.bones.map((bone) => {
    if (bone === "pelvis") return pelvis;
    if (bone === "spine_01") return pelvis.clone().slerp(thorax, 1 / 3);
    if (bone === "spine_02") return pelvis.clone().slerp(thorax, 2 / 3);
    if (bone === "spine_03") return thorax;
    if (bone === "neck_01") return thorax.clone().slerp(head, 0.5);
    if (bone === "head") return head;
    const m = bone.match(/^(thigh|calf|foot|ball)_([lr])$/);
    if (m) return legQ(m[2], m[1]);
    if (ARM.test(bone)) {
      // The clip's arm, kept relative to its chest, on our chest.
      return thorax.clone().multiply(mixRot(mf, "spine_03").invert()).multiply(mixRot(mf, bone));
    }
    throw new Error(`no source for bone ${bone}`);
  });
  const d = hips.clone().sub(ref.hips).multiplyScalar(scale); // mm -> our metres
  out.push({
    hips: d.toArray().map((v) => +v.toFixed(4)),
    rot: rot.map((r) => r.toArray().map((v) => +v.toFixed(4))),
  });
}

fs.writeFileSync(outFile, JSON.stringify({ fps: FPS, bones: mix.bones, frames: out }));
console.log(`wrote ${outFile}: ${out.length} frames (rep frames ${top}..${bottom}), leg scale ${(scale * 1000).toFixed(3)}`);
