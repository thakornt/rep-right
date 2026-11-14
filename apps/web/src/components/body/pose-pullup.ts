// Pull-up and chin-up on a fixed bar, from the owner's reference clips (2026-11-14): a coaching clip
// for the pull-up (the dead hang and the active hang side by side from behind, the hold at the top
// and the slow way down, seen from behind and to one side) and a clip of the two grips side by side
// from behind.
//
// - The rep starts from the dead hang: the arms straight overhead, the shoulders shrugged up to the
//   ears and the head sunk between the arms, the back stretched long. First the shoulder blades
//   press down ("toward the back pockets"), lifting the body a little with the arms still straight:
//   the active hang. Then the pull, until the chin clears the bar with the chest near it, the
//   shoulders kept down and the neck straight.
// - The trunk leans back about 15 degrees at the top and 20 through the middle, and hangs nearly
//   upright at the bottom. The knees stay bent about 90 degrees, the shins back, the thighs a little
//   forward, all the way.
// - Overhand (pull-up): the hands a little wider than the shoulders, the palms facing away, the
//   elbows going out to the sides.
// - Underhand (chin-up): the hands about shoulder width, the palms facing the lifter, the elbows
//   coming down in front of the body, the upper arms close to the ribs at the top.
//
// The bar is fixed; the body moves. Each frame poses the body about its hips, then moves it whole
// so the hands land on the bar. Depth 0 = the dead hang (the stretch), 1 = the chin over the bar,
// as the pulldown's 0 is the arms up.

import * as THREE from "three";

import { enableArmTwist } from "./arm-twist";
import { readBody } from "./contact";
import { readGrip } from "./grip";
import { aim, BAR_RADIUS, deg, keepHinge, qx, readRig, rotateWorld, setWorldPos, setWorldQuat, twoBoneIK, worldPos, type Rig } from "./pose";
import { frame, readSide, turnTo, type PressSide } from "./pose-press";

export type PullUpGrip = "overhand" | "underhand";

export const PULL_UP = {
  shrug: 45, // degrees the collarbones rise in the dead hang: the shoulders up by the ears
  shoulderDownTop: 8, // degrees they press down at the top
  shoulderBackTop: 12, // degrees they pull back at the top, the shoulder blades squeezing
  leanTop: 15, // degrees the trunk leans back at the top, as in the clip
  leanMiddle: 10, // degrees more through the middle of the pull: about 20 there, as in the clip
  neckBack: 0.7, // share of the lean the neck takes back, so the face stays upright and the neck straight
  elbowBottom: 15, // degrees the elbows stay bent hanging: straight, not locked. Less leaves the hinge's plane loose, and the arm snaps round as it starts to bend
  barAboveTop: 0.11, // metres the bar sits above the shoulder joints at the top: just under the chin
  barAheadTop: 0.18, // metres in front of them: the chest near the bar, the head behind it
  barAheadBottom: 0.02, // and hanging: the bar over the head
  barAheadEase: 3, // the higher, the sooner the bar comes out in front of the face
  barAheadMiddle: 0.02, // metres further out through the middle, where the face passes the bar
  thighForward: 20, // degrees the thighs swing forward of straight down
  kneeBend: 90, // degrees, the shins back
  pointToes: 25, // degrees the feet point, relaxed
  kneeApart: 0.1, // metres from the middle to each knee
  barLength: 1.2, // metres
  barClear: 0.35, // metres the lowest skin hangs off the floor in the dead hang
  cameraTarget: [0, 1.4, 0] as [number, number, number], // halfway from the top of the head at the top to the hanging feet
  cameraTall: 1.25, // metres above and below it: the bar and the hanging feet
  cameraReach: 1.05, // metres either side of the middle in view: the frame then takes in the bar and the feet
};

export const PULL_UP_GRIPS = {
  // A little wider than the shoulders (owner, 2026-11-14): the clip's hands are 1.13 times the
  // width across the outsides of the shoulders.
  overhand: { gripHalf: 0.26, elbowSwingBottom: -85, elbowSwingTop: 60, elbowSwingEase: 4, handForward: 2, handOut: -5, thumbsOut: false },
  // About shoulder width: in the clip the hands sit just inside the outsides of the shoulders,
  // over the shoulder joints, which are 0.187 m from the middle on this body.
  underhand: { gripHalf: 0.19, elbowSwingBottom: 85, elbowSwingTop: 85, elbowSwingEase: 1, handForward: 6, handOut: 0, thumbsOut: true },
};

export type PullUpRig = {
  rig: Rig;
  grip: PullUpGrip;
  l: PressSide & { handFrame: THREE.Quaternion; bar: ReturnType<typeof readGrip> };
  r: PressSide & { handFrame: THREE.Quaternion; bar: ReturnType<typeof readGrip> };
  barY: number;
};

