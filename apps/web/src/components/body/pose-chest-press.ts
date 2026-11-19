// Seated machine chest press, as the owner set it out (2026-11-19) with their reference clip. Seated
// with the back and head on a pad reclined a little, the feet flat. The seat is set so that, at the
// stretch, the hands are level with the nipples, or a little below to bring the elbows down and
// the hands in. Each handle hangs on a rigid lever that turns about an axis along the trunk, so it
// leaves the stretch square out from the back pad and curves in toward the other as the arms push:
// never out, never up or down. The hands and elbows stay on that path all the way. The shoulder blades stay locked back and down; the shoulders
// never roll forward at the end of the push. The handles lean 70 degrees from level, their top
// ends in, so the palms face nearly in toward each other (owner, 2026-11-19).
//
// Depth 0 = the arms pressed out (the work done), 1 = the stretch, as with the other lifts.

import * as THREE from "three";

import { readBody } from "./contact";
import { aim, deg, keepHinge, qx, readRig, rotateWorld, setWorldPos, setWorldQuat, twoBoneIK, worldPos, type Rig } from "./pose";
import { frame, readSide, turnTo, type PressSide } from "./pose-press";

export const CHEST_PRESS = {
  padAngle: 75, // degrees the back pad stands up from the floor: reclined a little, as in the clip
  hipHeight: 0.5, // metres of the hip joints above the floor, sitting
  kneeAhead: 0.42, // metres the ankles sit in front of the hips
  stance: 0.22, // metres from the middle to each ankle
  toeOut: 12, // degrees
  chestUp: 6, // degrees the upper back lifts the chest
  neck: 4, // degrees the head tips forward from the pad's line, the eyes level
  shoulderBack: 16, // degrees the collarbones are pulled back: the shoulder blades squeezed together, locked the whole lift (owner, 2026-11-19)
  shoulderDown: 6, // degrees the collarbones are pulled down, away from the ears, locked the whole lift
  handleTilt: 70, // degrees each handle leans from level, its top end in (owner, 2026-11-19)
  // How wide the handles' line is: "forearm" puts the elbow straight behind the hand at the
  // stretch, the forearm square to the pad; "flare" opens the upper arm elbowFlare from the trunk.
  fit: "forearm" as "forearm" | "flare",
  elbowFlare: 45, // degrees the upper arm opens from the trunk, seen square to the back pad, at the stretch
  stretchAhead: 0.02, // metres the handle's middle sits in front of the chest's front at the stretch
  topBend: 12, // degrees the elbow stays bent at the end of the push: soft, not locked
  handleLength: 0.14, // metres
  handleRadius: 0.014, // metres: the fist is shaped for this (grip.ts)
  handDrop: 0.05, // metres the hands sit below the nipple line at the stretch: the elbows lower, the hands narrower (owner, 2026-11-19)
  // Each handle hangs on a rigid lever that turns about an axis along the trunk, leverRadius from
  // the handle's middle and level with it at the stretch, toward the middle, so the handle leaves
  // the stretch square out from the pad and curves in (owner, 2026-11-19: radius 0.6 m).
  leverRadius: 0.6,
  leverUp: 0.55, // metres along the trunk above the handles where the left lever's bearing sits, clear over the head
  leverStagger: 0.06, // and the right one this much higher, so the levers cross without meeting
  pecBulge: 0.012, // metres the inner chest swells at the end of the push, squeezed (owner, 2026-11-19)
  // and the metres the nipple sinks then: the arms forward fold the chest's skin into a point
  // there, with or without the swell (owner, 2026-11-19: no pointed nipple)
  nippleFlat: 0.009,
  pecFrom: 0.85, // share of the way from the end of the push back to the stretch where it starts to swell
  swivelAbove: 0.03, // metres above the handle's top end where its swivel sits on the lever, over its middle
  // Each handle turns on its own bearing at the lever's end and keeps facing the same way as the
  // lever turns: fixed to the lever it would turn up to 35 degrees in with it, more than the wrist
  // can follow at the end of the push (bent 32 degrees toward the thumb, the limit 20).
  cameraTarget: [0, 0.92, 0.12] as [number, number, number],
  cameraReach: 0.62,
};

export type ChestPressLever = {
  axis: THREE.Vector3; // a point on the lever's axis, level with the handle: it turns about t through here
  bearing: THREE.Vector3; // where the axis meets the frame, above the head
};

