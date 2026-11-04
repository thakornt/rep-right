// Incline dumbbell press, built from anatomy rather than a recording: the body
// is fixed on the bench with the feet planted, and only the arms move. Arm
// targets come from coaching cues; the shoulder, elbow, forearm and wrist each
// take only the motion that joint can make. Finger grip comes from the squat clip.

import * as THREE from "three";

import { readBody } from "./contact";
import { aim, CLIP, deg, keepHinge, qx, readRig, rotateWorld, setWorldPos, setWorldQuat, twoBoneIK, worldPos, worldQuat, type Rig } from "./pose";

const BENCH_ANGLE = 30; // degrees of the back pad above the floor (the app's cue)
const RECLINE = deg(90 - BENCH_ANGLE);
const HIP_HEIGHT = 0.5; // metres of the pelvis above the floor, sitting
const KNEE_AHEAD = 0.42; // metres the ankles sit in front of the hips
const STANCE = 0.25; // metres from the middle to each ankle
const TOE_OUT = 15; // degrees
const NECK_UP = 2; // degrees the neck bends from the reclined chest; the head rests on the pad
const SHOULDER_BACK = 18; // degrees the clavicles pull back: shoulder blades squeezed together
const SHOULDER_DOWN = 4; // degrees they pull down, away from the ears
const CHEST_UP = 8; // degrees the upper back lifts the chest
const LOW_ALONG_CHEST = 0.14; // metres down the chest from the shoulder: the nipple line
const HIGH_ALONG_CHEST = 0.04; // metres down the chest at the top: the upper chest
const LOW_WIDTH = 0.15; // metres the hands sit outside the shoulders at the bottom
const LOW_HEIGHT = 0.10; // metres the wrists sit above the shoulders at the bottom
const INWARD = 0.06; // metres the hands come in on the way up: a slight line, never meeting
const TOP_REACH = 0.985; // share of the full arm at the top: elbows stay soft
const PALM_TURN = 30; // degrees the palms turn in from facing the feet, easier on the shoulder

// Dumbbell shape, metres.
export const DUMBBELL = { handleRadius: 0.014, handleLength: 0.16, headRadius: 0.052, headAt: 0.105, headWidth: 0.055 };

const UP = new THREE.Vector3(0, 1, 0);
const reject = (v: THREE.Vector3, axis: THREE.Vector3) => v.clone().addScaledVector(axis, -v.dot(axis)).normalize();

// Rotation with columns across, long, out (right-handed), from two directions.
function frame(long: THREE.Vector3, across: THREE.Vector3) {
  const y = long.clone().normalize();
  const x = reject(across, y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y)));
}

// Turn a bone about dir (a unit vector along it) so a direction fixed in it
// points as close to want as it can.
function turnTo(bone: THREE.Object3D, local: THREE.Vector3, dir: THREE.Vector3, want: THREE.Vector3) {
  const now = reject(local.clone().applyQuaternion(worldQuat(bone)), dir);
  const to = reject(want, dir);
  const angle = Math.atan2(now.clone().cross(to).dot(dir), now.dot(to));
  rotateWorld(bone, new THREE.Quaternion().setFromAxisAngle(dir, angle));
}

type PressSide = ReturnType<typeof readSide>;
type PressArms = { rig: Rig; l: PressSide; r: PressSide };
export type PressRig = PressArms & { body: ReturnType<typeof readBody>; bench: { backOffset: number; seatY: number } };

