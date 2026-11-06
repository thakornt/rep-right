// Floor crunch. The body lies on its back, knees bent and feet flat. The hips and the lower back
// stay down, and the spine curls from the top: the upper back does most of it, so the shoulder
// blades come off the floor while the lower back doesn't. The neck follows only a little, and
// the fingertips rest beside the head, elbows out, so the hands don't pull on it.

import * as THREE from "three";

import { readBody } from "./contact";
import { deg, keepHinge, qx, readRig, rotateWorld, setWorldPos, setWorldQuat, twoBoneIK, worldPos, type Rig } from "./pose";
import { holdArm } from "./pose-curl";
import { frame, readSide, type PressSide } from "./pose-press";

export const CRUNCH = {
  curlLow: 7, // degrees the lowest part of the spine curls at the top: little, so the lower back stays down
  curlMiddle: 13, // and the middle
  curlHigh: 16, // and the upper back, which does most of it
  neckCurl: 10, // degrees the neck curls with it, keeping about a fist under the chin
  kneeAhead: 0.47, // metres the ankles sit toward the feet from the hips
  stance: 0.13, // metres from the middle to each ankle
  toeOut: 4, // degrees
  wristBeside: 0.22, // metres the wrist sits to the side of the neck
  wristAlong: 0.05, // metres past the neck, toward the top of the head
  wristFront: 0.02, // metres to the face's side of the neck
  tipBeside: 0.06, // metres the fingertips sit to the side of the neck: on the side of the head
  tipAlong: 0.15, // metres past the neck
  tipFront: 0.02, // metres to the face's side of the neck
  fingerCurl: 16, // degrees each finger joint bends: relaxed, not a fist
  matTop: 0.012, // metres the mat's top sits above the floor
  matWidth: 0.7, // metres
  matLength: 1.9, // metres
  cameraTarget: [0, 0.3, -0.1] as [number, number, number],
  cameraReach: 0.95, // metres either side of the middle the body reaches
};

export type CrunchRig = { rig: Rig; l: PressSide; r: PressSide; hipY: number };

const LYING = -Math.PI / 2; // the whole body, turned onto its back
const X = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
const FRONT = new THREE.Vector3(0, 0, 1);

// Call once with the body at rest.
export function readCrunchRig(root: THREE.Object3D): CrunchRig {
  const rig = readRig(root);
  const out: CrunchRig = { rig, l: readSide(root, rig, "l"), r: readSide(root, rig, "r"), hipY: 0.2 };

  // Lie it flat, then bring the back down onto the mat.
  poseCrunch(out, 1);
  const body = readBody(root);
  const p = new THREE.Vector3();
  let lowest = Infinity;
  body.part.forEach((part, i) => {
    if (part !== "core") return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    lowest = Math.min(lowest, p.y);
  });
  out.hipY += CRUNCH.matTop - lowest;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  root.updateMatrixWorld(true);
  return out;
}

// Depth 0 = curled up, 1 = lying flat, as with the other lifts.
export function poseCrunch(crunch: CrunchRig, depth: number) {
  const { rig } = crunch;
  const P = CRUNCH;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);

  setWorldPos(rig.pelvis, new THREE.Vector3(0, crunch.hipY, 0));
  rotateWorld(rig.pelvis, qx(LYING));

  const curl = 1 - depth;
  rotateWorld(rig.spine1, qx(deg(P.curlLow * curl)));
  rotateWorld(rig.spine2, qx(deg(P.curlMiddle * curl)));
  rotateWorld(rig.spine3, qx(deg(P.curlHigh * curl)));
  rotateWorld(rig.neck, qx(deg(P.neckCurl * curl)));

  // The way the chest points, for the hands to stay beside the head as it comes up.
  const trunk = deg(P.curlLow + P.curlMiddle + P.curlHigh) * curl + LYING;
  const along = UP.clone().applyAxisAngle(X, trunk);
  const facing = FRONT.clone().applyAxisAngle(X, trunk);

  const hands = [crunch.l, crunch.r].map((a) => {
    const s = a.s;

    // Knees up, feet flat on the mat.
    const ankle = new THREE.Vector3(s.sign * P.stance, s.ankle.y + P.matTop, P.kneeAhead);
    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, s.sign * deg(P.toeOut));
    twoBoneIK(s.thigh, s.calf, s.foot, s.thighLen, s.shinLen, ankle, UP);
    keepHinge(s, ankle);
    setWorldQuat(s.foot, yaw.clone().multiply(a.footRest));
    setWorldQuat(s.ball, yaw.clone().multiply(a.toesRest));

    // The wrist beside the neck, the elbow out to the side.
    const shoulder = worldPos(s.upperarm);
    const wrist = worldPos(rig.neck)
      .addScaledVector(X, s.sign * P.wristBeside)
      .addScaledVector(along, P.wristAlong)
      .addScaledVector(facing, P.wristFront);
    const reach = wrist.clone().sub(shoulder);
    const length = reach.length();
    const line = reach.clone().normalize();
    const toElbow = (a.upperLen ** 2 - a.foreLen ** 2 + length ** 2) / (2 * length);
    const faces = X.clone().multiplyScalar(s.sign);
    faces.addScaledVector(line, -faces.dot(line)).normalize();
    const elbow = line.clone().multiplyScalar(toElbow).addScaledVector(faces, Math.sqrt(a.upperLen ** 2 - toElbow ** 2));
    const upper = elbow.clone().normalize();
    const fore = reach.clone().sub(elbow).normalize();
    const hinge = fore.clone().cross(upper).normalize();
    const bend = THREE.MathUtils.radToDeg(upper.angleTo(fore));
    const thumbs = along.clone().negate();
    holdArm(a, upper, hinge, upper, bend, thumbs);

    // holdArm closes the hand for a handle. Here it stays open and points at the side of the
    // head, the fingers relaxed, so the fingertips rest there.
    const tag = s.sign > 0 ? "l" : "r";
    const tip = worldPos(rig.neck)
      .addScaledVector(X, s.sign * P.tipBeside)
      .addScaledVector(along, P.tipAlong)
      .addScaledVector(facing, P.tipFront);
    const long = tip.sub(worldPos(s.hand)).normalize();
    setWorldQuat(s.hand, frame(long, thumbs).multiply(a.handFrame.clone().invert()).multiply(a.handRest));
    const palm = long.clone().cross(thumbs.clone().addScaledVector(long, -thumbs.dot(long)).normalize()).normalize();
    const relax = new THREE.Quaternion().setFromAxisAngle(long.clone().cross(palm).normalize(), deg(P.fingerCurl));
    for (const f of ["thumb", "index", "middle", "ring", "pinky"]) {
      for (const n of ["01", "02", "03"]) {
        const b = s.hand.getObjectByName(`${f}_${n}_${tag}`)!;
        const rest = rig.rest.get(b);
        if (rest) {
          b.quaternion.copy(rest.q);
          b.position.copy(rest.p);
        }
        b.updateMatrixWorld(true);
      }
    }
    for (const f of ["index", "middle", "ring", "pinky"]) {
      for (const n of ["01", "02", "03"]) rotateWorld(s.hand.getObjectByName(`${f}_${n}_${tag}`)!, relax);
    }
    return { grip: worldPos(s.middle1), handle: X.clone() };
  });
  return { l: hands[0], r: hands[1] };
}