const X = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

// The way the elbow points from the line of the arm, for the two-bone solve: out to the side,
// swung by this many degrees toward the front of the arm's line (forward with the arms overhead,
// down with the hands in front of the shoulders), as for the pulldown.
function elbowAim(shoulder: THREE.Vector3, wrist: THREE.Vector3, sign: number, swing: number) {
  const dy = wrist.y - shoulder.y;
  const dz = wrist.z - shoulder.z;
  const apart = Math.hypot(dy, dz);
  const forwardDown = new THREE.Vector3(0, -dz / apart, dy / apart);
  return new THREE.Vector3(sign * Math.cos(deg(swing)), 0, 0).addScaledVector(forwardDown, Math.sin(deg(swing)));
}

// Call once with the body at rest.
export function readPullUpRig(root: THREE.Object3D, grip: PullUpGrip): PullUpRig {
  // Hanging underhand turns the upper arm 157 degrees from rest about its length; without twist
  // bones the skin where the arm meets the shoulder takes all of it and pinches to a thin band, as
  // in the overhead triceps extension (owner, 2026-11-14).
  enableArmTwist(root);
  const rig = readRig(root);
  const side = (tag: "l" | "r") => {
    const a = readSide(root, rig, tag);
    const bar = readGrip(root, rig.skin, tag, BAR_RADIUS);
    // Square to the bar in the palm: the hand's frame carries the bar's own line.
    const dir = bar.dir();
    const length = worldPos(a.s.middle1).sub(worldPos(a.s.hand));
    return { ...a, bar, handFrame: frame(length.addScaledVector(dir, -length.dot(dir)), dir) };
  };
  const out: PullUpRig = { rig, grip, l: side("l"), r: side("r"), barY: 0 };

  // Hang the body so its lowest skin clears the floor in the dead hang.
  posePullUp(out, 0);
  const body = readBody(root);
  const p = new THREE.Vector3();
  let low = Infinity;
  body.part.forEach((_, i) => {
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    low = Math.min(low, p.y);
  });
  out.barY = PULL_UP.barClear - low;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  root.updateMatrixWorld(true);
  return out;
}

export const pullUpBar = (pull: PullUpRig) => new THREE.Vector3(0, pull.barY, 0);

const smooth = (t: number) => t * t * (3 - 2 * t);