export type ChestPressRig = {
  rig: Rig;
  l: PressSide;
  r: PressSide;
  thumbSign: [number, number]; // which way along the fist's handle the thumb points, per side
  // Fitted to this body at read time.
  nipple: number; // metres along the trunk from the shoulder joints down to the nipple line
  chestFront: number; // metres out of the chest, from the shoulder joints to the chest's front at the nipple line
  side: number; // metres from the middle to each handle's line
  stretch: number; // metres out of the chest, from the shoulder joints to the handle's middle, at the stretch
  swing: number; // radians the levers turn from the stretch to the end of the push
  backAt: number; // metres behind the hip joints, along the trunk's front, where the back pad's face is
  seatY: number; // the seat's top
  levers: [ChestPressLever, ChestPressLever]; // per side
  shoulderY: number; // the shoulder joints' height, sitting
};

const UP = new THREE.Vector3(0, 1, 0);

// The trunk's axes on the pad: x to the body's left, t along the trunk toward the head, n out of
// the chest, square to the pad. The handles move along n.
export function chestPressAxes() {
  const q = qx(-deg(90 - CHEST_PRESS.padAngle));
  return {
    x: new THREE.Vector3(1, 0, 0),
    t: new THREE.Vector3(0, 1, 0).applyQuaternion(q),
    n: new THREE.Vector3(0, 0, 1).applyQuaternion(q),
  };
}

// Out from a lever's axis to its handle, with the lever turned `turn` radians from the stretch:
// straight out to the side at the stretch, turning forward.
export function leverOut(sign: number, turn: number) {
  const { x, n } = chestPressAxes();
  return x.clone().multiplyScalar(sign * Math.cos(turn)).addScaledVector(n, Math.sin(turn));
}

// The way a handle moves, the lever turned `turn`: square out from the pad at the stretch.
export function pushDir(sign: number, turn: number) {
  const { x, n } = chestPressAxes();
  return x.clone().multiplyScalar(-sign * Math.sin(turn)).addScaledVector(n, Math.cos(turn));
}

// The direction a handle runs, top end first: up along the trunk, leaning in. It swivels on the
// lever, so it faces this way at every turn.
export function handleDir(sign: number) {
  const { x, t } = chestPressAxes();
  const lean = deg(CHEST_PRESS.handleTilt);
  return t.clone().multiplyScalar(Math.sin(lean)).addScaledVector(x, -sign * Math.cos(lean)).normalize();
}

// Everything but the arms: seated back on the pad, chest up, the shoulder blades locked, feet flat.
function poseBody(press: Pick<ChestPressRig, "rig" | "l" | "r">) {
  const P = CHEST_PRESS;
  const { rig } = press;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);
  setWorldPos(rig.pelvis, new THREE.Vector3(0, P.hipHeight, 0));
  rotateWorld(rig.pelvis, qx(-deg(90 - P.padAngle)));
  rotateWorld(rig.spine3, qx(-deg(P.chestUp)));
  const { t, n } = chestPressAxes();
  // The same at every depth: the shoulders never come forward off the pad.
  for (const a of [press.l, press.r]) {
    const clavicle = a.s.upperarm.parent!;
    rotateWorld(clavicle, new THREE.Quaternion().setFromAxisAngle(t, a.s.sign * deg(P.shoulderBack)));
    rotateWorld(clavicle, new THREE.Quaternion().setFromAxisAngle(n, -a.s.sign * deg(P.shoulderDown)));
  }
  rotateWorld(rig.neck, qx(deg(P.neck)));
  for (const a of [press.l, press.r]) {
    const s = a.s;
    const hip = worldPos(s.thigh);
    const ankle = new THREE.Vector3(s.sign * P.stance, s.ankle.y, hip.z + P.kneeAhead);
    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, s.sign * deg(P.toeOut));
    twoBoneIK(s.thigh, s.calf, s.foot, s.thighLen, s.shinLen, ankle, new THREE.Vector3(0, 0, 1).applyQuaternion(yaw));
    keepHinge(s, ankle);
    setWorldQuat(s.foot, yaw.clone().multiply(a.footRest));
    setWorldQuat(s.ball, yaw.clone().multiply(a.toesRest));
  }
}

