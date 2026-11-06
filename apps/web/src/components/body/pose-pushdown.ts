// Rope triceps pushdown, from one rep measured off a side-on video the owner picked. The body
// holds one position: knees a little soft and the trunk leaning a little forward. The upper arm
// hangs still and the elbow does the lift, so the hand travels on one arc about it, from chest
// height to beside the hips. The arc turns in toward the middle, so the hands come together at
// the top and part at the bottom, where the rope ends spread. The hands hold neutral, thumbs up
// at the top and forward lower down, and the wrist gives a little each way so the fist lies along
// the rope. Near the bottom the owner's squeeze for the triceps takes over, from their reference
// photo: the wrist comes in under the shoulder seen from the front, a little ahead of it seen from
// the side so the fist clears the thigh, with the arm in one nearly straight line. The forearms turn the palms toward the floor and the wrists bend well back, so the
// hands point forward. The elbow turns out by the upper arm turning in about that line, which doesn't
// move the wrist or spread the arms. The shoulder blades stay put. The rope hangs straight from the
// pulley to the knot and on to the hands.

import * as THREE from "three";

import { deg, qx, readRig, rotateWorld, setWorldPos, worldPos, type Rig } from "./pose";
import { holdArm, standFeet } from "./pose-curl";
import { readSide, type PressSide } from "./pose-press";

export const ROPE_PUSHDOWN = {
  trunkLean: 9, // degrees the trunk leans forward from the hips, as measured; the clip rocks a degree or two either way, which this leaves out
  hipsBack: 0.01, // metres the hips sit behind the ankles: over the middle of the foot with the lean, as measured
  hipsDrop: 0.03, // metres the hips sink, softening the knees
  neckBack: 11, // degrees the neck lifts back against the lean, so the eyes look ahead and a little down
  armOut: 7, // degrees the upper arm hangs away from the trunk: elbows by the ribs, clear of them
  bendTop: 112, // degrees the elbow is bent at the top: the forearm about 22 degrees above level, the fist at the measured height
  bendBottom: 8, // and at the bottom: just short of fully straight, so the arm reads as one line, from the owner's photo
  turnIn: 24, // degrees the upper arm is turned in, turning the arc in from straight ahead: the fists come close at the top without pressing together. It holds until the squeeze
  wristTop: 15, // degrees the wrist sets toward the little finger at the top, tipping the thumb end forward: the fist lies along the rope, as measured
  wristBottom: 0, // and straight at the bottom, where the hands flare; it changes evenly between
  flareFrom: 0.55, // share of the way down where the palms start to turn and the wrists to bend back
  flareTurn: 65, // degrees the forearms turn the palms toward the floor at the very bottom, from neutral: the back of the hand faces forward and up, so the bent wrist takes the hand forward, not out
  wristBack: 55, // degrees the wrists bend back at the very bottom, from the owner's photo, inside their range of 70
  squeezeFrom: 0.2, // share of the way down where the wrist starts to come in and the elbow to turn out: early, so it stays smooth
  armOutBottom: 2.5, // degrees the arm's line is out from plumb at the very bottom, bringing the wrist under the shoulder from the front
  armForwardBottom: 2.5, // degrees it is forward of plumb then: the wrist about 5 cm ahead of the shoulder from the side, as near as the thigh allows
  elbowOutBottom: 50, // degrees the point of the elbow faces out from straight back at the very bottom; it holds at the turnIn angle before the squeeze
  stance: 0.13, // metres from the middle to each ankle
  toeOut: 8, // degrees
  pulleyHeight: 2.05, // metres above the floor, read off the cable's line in the video
  pulleyAhead: 0.5, // metres in front of the hips, the same
  strand: 0.33, // metres of rope from the knot to the top of each fist: the long end of what was measured, so the rope keeps a clear V with the arms straight
  ropeRadius: 0.014, // metres: the dumbbell handle's, so the agreed grip closes on it
  fistHalf: 0.05, // metres along the rope from the middle of the fist to where the rope leaves it
  ropeEnd: 0.022, // metres the rope carries on past the little finger to its stopper
  stopperRadius: 0.024, // metres
  cameraTarget: [0, 0.9, 0.1] as [number, number, number],
  cameraReach: 0.7, // metres either side of the middle the machine reaches
};

export type PushdownRig = { rig: Rig; l: PressSide; r: PressSide; hips: THREE.Vector3 };

const X = new THREE.Vector3(1, 0, 0);

// Call once with the body at rest.
export function readPushdownRig(root: THREE.Object3D): PushdownRig {
  const rig = readRig(root);
  return { rig, l: readSide(root, rig, "l"), r: readSide(root, rig, "r"), hips: worldPos(rig.pelvis) };
}

export const pushdownPulley = () => new THREE.Vector3(0, ROPE_PUSHDOWN.pulleyHeight, ROPE_PUSHDOWN.pulleyAhead);

