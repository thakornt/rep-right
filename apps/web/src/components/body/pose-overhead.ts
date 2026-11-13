// Overhead dumbbell triceps extension, standing, from the owner's reference pictures, in two
// ways the owner described:
//
// One arm (the right): the upper arm points straight up from the shoulder, leaning out only a
// little, as far as a stiff shoulder needs. It stays there; the elbow does the lift. Lowering, the
// forearm swings down behind the head and across, toward the opposite shoulder blade: working the
// right arm, the dumbbell goes down behind and to the left. The left hand rests on the hip.
//
// Two hands: both upper arms up, the elbows high and a little forward, as they naturally sit. The
// hands overlap palm on palm and cup the inside of the dumbbell's top head, the handle hanging down
// between the thumbs and first fingers. Lowering, the dumbbell goes down behind the head as far as
// the elbows allow, clear of the back of the head and the neck. At the top the arms needn't be
// quite straight: this joint doesn't straighten fully under a weight held this way.
//
// Depth 0 = arms up, 1 = dumbbell lowered, as with the presses.

import * as THREE from "three";

import { enableArmTwist } from "./arm-twist";
import { enableShoulderCorrectives } from "./shoulder-correctives";
import { readBody } from "./contact";
import { aim, deg, readRig, rotateWorld, setWorldQuat, twoBoneIK, worldPos, type Rig } from "./pose";
import { holdArm, standFeet } from "./pose-curl";
import { DUMBBELL, frame, readSide, turnTo, type PressSide } from "./pose-press";

export const OVERHEAD_ONE = {
  armOut: 3, // degrees the upper arm leans out from straight up, seen from the front or behind: near straight up at the top, as the owner asked (2026-11-11)
  armForward: 10, // degrees it leans forward, seen from the side; less and the shoulder turns out past its range
  across: 35, // degrees the forearm's way down turns from straight back toward the other side
  topBend: 6, // degrees the elbow stays bent at the top: not locked
  lowBend: 125, // degrees at the bottom: the dumbbell 3 cm off the base of the neck
  stance: 0.12, // metres from the middle to each ankle
  toeOut: 8, // degrees
  cameraTarget: [0, 1.22, 0] as [number, number, number],
};

export type OverheadRig = { root: THREE.Object3D; rig: Rig; l: PressSide; r: PressSide; waist: { l: THREE.Vector3; r: THREE.Vector3 } };

// With the arm overhead the shoulder blade turns up about 60 degrees, mostly from the clavicle
// rolling back about its own length (about 30) and partly from it rising, so the shoulder comes up
// and in toward the neck and presses into the upper trapezius, which shortens and thickens. The
// owner compared this with the clavicle rising alone and picked it (2026-11-10).
export const SHOULDER_GIRDLE = {
  rise: 28, // degrees the clavicle rises with the arm overhead
  rollBack: 30, // degrees it rolls back about its own length
  trapsBulge: 0.016, // metres the upper trapezius stands up at most
};

const UP = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);
const HAND_ON_HIP_ABOVE = 0.1; // metres above the hip joints the palm rests, on the top of the pelvis
const PALM_SKIN = 0.012; // metres from the palm's middle to the skin it rests on

// Call once with the body at rest.
export function readOverheadRig(root: THREE.Object3D): OverheadRig {
  // The arm turns far about its length overhead; without twist bones the shoulder's skin pinches.
  enableArmTwist(root);
  const rig = readRig(root);
  // Where the side of the waist is, at the height the hand rests on it.
  const y = worldPos(rig.l.thigh).y + HAND_ON_HIP_ABOVE;
  const p = new THREE.Vector3();
  let side = 0;
  let z = 0;
  const { skinIndex, skinWeight } = rig.skin.geometry.attributes;
  const bones = rig.skin.skeleton.bones;
  for (let i = 0; i < rig.skin.geometry.attributes.position.count; i++) {
    const bone = bones[skinIndex.getComponent(i, 0)].name;
    if (!/^(pelvis|spine)/.test(bone) || skinWeight.getComponent(i, 0) < 0.5) continue;
    rig.skin.getVertexPosition(i, p).applyMatrix4(rig.skin.matrixWorld);
    if (Math.abs(p.y - y) > 0.015 || p.x < side) continue;
    side = p.x;
    z = p.z;
  }
  readTraps(rig);
  return {
    rig,
    root,
    l: readSide(root, rig, "l"),
    r: readSide(root, rig, "r"),
    waist: { l: new THREE.Vector3(side, y, z), r: new THREE.Vector3(-side, y, z) },
  };
}

