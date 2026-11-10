// Push-up, from the owner's description. The body holds one straight line from the head to the
// heels, braced, and turns as one piece about the toes: only the angle to the floor changes. The
// hands stay planted a little wider than the shoulders, fingers forward and turned out a little.
// At the top, seen from the side, the arm stands upright under the shoulder, and from the front it
// runs out a little to the hand. The body moves forward over the hands on the way down, so at the
// bottom they are by the nipples; the forearm stands upright seen from the front and leans back
// toward the feet, as the owner agreed. Up is quick, breathing out; down is slow, breathing in (tempo.ts).

import * as THREE from "three";

import { aim, deg, readRig, rotateWorld, setWorldPos, setWorldQuat, worldPos, worldQuat, type Rig } from "./pose";
import { frame, readSide, turnTo, type PressSide } from "./pose-press";

export const PUSH_UP = {
  chestGap: 0.04, // metres between the chest and the floor at the bottom
  handTurn: 10, // degrees the fingers turn out from straight ahead
  handOut: 0.136, // metres each wrist sits outside its shoulder joint: a little wider than the shoulders
  wristHeight: 0.03, // metres from the floor to the middle of the wrist, with the palm flat
  topBend: 6, // degrees the elbow stays bent at the top: straight, not locked
  ankle: 0.1, // metres from the middle to each ankle: about hip width
  toeHeight: 0.015, // metres from the floor to the joint at the base of the toes, with the toes on the floor
  pivotZ: -0.78, // metres along the floor where the toes rest, so the body lies across the middle of the view
  cameraTarget: [0, 0.28, 0] as [number, number, number],
  cameraReach: 0.9, // metres either side of the middle the body reaches, seen from the front or back
};

// In the standing body: the chest's skin that can come nearest the floor.
const CHEST = { from: 1.05, to: 1.4, halfWidth: 0.16 };

const X = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
const FOREARM_SHARE = 0.8; // of the hand's turn against the forearm, how much the forearm rolls to take up
const FINGERS = ["thumb", "index", "middle", "ring", "pinky"] as const;

export type PushUpRig = {
  rig: Rig;
  l: PressSide;
  r: PressSide;
  // Standing, from the joint at the base of the toes: where the shoulders are.
  toShoulder: THREE.Vector3[];
  // Lean of the body from upright, radians, at the top and the bottom.
  top: number;
  bottom: number;
  bottomBend: number; // degrees the elbow is bent at the bottom
  pivot: THREE.Vector3;
  wrists: THREE.Vector3[];
  // Each forearm's direction at the top, from the wrist up to the elbow, and where the elbow ends up.
  topFore: THREE.Vector3[];
  bottomElbows: THREE.Vector3[];
  hands: { long: THREE.Vector3; thumb: THREE.Vector3 }[];
  handRest: { long: THREE.Vector3; thumb: THREE.Vector3 }[];
};

// The body turned forward by `lean` about the toes' joint, which rests at `pivot`: where a
// point fixed in the standing body goes.
function carry(from: THREE.Vector3, lean: number, pivot: THREE.Vector3) {
  return from.clone().applyAxisAngle(X, lean).add(pivot);
}

