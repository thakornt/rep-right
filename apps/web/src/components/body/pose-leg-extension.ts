// Machine leg extension, from the correct-form part of the owner's reference clip (2026-11-12,
// 13.6 to 18.6 seconds), with the seat and the body reclined together as the owner asked from a
// photo of the machine. Seated with the back on the pad, the thighs along the seat and the buttocks
// pulled into it, the hands reaching down to the handles that run beside the seat at its height,
// parallel to it, the wrists bent to grip them square. The
// knee lines up with the machine's pivot, so the shin pad turns with the shin. The knee starts
// bent past 90 degrees and straightens to nearly straight; nothing else moves.
//
// Depth 0 = the legs straightened (the work done), 1 = the knees bent, as with the other lifts.

import * as THREE from "three";

import { readBody } from "./contact";
import { aim, deg, keepHinge, qx, readRig, rotateWorld, setWorldPos, setWorldQuat, twoBoneIK, worldPos, worldQuat, type Rig } from "./pose";
import { frame, readSide, turnTo, type PressSide } from "./pose-press";

export const LEG_EXTENSION = {
  kneeBottom: 95, // degrees the knee is bent at the start: past 90, as the clip says, measured about 90-95
  kneeTop: 5, // degrees it is still bent at the top: straightened fully, as the owner asked (2026-11-12), short of locking
  recline: 13, // degrees the seat, the handles and the whole body tilt back together, front up: from the owner's photo, then a little further as the owner asked (2026-11-12)
  thighRise: 3, // degrees the thigh rises from the seat toward the knee
  lean: 25, // degrees the trunk leans back from square to the seat: further than the clip's 15-20, as the owner asked (2026-11-12), so the legs straighten fully
  neckForward: 0.7, // share of the lean the neck takes back forward, so the eyes stay level
  hipHeight: 0.6, // metres of the hip joints above the floor: the feet hang clear of it
  stance: 0.11, // metres from the middle to each knee: hip width, the legs parallel
  holdHandles: false, // false: the arms hang along the trunk, nearly straight, the fists in line with the forearms and the wrists straight, and each handle goes through the fist along its hole, wherever that points (owner, 2026-11-12); true: the handles run parallel to the seat and the hands reach them
  armBendFree: 30, // degrees the elbow bends when the hand isn't reaching for a handle, measured 27 between the bones (owner, 2026-11-12)
  upperArmBack: 15, // degrees the upper arm swings back from the trunk's line, the elbow pushed back (owner, 2026-11-12)
  elbowOut: 0.05, // metres the elbow sits out from the shoulder, so the upper arm clears the back's side when pushed back
  wristDown: 10, // degrees the fist tips down, toward the little finger's side (owner, 2026-11-12)
  handOut: 0.245, // metres from the middle to each wrist: the arm hangs just clear of the trunk, so the elbows stay in (owner, 2026-11-12)
  gripBack: 0.07, // metres the fist sits back along the handle from where the arm along the trunk would put it; the elbow bends a little more for it (owner, 2026-11-12)
  armBend: 15, // degrees the elbow bends: the arm hangs along the trunk's line, bent a little, as the owner asked (2026-11-12); the handle goes where the fist then is, parallel to the seat
  handleLength: 0.3, // metres: a bar along the seat's side
  shoulderDown: 10, // degrees the collarbones drop: the shoulders pressed down, pulling the body into the seat
  elbowBack: 1, // how far back, against out to the side, the elbow points when it bends: straight back, so it doesn't flare out (owner, 2026-11-12)
  padAt: 0.82, // share of the shin from the knee where the shin pad sits: low on the shin, above the ankle
  padRadius: 0.045, // metres
  shinFront: 0.03, // metres from the shin's line to its front skin, low on the shin
  padWidth: 0.36, // metres across both shins
  pivotOut: 0.27, // metres from the middle to the pivot, outside the right knee
  cameraTarget: [0, 0.62, 0.15] as [number, number, number],
  cameraReach: 0.6,
};

export type LegExtensionRig = {
  rig: Rig;
  l: PressSide;
  r: PressSide;
  seatY: number; // the seat's top, under the hip joints; it rises toward the front by the recline
  backAt: number; // metres behind the hip joints, along the trunk's front, where the back pad's face is
  knee: THREE.Vector3; // the knee joint: the machine's pivot lines up with it
  seatFront: number; // metres forward of the hips where the seat ends: at the back of the knee, so the calf clears it bent
  handles: { at: THREE.Vector3; dir: THREE.Vector3 }[]; // each handle where the fist closes on it, along the hole through the fist
};

const SEAT_BELOW_KNEE = 0.04; // metres below the knee joint where the calf begins, for the seat's edge
const CALF_REACH = 0.12; // metres behind the knee joint the calf can reach, bent
const SEAT_GAP = -0.015; // metres between the seat's edge and the calf, the knee bent most: the owner had it a little longer again, so its padded edge meets the calf
const X = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
const FRONT = new THREE.Vector3(0, 0, 1);

