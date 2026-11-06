// Lat pulldown with a straight bar, from a whole rep measured off a side-on video the owner
// picked. At the top the trunk is nearly upright and stretched tall with the arms nearly
// straight, the bar well out in front. Pulling, the trunk leans back steadily while the
// shoulders drop, and the bar keeps about the same distance in front of the shoulders, so it
// comes in toward the body in one sweep. The elbow comes forward and stays in front of the
// shoulder. The hands hold the bar with a thumbless grip, which asks less of the forearm.

import * as THREE from "three";

import { readBody } from "./contact";
import { readGrip } from "./grip";
import { aim, BAR_RADIUS, deg, keepHinge, qx, readRig, rotateWorld, setWorldPos, setWorldQuat, twoBoneIK, worldPos, type Rig } from "./pose";
import { frame, readSide, turnTo, type PressSide } from "./pose-press";

export const LAT_PULLDOWN = {
  gripHalf: 0.33, // metres from the middle of the bar to each fist: wider than the shoulders, not so wide the forearms leave the line of the cable
  gripDiagonal: -4, // degrees the bar turns in the palm, centring how far the wrist bends sideways through the lift
  barTop: 1.545, // metres above the floor at the top: the arms nearly straight
  barBottom: 0.98, // metres above the floor at the bottom: the collarbones. A little lower than the video by its look, but this body's arm can't fold further
  barAheadTop: 0.23, // metres the bar sits in front of the shoulders at the top, as measured
  barAheadBottom: 0.21, // and at the bottom: measured 0.19, but this body's chest needs the room
  barAheadMiddle: 0.025, // metres further through the middle, inside the measure's error, keeping the forearm near the cable
  pulleyAhead: 0.235, // metres the pulley sits in front of the hips: the cable is near upright at the top, slanting about 12 degrees at the bottom, as measured
  leanTop: 3, // degrees the trunk leans back at the top, as measured
  leanBottom: 28, // and at the bottom, as measured; it grows evenly with the bar's height
  chestUp: 6, // degrees the upper back lifts the chest
  neckForward: 0.7, // share of the lean the neck takes back, so the eyes stay level
  shoulderRiseTop: 26, // degrees the clavicles rise at the top: stretched tall, as measured, with the shoulder blades rotating up
  shoulderDownBottom: 8, // degrees they pull down at the bottom
  shoulderBackBottom: 12, // degrees they pull back at the bottom: the shoulder blades squeezing
  hipHeight: 0.52, // metres of the pelvis above the floor, seated
  kneeAhead: 0.4, // metres the ankles sit in front of the hips
  elbowSwingTop: 15, // degrees the elbow points forward of straight out at the top
  elbowSwingBottom: 65, // and at the bottom; it swings steadily between, in one direction, so its path can't double back
  elbowSwingEase: 4, // the higher, the sooner the swing happens
  handTilt: 8, // degrees the hand leans forward from upright, seen from the side, all the way
  stance: 0.17, // metres from the middle to each ankle
  toeOut: 8, // degrees
  padAhead: 0.3, // metres the thigh pads sit in front of the hips
  padRadius: 0.05, // metres
  padPress: 0.01, // metres the pads press into the thighs: locked down, no gap
  barLength: 1.2, // metres
  pulleyHeight: 2, // metres above the floor
  cameraTarget: [0, 0.85, 0.1] as [number, number, number],
  cameraReach: 0.72, // metres either side of the middle the bar reaches, with a margin
};

export type PulldownRig = {
  rig: Rig;
  l: PressSide;
  r: PressSide;
  seatY: number;
  padY: number;
};

const X = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
const FRONT = new THREE.Vector3(0, 0, 1);
const PAD_ALONG = 0.015; // metres either side of the pad's line that count as under it

// The way the elbow points from the line of the arm, for the two-bone solve: out to the side,
// swung forward and down by this many degrees.
function elbowAim(shoulder: THREE.Vector3, wrist: THREE.Vector3, sign: number, swing: number) {
  const dy = wrist.y - shoulder.y;
  const dz = wrist.z - shoulder.z;
  const apart = Math.hypot(dy, dz);
  const forwardDown = new THREE.Vector3(0, -dz / apart, dy / apart);
  return new THREE.Vector3(sign * Math.cos(deg(swing)), 0, 0).addScaledVector(forwardDown, Math.sin(deg(swing)));
}

// Call once with the body at rest.
export function readPulldownRig(root: THREE.Object3D): PulldownRig {
  const rig = readRig(root);
  const side = (tag: "l" | "r") => {
    const a = readSide(root, rig, tag);
    const grip = readGrip(root, rig.skin, tag, BAR_RADIUS, LAT_PULLDOWN.gripDiagonal, 0, 0, true);
    // Square to the bar in the palm, which sits on a diagonal: the hand's frame must carry
    // the bar's own line, or the fingers close on a line the bar doesn't lie along.
    const dir = grip.dir();
    const length = worldPos(a.s.middle1).sub(worldPos(a.s.hand));
    return { ...a, grip, handFrame: frame(length.addScaledVector(dir, -length.dot(dir)), dir) };
  };
  const out: PulldownRig = { rig, l: side("l"), r: side("r"), seatY: 0, padY: 0 };

  // Fit the seat and the pads to this body as it sits.
  posePulldown(out, 0);
  const body = readBody(root);
  const p = new THREE.Vector3();
  let seatY = Infinity;
  let thighTop = -Infinity;
  // The top of the thigh along the line the pad lies on: not the knee further on.
  body.part.forEach((part, i) => {
    if (part !== "core" && part !== "legL" && part !== "legR") return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    if (part === "core") seatY = Math.min(seatY, p.y);
    else if (Math.abs(p.z - LAT_PULLDOWN.padAhead) < PAD_ALONG) thighTop = Math.max(thighTop, p.y);
  });
  out.seatY = seatY;
  out.padY = thighTop + LAT_PULLDOWN.padRadius - LAT_PULLDOWN.padPress;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  root.updateMatrixWorld(true);
  return out;
}

