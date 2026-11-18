// Dumbbell lateral raise, from the owner's reference photo. The body holds one position
// all the way: knees a little bent, hips back, trunk leaning forward in one straight
// piece. The shoulder does the lift, with the elbow a little bent and leading: the upper
// arm is turned in so the bend shows downward, and the elbow rises ahead of the hand.
// At the bottom the dumbbell lies nearly across the body; the forearm turns back on the way
// up, so the back of the hand faces up at the top and the dumbbell comes up level.

import * as THREE from "three";

import { deg, qx, readRig, rotateWorld, setWorldPos, worldPos, type Rig } from "./pose";
import { holdArm, standFeet } from "./pose-curl";
import { readSide, type PressSide } from "./pose-press";

export const LATERAL_RAISE = {
  lowRaise: 20, // degrees the upper arm is out from hanging at the bottom: with the elbow pointing out, less brings the dumbbells onto the thighs
  highRaise: 88, // degrees at the top: the elbow about shoulder height, not above
  planeForward: 40, // degrees the arm's path is forward of straight out to the side at the bottom: the hands in front of the thighs
  planeForwardTop: 35, // and at the top: the hands forward of the side (owner, 2026-11-17)
  // Degrees the hand is turned about the forearm from thumbs-forward, toward palm-back: at the
  // bottom the dumbbell lies nearly across the body; on the way up the forearm turns back so the
  // back of the hand faces up at the top and the dumbbell comes up level (owner, 2026-11-17).
  handTurnLow: 0, // with the upper arm turned in, the dumbbell 18 degrees off straight across
  handTurnHigh: -22, // the back of the hand up, the thumb end of the dumbbell about 2 degrees below level (owner: down, no more than 5)
  elbowBend: 20, // degrees the elbow stays bent, the same all the way
  elbowLeadLow: 70, // degrees the upper arm is turned in at the bottom: the elbow points out to the side (22 degrees back of straight out), the biceps toward the body (owner, 2026-11-17); the shoulder turns in 68, of its 70
  elbowLeadHigh: 60, // and at the top, so the elbow rides above the hand; with the path this far forward, less leaves it level with the hand
  shoulderRiseAtTop: 6, // degrees the clavicles rise with the arm at the top: the shoulder blade rotating up, not a shrug
  trunkLean: 15, // degrees the trunk leans forward from the hips, the back straight
  hipsBack: 0.09, // metres the hips sit behind the ankles
  hipsDrop: 0.03, // metres the hips sink, bending the knees a little
  neckBack: 12, // degrees the neck lifts back against the lean, so the eyes look ahead
  stance: 0.12, // metres from the middle to each ankle
  toeOut: 8, // degrees
  cameraTarget: [0, 0.95, 0] as [number, number, number],
  cameraReach: 0.92, // metres either side of the middle the dumbbells reach at the top, with a margin
};

export type RaiseRig = { rig: Rig; l: PressSide; r: PressSide; hips: THREE.Vector3 };

const DOWN = new THREE.Vector3(0, -1, 0);
const ACROSS = new THREE.Vector3(1, 0, 0);
const FRONT = new THREE.Vector3(0, 0, 1);

// Call once with the body at rest.
export function readRaiseRig(root: THREE.Object3D): RaiseRig {
  const rig = readRig(root);
  return { rig, l: readSide(root, rig, "l"), r: readSide(root, rig, "r"), hips: worldPos(rig.pelvis) };
}

// Depth 0 = arms up, 1 = arms down, as with the presses.
export function poseRaise(raise: RaiseRig, depth: number) {
  const { rig, hips } = raise;
  const { lowRaise, highRaise, planeForward, planeForwardTop, handTurnLow, handTurnHigh, elbowBend, elbowLeadLow, elbowLeadHigh, shoulderRiseAtTop, trunkLean, hipsBack, hipsDrop, neckBack, stance, toeOut } = LATERAL_RAISE;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);

  // The body's one position: it does not change through the lift.
  setWorldPos(rig.pelvis, new THREE.Vector3(hips.x, hips.y - hipsDrop, rig.l.ankle.z - hipsBack));
  rotateWorld(rig.pelvis, qx(deg(trunkLean)));
  rotateWorld(rig.neck, qx(-deg(neckBack)));
  const chestFront = FRONT.clone().applyAxisAngle(ACROSS, deg(trunkLean));

  const elevation = highRaise + (lowRaise - highRaise) * depth;
  const lead = elbowLeadHigh + (elbowLeadLow - elbowLeadHigh) * depth;
  const out = [raise.l, raise.r].map((a) => {
    const { sign } = a.s;
    standFeet(a, stance, toeOut);
    rotateWorld(a.s.upperarm.parent!, new THREE.Quaternion().setFromAxisAngle(chestFront, sign * deg(shoulderRiseAtTop * (1 - depth))));

    // The arm's height is against gravity, not the trunk: it hangs straight down at rest.
    const e = deg(elevation);
    const plane = deg(planeForwardTop + (planeForward - planeForwardTop) * depth);
    const upper = new THREE.Vector3(sign * Math.sin(e) * Math.cos(plane), -Math.cos(e), Math.sin(e) * Math.sin(plane));
    // The arm swings up carrying the elbow's hinge, turned in about itself so the bend shows downward.
    const hinge = ACROSS.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(DOWN, upper)).applyAxisAngle(upper, sign * deg(lead));
    // The hand's turn on the forearm, carried by the arm: across at the bottom, palm down at the top.
    const handTurn = handTurnHigh + (handTurnLow - handTurnHigh) * depth;
    const swing = hinge.clone().addScaledVector(upper, -hinge.dot(upper)).normalize();
    const fore = upper.clone().applyAxisAngle(swing, -deg(elbowBend));
    const thumbs = fore.clone().cross(swing).normalize().applyAxisAngle(fore, sign * deg(handTurn));
    return holdArm(a, upper, hinge, upper, elbowBend, thumbs);
  });
  return { l: out[0], r: out[1] };
}