// One arm with the handle's middle at a point. The elbow takes the spot closest to straight behind
// the hand along the push, so the forearm runs along the push wherever the arm's length lets it;
// the wrist stays straight, the fist on the handle, and the forearm turns the hand to the handle.
function holdHandle(a: PressSide, thumbSign: number, handle: THREE.Vector3, dir: THREE.Vector3, push: THREE.Vector3) {
  const s = a.s;
  const shoulder = worldPos(s.upperarm);
  const across = dir.clone().multiplyScalar(thumbSign);
  let wrist = handle.clone().addScaledVector(push, -a.foreLen * 0.3);
  for (let k = 0; k < 12; k++) {
    const behind = wrist.clone().addScaledVector(push, -a.foreLen);
    twoBoneIK(s.upperarm, s.lowerarm, s.hand, a.upperLen, a.foreLen, wrist, behind.sub(shoulder));
    const elbow = worldPos(s.lowerarm);
    const upper = elbow.clone().sub(shoulder).normalize();
    const fore = wrist.clone().sub(elbow).normalize();
    turnTo(s.upperarm, a.hinge, upper, fore.clone().cross(upper).normalize());
    aim(s.lowerarm, s.hand, wrist);
    const foreNow = worldPos(s.hand).sub(worldPos(s.lowerarm)).normalize();
    turnTo(s.lowerarm, a.radial, foreNow, across);
    setWorldQuat(s.hand, frame(foreNow, across).multiply(a.handFrame.clone().invert()).multiply(a.handRest));
    a.grip.close();
    // Where the forearm isn't square to the pad, the fist across it isn't along the handle: the
    // wrist turns it the rest of the way, as little as it takes.
    const now = a.grip.dir().dot(dir) > 0 ? a.grip.dir() : a.grip.dir().negate();
    rotateWorld(s.hand, new THREE.Quaternion().setFromUnitVectors(now, dir));
    // Move the wrist by however far the handle's middle is from where it should be.
    wrist = wrist.add(handle.clone().sub(a.grip.held()));
  }
  return { grip: a.grip.held(), handle: dir };
}

// A point on a lever's axis, level with its handle; the body must be posed (the axis sits by the
// shoulders, which don't move through the rep).
function leverAxis(press: ChestPressRig, a: PressSide) {
  const { x, t, n } = chestPressAxes();
  const shoulder = worldPos(a.s.upperarm);
  return shoulder
    .addScaledVector(t, -(press.nipple + CHEST_PRESS.handDrop))
    .addScaledVector(n, press.stretch)
    .addScaledVector(x, a.s.sign * (press.side - CHEST_PRESS.leverRadius) - shoulder.x);
}

export function poseChestPressArms(press: ChestPressRig, depth: number) {
  poseBody(press);
  const turn = press.swing * (1 - depth);
  const out = ([press.l, press.r] as const).map((a, i) => {
    const handle = leverAxis(press, a).addScaledVector(leverOut(a.s.sign, turn), CHEST_PRESS.leverRadius);
    return { ...holdHandle(a, press.thumbSign[i], handle, handleDir(a.s.sign), pushDir(a.s.sign, turn)), turn };
  });
  return { l: out[0], r: out[1] };
}

export const poseChestPress = poseChestPressArms;