// Call once with the body at rest.
export function readLegExtensionRig(root: THREE.Object3D): LegExtensionRig {
  const rig = readRig(root);
  const out: LegExtensionRig = { rig, l: readSide(root, rig, "l"), r: readSide(root, rig, "r"), seatY: 0, backAt: 0, knee: new THREE.Vector3(), seatFront: 0, handles: [] };

  // Fit the seat and the back pad to this body as it sits.
  poseLegExtension(out, 1);
  const body = readBody(root);
  const p = new THREE.Vector3();
  const hip = worldPos(rig.pelvis);
  const chest = FRONT.clone().applyAxisAngle(X, -deg(LEG_EXTENSION.lean + LEG_EXTENSION.recline));
  const slope = Math.tan(deg(LEG_EXTENSION.recline));
  let seatY = Infinity;
  let back = Infinity;
  body.part.forEach((part, i) => {
    if (part !== "core") return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    seatY = Math.min(seatY, p.y - slope * p.z);
    if (p.y > hip.y + 0.15) back = Math.min(back, p.clone().sub(hip).dot(chest));
  });
  out.seatY = seatY;
  out.backAt = back;
  out.knee = worldPos(rig.l.calf).setX(0);
  // The seat ends at the back of the knee: the furthest back the calf reaches below the knee,
  // with the knee bent most, less a small gap.
  let calfBack = Infinity;
  body.part.forEach((part, i) => {
    if (part !== "legL" && part !== "legR") return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    if (p.y < out.knee.y - SEAT_BELOW_KNEE && p.y > seatY + slope * p.z - 0.15 && p.z > out.knee.z - CALF_REACH) calfBack = Math.min(calfBack, p.z);
  });
  out.seatFront = calfBack - SEAT_GAP;
  // Now the seat is known, where the fists close on the handles.
  const held = poseLegExtension(out, 1);
  out.handles = [held.l, held.r].map((h) => ({ at: h.grip.clone(), dir: h.handle.clone() }));
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  root.updateMatrixWorld(true);
  return out;
}

// The knee's bend at a depth: straightening is the lift.
// The seat's line, front up by the recline, and its top's height at a distance forward of the hips.
export const seatDir = () => new THREE.Vector3(0, Math.sin(deg(LEG_EXTENSION.recline)), Math.cos(deg(LEG_EXTENSION.recline)));
export const seatTopAt = (ext: LegExtensionRig, z: number) => ext.seatY + Math.tan(deg(LEG_EXTENSION.recline)) * z;

export const kneeBendAt = (depth: number) => LEG_EXTENSION.kneeTop + (LEG_EXTENSION.kneeBottom - LEG_EXTENSION.kneeTop) * depth;

