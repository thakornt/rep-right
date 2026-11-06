// Dumbbell hammer curl, built from anatomy like the presses: the body stands still
// and the elbow does the lift. The upper arm hangs beside the trunk, the forearm
// swings up about the elbow's hinge, and the palm keeps facing in, so the hand needs
// no turn at the forearm or the wrist. The dumbbell turns with the forearm: nothing
// keeps it level, because a straight wrist is the cue here.

import * as THREE from "three";

import { aim, deg, keepHinge, readRig, setWorldQuat, twoBoneIK, worldPos, worldQuat, type Rig } from "./pose";
import { frame, readSide, turnTo, type PressSide } from "./pose-press";
import { fromBottomDepthAt, fromBottomTimeAt } from "./tempo";

export const HAMMER_CURL = {
  armOut: 13, // degrees the whole arm hangs away from the trunk, in one straight line, leaving room for the dumbbell beside the thigh
  carrying: 0, // degrees the straight forearm angles out from the upper arm; the owner wants the arm straight
  lowBend: 8, // degrees the elbow stays bent at the bottom: not locked
  highBend: 130, // degrees at the top
  forwardAtTop: 12, // degrees the elbow may drift forward at the very top
  stance: 0.12, // metres from the middle to each ankle
  toeOut: 8, // degrees
  bicepsBulge: 0.01, // metres the front of the upper arm swells at the top: a little, as the owner asked
  bicepsFrom: 30, // degrees of elbow bend where it starts to swell
  bicepsFull: 120, // degrees where it is fully swollen
  cameraTarget: [0, 0.87, 0] as [number, number, number],
};

export type CurlRig = { rig: Rig; l: PressSide; r: PressSide; biceps: Float32Array };

const X = new THREE.Vector3(1, 0, 0);
const FRONT = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);
const BICEPS_START = 0.15; // share of the upper arm, from the shoulder, where the belly of the muscle starts
const BICEPS_END = 0.9; // and ends
const BICEPS_MIN_WEIGHT = 0.02; // below this a vertex stays still

// Call once with the body at rest.
export function readCurlRig(root: THREE.Object3D): CurlRig {
  const rig = readRig(root);
  const l = readSide(root, rig, "l");
  const r = readSide(root, rig, "r");
  return { rig, l, r, biceps: readBiceps(rig, [l, r]) };
}

// How much each vertex swells with the biceps, up to 1: most at the middle of the upper
// arm's front, none at its ends or behind. The front is the side the forearm folds
// toward, square to the elbow's hinge. Kept on the mesh as the attribute aBiceps,
// which the body material pushes out along the skin's normal: positive on the left
// arm and negative on the right, so each can swell by its own amount.
function readBiceps(rig: Rig, sides: PressSide[]) {
  const { skin } = rig;
  for (const [b, rest] of rig.rest) {
    b.quaternion.copy(rest.q);
    b.position.copy(rest.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);
  const { skinIndex, skinWeight, position } = skin.geometry.attributes;
  const bones = skin.skeleton.bones;
  const limbs = sides.map((a) => {
    const shoulder = worldPos(a.s.upperarm);
    const along = worldPos(a.s.lowerarm).sub(shoulder).normalize();
    const hinge = a.hinge.clone().applyQuaternion(worldQuat(a.s.upperarm));
    return { bone: bones.indexOf(a.s.upperarm as THREE.Bone), shoulder, along, front: along.clone().cross(hinge).normalize(), length: a.upperLen };
  });
  const at = new Float32Array(position.count);
  const p = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    const limb = limbs.find((m) => [0, 1, 2, 3].some((k) => skinIndex.getComponent(i, k) === m.bone && skinWeight.getComponent(i, k) > 0.5));
    if (!limb) continue;
    skin.getVertexPosition(i, p).applyMatrix4(skin.matrixWorld).sub(limb.shoulder);
    const t = (p.dot(limb.along) / limb.length - BICEPS_START) / (BICEPS_END - BICEPS_START);
    if (t <= 0 || t >= 1) continue;
    const out = p.addScaledVector(limb.along, -p.dot(limb.along)).normalize().dot(limb.front);
    if (out <= 0) continue;
    const w = Math.sin(Math.PI * t) ** 2 * out ** 2;
    if (w > BICEPS_MIN_WEIGHT) at[i] = limb === limbs[0] ? w : -w;
  }
  skin.geometry.setAttribute("aBiceps", new THREE.BufferAttribute(at, 1));
  return at;
}

// Metres the biceps swells at this depth of the lift.
export function bicepsBulge(depth: number) {
  const { lowBend, highBend, bicepsFrom, bicepsFull, bicepsBulge: most } = HAMMER_CURL;
  return most * THREE.MathUtils.smoothstep(highBend + (lowBend - highBend) * depth, bicepsFrom, bicepsFull);
}