// The clavicle carrying the raised arm: it rises, then rolls back.
function raiseClavicle(s: Rig["l"]) {
  const clavicle = s.upperarm.parent!;
  rotateWorld(clavicle, new THREE.Quaternion().setFromAxisAngle(Z, s.sign * deg(SHOULDER_GIRDLE.rise)));
  // About its own length, so the shoulder joint stays where the rise put it; the top rolls back.
  const along = worldPos(s.upperarm).sub(worldPos(clavicle)).normalize();
  rotateWorld(clavicle, new THREE.Quaternion().setFromAxisAngle(along, -s.sign * deg(SHOULDER_GIRDLE.rollBack)));
}

// How much each vertex of the upper trapezius and the top of the shoulder stands up when the
// shoulder presses in under it, up to 1: most halfway from the neck to the shoulder joint, reaching
// over the top of the shoulder to the front where the raised arm meets it, none at the edges.
// Kept on the mesh as aTraps (left, right).
function readTraps(rig: Rig) {
  toRest(rig);
  const { skin } = rig;
  const { position, normal } = skin.geometry.attributes;
  const neck = worldPos(rig.neck);
  const span = Math.abs(worldPos(rig.l.upperarm).x) * 1.05;
  const parts = readBody(skin.parent ?? skin).part;
  const at = new Float32Array(position.count * 2);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const toWorld = new THREE.Matrix3().getNormalMatrix(skin.matrixWorld);
  for (let i = 0; i < position.count; i++) {
    if (parts[i] !== "core" && parts[i] !== "none") continue;
    skin.getVertexPosition(i, p).applyMatrix4(skin.matrixWorld);
    n.fromBufferAttribute(normal, i).applyMatrix3(toWorld).normalize();
    const u = (Math.abs(p.x) - 0.045) / (span - 0.045);
    const v = (p.y - (neck.y - 0.12)) / 0.18;
    const across = (neck.z + 0.12 - p.z) / 0.3; // from the front of the shoulder to the back
    if (u <= 0 || u >= 1 || v <= 0 || v >= 1 || across <= 0 || across >= 1) continue;
    const facing = Math.min(1, Math.max(0, 0.9 * n.y + 0.2 * Math.abs(n.x)));
    const w = Math.sin(Math.PI * u) ** 0.7 * Math.sin(Math.PI * v) * Math.sin(Math.PI * across) ** 0.6 * facing;
    if (w > 0.02) at[i * 2 + (p.x > 0 ? 0 : 1)] = Math.min(1, w * 1.5);
  }
  skin.geometry.setAttribute("aTraps", new THREE.BufferAttribute(at, 2));
}

function toRest(rig: Rig) {
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);
}

// The upper arm pointing up, leaning this far out and forward.
function upward(sign: number, out: number, forward: number) {
  return UP.clone().applyAxisAngle(Z, -sign * deg(out)).applyAxisAngle(X, deg(forward));
}

// The hand flat on the side of the waist, fingers forward and down, thumb behind, the elbow out.
function handOnHip(a: PressSide, waist: THREE.Vector3) {
  const s = a.s;
  const palm = waist.clone().addScaledVector(X, s.sign * PALM_SKIN);
  const fingers = new THREE.Vector3(0, -0.45, 1).normalize();
  // The wrist sits back from the palm's middle, along the hand.
  const wrist = palm.clone().addScaledVector(fingers, -a.grip.palmLength * 0.5);
  twoBoneIK(s.upperarm, s.lowerarm, s.hand, a.upperLen, a.foreLen, wrist, new THREE.Vector3(s.sign, 0, -0.7));
  // The elbow is a hinge: square the upper arm to the arm's plane, then aim the forearm back at the wrist.
  const shoulder = worldPos(s.upperarm);
  const elbow = worldPos(s.lowerarm);
  const upper = elbow.clone().sub(shoulder).normalize();
  turnTo(s.upperarm, a.hinge, upper, wrist.clone().sub(elbow).normalize().cross(upper).normalize());
  aim(s.lowerarm, s.hand, wrist);
  const fore = worldPos(s.hand).sub(worldPos(s.lowerarm)).normalize();
  // Palm on the body: the thumb side is up and back of the fingers, square to the palm's facing.
  const thumbs = new THREE.Vector3(s.sign, 0, 0).cross(fingers).multiplyScalar(-s.sign);
  turnTo(s.lowerarm, a.radial, fore, thumbs.clone().addScaledVector(fore, -thumbs.dot(fore)));
  setWorldQuat(s.hand, frame(fingers, thumbs).multiply(a.handFrame.clone().invert()).multiply(a.handRest));
}