export const pulleyAt = () => new THREE.Vector3(0, LAT_PULLDOWN.pulleyHeight, LAT_PULLDOWN.pulleyAhead);

export function posePulldown(pull: PulldownRig, depth: number) {
  const { rig } = pull;
  const P = LAT_PULLDOWN;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);

  // The trunk leans back in one piece from the seat, chest up.
  const lean = deg(P.leanTop + (P.leanBottom - P.leanTop) * depth);
  setWorldPos(rig.pelvis, new THREE.Vector3(0, P.hipHeight, 0));
  rotateWorld(rig.pelvis, qx(-lean));
  rotateWorld(rig.spine3, qx(-deg(P.chestUp)));
  rotateWorld(rig.neck, qx(lean * P.neckForward));

  const chest = qx(-lean);
  const along = UP.clone().applyQuaternion(chest);
  const out = FRONT.clone().applyQuaternion(chest);
  for (const a of [pull.l, pull.r]) {
    const clavicle = a.s.upperarm.parent!;
    // Up with the arms at the top; down and back as the bar comes down.
    const rise = P.shoulderRiseTop * (1 - depth) - P.shoulderDownBottom * depth;
    rotateWorld(clavicle, new THREE.Quaternion().setFromAxisAngle(along, a.s.sign * deg(P.shoulderBackBottom * depth)));
    rotateWorld(clavicle, new THREE.Quaternion().setFromAxisAngle(out, a.s.sign * deg(rise)));
  }
  // The bar keeps about the same distance in front of the shoulders, wherever they go.
  const bar = new THREE.Vector3(0, P.barTop + (P.barBottom - P.barTop) * depth, worldPos(pull.l.s.upperarm).z + P.barAheadTop + (P.barAheadBottom - P.barAheadTop) * depth + P.barAheadMiddle * Math.sin(Math.PI * depth));
  const swing = P.elbowSwingTop + (P.elbowSwingBottom - P.elbowSwingTop) * (1 - (1 - depth) ** P.elbowSwingEase);

  const hands = [pull.l, pull.r].map((a) => {
    const s = a.s;

    // Sitting with the feet flat and the knees over them.
    const ankle = new THREE.Vector3(s.sign * P.stance, s.ankle.y, P.kneeAhead);
    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, s.sign * deg(P.toeOut));
    twoBoneIK(s.thigh, s.calf, s.foot, s.thighLen, s.shinLen, ankle, FRONT.clone().applyQuaternion(yaw));
    keepHinge(s, ankle);
    setWorldQuat(s.foot, yaw.clone().multiply(a.footRest));
    setWorldQuat(s.ball, yaw.clone().multiply(a.toesRest));

    // The hand is on the bar, thumb side toward the middle, palm facing forward.
    const onBar = bar.clone().addScaledVector(X, s.sign * P.gripHalf);
    const thumbs = new THREE.Vector3(-s.sign, 0, 0);
    const shoulder = worldPos(s.upperarm);
    // The hand hangs off the bar at one steady angle, so the wrist travels with the bar on the
    // same line. Following the forearm instead, which dips and comes back, puts an S in the
    // wrist's path. The wrist takes up the difference, a little either way.
    const long = new THREE.Vector3(0, Math.cos(deg(P.handTilt)), Math.sin(deg(P.handTilt)));
    const handQ = frame(long, thumbs).multiply(a.handFrame.clone().invert()).multiply(a.handRest);
    setWorldQuat(s.hand, handQ);
    a.grip.close();
    const wrist = onBar.clone().sub(a.grip.at().sub(worldPos(s.hand)));

    twoBoneIK(s.upperarm, s.lowerarm, s.hand, a.upperLen, a.foreLen, wrist, elbowAim(shoulder, wrist, s.sign, swing));
    const elbow = worldPos(s.lowerarm);
    const upper = elbow.clone().sub(shoulder).normalize();
    const fore = wrist.clone().sub(elbow).normalize();
    // Square the upper arm to the arm's plane: the elbow is a hinge.
    turnTo(s.upperarm, a.hinge, upper, fore.clone().cross(upper).normalize());
    aim(s.lowerarm, s.hand, wrist);
    // The forearm turns the palm forward; the wrist takes up the rest.
    turnTo(s.lowerarm, a.radial, worldPos(s.hand).sub(worldPos(s.lowerarm)).normalize(), thumbs);
    setWorldQuat(s.hand, handQ);
    a.grip.close();
    return { grip: a.grip.at(), handle: a.grip.dir() };
  });
  return { l: hands[0], r: hands[1], bar };
}
