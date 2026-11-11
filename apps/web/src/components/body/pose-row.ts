// Single-arm dumbbell row, from the owner's description and reference clip (2026-11-11). The body
// holds one braced position: hinged well forward from the hips with the back straight, the free
// (right) hand pressing on a support, the right foot forward under it and the left foot stepped
// straight back, both flat on the floor, so the working (left) elbow has room to go back past the
// body. The left arm works, on the side the side view looks from, so the support doesn't hide it.
// It hangs straight down at the bottom; rowing, the elbow sweeps back and up toward
// the hip, the upper arm close to the side, rather than the hand pulling straight up to the chest.
// The forearm hangs straight down throughout, so the elbow bends only as far as that needs.
//
// Depth 0 = rowed to the top, 1 = arm hanging, as with the other lifts.

import * as THREE from "three";

import { deg, keepHinge, qx, readRig, rotateWorld, setWorldPos, setWorldQuat, twoBoneIK, aim, worldPos, type Rig } from "./pose";
import { holdArm } from "./pose-curl";
import { frame, readSide, turnTo, type PressSide } from "./pose-press";

export const DUMBBELL_ROW = {
  trunkLean: 72, // degrees the back leans forward from upright, in one straight line from the hips to the neck
  pelvisTuck: 35, // degrees the pelvis tips back from the back's line, flattening the lower back
  hipsDrop: 0.08, // metres the hips sit lower than standing: knees soft
  neckBack: 22, // degrees the neck lifts back against the lean, so the eyes look at the floor a little ahead
  frontFoot: [0.13, 0.15] as [number, number], // metres the support side's ankle sits out from the middle and ahead of the hips
  backFoot: [0.14, -0.36] as [number, number], // metres the working side's ankle sits out and behind
  toeOut: 6, // degrees
  supportAhead: 0.16, // metres the support hand sits ahead of its shoulder
  supportOut: 0.02, // metres outside it
  supportReach: 0.92, // share of the arm's full length from the shoulder to the wrist: nearly straight, with room for the shoulder to rise as the back turns
  bottomTwist: 10, // degrees the upper back turns toward the dumbbell at the bottom, its shoulder dropping, to stretch the back fully, as the owner allows
  twistFrom: 0.5, // depth where the turn starts
  hangForward: 6, // degrees the working arm hangs forward of straight down at the bottom
  hangOut: 4, // degrees out from the body
  hangBend: 8, // degrees the elbow stays bent at the bottom
  topPastTrunk: 20, // degrees the upper arm rises past the line of the trunk at the top: the elbow back above the back
  topOut: 18, // degrees out from the side at the top: close, not flared, just clear for the dumbbell to pass the hip
  cameraTarget: [0, 0.75, -0.05] as [number, number, number],
  cameraReach: 0.75,
};

export type RowRig = { rig: Rig; l: PressSide; r: PressSide; hips: THREE.Vector3; supportWrist?: THREE.Vector3 };

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const X = new THREE.Vector3(1, 0, 0);
const FRONT = new THREE.Vector3(0, 0, 1);

// Call once with the body at rest.
export function readRowRig(root: THREE.Object3D): RowRig {
  const rig = readRig(root);
  return { rig, l: readSide(root, rig, "l"), r: readSide(root, rig, "r"), hips: worldPos(rig.pelvis) };
}

// A foot flat on the floor at (out, ahead) from the middle, the knee bending in the leg's own plane.
function plantFoot(a: PressSide, out: number, ahead: number, toeOut: number) {
  const s = a.s;
  const ankle = new THREE.Vector3(s.sign * out, s.ankle.y, ahead);
  const yaw = new THREE.Quaternion().setFromAxisAngle(UP, s.sign * deg(toeOut));
  twoBoneIK(s.thigh, s.calf, s.foot, s.thighLen, s.shinLen, ankle, FRONT.clone().applyQuaternion(yaw));
  keepHinge(s, ankle);
  setWorldQuat(s.foot, yaw.clone().multiply(a.footRest));
  setWorldQuat(s.ball, yaw.clone().multiply(a.toesRest));
}