// Call once with the body at rest: fits the handles' line, the stretch and the end of the push to
// this body, and the pad and the seat to where it sits.
export function readChestPressRig(root: THREE.Object3D): ChestPressRig {
  const P = CHEST_PRESS;
  const rig = readRig(root);
  const l = readSide(root, rig, "l");
  const r = readSide(root, rig, "r");
  const thumbOf = (a: PressSide, tag: "l" | "r") => {
    const thumb = worldPos(root.getObjectByName(`index_01_${tag}`)!).sub(worldPos(root.getObjectByName(`pinky_01_${tag}`)!));
    return Math.sign(a.grip.dir().dot(thumb)) || 1;
  };
  const press: ChestPressRig = {
    rig,
    l,
    r,
    thumbSign: [thumbOf(l, "l"), thumbOf(r, "r")],
    nipple: 0,
    chestFront: 0,
    side: 0,
    stretch: 0,
    swing: 0,
    backAt: 0,
    seatY: 0,
    levers: [
      { axis: new THREE.Vector3(), bearing: new THREE.Vector3() },
      { axis: new THREE.Vector3(), bearing: new THREE.Vector3() },
    ],
    shoulderY: 0,
  };
  const body = readBody(root);
  poseBody(press);
  const { t, n } = chestPressAxes();
  const shoulder = worldPos(l.s.upperarm);
  // The nipple: the chest's furthest point out of the chest, a hand's width from the middle.
  const p = new THREE.Vector3();
  let best = -Infinity;
  let bestAt = new THREE.Vector3();
  let backAt = Infinity;
  let seatY = Infinity;
  const pelvis = worldPos(rig.pelvis);
  body.part.forEach((part, i) => {
    if (part !== "core") return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    backAt = Math.min(backAt, p.clone().sub(pelvis).dot(n));
    seatY = Math.min(seatY, p.y);
    const rel = p.clone().sub(shoulder);
    if (p.x < 0.06 || p.x > 0.14 || rel.dot(t) > -0.06 || rel.dot(t) < -0.3) return;
    const out = rel.dot(n);
    if (out > best) {
      best = out;
      bestAt = p.clone();
    }
  });
  press.nipple = -bestAt.clone().sub(shoulder).dot(t);
  press.chestFront = best;
  press.backAt = backAt;
  press.seatY = seatY;
  press.stretch = best + P.stretchAhead;

  // The handles' line: at the stretch the elbow is straight behind the hand, the forearm square
  // to the pad: narrower and the elbow sits outside the hand, wider and inside it.
  const elbowOutAt = (side: number) => {
    press.side = side;
    press.swing = 0;
    poseChestPressArms(press, 1);
    if (P.fit === "flare") {
      const el = worldPos(l.s.lowerarm).sub(worldPos(l.s.upperarm));
      return Math.atan2(el.x * l.s.sign, -el.dot(t)) * (180 / Math.PI) < P.elbowFlare ? 1 : -1;
    }
    return (worldPos(l.s.lowerarm).x - worldPos(l.s.hand).x) * l.s.sign;
  };
  let lo = 0.1;
  let hi = 0.5;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (elbowOutAt(mid) > 0) lo = mid;
    else hi = mid;
  }
  press.side = (lo + hi) / 2;

  // The end of the push: as far out as leaves the elbow topBend short of straight.
  const bendAt = (swing: number) => {
    press.swing = swing;
    poseChestPressArms(press, 0);
    const sh = worldPos(l.s.upperarm);
    const el = worldPos(l.s.lowerarm);
    const wr = worldPos(l.s.hand);
    return el.clone().sub(sh).angleTo(wr.clone().sub(el)) * (180 / Math.PI);
  };
  lo = 0;
  hi = Math.PI / 2;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (bendAt(mid) > P.topBend) lo = mid;
    else hi = mid;
  }
  press.swing = (lo + hi) / 2;

  // Each lever's bearing sits on its axis above the head.
  poseBody(press);
  for (const [i, a] of ([l, r] as const).entries()) {
    const axis = leverAxis(press, a);
    press.levers[i] = { axis, bearing: axis.clone().addScaledVector(t, P.leverUp + i * P.leverStagger) };
  }
  press.shoulderY = worldPos(l.s.upperarm).y;

  for (const [b, rr] of rig.rest) {
    b.quaternion.copy(rr.q);
    b.position.copy(rr.p);
  }
  root.updateMatrixWorld(true);
  readPecs(rig, body.part);
  return press;
}

