// Rope face pull, from the owner's reference clip (2026-11-12). The pulley is set a little above the
// head and the lifter steps back from it, standing tall with the knees soft. The rope is held
// overhand, palms down, the arms reaching up toward the pulley. The pull takes the middle of the
// rope toward the forehead: the elbows travel out and back at shoulder height, then the upper arms
// turn out so the forearms stand up and the hands spread wide beside the head, "like a double
// biceps pose", the shoulder blades squeezed together. The clip's wrong way, a hammer curl with the
// elbows low that works the biceps and forearms, is what this avoids. Pulled quickly breathing out,
// let back slowly breathing in.
//
// Depth 0 = arms reaching to the pulley, 1 = pulled in, as with the pulldown and pushdown, where the
// work is also on the way to 1.

import * as THREE from "three";

import { deg, qx, readRig, rotateWorld, setWorldPos, worldPos, type Rig } from "./pose";
import { holdArm, standFeet } from "./pose-curl";
import { readSide, type PressSide } from "./pose-press";

export const FACE_PULL = {
  hipsDrop: 0.02, // metres the hips sink, softening the knees
  leanBack: 12, // degrees the body leans back from the ankles in one line, against the cable's pull forward (owner, 2026-11-12)
  headUp: 0.8, // share of the lean the neck takes back, so the eyes look ahead
  reachRise: 14, // degrees the upper arms point up from level at the start, toward the pulley above the head
  reachIn: 6, // degrees they point in from straight ahead then
  bendStart: 8, // degrees the elbows stay bent at the start: not locked
  elbowDown: 40, // degrees the elbows point down from straight out at the start: straight out turns the shoulder in past its range
  sweep: 20, // degrees the upper arms end forward of straight out to the sides, at shoulder height
  elbowBelow: 5, // degrees the upper arms end below level: the elbows at shoulder height, the hands at the forehead
  forearmIn: 30, // degrees the forearms end leaning in from straight up, the hands beside the head
  forearmForward: 6, // degrees they lean forward then, the hands beside the forehead rather than behind it
  turnFrom: 0.15, // share of the pull before the upper arms start turning out
  protract: 6, // degrees the shoulder blades reach forward with the arms at the start
  retract: 12, // degrees they squeeze back together at the end
  stance: 0.12, // metres from the middle to each ankle: about hip width
  toeOut: 6, // degrees
  pulleyAbove: 0.08, // metres the pulley sits above the top of the head, as the clip says
  pulleyAhead: 1.4, // metres in front of the hips: one or two steps back from the tower
  strand: 0.4, // metres of rope from the knot to the thumb side of each fist
  ropeRadius: 0.014, // metres: the dumbbell handle's, so the agreed grip closes on it
  fistHalf: 0.05, // metres along the rope from the middle of the fist to where the rope leaves it
  ropeEnd: 0.022, // metres the rope carries on past the little finger to its stopper
  stopperRadius: 0.024, // metres
  cameraTarget: [0, 1.15, 0.12] as [number, number, number],
  cameraReach: 0.75,
};

export type FacePullRig = { rig: Rig; l: PressSide; r: PressSide; hips: THREE.Vector3; pulley: THREE.Vector3 };

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);

// Call once with the body at rest.
export function readFacePullRig(root: THREE.Object3D): FacePullRig {
  const rig = readRig(root);
  const top = new THREE.Box3().setFromObject(rig.skin).max.y;
  const hips = worldPos(rig.pelvis);
  return {
    rig,
    l: readSide(root, rig, "l"),
    r: readSide(root, rig, "r"),
    hips,
    pulley: new THREE.Vector3(0, top + FACE_PULL.pulleyAbove, hips.z + FACE_PULL.pulleyAhead),
  };
}

const slerp = (a: THREE.Vector3, b: THREE.Vector3, t: number) => {
  const q = new THREE.Quaternion().setFromUnitVectors(a, b);
  return a.clone().applyQuaternion(new THREE.Quaternion().slerp(q, t)).normalize();
};

