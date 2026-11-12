// Dumbbell Romanian deadlift, from the owner's reference clip (2026-11-11). Standing tall with a
// dumbbell in each hand in front of the thighs, palms toward the body, the lifter hinges at the
// hips: the hips push back, the knees stay soft and barely bend more, the back stays one straight
// line from the hips to the neck (no rounding, no arch), and the arms hang straight down so the
// dumbbells slide down close to the legs to about mid-shin. Balance keeps the dumbbells over the
// middle of the foot all the way. The wrong form in the clip, squatting down with a rounded back,
// is what this avoids.
//
// Depth 0 = standing, 1 = at the bottom, as with the other lifts.

import * as THREE from "three";

import { deg, qx, readRig, rotateWorld, setWorldPos, worldPos, type Rig } from "./pose";
import { holdArm, standFeet } from "./pose-curl";
import { readSide, type PressSide } from "./pose-press";

export const DUMBBELL_RDL = {
  leanBottom: 72, // degrees the back leans forward from upright at the bottom
  pelvisTuck: 26, // degrees the pelvis tips back from the back's line, so the lower back neither rounds nor arches
  kneeTop: 8, // degrees the knees are bent standing: unlocked
  kneeBottom: 42, // and at the bottom: bent more, as the owner asked (2026-11-12), still a hinge rather than a squat
  neckBack: 0.75, // share of the lean the neck lifts back, so the eyes look at the floor a little ahead
  forwardTop: 7, // degrees the arms hang forward of straight down when standing, the dumbbells in front of the thighs
  backBottom: 17, // degrees they swing back toward the legs at the bottom, keeping the dumbbells close
  armIn: 3, // degrees the arms hang in from straight down, the hands in front of the thighs
  thumbsForward: 0.35, // the thumbs turn forward of straight in, the palms facing back and a little in
  elbowBend: 4, // degrees the elbows stay bent: not locked, not pulling
  elbowTurn: 35, // degrees the elbows' pointing turns from straight out toward the back
  forearmIn: 1.5, // how far the forearms fold back in, as a share of the arm's lean out: below 2 the wrists sit outside the shoulders' line (owner, 2026-11-12)
  elbowOut: 14, // degrees the elbows bend out to the sides, the forearms coming in under them, as the owner asked (2026-11-12)
  stance: 0.12, // metres from the middle to each ankle: about hip width
  toeOut: 6, // degrees
  cameraTarget: [0, 0.75, 0.05] as [number, number, number],
  cameraReach: 0.7,
};

export type RdlRig = { rig: Rig; l: PressSide; r: PressSide; hips: THREE.Vector3; midfootZ: number; restDirs: THREE.Vector3[] };

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const X = new THREE.Vector3(1, 0, 0);
const FRONT = new THREE.Vector3(0, 0, 1);

// Call once with the body at rest.
export function readRdlRig(root: THREE.Object3D): RdlRig {
  const rig = readRig(root);
  const footLength = worldPos(rig.l.ball).z - worldPos(rig.l.foot).z;
  const chain = [rig.pelvis, rig.spine1, rig.spine2, rig.spine3, rig.neck];
  const restDirs = chain.slice(0, -1).map((b, i) => worldPos(chain[i + 1]).sub(worldPos(b)).normalize());
  return { rig, l: readSide(root, rig, "l"), r: readSide(root, rig, "r"), hips: worldPos(rig.pelvis), midfootZ: rig.l.ankle.z + footLength * 0.45, restDirs };
}

export function poseRdl(rdl: RdlRig, depth: number) {
  const P = DUMBBELL_RDL;
  const { rig, hips } = rdl;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);

  const k = THREE.MathUtils.smoothstep(depth, 0, 1) * 0.5 + depth * 0.5;
  const lean = P.leanBottom * k;
  const knee = P.kneeTop + (P.kneeBottom - P.kneeTop) * k;

  // The trunk turns forward about the hips; going down, the back straightens from its natural curves
  // into one line from the hips to the neck (no rounding, no arch), the pelvis tilting with it less
  // the tuck, so the lower back keeps a neutral shape.
  const chain = [rig.pelvis, rig.spine1, rig.spine2, rig.spine3, rig.neck];
  const along = UP.clone().applyAxisAngle(X, deg(lean));
  for (let i = 0; i < chain.length - 1; i++) {
    const now = worldPos(chain[i + 1]).sub(worldPos(chain[i])).normalize();
    const restDir = rdl.restDirs[i].clone().applyAxisAngle(X, deg(lean));
    const line = i === 0 ? along.clone().applyAxisAngle(X, -deg(P.pelvisTuck)) : along;
    const want = restDir.lerp(line, k).normalize();
    rotateWorld(chain[i], new THREE.Quaternion().setFromUnitVectors(now, want));
  }
  rotateWorld(rig.neck, qx(-deg(lean * P.neckBack)));

  // Where the hips go: up the legs from the planted ankles, the shins leaning forward `shin` degrees
  // and the knees bent `knee`. The shins lean just enough to keep the knees over the middle of the foot.
  const s = rdl.l.s;
  const ankle = new THREE.Vector3(0, s.ankle.y, s.ankle.z);
  const hipOffset = worldPos(rig.pelvis).sub(worldPos(s.thigh).add(worldPos(rdl.r.s.thigh)).multiplyScalar(0.5));
  const place = (shin: number) => {
    const shinDir = UP.clone().applyAxisAngle(X, deg(shin));
    const thighDir = shinDir.clone().applyAxisAngle(X, -deg(knee));
    const hip = ankle.clone().addScaledVector(shinDir, s.shinLen).addScaledVector(thighDir, s.thighLen);
    setWorldPos(rig.pelvis, hip.add(hipOffset).setX(hips.x));
  };
  // The knees stay over the middle of the foot all the way, seen from the side, as the owner asked
  // (2026-11-12): the shins lean just enough to bring them there.
  const kneeOver = (shin: number) => ankle.z + Math.sin(deg(shin)) * s.shinLen - rdl.midfootZ;
  let lo = -15;
  let hi = 25;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (kneeOver(mid) > 0) hi = mid;
    else lo = mid;
  }
  place((lo + hi) / 2);

  const forward = deg(P.forwardTop * (1 - k) - P.backBottom * k);
  const out = [rdl.l, rdl.r].map((a) => {
    const { sign } = a.s;
    standFeet(a, P.stance, P.toeOut);
    const upper = DOWN.clone().applyAxisAngle(X, -forward).applyAxisAngle(FRONT, sign * deg(P.elbowOut - P.armIn));
    // The elbows point out: the hinge runs front to back, so the forearm folds in toward the middle.
    // Pointing out and a little back: a hinge fully front to back would turn the shoulder in past its range.
    const axis = X.clone().multiplyScalar(Math.sin(deg(P.elbowTurn))).addScaledVector(FRONT, sign * Math.cos(deg(P.elbowTurn)));
    const hinge = axis.addScaledVector(upper, -axis.dot(upper)).normalize();
    // Palms toward the body: the thumbs point in, so the handles lie across in front of the legs.
    return holdArm(a, upper, hinge, upper, P.elbowBend + P.forearmIn * P.elbowOut, new THREE.Vector3(-sign, 0, P.thumbsForward).normalize());
  });
  return { l: out[0], r: out[1] };
}
