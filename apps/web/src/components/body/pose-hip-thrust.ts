// Barbell hip thrust, from the owner's two reference photos (2026-11-16). The upper back rests on
// the long edge of a flat bench, just below the shoulder blades; the feet stay planted, hip width;
// the bar lies on a pad across the hip creases, the hands holding it just outside the hips. At the
// top (photo 1) the shoulders, hips and knees are one level line and the shins stand straight up.
// The back turns about the bench's edge at the same place on it all the way, and the bar rides with
// the pelvis (owner, 2026-11-16). The hips sink until the knees are bent as far as they go on the
// way: past that the hips would swing away from the feet and the knees straighten again. For this
// body that leaves the buttocks about 19 cm off the floor, short of photo 2, which the owner
// accepted for now (2026-11-16): reaching the floor takes the back rolling on the bench at the end.
// The back is one straight line from the hips to the neck all the way, the pelvis tucked a little so
// the lower back doesn't arch, the chin a little toward the chest.
// Driven up quickly breathing out, lowered slowly breathing in.
//
// Depth 0 = hips up, 1 = lowered, as with the other lifts.

import * as THREE from "three";

import { readBody } from "./contact";
import { deg, keepHinge, qx, readRig, rotateWorld, setWorldPos, setWorldQuat, twoBoneIK, worldPos, worldQuat, type Rig } from "./pose";
import { holdArm } from "./pose-curl";
import { readSide, type PressSide } from "./pose-press";

export const HIP_THRUST = {
  topAngle: 2, // degrees the shoulders sit above the hips at the top: a level line, from photo 1
  buttGap: 0.03, // metres the buttocks stay off the floor at the bottom, if the knees let them get that low
  kneeMargin: 1, // degrees short of where the knees bend most that the back stops: right at it, the ankles turn back a touch
  contactAlong: 0.4, // metres from the hip joints up the back to where it meets the bench's edge at the top: below the shoulder blades
  benchPress: 0.005, // metres the back presses into the bench's padding at the top
  plateGap: 0.005, // metres the plates stay off the floor at the bottom: they may come down nearly onto it
  // The back turns about the bench's edge at one place on it all the way (owner, 2026-11-16).
  pelvisTuck: 15, // degrees the pelvis tips back from the back's line, so the lower back doesn't arch
  neckTuck: 25, // degrees the chin comes toward the chest from the back's line, the eyes forward
  stance: 0.13, // metres from the middle to each ankle: hip width
  feetIn: 0, // metres the feet sit in toward the bench from under the knees at the top: the shins then lean a little, and the hips can sink further before the knees would straighten again
  toeOut: 10, // degrees
  gripHalf: 0.3, // metres from the middle to each hand: just outside the hips
  elbowOutTop: 10, // degrees the elbow points out from straight down toward the bench's side of the trunk, at the top
  elbowOutBottom: 36, // and at the bottom, opening steadily: so the upper arm swings one way only as the arm folds
  elbowEven: 0.5, // share of the elbow's opening that goes at an even pace, the rest eased with the hips: enough that it keeps opening to the end // and at the bottom, opening steadily: so the upper arm swings one way only as the arm folds
  padRadius: 0.045, // metres: the bar's foam pad
  padSquash: 0.02, // metres the thighs may press into the pad at the bottom, folding up into it as a foam pad lets them
  padPress: 0.008, // metres the pad and the skin press into each other under the bar's weight
  padLength: 0.4, // metres
  barLength: 1.8, // metres
  plateRadius: 0.225, // metres: a full-size plate, as in photo 2
  plateWidth: 0.06, // metres
  plateAt: 0.66, // metres from the middle to each plate's middle
  benchDepth: 0.3, // metres from the bench's edge to its far side
  benchLength: 1.1, // metres across the lifter
  cameraTarget: [0, 0.45, -0.12] as [number, number, number], // the middle of the body, from the head over the bench to the feet
  cameraReach: 0.95,
};

export type HipThrustRig = {
  rig: Rig;
  l: PressSide;
  r: PressSide;
  backThick: number; // metres from the back's line to its skin where the bench meets it
  frontThick: number; // metres from the hip joints' line to the skin in front of them, where the bar lies
  edge: THREE.Vector3; // the bench's edge, under the upper back: its top's height, its front's place
  ankles: THREE.Vector3[]; // where the ankles stay, left and right
  bottomAngle: number; // degrees the back points up from level at the bottom
  bottomLimit: "knee" | "buttocks" | "plates"; // what set the bottom
  under: number[]; // the vertices the bar's pad can rest on: the front of the hips and thighs under it
  barOut: number; // metres the bar sits out from the hip joints' line toward the chest: fixed, it rides with the pelvis
  barUp: number; // and metres along the back toward the head from the hip joints: on the front of the pelvis, above where the thighs fold up
};