export function poseLegExtension(ext: LegExtensionRig, depth: number) {
  const { rig } = ext;
  const P = LEG_EXTENSION;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);

  // Seated, leaning back on the pad in one piece, the seat reclined under it; the eyes stay level.
  setWorldPos(rig.pelvis, new THREE.Vector3(0, P.hipHeight, 0));
  rotateWorld(rig.pelvis, qx(-deg(P.lean + P.recline)));
  rotateWorld(rig.neck, qx(deg((P.lean + P.recline) * P.neckForward)));

  // The shoulders press down, pulling the body into the seat.
  const trunkFront = FRONT.clone().applyAxisAngle(X, -deg(P.lean + P.recline));
  for (const a of [ext.l, ext.r]) rotateWorld(a.s.upperarm.parent!, new THREE.Quaternion().setFromAxisAngle(trunkFront, a.s.sign * deg(P.shoulderDown)));

  // The thigh lies along the seat, the shin turns about the knee.
  const thighAngle = deg(P.thighRise + P.recline);
  const shinAngle = thighAngle - deg(kneeBendAt(depth));
  const thighDir = new THREE.Vector3(0, Math.sin(thighAngle), Math.cos(thighAngle));
  const shinDir = new THREE.Vector3(0, Math.sin(shinAngle), Math.cos(shinAngle));
  // The front of the shin: square to it, on the knee's front side.
  const shinFront = new THREE.Vector3(0, Math.cos(shinAngle), -Math.sin(shinAngle));
  let pad = new THREE.Vector3();

  const hands = [ext.l, ext.r].map((a) => {
    const s = a.s;
    const hip = worldPos(s.thigh);
    const knee = hip.clone().setX(s.sign * P.stance).addScaledVector(thighDir, s.thighLen);
    const ankle = knee.clone().addScaledVector(shinDir, s.shinLen);
    twoBoneIK(s.thigh, s.calf, s.foot, s.thighLen, s.shinLen, ankle, UP.clone().add(FRONT));
    keepHinge(s, ankle);
    pad = worldPos(s.calf).addScaledVector(shinDir, s.shinLen * P.padAt).addScaledVector(shinFront, P.shinFront + P.padRadius).setX(0);

    // The arm hangs along the trunk's line, the elbow bent a little and pointing back, and the
    // hand closes on a handle that runs parallel to the seat, thumb forward along it. The handle
    // goes where the fist is. The fist closes square to the handle; the wrist bends sideways,
    // toward the little finger, to keep it so.
    const along = seatDir();
    const shoulder = worldPos(s.upperarm);
    const trunkDown = new THREE.Vector3(0, -Math.cos(deg(P.lean + P.recline)), Math.sin(deg(P.lean + P.recline)));
    const bend = P.holdHandles ? P.armBend : P.armBendFree;
    const reach = Math.sqrt(a.upperLen ** 2 + a.foreLen ** 2 + 2 * a.upperLen * a.foreLen * Math.cos(deg(bend)));
    const sideways = s.sign * P.handOut - shoulder.x;
    const wrist = shoulder.clone().addScaledVector(trunkDown, Math.sqrt(Math.max(0, reach ** 2 - sideways ** 2)));
    wrist.x = s.sign * P.handOut;
    // Then back along the handle's line, the fist sliding back on it at the same height.
    if (P.holdHandles) wrist.addScaledVector(along, -P.gripBack);
    const elbowAim = new THREE.Vector3(s.sign * (1 - P.elbowBack), 0, 0).addScaledVector(trunkDown.clone().applyAxisAngle(X, Math.PI / 2), P.elbowBack).normalize();
    twoBoneIK(s.upperarm, s.lowerarm, s.hand, a.upperLen, a.foreLen, wrist, elbowAim);
    if (!P.holdHandles) {
      // The upper arm swings back from the trunk's line, the elbow pushed back, and the forearm
      // comes forward of it by the bend: worked out joint by joint, then reached with the arm.
      const upperDir = trunkDown.clone().applyAxisAngle(X, deg(P.upperArmBack));
      const elbowAt = shoulder.clone().addScaledVector(upperDir, a.upperLen);
      elbowAt.x = shoulder.x + s.sign * P.elbowOut;
      const foreDir = upperDir.clone().applyAxisAngle(X, -deg(P.armBendFree));
      const free = elbowAt.clone().addScaledVector(foreDir, a.foreLen);
      free.x = s.sign * P.handOut;
      const towardElbow = elbowAt.clone().sub(shoulder.clone().lerp(free, 0.5));
      twoBoneIK(s.upperarm, s.lowerarm, s.hand, a.upperLen, a.foreLen, free, towardElbow);
      wrist.copy(free);
    }
    const fore = wrist.clone().sub(worldPos(s.lowerarm)).normalize();
    if (!P.holdHandles) {
      // No handle: the hand stays in line with the forearm, the wrist straight, the thumb
      // forward, the fingers closed in a loose fist.
      const elbow = worldPos(s.lowerarm);
      const upper = elbow.clone().sub(shoulder).normalize();
      turnTo(s.upperarm, a.hinge, upper, fore.clone().cross(upper).normalize());
      aim(s.lowerarm, s.hand, wrist);
      turnTo(s.lowerarm, a.radial, worldPos(s.hand).sub(worldPos(s.lowerarm)).normalize(), along);
      // The fist tips down, toward the little finger's side, about the axis through the palm.
      const thumbSide = a.radial.clone().applyQuaternion(worldQuat(s.lowerarm));
      const palmAxis = fore.clone().cross(thumbSide).normalize();
      rotateWorld(s.hand, new THREE.Quaternion().setFromAxisAngle(palmAxis, -deg(P.wristDown)));
      a.grip.close();
      return { grip: a.grip.at(), handle: a.grip.dir() };
    }
    // The hand's length lies square to the handle, turned about it toward the forearm.
    const long = fore.clone().addScaledVector(along, -fore.dot(along)).normalize();
    let handQ = frame(long, along).multiply(a.handFrame.clone().invert()).multiply(a.handRest);
    // Then turn it so the hole through the closed fist, which crosses the palm on a slight
    // diagonal, lies exactly along the handle, parallel to the seat.
    setWorldQuat(s.hand, handQ);
    a.grip.close();
    const hole = a.grip.dir();
    if (hole.dot(along) < 0) hole.negate();
    rotateWorld(s.hand, new THREE.Quaternion().setFromUnitVectors(hole.normalize(), along));
    handQ = worldQuat(s.hand);
    const elbow = worldPos(s.lowerarm);
    const upper = elbow.clone().sub(shoulder).normalize();
    // The elbow is a hinge: square the upper arm to the arm's plane.
    turnTo(s.upperarm, a.hinge, upper, fore.clone().cross(upper).normalize());
    aim(s.lowerarm, s.hand, wrist);
    // The forearm turns the thumb forward; the wrist takes up the rest.
    turnTo(s.lowerarm, a.radial, worldPos(s.hand).sub(worldPos(s.lowerarm)).normalize(), along);
    setWorldQuat(s.hand, handQ);
    a.grip.close();
    return { grip: a.grip.at(), handle: a.grip.dir() };
  });
  return { l: hands[0], r: hands[1], pad, shinAngle };
}

