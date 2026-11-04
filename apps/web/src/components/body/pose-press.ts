// Dumbbell presses on a bench, built from anatomy rather than a recording: the
// body is fixed on the bench with the feet planted, and only the arms move. Arm
// targets come from coaching cues; the shoulder, elbow, forearm and wrist each
// take only the motion that joint can make.

import * as THREE from "three";

import { readBody } from "./contact";
import { readGrip } from "./grip";
import { aim, deg, keepHinge, qx, readRig, rotateWorld, setWorldPos, setWorldQuat, twoBoneIK, worldPos, worldQuat, type Rig } from "./pose";

const HIP_HEIGHT = 0.5; // metres of the pelvis above the floor, sitting
const KNEE_AHEAD = 0.42; // metres the ankles sit in front of the hips
const STANCE = 0.25; // metres from the middle to each ankle
const TOE_OUT = 15; // degrees
const TOP_REACH = 0.985; // share of the full arm at the top: elbows stay soft
const HANDLE_TURN = -7; // degrees the wrist holds the hand off the forearm's line, splitting what's left of the handle's tilt through the lift
const DUMBBELL_DIAGONAL = 14; // degrees the handle lies along the knuckles, so the little finger reaches it too
const PALM_TURN = 30; // degrees the palms turn in from facing the feet, easier on the shoulder

// What differs between presses. Angles in degrees, distances in metres.
export type PressSpec = {
  benchAngle: number; // back pad above the floor
  neck: number; // neck bend from the chest
  shoulderBack: number; // clavicles pulled back: shoulder blades squeezed together
  shoulderDown: number; // clavicles pulled down, away from the ears
  shoulderRiseAtTop: number; // clavicles rising with the arms at the top: shoulder blades rotating up
  chestUp: number; // upper back lifting the chest
  lowForward: number; // hands in front of the shoulders at the bottom
  highForward: number; // and at the top
  lowWidth: number; // hands outside the shoulders at the bottom
  lowHeight: number; // wrists above the shoulders at the bottom
  inward: number; // how far the hands come in on the way up
  cameraTarget: [number, number, number];
};

// Hands from over the nipple line up over the upper chest. Shoulder blades stay
// pinned, since the arms stay below the head.
export const INCLINE_PRESS: PressSpec = {
  benchAngle: 30,
  neck: 2,
  shoulderBack: 18,
  shoulderDown: 4,
  shoulderRiseAtTop: 0,
  chestUp: 8,
  lowForward: 0.122,
  highForward: 0.035,
  lowWidth: 0.15,
  lowHeight: 0.1,
  inward: 0.06,
  cameraTarget: [0, 0.72, -0.05],
};

// Dumbbells from just above and in front of the shoulders up overhead. At the
// bottom the elbows are forward of the body rather than straight out to the
// sides, and the wrists come forward with them so the forearms stay upright. The
// shoulder blades can't stay pinned with the arms overhead; they rotate up with
// them, which the clavicles' rise stands for.
export const SHOULDER_PRESS: PressSpec = {
  benchAngle: 70,
  neck: 20,
  shoulderBack: 8,
  shoulderDown: 0,
  shoulderRiseAtTop: 14,
  chestUp: 4,
  lowForward: 0.13,
  highForward: 0.02,
  lowWidth: 0.13,
  lowHeight: 0.06,
  inward: 0.10,
  cameraTarget: [0, 0.88, -0.05],
};

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
type PressArms = { spec: PressSpec; rig: Rig; l: PressSide; r: PressSide };
export type PressRig = PressArms & { body: ReturnType<typeof readBody>; bench: { backOffset: number; seatY: number } };

function readSide(root: THREE.Object3D, rig: Rig, tag: "l" | "r") {
  const s = rig[tag];
  const grip = readGrip(root, rig.skin, tag, DUMBBELL.handleRadius, DUMBBELL_DIAGONAL);
  const shoulder = worldPos(s.upperarm);
  const elbow = worldPos(s.lowerarm);
  const wrist = worldPos(s.hand);
  const upper = elbow.clone().sub(shoulder);
  const fore = wrist.clone().sub(elbow);
  const palmNormal = worldPos(s.middle1).sub(wrist).cross(grip.dir()).normalize();
  const thumbSide = worldPos(root.getObjectByName(`index_01_${tag}`)!).sub(worldPos(root.getObjectByName(`pinky_01_${tag}`)!));
  return {
    s,
    grip,
    // Where the fist is at the top and bottom of the lift, found once the bench is set up.
    line: null as { high: THREE.Vector3; low: THREE.Vector3 } | null,
    upperLen: upper.length(),
    foreLen: fore.length(),
    // The elbow's hinge axis, fixed in the upper arm (as in anatomy.ts).
    hinge: fore.clone().cross(upper).normalize().applyQuaternion(worldQuat(s.upperarm).invert()),
    // Thumb side of the wrist, fixed in the forearm.
    radial: reject(thumbSide, fore.clone().normalize()).applyQuaternion(worldQuat(s.lowerarm).invert()),
    // The hand at rest: its length and its thumb side.
    handRest: worldQuat(s.hand),
    // Across it is the way the handle lies in the palm, so the dumbbell comes out level.
    handFrame: frame(worldPos(s.middle1).sub(wrist).applyAxisAngle(palmNormal, deg(HANDLE_TURN)), grip.dir()),
    footRest: worldQuat(s.foot),
    toesRest: worldQuat(s.ball),
  };
}

