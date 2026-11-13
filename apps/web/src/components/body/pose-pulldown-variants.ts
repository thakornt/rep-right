// The lat pulldown's other two grips, from the owner's reference pictures (2026-11-12), on the same
// seat and thigh pads as the wide grip (pose-pulldown.ts):
//
// - Neutral grip: a close parallel handle, the palms facing each other. From the arms nearly
//   straight overhead, the handle comes down to the top of the chest while the trunk leans back
//   a little more, the elbows coming down in front of the body, close in.
// - Single arm: one D-handle in the right hand, from the owner's reference clip (2026-11-12). The
//   forearm stays in line with the cable all the way, so the hand pulls the way the cable runs and
//   the handle hangs square to it; the pull comes from the armpit, the elbow driving down in front
//   of the body, never out to the side, until the hand is by the shoulder. The trunk stays nearly
//   upright and the left hand rests on the left thigh.
//
// Depth 0 = the arms up (the stretch), 1 = pulled down, as with the wide grip.

import * as THREE from "three";

import { enableShoulderCorrectives } from "./shoulder-correctives";
import { aim, deg, keepHinge, qx, rotateWorld, setWorldPos, setWorldQuat, twoBoneIK, worldPos } from "./pose";
import { frame, readSide, turnTo, type PressSide } from "./pose-press";
import { LAT_PULLDOWN, readPulldownRig, type PulldownRig } from "./pose-pulldown";

export type PulldownGrip = "neutral" | "single";

export const PULLDOWN_NEUTRAL = {
  gripHalf: 0.065, // metres from the middle to each hand: the parallel handle's two grips
  handleTop: 1.58, // metres above the floor the hands are at the top: the arms nearly straight, not locked
  handleBottom: 1.0, // and at the bottom: the top of the chest
  aheadTop: 0.16, // metres the hands sit in front of the shoulders at the top
  aheadBottom: 0.14, // and at the bottom, clear of the chest
  leanTop: 5, // degrees the trunk leans back at the top
  leanBottom: 22, // and at the bottom: a little more than the wide grip's start, as in the picture
  elbowForwardTop: 0,
  elbowForwardBottom: 0,
  // As the single arm (owner, 2026-11-12): each elbow drives down in front of the body and the
  // forearm, seen from the side, stays on the cable's line, so the pull is the back's and not a
  // curl folding the elbow in toward the body.
  upperTopOff: 0.06, // share of the way from pointing at the pulley toward the bottom the upper arms start: nearly straight
  upperDownForward: 30, // degrees the upper arms lean forward of straight down at the bottom, as the single arm
  upperIn: -0.06, // how far the upper arms angle in toward the middle at the bottom: a little out, as the single arm, the elbows never folding in toward the body (owner, 2026-11-12)
  gripReach: 0.075, // metres from the wrist to the middle of the fist, along the hand
  pulleyAhead: 0.22,
  cameraTarget: [0, 0.95, 0.1] as [number, number, number],
  cameraReach: 0.75,
};

export const PULLDOWN_SINGLE = {
  handleTop: 1.6, // unused here: the hand follows the elbow and the cable (kept so the grips share a shape)
  handleBottom: 1.08,
  aheadTop: 0,
  aheadBottom: 0,
  leanTop: 3, // degrees the trunk leans back at the top
  leanBottom: 10, // and at the bottom: nearly upright, as in the clip
  elbowForwardTop: 0,
  elbowForwardBottom: 0,
  upperTopOff: 0.06, // share of the way from pointing at the pulley toward the bottom the upper arm starts: the arm nearly straight, not locked
  upperDownForward: 30, // degrees the upper arm leans forward of straight down at the bottom: the elbow in front of the body, as in the clip
  upperIn: -0.06, // how far the upper arm angles toward the middle at the bottom, against straight down: a little out, as the owner asked (2026-11-12), never flared
  gripReach: 0.075, // metres from the wrist to the middle of the fist, along the hand
  restOnThigh: 0.22, // metres in front of the hips the left hand rests on the thigh, just behind the pad
  palmAbove: 0.09, // metres above the thigh's top the middle of the palm sits: resting on the skin
  cameraTarget: [0, 0.95, 0.1] as [number, number, number],
  cameraReach: 0.75,
};

export type PulldownVariantRig = PulldownRig & { grip: PulldownGrip; root: THREE.Object3D; hands: { l: PressSide; r: PressSide } };

const X = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
const FRONT = new THREE.Vector3(0, 0, 1);

// Call once with the body at rest. The seat and pads fit as for the wide grip.
export function readPulldownVariantRig(root: THREE.Object3D, grip: PulldownGrip): PulldownVariantRig {
  const base = readPulldownRig(root);
  return { ...base, grip, root, hands: { l: readSide(root, base.rig, "l"), r: readSide(root, base.rig, "r") } };
}