export function posePullUp(pull: PullUpRig, depth: number) {
  const { rig } = pull;
  const P = PULL_UP;
  const G = PULL_UP_GRIPS[pull.grip];
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);

  // The shoulder blades come down out of the shrug as the pull starts, gradually, with it: most of
  // the way by halfway up, not as a step of their own (owner, 2026-11-14).
  const p = depth;
  const active = 1 - (1 - depth) ** 2;

  // The trunk leans back in one piece from the hips.
  const lean = deg(P.leanTop * p + P.leanMiddle * Math.sin(Math.PI * p));
  rotateWorld(rig.pelvis, qx(-lean));
  rotateWorld(rig.neck, qx(lean * P.neckBack));

  const chest = qx(-lean);
  const along = UP.clone().applyQuaternion(chest);
  const out = new THREE.Vector3(0, 0, 1).applyQuaternion(chest);
  for (const a of [pull.l, pull.r]) {
    const clavicle = a.s.upperarm.parent!;
    // Up by the ears hanging; pressed down, then down and back as the chin comes up.
    const rise = P.shrug * (1 - active) - P.shoulderDownTop * p;
    rotateWorld(clavicle, new THREE.Quaternion().setFromAxisAngle(along, a.s.sign * deg(P.shoulderBackTop * p)));
    rotateWorld(clavicle, new THREE.Quaternion().setFromAxisAngle(out, a.s.sign * deg(rise)));
  }

  // The legs hang with the knees bent and the shins back.
  for (const a of [pull.l, pull.r]) {
    const s = a.s;
    const hip = worldPos(s.thigh);
    const thigh = new THREE.Vector3(0, -Math.cos(deg(P.thighForward)), Math.sin(deg(P.thighForward)));
    const shinAt = deg(P.thighForward - P.kneeBend);
    const shin = new THREE.Vector3(0, -Math.cos(shinAt), Math.sin(shinAt));
    const knee = new THREE.Vector3(s.sign * P.kneeApart, hip.y, hip.z).addScaledVector(thigh, s.thighLen);
    const ankle = knee.clone().addScaledVector(shin, s.shinLen);
    twoBoneIK(s.thigh, s.calf, s.foot, s.thighLen, s.shinLen, ankle, new THREE.Vector3(0, 0, 1));
    keepHinge(s, ankle);
    rotateWorld(s.foot, qx(deg(P.pointToes)));
  }

  // Where the bar is, from the shoulders: overhead hanging, by the chin at the top. Hanging, it is
  // as high as the arms reach with the elbows nearly straight, the hand straight up off the wrist.
  const thumbsOf = (sign: number) => new THREE.Vector3(G.thumbsOut ? sign : -sign, 0, 0);
  // Along the hand, from the wrist to the knuckles: up, leaning forward and out by the grip's angles.
  const handLong = (sign: number) =>
    new THREE.Vector3(sign * Math.tan(deg(G.handOut)), 1, Math.tan(deg(G.handForward))).normalize();
  const handQOf = (a: PullUpRig["l"], long: THREE.Vector3) =>
    frame(long, thumbsOf(a.s.sign)).multiply(a.handFrame.clone().invert()).multiply(a.handRest);
  const shoulders = worldPos(pull.l.s.upperarm).add(worldPos(pull.r.s.upperarm)).multiplyScalar(0.5);
  const a0 = pull.l;
  setWorldQuat(a0.s.hand, handQOf(a0, handLong(a0.s.sign)));
  a0.bar.close();
  const fist = a0.bar.at().sub(worldPos(a0.s.hand)); // the wrist to the middle of the fist
  const reach = Math.sqrt(a0.upperLen ** 2 + a0.foreLen ** 2 + 2 * a0.upperLen * a0.foreLen * Math.cos(deg(P.elbowBottom)));
  const sh = worldPos(a0.s.upperarm);
  const dx = G.gripHalf - fist.x - sh.x;
  const dz = shoulders.z + P.barAheadBottom - fist.z - sh.z;
  const hangAbove = sh.y - shoulders.y + Math.sqrt(Math.max(0, reach ** 2 - dx ** 2 - dz ** 2)) + fist.y;
  const above = hangAbove + (P.barAboveTop - hangAbove) * smooth(p); // easing off the hang: near straight, a little less reach bends the elbow a lot
  // The bar comes out in front early, so the face passes behind it, the head going back.
  const ahead = P.barAheadBottom + (P.barAheadTop - P.barAheadBottom) * (1 - (1 - p) ** P.barAheadEase) + P.barAheadMiddle * Math.sin(Math.PI * p);
  const bar = new THREE.Vector3(0, shoulders.y + above, shoulders.z + ahead);
  const swing = G.elbowSwingBottom + (G.elbowSwingTop - G.elbowSwingBottom) * (1 - (1 - p) ** G.elbowSwingEase);

  const hands = [pull.l, pull.r].map((a) => {
    const s = a.s;
    const onBar = bar.clone().addScaledVector(X, s.sign * G.gripHalf);
    // Overhand the thumbs point in, the palms away; underhand the thumbs point out, the palms in.
    const thumbs = thumbsOf(s.sign);
    // The hand holds the bar the same way all through: the fist doesn't turn round the bar. The
    // wrist takes up the forearm's swing (owner, 2026-11-14).
    const handQ = handQOf(a, handLong(s.sign));
    setWorldQuat(s.hand, handQ);
    a.bar.close();
    const wrist = onBar.clone().sub(a.bar.at().sub(worldPos(s.hand)));
    twoBoneIK(s.upperarm, s.lowerarm, s.hand, a.upperLen, a.foreLen, wrist, elbowAim(worldPos(s.upperarm), wrist, s.sign, swing));
    const shoulder = worldPos(s.upperarm);
    const elbow = worldPos(s.lowerarm);
    const upper = elbow.clone().sub(shoulder).normalize();
    const fore = wrist.clone().sub(elbow).normalize();
    // Square the upper arm to the arm's plane: the elbow is a hinge.
    turnTo(s.upperarm, a.hinge, upper, fore.clone().cross(upper).normalize());
    aim(s.lowerarm, s.hand, wrist);
    // The forearm turns the palm; the wrist takes up the rest.
    turnTo(s.lowerarm, a.radial, worldPos(s.hand).sub(worldPos(s.lowerarm)).normalize(), thumbs);
    setWorldQuat(s.hand, handQ);
    a.bar.close();
    return a;
  });

  // Move the whole body so the bar it holds is the fixed bar.
  const fixed = pullUpBar(pull);
  setWorldPos(rig.pelvis, worldPos(rig.pelvis).add(fixed.clone().sub(bar)));
  rig.pelvis.parent!.updateMatrixWorld(true);
  const held = hands.map((a) => ({ grip: a.bar.at(), handle: a.bar.dir() }));
  return { l: held[0], r: held[1], bar: fixed };
}