function readSide(root: THREE.Object3D, rig: Rig, tag: "l" | "r") {
  const s = rig[tag];
  const restOf = new Map(rig.clipBones.map((c) => [c.bone, c.rest]));
  const first = CLIP.frames[0];
  const clipWorld = (name: string) =>
    new THREE.Quaternion()
      .fromArray(first.rot[CLIP.bones.indexOf(name)])
      .multiply(restOf.get(root.getObjectByName(name)!)!);
  const shoulder = worldPos(s.upperarm);
  const elbow = worldPos(s.lowerarm);
  const wrist = worldPos(s.hand);
  const upper = elbow.clone().sub(shoulder);
  const fore = wrist.clone().sub(elbow);
  const thumbSide = worldPos(root.getObjectByName(`index_01_${tag}`)!).sub(worldPos(root.getObjectByName(`pinky_01_${tag}`)!));
  const handClipInv = clipWorld(`hand_${tag}`).invert();
  return {
    s,
    upperLen: upper.length(),
    foreLen: fore.length(),
    // The elbow's hinge axis, fixed in the upper arm (as in anatomy.ts).
    hinge: fore.clone().cross(upper).normalize().applyQuaternion(worldQuat(s.upperarm).invert()),
    // Thumb side of the wrist, fixed in the forearm.
    radial: reject(thumbSide, fore.clone().normalize()).applyQuaternion(worldQuat(s.lowerarm).invert()),
    // The hand at rest: its length and its thumb side.
    handRest: worldQuat(s.hand),
    handFrame: frame(worldPos(s.middle1).sub(wrist), thumbSide),
    footRest: worldQuat(s.foot),
    toesRest: worldQuat(s.ball),
    // The clip's closed fingers, relative to its hand.
    fingers: rig.clipBones
      .filter((c) => /^(thumb|index|middle|ring|pinky)_/.test(c.bone.name) && c.bone.name.endsWith(`_${tag}`))
      .map((c) => ({ bone: c.bone, inHand: handClipInv.clone().multiply(clipWorld(c.bone.name)) })),
  };
}

// Call once with the body at rest.
export function readPressRig(root: THREE.Object3D): PressRig {
  const rig = readRig(root);
  const arms: PressArms = { rig, l: readSide(root, rig, "l"), r: readSide(root, rig, "r") };
  const body = readBody(root);

  // Fit the bench to this body: the pad touches the back, the seat the hips.
  posePress(arms, 0);
  const { n } = chestAxes();
  const pelvis = worldPos(rig.pelvis);
  const p = new THREE.Vector3();
  let backOffset = Infinity;
  let seatY = Infinity;
  body.part.forEach((part, i) => {
    if (part !== "core") return;
    body.mesh.getVertexPosition(i, p).applyMatrix4(body.mesh.matrixWorld);
    backOffset = Math.min(backOffset, p.clone().sub(pelvis).dot(n));
    seatY = Math.min(seatY, p.y);
  });
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  root.updateMatrixWorld(true);
  return { ...arms, body, bench: { backOffset, seatY } };
}

// The chest's axes on the bench: x to the body's left, t along the torso toward
// the head, n out of the chest.
function chestAxes() {
  const q = qx(-RECLINE);
  return {
    x: new THREE.Vector3(1, 0, 0),
    t: new THREE.Vector3(0, 1, 0).applyQuaternion(q),
    n: new THREE.Vector3(0, 0, 1).applyQuaternion(q),
  };
}