// The free hand flat on the support, fingers forward, the arm nearly straight. Returns where the palm
// presses, for the support's top.
function bracePalm(a: PressSide, wrist: THREE.Vector3) {
  const s = a.s;
  twoBoneIK(s.upperarm, s.lowerarm, s.hand, a.upperLen, a.foreLen, wrist, new THREE.Vector3(s.sign * 0.4, 0, -1));
  const shoulder = worldPos(s.upperarm);
  const elbow = worldPos(s.lowerarm);
  const upper = elbow.clone().sub(shoulder).normalize();
  turnTo(s.upperarm, a.hinge, upper, wrist.clone().sub(elbow).normalize().cross(upper).normalize());
  aim(s.lowerarm, s.hand, wrist);
  const fore = worldPos(s.hand).sub(worldPos(s.lowerarm)).normalize();
  // Palm down: the thumb side toward the middle of the body.
  const thumbs = new THREE.Vector3(-s.sign, 0, 0);
  turnTo(s.lowerarm, a.radial, fore, thumbs.clone().addScaledVector(fore, -thumbs.dot(fore)));
  setWorldQuat(s.hand, frame(FRONT, thumbs).multiply(a.handFrame.clone().invert()).multiply(a.handRest));
  const palm = worldPos(s.hand).lerp(worldPos(s.middle1), 0.5);
  palm.y -= 0.022; // to the skin under it
  return palm;
}

export function poseRow(row: RowRig, depth: number) {
  const P = DUMBBELL_ROW;
  const { rig, hips } = row;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);

  // The body's one braced position.
  setWorldPos(rig.pelvis, new THREE.Vector3(hips.x, hips.y - P.hipsDrop, hips.z));
  // The back flat from the hips to the base of the neck, as in the reference clip: the pelvis tips
  // forward with the trunk, and each part of the spine lines up on one straight line.
  const along = UP.clone().applyAxisAngle(X, deg(P.trunkLean));
  const chain = [rig.pelvis, rig.spine1, rig.spine2, rig.spine3, rig.neck];
  for (let i = 0; i < chain.length - 1; i++) {
    const bone = chain[i];
    const child = chain[i + 1];
    const now = worldPos(child).sub(worldPos(bone)).normalize();
    // The pelvis tucks under a little: tipped forward with the trunk it would push the buttocks up
    // and leave the lower back dipping, the arch the owner doesn't want.
    const want = i === 0 ? along.clone().applyAxisAngle(X, -deg(P.pelvisTuck)) : along;
    rotateWorld(bone, new THREE.Quaternion().setFromUnitVectors(now, want));
  }
  rotateWorld(rig.neck, qx(-deg(P.neckBack)));
  const free = row.r;
  const a = row.l;
  plantFoot(free, P.frontFoot[0], hips.z + P.frontFoot[1], P.toeOut);
  plantFoot(a, P.backFoot[0], hips.z + P.backFoot[1], P.toeOut);

  // Where the free hand presses, set by the shoulder before any turn: the support doesn't move.
  const fs = free.s;
  if (!row.supportWrist) {
    const shoulder = worldPos(fs.upperarm);
    const reach = (free.upperLen + free.foreLen) * P.supportReach;
    const ahead = P.supportAhead;
    row.supportWrist = shoulder.clone().add(new THREE.Vector3(fs.sign * P.supportOut, -Math.sqrt(reach ** 2 - ahead ** 2 - P.supportOut ** 2), ahead));
  }

  // Low in the lift the upper back turns about its own line toward the dumbbell, half in each of
  // its two parts, so the working shoulder drops and the back stretches.
  const turn = P.bottomTwist * THREE.MathUtils.smoothstep(depth, P.twistFrom, 1);
  for (const b of [rig.spine2, rig.spine3]) rotateWorld(b, new THREE.Quaternion().setFromAxisAngle(along, -a.s.sign * deg(turn / 2)));

  const support = bracePalm(free, row.supportWrist);

  // The working arm: hanging at the bottom, the elbow back past the trunk at the top.
  const s = a.s;
  const hang = DOWN.clone().applyAxisAngle(X, -deg(P.hangForward)).applyAxisAngle(FRONT, s.sign * deg(P.hangOut));
  const trunkDown = DOWN.clone().applyAxisAngle(X, deg(P.trunkLean)); // along the trunk toward the hips
  const top = trunkDown.applyAxisAngle(X, deg(P.topPastTrunk)).applyAxisAngle(FRONT.clone().applyAxisAngle(X, deg(P.trunkLean)), s.sign * deg(P.topOut));
  const upper = new THREE.Vector3().copy(hang).lerp(top, 1 - depth).normalize();
  // The forearm hangs straight down; at the bottom it carries on from the arm with a little bend.
  const bend = Math.max(P.hangBend, THREE.MathUtils.radToDeg(upper.angleTo(DOWN)));
  // The elbow bends the forearm from the arm's line down toward the floor, and with the arm hanging,
  // forward, the way its front faces with the thumb forward.
  const toward = DOWN.clone().addScaledVector(FRONT, 0.35).normalize();
  const hinge = toward.cross(upper).normalize();
  const work = holdArm(a, upper, hinge, upper, bend, FRONT);
  return { work, support };
}