// Call once with the body at rest.
export function readPressRig(root: THREE.Object3D, spec: PressSpec = INCLINE_PRESS): PressRig {
  const rig = readRig(root);
  const arms: PressArms = { spec, rig, l: readSide(root, rig, "l"), r: readSide(root, rig, "r") };
  const body = readBody(root);

  // The two ends of the dumbbell's straight line.
  const low = posePress(arms, 1);
  const high = posePress(arms, 0);
  arms.l.line = { high: high.l.grip, low: low.l.grip };
  arms.r.line = { high: high.r.grip, low: low.r.grip };

  // Fit the bench to this body: the pad touches the back, the seat the hips.
  const { n } = chestAxes(spec);
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

const recline = (spec: PressSpec) => deg(90 - spec.benchAngle);

// The chest's axes on the bench: x to the body's left, t along the torso toward
// the head, n out of the chest.
function chestAxes(spec: PressSpec) {
  const q = qx(-recline(spec));
  return {
    x: new THREE.Vector3(1, 0, 0),
    t: new THREE.Vector3(0, 1, 0).applyQuaternion(q),
    n: new THREE.Vector3(0, 0, 1).applyQuaternion(q),
  };
}

export function posePress(press: PressArms, depth: number) {
  const { rig, spec } = press;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);

  // Sitting back on the bench: the trunk reclines in one piece, chest up.
  setWorldPos(rig.pelvis, new THREE.Vector3(0, HIP_HEIGHT, 0));
  rotateWorld(rig.pelvis, qx(-recline(spec)));
  // Chest up, shoulder blades back and down into the pad.
  rotateWorld(rig.spine3, qx(-deg(spec.chestUp)));
  const { t, n } = chestAxes(spec);
  const down = spec.shoulderDown - spec.shoulderRiseAtTop * (1 - depth);
  for (const a of [press.l, press.r]) {
    const clavicle = a.s.upperarm.parent!;
    rotateWorld(clavicle, new THREE.Quaternion().setFromAxisAngle(t, a.s.sign * deg(spec.shoulderBack)));
    rotateWorld(clavicle, new THREE.Quaternion().setFromAxisAngle(n, -a.s.sign * deg(down)));
  }
  rotateWorld(rig.neck, qx(deg(spec.neck)));

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
    // The hands travel a straight line, as under a real weight. Seen from the
    // front they rise nearly straight, coming in only as far as the lift needs.
    const low = shoulder.clone();
    low.x += s.sign * spec.lowWidth;
    low.y += spec.lowHeight;
    low.z += spec.lowForward;
    const high = shoulder.clone();
    high.x = low.x - s.sign * spec.inward;
    high.z += spec.highForward;
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
      a.grip.close();
      return a.grip.at();
    };
    const thumbs = new THREE.Vector3(-s.sign, 0, 0).applyAxisAngle(UP, -s.sign * deg(PALM_TURN));

    // The dumbbell, which sits past the wrist, is what runs the straight line:
    // shift the wrist so the fist lands on the line between the lift's two ends.
    const wrist = high.clone().lerp(low, depth);
    if (a.line) {
      const target = a.line.high.clone().lerp(a.line.low, depth);
      for (let pass = 0; pass < 3; pass++) wrist.add(target.clone().sub(solve(wrist)));
    }
    return { grip: solve(wrist), handle: a.grip.dir() };
  });
  return { l: out[0], r: out[1] };
}

// Where the bench sits for this body, in world space.
export function benchLayout(press: PressRig) {
  const { t, n } = chestAxes(press.spec);
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
      rotationX: -recline(press.spec),
      size: [0.28, LENGTH, THICK] as [number, number, number],
    },
    seat: {
      position: new THREE.Vector3(0, press.bench.seatY - THICK / 2, 0.1),
      size: [0.3, THICK, 0.36] as [number, number, number],
    },
  };
}
