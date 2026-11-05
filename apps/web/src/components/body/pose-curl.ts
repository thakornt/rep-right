// Dumbbell hammer curl, built from anatomy like the presses: the body stands still
// and the elbow does the lift. The upper arm hangs beside the trunk, the forearm
// swings up about the elbow's hinge, and the palm keeps facing in, so the hand needs
// no turn at the forearm or the wrist. The dumbbell turns with the forearm: nothing
// keeps it level, because a straight wrist is the cue here.

import * as THREE from "three";

import { aim, deg, keepHinge, readRig, setWorldQuat, twoBoneIK, worldPos, type Rig } from "./pose";
import { frame, readSide, turnTo, type PressSide } from "./pose-press";

export const HAMMER_CURL = {
  armOut: 9, // degrees the upper arm hangs away from the trunk, leaving room for the dumbbell beside the thigh
  carrying: 8, // degrees the straight forearm angles out from the upper arm, as a real elbow's does
  lowBend: 8, // degrees the elbow stays bent at the bottom: not locked
  highBend: 130, // degrees at the top
  forwardAtTop: 12, // degrees the elbow may drift forward at the very top
  stance: 0.15, // metres from the middle to each ankle
  toeOut: 8, // degrees
  cameraTarget: [0, 0.87, 0] as [number, number, number],
};

export type CurlRig = { rig: Rig; l: PressSide; r: PressSide };

const X = new THREE.Vector3(1, 0, 0);
const FRONT = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

// Call once with the body at rest.
export function readCurlRig(root: THREE.Object3D): CurlRig {
  const rig = readRig(root);
  return { rig, l: readSide(root, rig, "l"), r: readSide(root, rig, "r") };
}

// Pose both arms with the elbows bent this far, and the upper arms this far forward.
export function poseCurlArms(curl: CurlRig, bend: number, forward: number) {
  const { rig } = curl;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);

  const out = [curl.l, curl.r].map((a) => {
    const s = a.s;
    // Feet about hip width, flat on the floor, which softens the knees a little.
    const ankle = new THREE.Vector3(s.sign * HAMMER_CURL.stance, s.ankle.y, s.ankle.z);
    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, s.sign * deg(HAMMER_CURL.toeOut));
    twoBoneIK(s.thigh, s.calf, s.foot, s.thighLen, s.shinLen, ankle, FRONT.clone().applyQuaternion(yaw));
    keepHinge(s, ankle);
    setWorldQuat(s.foot, yaw.clone().multiply(a.footRest));
    setWorldQuat(s.ball, yaw.clone().multiply(a.toesRest));

    const shoulder = worldPos(s.upperarm);
    const upper = new THREE.Vector3(s.sign * Math.sin(deg(HAMMER_CURL.armOut)), -Math.cos(deg(HAMMER_CURL.armOut)), 0);
    upper.applyAxisAngle(X, -deg(forward));
    aim(s.upperarm, s.lowerarm, shoulder.clone().addScaledVector(upper, a.upperLen));
    // The elbow's hinge runs across the body, whatever the upper arm does.
    const hinge = X.clone().addScaledVector(upper, -X.dot(upper)).normalize();
    turnTo(s.upperarm, a.hinge, upper, hinge);
    // Straight, the forearm angles out; bending, it swings in front and back in toward the shoulder.
    const straight = upper.clone().applyAxisAngle(FRONT, s.sign * deg(HAMMER_CURL.carrying));
    const swing = hinge.clone().addScaledVector(straight, -hinge.dot(straight)).normalize();
    const fore = straight.applyAxisAngle(swing, -deg(bend));
    aim(s.lowerarm, s.hand, worldPos(s.lowerarm).addScaledVector(fore, a.foreLen));

    // Palm facing in: the thumb side stays square to the forearm, on the side the
    // forearm swings toward. The wrist stays straight.
    const thumbs = fore.clone().cross(swing).normalize();
    turnTo(s.lowerarm, a.radial, fore, thumbs);
    setWorldQuat(s.hand, frame(fore, thumbs).multiply(a.handFrame.clone().invert()).multiply(a.handRest));
    a.grip.close();
    return { grip: a.grip.held(), handle: a.grip.dir() };
  });
  return { l: out[0], r: out[1] };
}

// Depth 0 = curled to the top, 1 = arms down, as with the presses.
export function poseCurl(curl: CurlRig, depth: number) {
  const { lowBend, highBend, forwardAtTop } = HAMMER_CURL;
  return poseCurlArms(curl, highBend + (lowBend - highBend) * depth, forwardAtTop * (1 - depth) ** 2);
}