// One arm, the right: depth 0 = arm up, 1 = dumbbell lowered behind the head.
export function poseOverheadOne(o: OverheadRig, depth: number) {
  enableShoulderCorrectives(o.root, false); // sculpted only for both arms (poseOverheadTwo)
  const { armOut, armForward, across, topBend, lowBend, stance, toeOut } = OVERHEAD_ONE;
  const { rig } = o;
  toRest(rig);
  const a = o.r;
  const s = a.s;
  standFeet(o.l, stance, toeOut);
  standFeet(o.r, stance, toeOut);
  raiseClavicle(s);

  const upper = upward(s.sign, armOut, armForward);
  // The forearm folds toward behind the head and across to the other side.
  const way = new THREE.Vector3(-s.sign * Math.sin(deg(across)), 0, -Math.cos(deg(across)));
  way.addScaledVector(upper, -way.dot(upper)).normalize();
  const hinge = way.clone().cross(upper).normalize();
  const bend = topBend + (lowBend - topBend) * depth;
  const held = holdArm(a, upper, hinge, upper, bend);

  handOnHip(o.l, o.waist.l);
  return { r: held, l: null };
}

export const OVERHEAD_TWO = {
  armInTop: 0, // degrees each upper arm leans in from straight up at the top, seen from the front, bringing the hands together
  armInLow: -6, // and at the bottom: leaning out, the elbows a little outside the shoulders
  armForward: 18, // degrees it leans forward, seen from the side: the elbows high and a little forward
  topBend: 35, // degrees the elbow stays bent at the top: with the hands together, the arm doesn't come straight
  lowBend: 130, // degrees at the bottom: the dumbbell 3 cm off the back of the neck
  handsApart: 0.045, // metres from the middle to each wrist's line: the hands side by side round the handle
  palmSkin: 0.012, // metres from the palm's bones to its skin, where the dumbbell's head rests
  fingerYaw: 0, // degrees the fingers turn about the handle from pointing back, toward the middle, at the top
  fingerYawLow: -40, // and at the bottom
  tiltTop: 40, // degrees the dumbbell's top leans forward from straight up, at the top
  tiltLow: 0, // and at the bottom
  cup: 45, // degrees each palm turns from facing up toward the other at the top: the two make a V under the head
  cupLow: 60, // and at the bottom
  stance: 0.12,
  toeOut: 8,
  cameraTarget: [0, 1.22, 0] as [number, number, number],
};

// Which way the palm faces: up toward the dumbbell's head, turned toward the other hand.
function palmTowards(s: Rig["l"], depth: number, hold: THREE.Vector3, tilt: number) {
  const cup = OVERHEAD_TWO.cup + (OVERHEAD_TWO.cupLow - OVERHEAD_TWO.cup) * depth;
  return hold.clone().applyAxisAngle(Z.clone().applyAxisAngle(X, deg(tilt)), s.sign * deg(cup));
}

const FINGER_SKIN = 0.009; // metres from a finger's bone to its skin
const THUMB_SKIN = 0.011;
const CURL_STEP = 2; // degrees a joint folds at a time while closing on the dumbbell
// Most each joint folds, from the knuckle out, if it meets nothing first: a loose fist.
const CURL_MOST = [70, 95, 70];

// Whether a point is within `skin` of the dumbbell: its heads or its handle.
function inDumbbell(p: THREE.Vector3, { grip, handle }: { grip: THREE.Vector3; handle: THREE.Vector3 }, skin: number) {
  const w = p.clone().sub(grip);
  const along = w.dot(handle);
  const out = w.addScaledVector(handle, -along).length();
  const head = Math.abs(Math.abs(along) - DUMBBELL.headAt) < DUMBBELL.headWidth / 2 + skin && out < DUMBBELL.headRadius + skin;
  const bar = Math.abs(along) < DUMBBELL.headAt && out < DUMBBELL.handleRadius + skin;
  return head || bar;
}

