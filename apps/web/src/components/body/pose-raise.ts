// Dumbbell lateral raise, from the owner's reference photo. The body holds one position
// all the way: knees a little bent, hips back, trunk leaning forward in one straight
// piece. The shoulder does the lift, with the elbow a little bent and leading: the upper
// arm is turned in so the bend shows downward, and the elbow rises ahead of the hand.
// The forearm turns back against that, so the palm that faced in at the bottom faces
// down at the top and the dumbbell stays near level.

import * as THREE from "three";

import { deg, qx, readRig, rotateWorld, setWorldPos, worldPos, type Rig } from "./pose";
import { holdArm, standFeet } from "./pose-curl";
import { readSide, type PressSide } from "./pose-press";

export const LATERAL_RAISE = {
  lowRaise: 16, // degrees the upper arm is out from hanging at the bottom
  highRaise: 88, // degrees at the top: the elbow about shoulder height, not above
  planeForward: 15, // degrees the arm's path is forward of straight out to the side; the owner confirmed it
  elbowBend: 20, // degrees the elbow stays bent, the same all the way
  elbowLeadLow: 15, // degrees the upper arm is turned in at the bottom; any more and the dumbbell meets the thigh
  elbowLeadHigh: 40, // and at the top, so the elbow rides above the hand
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
  const { lowRaise, highRaise, planeForward, elbowBend, elbowLeadLow, elbowLeadHigh, shoulderRiseAtTop, trunkLean, hipsBack, hipsDrop, neckBack, stance, toeOut } = LATERAL_RAISE;
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
    const plane = deg(planeForward);
    const upper = new THREE.Vector3(sign * Math.sin(e) * Math.cos(plane), -Math.cos(e), Math.sin(e) * Math.sin(plane));
    // The arm swings up carrying the elbow's hinge, turned in about itself so the bend shows downward.
    const hinge = ACROSS.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(DOWN, upper)).applyAxisAngle(upper, sign * deg(lead));
    return holdArm(a, upper, hinge, upper, elbowBend, FRONT);
  });
  return { l: out[0], r: out[1] };
}