export const variantPulley = (grip: PulldownGrip) =>
  grip === "single"
    ? new THREE.Vector3(0, LAT_PULLDOWN.pulleyHeight, LAT_PULLDOWN.pulleyAhead)
    : new THREE.Vector3(0, LAT_PULLDOWN.pulleyHeight, PULLDOWN_NEUTRAL.pulleyAhead);

// The hand closes on a handle along `along`, its length following the forearm, the wrist straight.
// `fixed`: the line is the handle's own, shared by both hands, so it isn't turned to each forearm.
function holdAlong(a: PressSide, handle: THREE.Vector3, along: THREE.Vector3, elbowAim: THREE.Vector3, fixed = false) {
  const s = a.s;
  let long = UP.clone();
  let wrist = new THREE.Vector3();
  let handQ = new THREE.Quaternion();
  // The handle hangs free from the cable, so it turns square to the forearm.
  let line = along.clone();
  for (let pass = 0; pass < 3; pass++) {
    line = fixed ? along.clone().normalize() : along.clone().addScaledVector(long, -along.dot(long)).normalize();
    const square = long.clone().addScaledVector(line, -long.dot(line)).normalize();
    handQ = frame(square, line).multiply(a.handFrame.clone().invert()).multiply(a.handRest);
    setWorldQuat(s.hand, handQ);
    a.grip.close();
    wrist = handle.clone().sub(a.grip.at().sub(worldPos(s.hand)));
    twoBoneIK(s.upperarm, s.lowerarm, s.hand, a.upperLen, a.foreLen, wrist, elbowAim);
    long = wrist.clone().sub(worldPos(s.lowerarm)).normalize();
  }
  const shoulder = worldPos(s.upperarm);
  const elbow = worldPos(s.lowerarm);
  const upper = elbow.clone().sub(shoulder).normalize();
  const fore = wrist.clone().sub(elbow).normalize();
  turnTo(s.upperarm, a.hinge, upper, fore.clone().cross(upper).normalize());
  aim(s.lowerarm, s.hand, wrist);
  turnTo(s.lowerarm, a.radial, fore, line);
  setWorldQuat(s.hand, handQ);
  a.grip.close();
  return { grip: a.grip.at(), handle: a.grip.dir() };
}

// The direction a share t of the way round from a to b, on the great circle between them.
function slerpDir(a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const angle = a.angleTo(b);
  return a.clone().multiplyScalar(Math.sin((1 - t) * angle)).addScaledVector(b, Math.sin(t * angle)).divideScalar(Math.sin(angle)).normalize();
}