// Close each finger round the dumbbell: from the knuckle out, every joint folds toward the palm's
// side until the finger would touch the dumbbell. The thumb folds round the handle the same way.
function wrapFingers(s: Rig["l"], held: { grip: THREE.Vector3; handle: THREE.Vector3 }, palm: THREE.Vector3) {
  const tag = s.sign > 0 ? "l" : "r";
  const get = (n: string) => s.hand.getObjectByName(`${n}_${tag}`)!;
  const closest = (p: THREE.Vector3) => {
    const along = THREE.MathUtils.clamp(p.clone().sub(held.grip).dot(held.handle), -DUMBBELL.headAt, DUMBBELL.headAt);
    return held.grip.clone().addScaledVector(held.handle, along);
  };
  for (const f of ["index", "middle", "ring", "pinky", "thumb"]) {
    const thumb = f === "thumb";
    const chain = (thumb ? ["02", "03"] : ["01", "02", "03"]).map((n) => get(`${f}_${n}`));
    const skin = thumb ? THUMB_SKIN : FINGER_SKIN;
    chain.forEach((bone, j) => {
      // Points along the finger past this joint, out to its tip.
      const ahead = () => {
        const pts = chain.slice(j).map(worldPos);
        const last = chain[chain.length - 1];
        const prev = chain.length > 1 ? worldPos(chain[chain.length - 2]) : worldPos(last.parent!);
        pts.push(worldPos(last).add(worldPos(last).sub(prev).multiplyScalar(0.8)));
        const mids = pts.slice(1).map((p, i) => p.clone().lerp(pts[i], 0.5));
        return [...pts.slice(1), ...mids];
      };
      const most = CURL_MOST[thumb ? j + 1 : j];
      for (let turned = 0; turned < most; turned += CURL_STEP) {
        const at = worldPos(bone);
        const next = chain[j + 1] ? worldPos(chain[j + 1]) : ahead()[0];
        const dir = next.clone().sub(at).normalize();
        const toward = thumb ? closest(at).sub(at).normalize() : palm;
        const axis = dir.clone().cross(toward).normalize();
        if (axis.lengthSq() < 1e-6) break;
        const step = new THREE.Quaternion().setFromAxisAngle(axis, deg(CURL_STEP));
        rotateWorld(bone, step);
        if (ahead().some((p) => inDumbbell(p, held, skin))) {
          rotateWorld(bone, step.invert());
          break;
        }
      }
    });
  }
}

// Fingers straight, lying in the palm's plane: open under the dumbbell's head.
function openFingers(s: Rig["l"], palm: THREE.Vector3) {
  const tag = s.sign > 0 ? "l" : "r";
  for (const f of ["index", "middle", "ring", "pinky"]) {
    for (const [n, next] of [["01", "02"], ["02", "03"]]) {
      const bone = s.hand.getObjectByName(`${f}_${n}_${tag}`);
      const child = s.hand.getObjectByName(`${f}_${next}_${tag}`);
      if (!bone || !child) continue;
      const along = worldPos(child).sub(worldPos(bone));
      along.addScaledVector(palm, -along.dot(palm));
      aim(bone, child, worldPos(bone).add(along));
    }
  }
}

// The forearm's direction from the elbow with the elbow bent `bend` degrees from `upper`, and the
// wrist landing `apart` metres from the middle: of the two ways that can be, the one behind.
function foreTo(elbow: THREE.Vector3, upper: THREE.Vector3, foreLen: number, bend: number, apart: number) {
  const p = new THREE.Vector3(0, 0, -1).addScaledVector(upper, upper.z).normalize(); // back, square to the arm
  const q = upper.clone().cross(p).normalize();
  const c = Math.cos(deg(bend));
  const sn = Math.sin(deg(bend));
  // x of the wrist: elbow.x + foreLen (c u.x + sn (cos t p.x + sin t q.x)) = apart
  const want = (apart - elbow.x) / foreLen - c * upper.x;
  const r = sn * Math.hypot(p.x, q.x);
  const phase = Math.atan2(q.x, p.x);
  const t = phase - Math.acos(THREE.MathUtils.clamp(want / r, -1, 1));
  const t2 = phase + Math.acos(THREE.MathUtils.clamp(want / r, -1, 1));
  const at = (k: number) => upper.clone().multiplyScalar(c).addScaledVector(p, sn * Math.cos(k)).addScaledVector(q, sn * Math.sin(k));
  const a = at(t);
  const b = at(t2);
  return a.z < b.z ? a : b;
}