// Call once with the body at rest.
export function readPushUpRig(root: THREE.Object3D): PushUpRig {
  const rig = readRig(root);
  const l = readSide(root, rig, "l");
  const r = readSide(root, rig, "r");
  const P = PUSH_UP;
  standStraight(rig);
  const ball = worldPos(rig.l.ball).setX(0);
  const toShoulder = [l, r].map((a) => worldPos(a.s.upperarm).sub(ball));
  const pivot = new THREE.Vector3(0, P.toeHeight, P.pivotZ);
  const chest = chestSkin(rig, ball);

  // The bottom: the chest just off the floor.
  const bottom = solve((lean) => lowest(chest, lean, pivot) - P.chestGap, deg(40), deg(89.9));

  // The top: the elbow just short of straight and, seen from the side, the arm upright under the
  // shoulder. The hands stay where that puts them, which is by the nipples at the bottom.
  const reach = Math.sqrt(l.upperLen ** 2 + l.foreLen ** 2 + 2 * l.upperLen * l.foreLen * Math.cos(deg(P.topBend)));
  let top = deg(70);
  let wrists: THREE.Vector3[] = [];
  for (let pass = 0; pass < 20; pass++) {
    wrists = [l, r].map((a, i) => {
      const shoulder = carry(toShoulder[i], top, pivot);
      return new THREE.Vector3(shoulder.x + a.s.sign * P.handOut, P.wristHeight, shoulder.z);
    });
    top = solve((lean) => reach - carry(toShoulder[0], lean, pivot).distanceTo(wrists[0]), deg(30), bottom);
  }

  // The hands as they lie: fingers forward and turned out, the thumb side toward the middle.
  const hands = [l, r].map((a) => {
    const long = new THREE.Vector3(0, 0, 1).applyAxisAngle(UP, a.s.sign * deg(P.handTurn));
    return { long, thumb: new THREE.Vector3(-a.s.sign, 0, 0).applyAxisAngle(UP, a.s.sign * deg(P.handTurn)) };
  });
  const handRest = [l, r].map((a) => {
    const hand = worldPos(a.s.hand);
    const long = worldPos(a.s.middle1).sub(hand).normalize();
    const tag = a.s.sign > 0 ? "l" : "r";
    const thumb = worldPos(root.getObjectByName(`index_01_${tag}`)!).sub(worldPos(root.getObjectByName(`pinky_01_${tag}`)!));
    return { long, thumb: thumb.addScaledVector(long, -thumb.dot(long)).normalize() };
  });
  // At the bottom the elbow goes as near upright over the wrist as the arm allows.
  // At the bottom the elbow stays in line over the wrist seen from the front, the forearm leaning
  // only back toward the feet, as the owner asked: of the places the arm allows with the elbow
  // straight above the wrist's line, the highest.
  const bottomElbows = [l, r].map((a, i) => elbowInLine(carry(toShoulder[i], bottom, pivot), wrists[i], a.upperLen, a.foreLen));
  // At the top the elbow, all but straight, bends toward where it is going.
  const topFore = [l, r].map((a, i) =>
    elbowAt(carry(toShoulder[i], top, pivot), wrists[i], a.upperLen, a.foreLen, bottomElbows[i]).sub(wrists[i]).normalize(),
  );
  const bottomShoulder = carry(toShoulder[0], bottom, pivot);
  const bottomBend = 180 - THREE.MathUtils.radToDeg(bottomShoulder.sub(bottomElbows[0]).angleTo(wrists[0].clone().sub(bottomElbows[0])));
  toRest(rig);
  return { rig, l, r, toShoulder, top, bottom, bottomBend, pivot, wrists, topFore, bottomElbows, hands, handRest };
}

// The chest's skin, standing, from the toes' joint.
function chestSkin(rig: Rig, ball: THREE.Vector3) {
  const { skin } = rig;
  const p = new THREE.Vector3();
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < skin.geometry.attributes.position.count; i++) {
    skin.getVertexPosition(i, p).applyMatrix4(skin.matrixWorld);
    if (p.y > CHEST.from && p.y < CHEST.to && Math.abs(p.x) < CHEST.halfWidth && p.z > 0.05) out.push(p.clone().sub(ball));
  }
  return out;
}

// Height of the lowest of those points with the body turned forward by `lean`.
function lowest(points: THREE.Vector3[], lean: number, pivot: THREE.Vector3) {
  let y = Infinity;
  for (const p of points) y = Math.min(y, carry(p, lean, pivot).y);
  return y;
}

// Root of f between lo and hi, where f changes sign.
function solve(f: (x: number) => number, lo: number, hi: number) {
  let flo = f(lo);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

function toRest(rig: Rig) {
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);
}