// Where these vertices of the skin are with the bones as posed now, in the world, without
// updating the whole skeleton: the plain skinning blend, as the GPU does it.
const tmpV = new THREE.Vector3();
const tmpA = new THREE.Vector3();
const tmpM = new THREE.Matrix4();
function skinPoints(mesh: THREE.SkinnedMesh, ids: number[]) {
  const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
  const { bones, boneInverses } = mesh.skeleton;
  const mats = new Map<number, THREE.Matrix4>();
  const boneMat = (b: number) => {
    let m = mats.get(b);
    if (!m) {
      m = new THREE.Matrix4().multiplyMatrices(bones[b].matrixWorld, boneInverses[b]);
      mats.set(b, m);
    }
    return m;
  };
  tmpM.multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse);
  return ids.map((i) => {
    tmpV.fromBufferAttribute(position, i).applyMatrix4(mesh.bindMatrix);
    const out = new THREE.Vector3();
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k);
      if (!w) continue;
      out.addScaledVector(tmpA.copy(tmpV).applyMatrix4(boneMat(skinIndex.getComponent(i, k))), w);
    }
    return out.applyMatrix4(tmpM);
  });
}

// How far out from the hip joints' line, toward the chest, the bar must sit for its pad to rest on
// the skin under it, pressing in a little, with the body as posed now and the back at `angle`.
function barNeed(h: HipThrustRig, hips: THREE.Vector3, angle: number, up = 0) {
  const P = HIP_THRUST;
  const out = chestDir(angle);
  const across = backDir(angle);
  const r = P.padRadius - P.padPress;
  let need = r;
  for (const q of skinPoints(h.rig.skin, h.under)) {
    const w = q.sub(hips).addScaledVector(across, -up);
    const side = w.dot(across);
    if (Math.abs(side) >= r) continue;
    need = Math.max(need, w.dot(out) + Math.sqrt(r ** 2 - side ** 2));
  }
  return need;
}

const X = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
const FRONT = new THREE.Vector3(0, 0, 1);

const hipMid = (rig: Rig) => worldPos(rig.l.thigh).add(worldPos(rig.r.thigh)).multiplyScalar(0.5);
// The back's line from the hips toward the head, with the shoulders `angle` degrees above the hips,
// and the chest's side of it.
const backDir = (angle: number) => new THREE.Vector3(0, Math.sin(deg(angle)), -Math.cos(deg(angle)));
const chestDir = (angle: number) => new THREE.Vector3(0, Math.cos(deg(angle)), Math.sin(deg(angle)));

function toRest(rig: Rig) {
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);
}

// Where the middle of the hip joints is with the back at this angle: the back turns about the
// bench's edge, resting on it at the same place all the way.
export const hipsAt = (h: HipThrustRig, angle: number) =>
  h.edge.clone().addScaledVector(chestDir(angle), h.backThick).addScaledVector(backDir(angle), -HIP_THRUST.contactAlong);