// How much each vertex swells as the chest squeezes, up to 1: the inner and middle chest, most
// halfway between the breastbone and the nipple, from the collarbone to just under the nipple.
// None at the edges or on the sides, and the nipple sinks instead (nippleFlat), a share of the
// swell below zero (owner, 2026-11-19). Kept on the mesh as aPecs (left, right); the body must be
// at rest.
function readPecs(rig: Rig, parts: ReturnType<typeof readBody>["part"]) {
  const { skin } = rig;
  const { position, normal } = skin.geometry.attributes;
  const top = worldPos(rig.l.upperarm).y + 0.01;
  const p = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const toWorld = new THREE.Matrix3().getNormalMatrix(skin.matrixWorld);
  // The nipple line, as at read time: the chest's most forward point a hand's width out.
  let nipple = new THREE.Vector3(0, 0, -Infinity);
  for (let i = 0; i < position.count; i++) {
    if (parts[i] !== "core") continue;
    skin.getVertexPosition(i, p).applyMatrix4(skin.matrixWorld);
    if (p.x > 0.06 && p.x < 0.14 && p.y < top - 0.06 && p.y > top - 0.3 && p.z > nipple.z) nipple = p.clone();
  }
  const bottom = nipple.y - 0.04;
  const inner = 0.01;
  const outer = nipple.x + 0.03;
  const at = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    if (parts[i] !== "core") continue;
    skin.getVertexPosition(i, p).applyMatrix4(skin.matrixWorld);
    nrm.fromBufferAttribute(normal, i).applyMatrix3(toWorld).normalize();
    const u = (Math.abs(p.x) - inner) / (outer - inner);
    const v = (p.y - bottom) / (top - bottom);
    if (nrm.z <= 0.2 || p.z < nipple.z - 0.09) continue;
    const fromNipple = Math.hypot(Math.abs(p.x) - nipple.x, p.y - nipple.y);
    const sink = (1 - THREE.MathUtils.smoothstep(fromNipple, 0.01, 0.06)) * (CHEST_PRESS.nippleFlat / CHEST_PRESS.pecBulge);
    const swell =
      u <= 0 || u >= 1 || v <= 0 || v >= 1
        ? 0
        : Math.sin(Math.PI * u) ** 0.8 *
          Math.sin(Math.PI * v) ** 0.8 *
          Math.min(1, (nrm.z - 0.2) / 0.5) *
          THREE.MathUtils.smoothstep(fromNipple, 0.03, 0.07);
    const w = swell - sink;
    if (Math.abs(w) > 0.02) at[i * 2 + (p.x > 0 ? 0 : 1)] = w;
  }
  skin.geometry.setAttribute("aPecs", new THREE.BufferAttribute(at, 2));
  skin.geometry.setAttribute("aPecsGrad", new THREE.BufferAttribute(pecsSlope(skin.geometry, at), 4));
}

// How the swell tilts the skin, so the light shows it: per vertex, the swell's slope along the skin
// (per metre, in the mesh's own space), and in w which side's swell it follows (1 left, -1 right).
// Pushing the skin out along its normal leaves the normal where it was; the shader leans it back
// against this slope (body-scene.tsx).
function pecsSlope(geometry: THREE.BufferGeometry, at: Float32Array) {
  const position = geometry.attributes.position;
  const index = geometry.index!;
  const out = new Float32Array(position.count * 4);
  const weight = new Float32Array(position.count);
  const pt = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const n = new THREE.Vector3();
  const g = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  for (let f = 0; f < index.count; f += 3) {
    const ids = [index.getX(f), index.getX(f + 1), index.getX(f + 2)];
    const side = ids.map((i) => (at[i * 2] !== 0 ? 0 : at[i * 2 + 1] !== 0 ? 1 : -1)).find((s) => s >= 0);
    if (side === undefined) continue;
    const w = ids.map((i) => at[i * 2 + side]);
    ids.forEach((i, k) => pt[k].fromBufferAttribute(position, i));
    e1.subVectors(pt[1], pt[0]);
    e2.subVectors(pt[2], pt[0]);
    n.crossVectors(e1, e2);
    const area2 = n.lengthSq();
    if (area2 < 1e-14) continue;
    // The linear field's gradient on the triangle: (w1-w0) (n x e2) + (w2-w0) (e1 x n), over |n|^2.
    g.crossVectors(n, e2).multiplyScalar(w[1] - w[0]);
    g.add(tmp.crossVectors(e1, n).multiplyScalar(w[2] - w[0]));
    g.divideScalar(area2);
    const a = Math.sqrt(area2);
    for (const i of ids) {
      out[i * 4] += g.x * a;
      out[i * 4 + 1] += g.y * a;
      out[i * 4 + 2] += g.z * a;
      out[i * 4 + 3] = side === 0 ? 1 : -1;
      weight[i] += a;
    }
  }
  for (let i = 0; i < position.count; i++) {
    if (weight[i] > 0) for (let k = 0; k < 3; k++) out[i * 4 + k] /= weight[i];
  }
  return out;
}

// Metres the chest swells at this depth: squeezed as the handles come in at the end of the push.
export function pecsBulge(depth: number) {
  return CHEST_PRESS.pecBulge * (1 - THREE.MathUtils.smoothstep(depth, 0, CHEST_PRESS.pecFrom));
}