// Standing tall with straight legs, the ankles about hip width apart.
function standStraight(rig: Rig) {
  toRest(rig);
  for (const s of [rig.l, rig.r]) {
    const hip = worldPos(s.thigh);
    const ankle = new THREE.Vector3(s.sign * PUSH_UP.ankle, s.ankle.y, worldPos(s.foot).z);
    const dir = ankle.sub(hip).normalize();
    const footQ = worldQuat(s.foot);
    aim(s.thigh, s.calf, hip.clone().addScaledVector(dir, s.thighLen));
    aim(s.calf, s.foot, worldPos(s.calf).addScaledVector(dir, s.shinLen));
    setWorldQuat(s.foot, footQ); // flat, as at rest
  }
}

// Depth 0 = pushed up, 1 = chest down by the hands.
export function posePushUp(push: PushUpRig, depth: number) {
  const { rig } = push;
  standStraight(rig);
  const toesQ = [rig.l, rig.r].map((s) => worldQuat(s.ball));

  // The elbow bends evenly; the whole body, one straight piece, turns forward about the toes'
  // joint as far as that brings the shoulders toward the hands.
  const { pivot } = push;
  const a0 = push.l;
  const bend = PUSH_UP.topBend + (push.bottomBend - PUSH_UP.topBend) * depth;
  const reach = Math.sqrt(a0.upperLen ** 2 + a0.foreLen ** 2 + 2 * a0.upperLen * a0.foreLen * Math.cos(deg(bend)));
  const lean = depth <= 0 ? push.top : depth >= 1 ? push.bottom : solve((x) => carry(push.toShoulder[0], x, pivot).distanceTo(push.wrists[0]) - reach, push.top, push.bottom);
  rotateWorld(rig.pelvis, new THREE.Quaternion().setFromAxisAngle(X, lean));
  const moved = worldPos(rig.l.ball).setX(0);
  setWorldPos(rig.pelvis, worldPos(rig.pelvis).add(pivot.clone().sub(moved)));
  // The toes stay flat on the floor, bent back at their base, pointing ahead as at rest.
  [rig.l, rig.r].forEach((s, i) => setWorldQuat(s.ball, toesQ[i]));

  const hands = [push.l, push.r].map((a, i) => {
    const s = a.s;
    const wrist = push.wrists[i];
    // The upper arm turns about its length so the elbow's hinge lies square to the plane of the arm.
    // The elbow goes where the arm allows nearest the straight line from its place at the top
    // to its place at the bottom.
    const shoulder = worldPos(s.upperarm);
    const top = wrist.clone().addScaledVector(push.topFore[i], a.foreLen);
    const end = push.bottomElbows[i].clone();
    const elbow = elbowAt(shoulder, wrist, a.upperLen, a.foreLen, top.lerp(end, depth));
    const upper = elbow.clone().sub(shoulder).normalize();
    const fore = wrist.clone().sub(elbow).normalize();
    aim(s.upperarm, s.lowerarm, elbow);
    turnTo(s.upperarm, a.hinge, upper, fore.clone().cross(upper).normalize());
    aim(s.lowerarm, s.hand, wrist);
    const { long, thumb } = push.hands[i];
    // The forearm carries the thumb side round to where the hand lies, rolling as far as leaves
    // the wrist least turned about the hand's length; the wrist bends back.
    turnTo(s.lowerarm, a.radial, fore, thumb);
    const handTurn = () => {
      const radial = a.radial.clone().applyQuaternion(worldQuat(s.lowerarm));
      const r = radial.addScaledVector(long, -radial.dot(long)).normalize();
      return Math.atan2(r.clone().cross(thumb).dot(long), r.dot(thumb));
    };
    let rolled = 0;
    for (let k = 0; k < 4; k++) {
      const step = handTurn() * r0(fore, long);
      rolled += step;
      rotateWorld(s.lowerarm, new THREE.Quaternion().setFromAxisAngle(fore, step));
    }
    // The forearm takes only part of it, which keeps it inside its own turn; the wrist the rest.
    rotateWorld(s.lowerarm, new THREE.Quaternion().setFromAxisAngle(fore, -(1 - FOREARM_SHARE) * rolled));
    const rest = push.handRest[i];
    setWorldQuat(s.hand, frame(long, thumb).multiply(frame(rest.long, rest.thumb).invert()).multiply(a.handRest));
    flattenFingers(s);
    return { grip: wrist.clone(), handle: thumb.clone() };
  });
  return { l: hands[0], r: hands[1] };
}