// The rep's timing, as measured: down in about a third of it, up slowly. Depth at this time,
// and the time on the way down at a depth, to pick up from the slider.
const DOWN_SHARE = 0.36;
export function pushdownDepthAt(seconds: number, period: number) {
  const u = (((seconds % period) + period) % period) / period;
  return u < DOWN_SHARE ? (1 - Math.cos((Math.PI * u) / DOWN_SHARE)) / 2 : (1 + Math.cos((Math.PI * (u - DOWN_SHARE)) / (1 - DOWN_SHARE))) / 2;
}
export const pushdownTimeAt = (depth: number, period: number) => (Math.acos(1 - 2 * depth) / Math.PI) * DOWN_SHARE * period;

// Depth 0 = hands up at the chest, 1 = pressed down, as with the other lifts.
export function posePushdown(push: PushdownRig, depth: number) {
  const { rig, hips } = push;
  const P = ROPE_PUSHDOWN;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);

  // The body's one position: it does not change through the lift.
  setWorldPos(rig.pelvis, new THREE.Vector3(hips.x, hips.y - P.hipsDrop, rig.l.ankle.z - P.hipsBack));
  rotateWorld(rig.pelvis, qx(deg(P.trunkLean)));
  rotateWorld(rig.neck, qx(-deg(P.neckBack)));

  const bend = P.bendTop + (P.bendBottom - P.bendTop) * depth;
  const flare = THREE.MathUtils.smoothstep(depth, P.flareFrom, 1);
  const squeeze = THREE.MathUtils.smootherstep(depth, P.squeezeFrom, 1);
  const armOut = P.armOut + (P.armOutBottom - P.armOut) * squeeze;
  const armForward = P.armForwardBottom * squeeze;
  const elbowOut = P.turnIn + (P.elbowOutBottom - P.turnIn) * squeeze;
  const hands = [push.l, push.r].map((a) => {
    const s = a.s;
    standFeet(a, P.stance, P.toeOut);

    // Where the wrist goes: round one arc from an upper arm hanging against gravity, not the trunk.
    const hang = new THREE.Vector3(s.sign * Math.sin(deg(armOut)), -Math.cos(deg(armOut)), 0).applyAxisAngle(X, -deg(armForward));
    const swing = X.clone().addScaledVector(hang, -X.dot(hang)).normalize().applyAxisAngle(hang, s.sign * deg(P.turnIn));
    const reach = hang.clone().multiplyScalar(a.upperLen).addScaledVector(hang.clone().applyAxisAngle(swing, -deg(bend)), a.foreLen);
    // Where the elbow goes: bent that far, on the side of the line from the shoulder to the wrist that it faces.
    const length = reach.length();
    const line = reach.clone().normalize();
    const along = (a.upperLen ** 2 - a.foreLen ** 2 + length ** 2) / (2 * length);
    const faces = new THREE.Vector3(s.sign * Math.sin(deg(elbowOut)), 0, -Math.cos(deg(elbowOut)));
    faces.addScaledVector(line, -faces.dot(line)).normalize();
    const elbow = line.clone().multiplyScalar(along).addScaledVector(faces, Math.sqrt(a.upperLen ** 2 - along ** 2));
    const upper = elbow.clone().normalize();
    const fore = reach.clone().sub(elbow).normalize();
    const hinge = fore.clone().cross(upper).normalize();
    // The flare turns the thumb side in about the forearm, which is the palm turning down.
    const thumbs = fore.clone().cross(hinge).normalize().applyAxisAngle(fore, s.sign * deg(P.flareTurn * flare));
    holdArm(a, upper, hinge, upper, bend, thumbs);

    // The wrist gives evenly with the elbow, so the hand keeps going round with the forearm.
    rotateWorld(s.hand, new THREE.Quaternion().setFromAxisAngle(thumbs.clone().cross(fore).normalize(), deg(P.wristTop + (P.wristBottom - P.wristTop) * depth)));
    rotateWorld(s.hand, new THREE.Quaternion().setFromAxisAngle(thumbs.clone().multiplyScalar(s.sign).normalize(), deg(P.wristBack * flare)));
    a.grip.close();

    const grip = a.grip.held();
    const handle = a.grip.dir();
    // Thumb end first, for the rope going in at the top of the fist and out at the bottom.
    const topWard = handle.dot(thumbs) > 0 ? handle.clone() : handle.clone().negate();
    return { grip, handle, enter: grip.clone().addScaledVector(topWard, P.fistHalf), end: grip.clone().addScaledVector(topWard, -(P.fistHalf + P.ropeEnd)) };
  });

  // The knot hangs in line between the pulley and the hands, the strands pulled straight.
  const mid = hands[0].enter.clone().add(hands[1].enter).multiplyScalar(0.5);
  const up = pushdownPulley().sub(mid).normalize();
  const half = hands[0].enter.distanceTo(hands[1].enter) / 2;
  const knot = mid.addScaledVector(up, Math.sqrt(P.strand ** 2 - half ** 2));
  return { l: hands[0], r: hands[1], knot };
}
