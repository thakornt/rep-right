// Dumbbell squat, from the owner's reference picture. The dumbbells hang from the
// shoulders, so the shoulders stay over the middle of the foot and the weights travel
// straight up and down beside the legs. The hips sit back as far as that takes, the
// trunk leans in one straight piece, the knees follow the toes, and the arms only
// open out enough for the dumbbells to pass outside the knees.

import * as THREE from "three";

import { deg, qx, readRig, rotateWorld, setWorldPos, worldPos, type Rig } from "./pose";
import { holdArm, standFeet } from "./pose-curl";
import { readSide, type PressSide } from "./pose-press";

export const DUMBBELL_SQUAT = {
  hipsDropTop: 0, // metres the hips sit below rest when standing: the stance alone keeps the knees soft
  hipsDropBottom: 0.525, // and at the bottom: the hips just below the knees
  leanBottom: 20, // degrees the trunk leans forward at the bottom; straight up when standing
  leanEase: 1.5, // the higher, the sooner the lean arrives and levels off, so the knees don't come back near the bottom
  neckBack: 0.8, // share of the lean the neck takes back, so the eyes look ahead
  armOutTop: 17, // degrees the arms hang out from the shoulders when standing, the dumbbells beside the thighs
  armOutBottom: 25, // and at the bottom, the dumbbells outside the knees
  elbowBend: 6, // degrees the elbows stay bent: not locked, not lifting
  stance: 0.17, // metres from the middle to each ankle: about shoulder width
  toeOut: 15, // degrees
  kneeOut: 4, // degrees the knees are aimed outside the toes' line, which lands them over the toes
  cameraTarget: [0, 0.87, 0] as [number, number, number], // the head clears the caption and the feet stay in frame
};

export type DumbbellSquatRig = { rig: Rig; l: PressSide; r: PressSide; hips: THREE.Vector3; midfootZ: number };

const X = new THREE.Vector3(1, 0, 0);
const FRONT = new THREE.Vector3(0, 0, 1);

// Call once with the body at rest.
export function readDumbbellSquatRig(root: THREE.Object3D): DumbbellSquatRig {
  const rig = readRig(root);
  const l = readSide(root, rig, "l");
  const r = readSide(root, rig, "r");
  const footLength = worldPos(rig.l.ball).z - worldPos(rig.l.foot).z;
  return { rig, l, r, hips: worldPos(rig.pelvis), midfootZ: rig.l.ankle.z + footLength / 2 };
}

// Depth 0 = standing, 1 = at the bottom, as with the back squat.
export function poseDumbbellSquat(squat: DumbbellSquatRig, depth: number) {
  const { rig, hips, midfootZ } = squat;
  const { hipsDropTop, hipsDropBottom, leanBottom, leanEase, neckBack, armOutTop, armOutBottom, elbowBend, stance, toeOut, kneeOut } = DUMBBELL_SQUAT;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);

  // The trunk first: it sets how far back the hips must sit to keep the shoulders over the foot.
  const lean = deg(leanBottom * (1 - (1 - depth) ** leanEase));
  setWorldPos(rig.pelvis, new THREE.Vector3(hips.x, hips.y - (hipsDropTop + (hipsDropBottom - hipsDropTop) * depth), hips.z));
  rotateWorld(rig.pelvis, qx(lean));
  rotateWorld(rig.neck, qx(-lean * neckBack));
  const shoulders = worldPos(squat.l.s.upperarm).z;
  setWorldPos(rig.pelvis, worldPos(rig.pelvis).add(new THREE.Vector3(0, 0, midfootZ - shoulders)));

  const armOut = deg(armOutTop + (armOutBottom - armOutTop) * depth);
  const out = [squat.l, squat.r].map((a) => {
    const { sign } = a.s;
    standFeet(a, stance, toeOut, kneeOut);
    const upper = new THREE.Vector3(sign * Math.sin(armOut), -Math.cos(armOut), 0);
    const hinge = X.clone().addScaledVector(upper, -X.dot(upper)).normalize();
    return holdArm(a, upper, hinge, upper, elbowBend, FRONT);
  });
  return { l: out[0], r: out[1] };
}