// How a turn of the forearm about its length shows as a turn about the hand's length: the sign of
// their lining up, which sets which way to roll.
const r0 = (fore: THREE.Vector3, long: THREE.Vector3) => Math.sign(fore.dot(long)) || 1;

// Where the elbow goes between the shoulder and the wrist: of all the places the two bones
// allow, the one nearest `toward`.
function elbowAt(shoulder: THREE.Vector3, wrist: THREE.Vector3, upperLen: number, foreLen: number, toward: THREE.Vector3) {
  const run = wrist.clone().sub(shoulder);
  const d = Math.min(run.length(), upperLen + foreLen - 1e-4);
  const n = run.normalize();
  const along = (upperLen ** 2 - foreLen ** 2 + d ** 2) / (2 * d);
  const centre = shoulder.clone().addScaledVector(n, along);
  const off = toward.clone().sub(centre);
  const out = off.addScaledVector(n, -off.dot(n)).normalize();
  return centre.addScaledVector(out, Math.sqrt(Math.max(0, upperLen ** 2 - along ** 2)));
}

// Where the elbow goes between the shoulder and the wrist with it right over the wrist seen from the
// front: the same distance out from the middle, as high as it can be.
function elbowInLine(shoulder: THREE.Vector3, wrist: THREE.Vector3, upperLen: number, foreLen: number) {
  const run = wrist.clone().sub(shoulder);
  const d = run.length();
  const n = run.normalize();
  const along = (upperLen ** 2 - foreLen ** 2 + d ** 2) / (2 * d);
  const centre = shoulder.clone().addScaledVector(n, along);
  const radius = Math.sqrt(Math.max(0, upperLen ** 2 - along ** 2));
  // The circle the elbow can go round, in two directions square to the arm's line.
  const u = UP.clone().addScaledVector(n, -UP.dot(n)).normalize();
  const v = n.clone().cross(u);
  // x(t) = centre.x + radius (u.x cos t + v.x sin t) = wrist.x
  const amp = Math.hypot(u.x, v.x) * radius;
  const phase = Math.atan2(v.x, u.x);
  const c = (wrist.x - centre.x) / amp;
  if (Math.abs(c) > 1) return elbowAt(shoulder, wrist, upperLen, foreLen, wrist.clone().addScaledVector(UP, foreLen));
  const at = (t: number) => centre.clone().addScaledVector(u, radius * Math.cos(t)).addScaledVector(v, radius * Math.sin(t));
  const [p, q] = [phase + Math.acos(c), phase - Math.acos(c)].map(at);
  return p.y >= q.y ? p : q;
}

// Fingers lie straight along the floor, keeping their spread.
function flattenFingers(s: Rig["l"]) {
  const tag = s.sign > 0 ? "l" : "r";
  const root = s.hand;
  for (const f of FINGERS) {
    for (const n of ["01", "02"]) {
      const bone = root.getObjectByName(`${f}_${n}_${tag}`) ?? root.parent!.getObjectByName(`${f}_${n}_${tag}`);
      const next = root.getObjectByName(`${f}_${n === "01" ? "02" : "03"}_${tag}`);
      if (!bone || !next) continue;
      const along = worldPos(next).sub(worldPos(bone));
      along.y = 0;
      aim(bone, next, worldPos(bone).add(along));
    }
  }
}