// Feet flat on the floor this far from the middle, which softens the knees a little.
// `kneeOut` is degrees the knee is aimed outside the toes' line, to bring a deeply bent
// knee over the toes when the hips sit between the feet.
export function standFeet(a: PressSide, stance: number, toeOut: number, kneeOut = 0) {
  const s = a.s;
  const ankle = new THREE.Vector3(s.sign * stance, s.ankle.y, s.ankle.z);
  const yaw = new THREE.Quaternion().setFromAxisAngle(UP, s.sign * deg(toeOut));
  const aimKnee = FRONT.clone().applyAxisAngle(UP, s.sign * deg(toeOut + kneeOut));
  twoBoneIK(s.thigh, s.calf, s.foot, s.thighLen, s.shinLen, ankle, aimKnee);
  keepHinge(s, ankle);
  setWorldQuat(s.foot, yaw.clone().multiply(a.footRest));
  setWorldQuat(s.ball, yaw.clone().multiply(a.toesRest));
}

// One arm, the wrist straight and the hand closed on its dumbbell: the upper arm
// pointing along `upper` with the elbow's hinge along `hinge`, and the forearm bent
// this far from `straight`, its direction with the elbow unbent. The thumb side stays
// on the side the forearm swings toward, unless `thumbsToward` asks the forearm to
// turn it elsewhere.
export function holdArm(a: PressSide, upper: THREE.Vector3, hinge: THREE.Vector3, straight: THREE.Vector3, bend: number, thumbsToward?: THREE.Vector3) {
  const s = a.s;
  aim(s.upperarm, s.lowerarm, worldPos(s.upperarm).addScaledVector(upper, a.upperLen));
  turnTo(s.upperarm, a.hinge, upper, hinge);
  const swing = hinge.clone().addScaledVector(straight, -hinge.dot(straight)).normalize();
  const fore = straight.clone().applyAxisAngle(swing, -deg(bend));
  aim(s.lowerarm, s.hand, worldPos(s.lowerarm).addScaledVector(fore, a.foreLen));

  // The thumb side stays square to the forearm.
  const thumbs = thumbsToward ? thumbsToward.clone().addScaledVector(fore, -thumbsToward.dot(fore)).normalize() : fore.clone().cross(swing).normalize();
  turnTo(s.lowerarm, a.radial, fore, thumbs);
  setWorldQuat(s.hand, frame(fore, thumbs).multiply(a.handFrame.clone().invert()).multiply(a.handRest));
  a.grip.close();
  return { grip: a.grip.held(), handle: a.grip.dir() };
}

// Pose both arms with the elbows bent this far, and the upper arms this far forward.
// The right arm matches the left unless given its own.
export function poseCurlArms(curl: CurlRig, bendL: number, forwardL: number, bendR = bendL, forwardR = forwardL) {
  const { rig } = curl;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);

  const out = [curl.l, curl.r].map((a, side) => {
    const s = a.s;
    const bend = side === 0 ? bendL : bendR;
    const forward = side === 0 ? forwardL : forwardR;
    standFeet(a, HAMMER_CURL.stance, HAMMER_CURL.toeOut);

    const upper = new THREE.Vector3(s.sign * Math.sin(deg(HAMMER_CURL.armOut)), -Math.cos(deg(HAMMER_CURL.armOut)), 0);
    upper.applyAxisAngle(X, -deg(forward));
    // The elbow's hinge runs across the body, whatever the upper arm does.
    const hinge = X.clone().addScaledVector(upper, -X.dot(upper)).normalize();
    // Straight, the forearm angles out; bending, it swings in front and back in toward the shoulder.
    const straight = upper.clone().applyAxisAngle(FRONT, s.sign * deg(HAMMER_CURL.carrying));
    return holdArm(a, upper, hinge, straight, bend);
  });
  return { l: out[0], r: out[1] };
}

// Depth 0 = curled to the top, 1 = arms down, as with the presses. The right arm
// matches the left unless given its own depth.
export function poseCurl(curl: CurlRig, depth: number, depthR = depth) {
  const { lowBend, highBend, forwardAtTop } = HAMMER_CURL;
  const arm = (d: number) => [highBend + (lowBend - highBend) * d, forwardAtTop * (1 - d) ** 2] as const;
  const [bendL, forwardL] = arm(depth);
  const [bendR, forwardR] = arm(depthR);
  return poseCurlArms(curl, bendL, forwardL, bendR, forwardR);
}

export type CurlSide = "l" | "r";

// Alternating: one arm does a whole rep, quickly from down to the top and slowly back, while
// the other waits down; then they swap. `rep` is the seconds one rep takes.
export function alternateAt(seconds: number, rep: number): { side: CurlSide; depth: number } {
  const cycle = ((seconds % (2 * rep)) + 2 * rep) % (2 * rep);
  const side = cycle < rep ? "l" : "r";
  const into = side === "l" ? cycle : cycle - rep;
  return { side, depth: into === 0 ? 1 : fromBottomDepthAt(into / rep) };
}

// Where in that cycle this arm is at this depth, on its way up.
export function alternateTime(depth: number, side: CurlSide, rep: number) {
  return fromBottomTimeAt(depth) * rep + (side === "l" ? 0 : rep);
}