export function posePress(press: PressArms, depth: number) {
  const { rig } = press;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);

  // Sitting back on the bench: the trunk reclines in one piece, chest up.
  setWorldPos(rig.pelvis, new THREE.Vector3(0, HIP_HEIGHT, 0));
  rotateWorld(rig.pelvis, qx(-RECLINE));
  // Chest up, shoulder blades back and down into the pad, held for the whole lift.
  rotateWorld(rig.spine3, qx(-deg(CHEST_UP)));
  const { t, n } = chestAxes();
  for (const a of [press.l, press.r]) {
    const clavicle = a.s.upperarm.parent!;
    rotateWorld(clavicle, new THREE.Quaternion().setFromAxisAngle(t, a.s.sign * deg(SHOULDER_BACK)));
    rotateWorld(clavicle, new THREE.Quaternion().setFromAxisAngle(n, -a.s.sign * deg(SHOULDER_DOWN)));
  }
  rotateWorld(rig.neck, qx(deg(NECK_UP)));

  // Feet flat and turned out a little, knees over the toes.
  const sides = [press.l, press.r];
  for (const a of sides) {
    const s = a.s;
    const hip = worldPos(s.thigh);
    const ankle = new THREE.Vector3(s.sign * STANCE, s.ankle.y, hip.z + KNEE_AHEAD);
    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, s.sign * deg(TOE_OUT));
    const toes = new THREE.Vector3(0, 0, 1).applyQuaternion(yaw);
    twoBoneIK(s.thigh, s.calf, s.foot, s.thighLen, s.shinLen, ankle, toes);
    keepHinge(s, ankle);
    setWorldQuat(s.foot, yaw.clone().multiply(a.footRest));
    setWorldQuat(s.ball, yaw.clone().multiply(a.toesRest));
  }

  const out = sides.map((a) => {
    const s = a.s;
    const shoulder = worldPos(s.upperarm);
    // The hands travel a straight line, as under a real weight: from over the
    // nipple line, up and slightly back to over the upper chest. Seen from the
    // front they rise nearly straight, coming in only a little.
    const low = shoulder
      .clone()
      .addScaledVector(t, -LOW_ALONG_CHEST)
      .setX(shoulder.x + s.sign * LOW_WIDTH);
    low.y = shoulder.y + LOW_HEIGHT;
    const high = shoulder.clone().addScaledVector(t, -HIGH_ALONG_CHEST);
    high.x = low.x - s.sign * INWARD;
    const reach = (a.upperLen + a.foreLen) * TOP_REACH;
    high.y = shoulder.y + Math.sqrt(reach ** 2 - (high.x - shoulder.x) ** 2 - (high.z - shoulder.z) ** 2);
    // Pose the arm with its wrist at a point; returns where the fist lands.
    const solve = (wrist: THREE.Vector3) => {
      // The elbow takes the spot closest to under the wrist, keeping the forearm
      // as upright as this line allows.
      const hint = wrist.clone().addScaledVector(UP, -a.foreLen).sub(shoulder);
      twoBoneIK(s.upperarm, s.lowerarm, s.hand, a.upperLen, a.foreLen, wrist, hint);
      // The elbow is a hinge: square the upper arm to the arm's plane, which swings
      // the forearm, then aim the forearm back at the wrist.
      const elbow = worldPos(s.lowerarm);
      const upper = elbow.clone().sub(shoulder).normalize();
      const fore = wrist.clone().sub(elbow).normalize();
      const axis = fore.clone().cross(upper).normalize();
      turnTo(s.upperarm, a.hinge, upper, axis);
      aim(s.lowerarm, s.hand, wrist);

      // Palms toward the feet, turned in a little so thumbs point toward the head;
      // the wrist stays straight, so the forearm does the turning.
      const foreNow = worldPos(s.hand).sub(worldPos(s.lowerarm)).normalize();
      turnTo(s.lowerarm, a.radial, foreNow, thumbs);
      const hand = frame(foreNow, thumbs).multiply(a.handFrame.clone().invert()).multiply(a.handRest);
      setWorldQuat(s.hand, hand);
      for (const f of a.fingers) setWorldQuat(f.bone, hand.clone().multiply(f.inHand));
      return worldPos(s.middle1).add(worldPos(s.middle3)).multiplyScalar(0.5);
    };
    const thumbs = new THREE.Vector3(-s.sign, 0, 0).applyAxisAngle(UP, -s.sign * deg(PALM_TURN));

    // The dumbbell, which sits past the wrist, is what runs the straight line: find
    // the line's ends, then shift the wrist so the fist lands on it.
    const fistHigh = solve(high);
    const fistLow = solve(low);
    const target = fistHigh.clone().lerp(fistLow, depth);
    const wrist = high.clone().lerp(low, depth);
    for (let pass = 0; pass < 2; pass++) wrist.add(target.clone().sub(solve(wrist)));
    return { grip: solve(wrist), handle: thumbs };
  });
  return { l: out[0], r: out[1] };
}

// Where the bench sits for this body, in world space.
export function benchLayout(press: PressRig) {
  const { t, n } = chestAxes();
  const pelvis = new THREE.Vector3(0, HIP_HEIGHT, 0);
  const THICK = 0.07;
  const LENGTH = 0.92;
  const FROM_HIPS = -0.02; // where the pad starts along the torso
  return {
    pad: {
      position: pelvis
        .clone()
        .addScaledVector(n, press.bench.backOffset - THICK / 2)
        .addScaledVector(t, FROM_HIPS + LENGTH / 2),
      rotationX: -RECLINE,
      size: [0.28, LENGTH, THICK] as [number, number, number],
    },
    seat: {
      position: new THREE.Vector3(0, press.bench.seatY - THICK / 2, 0.1),
      size: [0.3, THICK, 0.36] as [number, number, number],
    },
  };
}