// Call once with the body at rest.
export function readHipThrustRig(root: THREE.Object3D): HipThrustRig {
  const rig = readRig(root);
  const P = HIP_THRUST;
  toRest(rig);
  const hipsRest = hipMid(rig);

  // How thick the body is at the bench and at the bar, measured standing.
  const body = readBody(root);
  rig.skin.skeleton.update();
  const p = new THREE.Vector3();
  let back = Infinity;
  let front = -Infinity;
  body.part.forEach((part, i) => {
    if (part !== "core" && part !== "legL" && part !== "legR") return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    if (Math.abs(p.x) < 0.05 && Math.abs(p.y - (hipsRest.y + P.contactAlong)) < 0.03) back = Math.min(back, p.z);
    if (Math.abs(p.x) < 0.1 && Math.abs(p.y - hipsRest.y) < 0.03) front = Math.max(front, p.z);
  });

  // At the top the thighs lie level and the shins stand straight up, so the hip joints are a shin
  // above the ankles; the bench's edge goes where the back meets it then.
  const s = rig.l;
  const ankleY = s.ankle.y;
  const hipsTop = new THREE.Vector3(0, ankleY + s.shinLen, 0);
  const out: HipThrustRig = {
    rig,
    l: readSide(root, rig, "l"),
    r: readSide(root, rig, "r"),
    backThick: hipsRest.z - back,
    frontThick: front - hipsRest.z,
    edge: new THREE.Vector3(),
    ankles: [],
    bottomAngle: P.topAngle,
    bottomLimit: "knee",
    under: [],
    barOut: 0,
    barUp: 0,
  };
  // The skin the pad can rest on, picked standing: the front of the hips, the lower belly above
  // them and the tops of the thighs below, across the pad's width.
  body.part.forEach((part, i) => {
    if (part !== "core" && part !== "legL" && part !== "legR") return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    if (Math.abs(p.x) < P.padLength / 2 && p.y > hipsRest.y - 0.45 && p.y < hipsRest.y + 0.25 && p.z > hipsRest.z - 0.05) out.under.push(i);
  });
  const placeEdge = () =>
    out.edge
      .copy(hipsTop)
      .addScaledVector(backDir(P.topAngle), P.contactAlong)
      .addScaledVector(chestDir(P.topAngle), -out.backThick);
  placeEdge();
  out.ankles = [rig.l, rig.r].map((side) => {
    const thighX = worldPos(side.thigh).x;
    return new THREE.Vector3(side.sign * P.stance, ankleY, Math.sqrt(side.thighLen ** 2 - (side.sign * P.stance - thighX) ** 2) - P.feetIn);
  });

  const skinNear = (keep: (q: THREE.Vector3) => boolean) => {
    rig.skin.skeleton.update();
    const found: THREE.Vector3[] = [];
    body.part.forEach((part, i) => {
      if (part !== "core" && part !== "legL" && part !== "legR") return;
      body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
      if (keep(p)) found.push(p.clone());
    });
    return found;
  };

  // The back, measured standing, is not quite as thick lying straightened: set the bench's top
  // where the back's skin actually is at the top, pressing in a little.
  poseAt(out, P.topAngle);
  const onBench = skinNear((q) => part2D(q, out));
  const lowestOnBench = Math.min(...onBench.map((q) => q.y));
  out.backThick += out.edge.y - lowestOnBench - P.benchPress;
  placeEdge();

  // The bottom: the back turns down until the knees are bent as far as they go on the way, past
  // which the hips would swing away from the feet and the knees straighten again; or sooner, if the
  // buttocks or the plates come near the floor first.
  const ankle = out.ankles[0].clone().setX(0);
  let kneeAngle = P.topAngle;
  let nearest = Infinity;
  for (let a = P.topAngle; a <= 80; a += 0.05) {
    const dist = hipsAt(out, a).distanceTo(ankle);
    if (dist < nearest) {
      nearest = dist;
      kneeAngle = a;
    }
  }
  out.bottomAngle = kneeAngle - P.kneeMargin;
  out.bottomLimit = "knee";

  // The bar rides with the pelvis, at one place on it: the lowest, nearest the crease, where the
  // thighs folding up press into the pad no more than it squashes; it sits just on the skin at the
  // top.
  const needs: number[][] = [];
  const UPS = Array.from({ length: 31 }, (_, i) => -0.05 + i * 0.01);
  for (let k = 0; k <= 40; k++) {
    const a = P.topAngle + ((out.bottomAngle - P.topAngle) * k) / 40;
    poseAt(out, a);
    needs.push(UPS.map((up) => barNeed(out, hipsAt(out, a), a, up)));
  }
  const pick = UPS.findIndex((_, j) => {
    const col = needs.map((row) => row[j]);
    return Math.max(...col) - col[0] <= P.padSquash;
  });
  const j = pick < 0 ? UPS.length - 1 : pick;
  out.barUp = UPS[j];
  out.barOut = needs[0][j];

  const clear = (a: number) => {
    poseAt(out, a);
    const butt = Math.min(...skinNear((q) => Math.abs(q.z - hipsAt(out, a).z) < 0.2).map((q) => q.y));
    const barY = hipsAt(out, a).addScaledVector(chestDir(a), out.barOut).addScaledVector(backDir(a), out.barUp).y;
    return { butt: butt > P.buttGap, plates: barY - P.plateRadius > P.plateGap };
  };
  const end = clear(out.bottomAngle);
  if (!end.butt || !end.plates) {
    let lo = P.topAngle;
    let hi = out.bottomAngle;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const c = clear(mid);
      if (c.butt && c.plates) lo = mid;
      else hi = mid;
    }
    out.bottomLimit = clear(hi).butt ? "plates" : "buttocks";
    out.bottomAngle = lo;
  }
  toRest(rig);
  root.updateMatrixWorld(true);
  return out;
}

// Skin over the bench's top, by the middle of the back.
const part2D = (q: THREE.Vector3, h: HipThrustRig) => Math.abs(q.x) < 0.12 && q.z < h.edge.z && q.z > h.edge.z - HIP_THRUST.benchDepth;