export function posePulldownVariant(pull: PulldownVariantRig, depth: number) {
  const { rig } = pull;
  // Each grip has its own shoulder shape, sculpted at its top (shoulder-correctives.ts). The single
  // arm's on the neutral grip, its arms pointing the same way, flared both lats out and tore the left
  // shoulder's back, where the posed skin sits up to 2 cm off the right's mirror image (2026-11-13).
  enableShoulderCorrectives(pull.root, pull.grip === "single" ? "pulldownSingle" : "pulldownNeutral");
  const P = LAT_PULLDOWN;
  const V = pull.grip === "single" ? PULLDOWN_SINGLE : PULLDOWN_NEUTRAL;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);

  // Seated as for the wide grip, leaning back in one piece as the handle comes down.
  const lean = deg(V.leanTop + (V.leanBottom - V.leanTop) * depth);
  setWorldPos(rig.pelvis, new THREE.Vector3(0, P.hipHeight, 0));
  rotateWorld(rig.pelvis, qx(-lean));
  rotateWorld(rig.spine3, qx(-deg(P.chestUp)));
  rotateWorld(rig.neck, qx(lean * P.neckForward));
  const chest = qx(-lean);
  const along = UP.clone().applyQuaternion(chest);
  const out = FRONT.clone().applyQuaternion(chest);
  const pulling = pull.grip === "single" ? [pull.hands.r] : [pull.hands.l, pull.hands.r];
  for (const a of pulling) {
    const clavicle = a.s.upperarm.parent!;
    const rise = P.shoulderRiseTop * (1 - depth) - P.shoulderDownBottom * depth;
    rotateWorld(clavicle, new THREE.Quaternion().setFromAxisAngle(along, a.s.sign * deg(P.shoulderBackBottom * depth)));
    rotateWorld(clavicle, new THREE.Quaternion().setFromAxisAngle(out, a.s.sign * deg(rise)));
  }

  // Feet flat, knees over them, the thighs under the pads.
  for (const a of [pull.hands.l, pull.hands.r]) {
    const s = a.s;
    const ankle = new THREE.Vector3(s.sign * P.stance, s.ankle.y, P.kneeAhead);
    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, s.sign * deg(P.toeOut));
    twoBoneIK(s.thigh, s.calf, s.foot, s.thighLen, s.shinLen, ankle, FRONT.clone().applyQuaternion(yaw));
    keepHinge(s, ankle);
    setWorldQuat(s.foot, yaw.clone().multiply(a.footRest));
    setWorldQuat(s.ball, yaw.clone().multiply(a.toesRest));
  }

  // The handles run front to back, the palms facing in, leaning back with the trunk. With the arms
  // raised and the palms facing in, the thumbs point back, toward the face.
  const handleLine = FRONT.clone().applyQuaternion(chest).negate();

  if (pull.grip === "neutral") {
    // Each elbow's path first, down in front of the body; then the hand on its grip of the
    // handle, the forearm on the cable's line seen from the side, converging on the handle from the front.
    const N = PULLDOWN_NEUTRAL;
    const pulley = variantPulley("neutral");
    // The handle is one rigid piece: both grips lie on one line, front to back, square to the
    // cable seen from the side, the thumbs toward the face. Found from where the hands are headed.
    let gripLine = handleLine.clone();
    const held = [pull.hands.l, pull.hands.r].map((a) => {
      const shoulder = worldPos(a.s.upperarm);
      const toPulley = pulley.clone().sub(shoulder).normalize();
      const down = new THREE.Vector3(-a.s.sign * N.upperIn, -Math.cos(deg(N.upperDownForward)), Math.sin(deg(N.upperDownForward))).normalize();
      const elbowAt = shoulder.clone().addScaledVector(slerpDir(toPulley, down, N.upperTopOff + (1 - N.upperTopOff) * depth), a.upperLen);
      const reach = a.foreLen + N.gripReach;
      const across = a.s.sign * N.gripHalf - elbowAt.x;
      const side = new THREE.Vector3(0, pulley.y - elbowAt.y, pulley.z - elbowAt.z).normalize();
      const handle = elbowAt.clone().addScaledVector(side, Math.sqrt(Math.max(0, reach ** 2 - across ** 2)));
      handle.x = a.s.sign * N.gripHalf;
      const cable = pulley.clone().sub(handle.clone().setX(0));
      gripLine = new THREE.Vector3(0, -cable.z, cable.y).normalize();
      if (gripLine.dot(handleLine) < 0) gripLine.negate();
      return holdAlong(a, handle, gripLine, elbowAt.clone().sub(shoulder.clone().lerp(handle, 0.5)), true);
    });
    return { l: held[0], r: held[1], bar: held[0].grip.clone().lerp(held[1].grip, 0.5), pulley };
  }

  // One arm: the elbow's path first, from the armpit down in front of the body; then the forearm
  // points at the pulley, so the hand pulls along the cable and the fist sits on its line.
  const r = pull.hands.r;
  const S = PULLDOWN_SINGLE;
  const shoulder = worldPos(r.s.upperarm);
  const pulley = variantPulley("single");
  const toPulley = pulley.clone().sub(shoulder).normalize();
  const down = new THREE.Vector3(S.upperIn, -Math.cos(deg(S.upperDownForward)), Math.sin(deg(S.upperDownForward))).normalize();
  const upperDir = slerpDir(toPulley, down, S.upperTopOff + (1 - S.upperTopOff) * depth);
  const elbowAt = shoulder.clone().addScaledVector(upperDir, r.upperLen);
  const foreDir = pulley.clone().sub(elbowAt).normalize();
  const handle = elbowAt.clone().addScaledVector(foreDir, r.foreLen + S.gripReach);
  const right = holdAlong(r, handle, handleLine, elbowAt.clone().sub(shoulder.clone().lerp(handle, 0.5)));
  const l = pull.hands.l;
  const thighTop = pull.padY - P.padRadius;
  // The palm rests flat on the thigh, fingers forward and a little down, thumb in.
  const rest = new THREE.Vector3(P.stance, thighTop + PULLDOWN_SINGLE.palmAbove, PULLDOWN_SINGLE.restOnThigh);
  const restLong = new THREE.Vector3(0, -0.25, 1).normalize();
  const thumbIn = new THREE.Vector3(-1, 0, 0);
  const restQ = frame(restLong, thumbIn).multiply(l.handFrame.clone().invert()).multiply(l.handRest);
  setWorldQuat(l.s.hand, restQ);
  const wrist = rest.clone().sub(worldPos(l.s.middle1).sub(worldPos(l.s.hand)).multiplyScalar(0.5));
  twoBoneIK(l.s.upperarm, l.s.lowerarm, l.s.hand, l.upperLen, l.foreLen, wrist, new THREE.Vector3(0.4, 0, -1).normalize());
  const lElbow = worldPos(l.s.lowerarm);
  const lUpper = lElbow.clone().sub(worldPos(l.s.upperarm)).normalize();
  const lFore = wrist.clone().sub(lElbow).normalize();
  turnTo(l.s.upperarm, l.hinge, lUpper, lFore.clone().cross(lUpper).normalize());
  aim(l.s.lowerarm, l.s.hand, wrist);
  turnTo(l.s.lowerarm, l.radial, lFore, thumbIn);
  setWorldQuat(l.s.hand, restQ);
  return { l: { grip: rest, handle: X.clone() }, r: right, bar: right.grip.clone(), pulley };
}