export function poseFacePull(fp: FacePullRig, depth: number) {
  const P = FACE_PULL;
  const { rig, hips } = fp;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);
  // The whole body leans back from the planted ankles in one line, the trunk with the legs.
  const ankleY = rig.l.ankle.y;
  const rise = hips.y - P.hipsDrop - ankleY;
  setWorldPos(rig.pelvis, new THREE.Vector3(hips.x, ankleY + rise * Math.cos(deg(P.leanBack)), rig.l.ankle.z - rise * Math.sin(deg(P.leanBack))));
  rotateWorld(rig.pelvis, qx(-deg(P.leanBack)));
  rotateWorld(rig.neck, qx(deg(P.leanBack * P.headUp)));

  const pull = THREE.MathUtils.smoothstep(depth, 0, 1);
  const turn = THREE.MathUtils.smoothstep(depth, P.turnFrom, 1);
  const hands = [fp.l, fp.r].map((a) => {
    const { s } = a;
    const { sign } = s;
    standFeet(a, P.stance, P.toeOut);

    // The shoulder blade reaches forward with the arm, then squeezes back.
    const blade = -P.protract + (P.protract + P.retract) * pull;
    rotateWorld(s.upperarm.parent!, new THREE.Quaternion().setFromAxisAngle(Y, sign * deg(blade)));

    // Start: the upper arm toward the pulley, the forearm bent a little in, the elbow pointing out.
    const upper0 = new THREE.Vector3(0, 0, 1).applyAxisAngle(X, -deg(P.reachRise)).applyAxisAngle(Y, -sign * deg(P.reachIn));
    const hinge0 = Y.clone().multiplyScalar(sign).addScaledVector(upper0, -sign * upper0.y).normalize().applyAxisAngle(upper0, -sign * deg(P.elbowDown));
    const fore0 = upper0.clone().applyAxisAngle(hinge0, -deg(P.bendStart));
    // End: the upper arm out at shoulder height, a little forward; the forearm up, leaning in.
    const below = deg(P.elbowBelow);
    const upper1 = new THREE.Vector3(sign * Math.cos(deg(P.sweep)) * Math.cos(below), -Math.sin(below), Math.sin(deg(P.sweep)) * Math.cos(below));
    const fore1 = new THREE.Vector3(-sign * Math.sin(deg(P.forearmIn)), Math.cos(deg(P.forearmIn)), Math.sin(deg(P.forearmForward))).normalize();

    const upper = slerp(upper0, upper1, pull);
    const fore = slerp(fore0, fore1, turn);
    const hinge = fore.clone().cross(upper).normalize();
    const bend = THREE.MathUtils.radToDeg(upper.angleTo(fore));
    // Palms down reaching, the thumbs in; at the end the palms face forward, the thumbs in beside
    // the head. The forearm turns the palm down at the start, where the elbow points part way down.
    const thumbs = slerp(new THREE.Vector3(-sign, 0, 0), fore.clone().cross(hinge).normalize(), turn);
    holdArm(a, upper, hinge, upper, bend, thumbs);

    const grip = a.grip.held();
    const handle = a.grip.dir();
    const inWard = handle.dot(thumbs) > 0 ? handle.clone() : handle.clone().negate();
    return { grip, handle, enter: grip.clone().addScaledVector(inWard, P.fistHalf), end: grip.clone().addScaledVector(inWard, -(P.fistHalf + P.ropeEnd)) };
  });

  // The knot sits in line between the hands and the pulley, the strands pulled straight.
  const mid = hands[0].enter.clone().add(hands[1].enter).multiplyScalar(0.5);
  const toward = fp.pulley.clone().sub(mid).normalize();
  const half = hands[0].enter.distanceTo(hands[1].enter) / 2;
  const knot = mid.addScaledVector(toward, Math.sqrt(Math.max(0, P.strand ** 2 - half ** 2)));
  return { l: hands[0], r: hands[1], knot };
}