// The body with the back at this angle, resting on the bench's edge; the legs reach the planted feet.
function poseAt(h: HipThrustRig, angle: number) {
  const P = HIP_THRUST;
  const { rig } = h;
  toRest(rig);
  const hips = hipsAt(h, angle);

  // The body turns onto its back, then the back straightens into one line, the pelvis tucked.
  rotateWorld(rig.pelvis, qx(deg(angle - 90)));
  const line = backDir(angle);
  const chain = [rig.pelvis, rig.spine1, rig.spine2, rig.spine3, rig.neck];
  for (let i = 0; i < chain.length - 1; i++) {
    const now = worldPos(chain[i + 1]).sub(worldPos(chain[i])).normalize();
    const want = i === 0 ? line.clone().applyAxisAngle(X, -deg(P.pelvisTuck)) : line;
    rotateWorld(chain[i], new THREE.Quaternion().setFromUnitVectors(now, want));
  }
  rotateWorld(rig.neck, qx(deg(P.neckTuck)));
  // Then the whole body moves so the hip joints are there.
  setWorldPos(rig.pelvis, worldPos(rig.pelvis).add(hips.clone().sub(hipMid(rig))));

  // The legs reach the planted feet, the knees pointing up over the toes.
  [rig.l, rig.r].forEach((s, i) => {
    const ankle = h.ankles[i];
    const aimKnee = UP.clone().add(FRONT.clone().applyAxisAngle(UP, s.sign * deg(P.toeOut)));
    twoBoneIK(s.thigh, s.calf, s.foot, s.thighLen, s.shinLen, ankle, aimKnee);
    keepHinge(s, ankle);
    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, s.sign * deg(P.toeOut));
    const side = i === 0 ? h.l : h.r;
    setWorldQuat(s.foot, yaw.clone().multiply(side.footRest));
    setWorldQuat(s.ball, yaw.clone().multiply(side.toesRest));
  });
  return hips;
}

// How far the elbow has opened at a depth, 0 to 1: half in step with the hips, half gathering pace
// toward the bottom, so it keeps opening to the very end and the shoulder never turns back.
const elbowOpening = (d: number) => 0.5 * THREE.MathUtils.smoothstep(d, 0, 1) + 0.5 * d * d;

// The back's angle at a depth, eased at each end.
export const hipThrustAngle = (h: HipThrustRig, depth: number) =>
  HIP_THRUST.topAngle + (h.bottomAngle - HIP_THRUST.topAngle) * THREE.MathUtils.smoothstep(depth, 0, 1);

export function poseHipThrust(h: HipThrustRig, depth: number) {
  const P = HIP_THRUST;
  const angle = hipThrustAngle(h, depth);
  const hips = poseAt(h, angle);
  const chest = chestDir(angle);

  // The bar on its pad across the hip creases, riding with the pelvis all the way.
  const barbell = hips.clone().addScaledVector(chest, h.barOut).addScaledVector(backDir(angle), h.barUp);

  // Each hand holds the bar from above just outside the hips, the elbow down by the side: reach
  // for it, then nudge the wrist until the closed fist is on the bar, and turn the hand a touch so
  // the bar runs through the fist along its hole.
  const d = depth;
  const elbowOut = P.elbowOutTop + (P.elbowOutBottom - P.elbowOutTop) * elbowOpening(d);
  const hands = [h.l, h.r].map((a) => {
    const s = a.s;
    const want = barbell.clone().setX(s.sign * P.gripHalf);
    const wrist = want.clone();
    for (let k = 0; k < 6; k++) {
      // Where the elbow points, about the line from the shoulder to the wrist: down toward the
      // bench's side of the trunk and out by a turn that opens steadily through the lift.
      const axis = wrist.clone().sub(worldPos(s.upperarm)).normalize();
      const down = chest.clone().negate().addScaledVector(axis, chest.dot(axis)).normalize();
      const outward = new THREE.Vector3(s.sign, 0, 0).addScaledVector(axis, -s.sign * axis.x).addScaledVector(down, -down.x * s.sign).normalize();
      const pole = down.multiplyScalar(Math.cos(deg(elbowOut))).addScaledVector(outward, Math.sin(deg(elbowOut)));
      twoBoneIK(s.upperarm, s.lowerarm, s.hand, a.upperLen, a.foreLen, wrist, pole);
      const shoulder = worldPos(s.upperarm);
      const elbow = worldPos(s.lowerarm);
      const upper = elbow.clone().sub(shoulder).normalize();
      const fore = worldPos(s.hand).sub(elbow).normalize();
      const hinge = fore.clone().cross(upper).normalize();
      const bend = THREE.MathUtils.radToDeg(upper.angleTo(fore));
      holdArm(a, upper, hinge, upper, bend, new THREE.Vector3(-s.sign, 0, 0));
      const hole = a.grip.dir();
      if (hole.x * s.sign > 0) hole.negate();
      setWorldQuat(s.hand, new THREE.Quaternion().setFromUnitVectors(hole.normalize(), new THREE.Vector3(-s.sign, 0, 0)).multiply(worldQuat(s.hand)));
      a.grip.close();
      wrist.add(want.clone().sub(a.grip.held()));
    }
    return { grip: a.grip.held(), handle: a.grip.dir() };
  });
  return { l: hands[0], r: hands[1], barbell, angle };
}