// Both hands under the dumbbell's top head: depth 0 = arms up, 1 = lowered behind the head.
export function poseOverheadTwo(o: OverheadRig, depth: number) {
  // Its own shoulder shape, sculpted at the bottom (shoulder-correctives.ts).
  enableShoulderCorrectives(o.root, "overheadTwo");
  const { armInTop, armInLow, armForward, topBend, lowBend, handsApart, palmSkin, stance, toeOut } = OVERHEAD_TWO;
  const { rig } = o;
  toRest(rig);
  const bend = topBend + (lowBend - topBend) * depth;
  const tilt = OVERHEAD_TWO.tiltTop + (OVERHEAD_TWO.tiltLow - OVERHEAD_TWO.tiltTop) * depth;
  const hold = UP.clone().applyAxisAngle(X, deg(tilt)); // the dumbbell's axis, up from the hands to the head they hold
  const palms: THREE.Vector3[] = [];
  const webs: THREE.Vector3[] = [];
  for (const a of [o.l, o.r]) {
    const s = a.s;
    standFeet(a, stance, toeOut);
    raiseClavicle(s);
    const shoulder = worldPos(s.upperarm);
    const upper = upward(s.sign, -(armInTop + (armInLow - armInTop) * depth), armForward);
    const elbow = shoulder.clone().addScaledVector(upper, a.upperLen);
    const fore = foreTo(elbow, upper, a.foreLen, bend, s.sign * handsApart);
    aim(s.upperarm, s.lowerarm, elbow);
    turnTo(s.upperarm, a.hinge, upper, fore.clone().cross(upper).normalize());
    aim(s.lowerarm, s.hand, elbow.clone().addScaledVector(fore, a.foreLen));

    // The palm faces up under the head, the fingers pointing back over the head, the first
    // finger's side toward the handle in the middle.
    const palm = palmTowards(s, depth, hold, tilt);
    const yaw = OVERHEAD_TWO.fingerYaw + (OVERHEAD_TWO.fingerYawLow - OVERHEAD_TWO.fingerYaw) * depth;
    const fingers = new THREE.Vector3(0, 0, -1).applyAxisAngle(hold, -s.sign * deg(yaw));
    fingers.addScaledVector(palm, -fingers.dot(palm)).normalize();
    const inward = palm.clone().cross(fingers).multiplyScalar(s.sign);
    const handQ = frame(fingers, inward).multiply(a.handFrame.clone().invert()).multiply(a.handRest);
    setWorldQuat(s.hand, handQ);
    // The forearm turns the hand: its thumb side follows the hand's, so the wrist doesn't twist.
    const tag0 = s.sign > 0 ? "l" : "r";
    const handRadial = worldPos(s.hand.getObjectByName(`index_01_${tag0}`)!).sub(worldPos(s.hand.getObjectByName(`ring_01_${tag0}`)!));
    turnTo(s.lowerarm, a.radial, fore, handRadial);
    setWorldQuat(s.hand, handQ);
    openFingers(s, palm);
    const tag = s.sign > 0 ? "l" : "r";
    const knuckle = worldPos(s.hand.getObjectByName(`middle_01_${tag}`)!);
    palms.push(worldPos(s.hand).lerp(knuckle, 0.5).addScaledVector(palm, palmSkin));
    webs.push(worldPos(s.hand.getObjectByName(`index_01_${tag}`)!).lerp(worldPos(s.hand.getObjectByName(`thumb_02_${tag}`)!), 0.5));
  }
  // The handle runs up between the hands; the top head's inner face rests on the palms.
  const web = webs[0].clone().lerp(webs[1], 0.5);
  const palmHeight = (palms[0].dot(hold) + palms[1].dot(hold)) / 2;
  const centre = web.addScaledVector(hold, palmHeight - web.dot(hold) - (DUMBBELL.headAt - DUMBBELL.headWidth / 2));
  const held = { grip: centre, handle: hold.clone() };
  for (const a of [o.l, o.r]) wrapFingers(a.s, held, palmTowards(a.s, depth, hold, tilt));
  return { l: held, r: held };
}
