// A closed hand around a cylinder, worked out once from this body's own hand:
// the object lies across the palm at the base of the fingers, the fingers curl
// around it and the thumb closes over them. Every hand holds its object this way.

import * as THREE from "three";

const AHEAD_OF_PALM = 0.012; // metres from the middle knuckle back toward the wrist, where the axis crosses the palm
const SKIN_GIVE = 0.002; // metres the palm presses in where it holds the object
const THUMB_JOINT_AROUND = 125; // degrees around the object from straight past the knuckles, where the thumb's last joint sits
const THUMB_TIP_AROUND = 112; // and its tip, lying across the fingers
const THUMB_JOINT_BESIDE = 0.009; // metres the last joint sits to the thumb side of the index finger
const THUMB_ON_FINGERS = 0.8; // share of the thumb's thickness between its centre and the fingers' skin
const THUMB_BASE_AHEAD = 0.012; // metres the thumb's base moves toward the fingers in a fist
const THUMB_BASE_OUT = 0.01; // and out of the palm
const THUMB_PAST_INDEX = 0.014; // metres the thumb's tip crosses over from the index finger toward the middle
const FINGER_PRESS = 0.75; // share of a finger's thickness kept outside the object: a tight fist presses the skin
const PINKY_PRESS = 0.3; // the little finger is short, so it presses in further to close on the object

const FINGER_GATHER = 0.88; // fingers close up beside each other, from where the knuckles spread them
const PINKY_WRAP = 1; // share of its thickness the little finger keeps outside a handle
const PINKY_FOLD = 25; // degrees further the little finger's last joint folds over a handle
const FINGERS = ["index", "middle", "ring", "pinky"];

const pos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
const quat = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());

function point(bone: THREE.Object3D, along: THREE.Vector3, target: THREE.Vector3) {
  const to = target.clone().sub(pos(bone)).normalize();
  const turn = new THREE.Quaternion().setFromUnitVectors(along.clone().normalize(), to);
  bone.quaternion.copy(quat(bone.parent!).invert().multiply(turn).multiply(quat(bone)));
  bone.updateMatrixWorld(true);
}

export type Grip = ReturnType<typeof readGrip>;

// How a hand holds a dumbbell, agreed with the owner against photos of a real grip.
// Use this for any dumbbell lift.
export const DUMBBELL_GRIP = {
  diagonal: 7, // degrees the handle turns in the palm toward the knuckles' line. More lets the little finger reach, but the wrist bends further sideways to keep the dumbbell level
  intoPalm: 0.012, // metres the handle sits further from the fingers than they closed, toward the base of the thumb
  pinkyCup: 0.004, // metres the edge of the palm cups toward the handle, for the little finger to close on it
};

// Call with the body at rest.
export function readGrip(root: THREE.Object3D, skin: THREE.SkinnedMesh, tag: "l" | "r", radius: number, diagonal = 0, intoPalm = 0, pinkyCup = 0) {
  root.updateMatrixWorld(true);
  const bone = (name: string) => root.getObjectByName(`${name}_${tag}`)!;
  const hand = bone("hand");

  // Skin each bone owns, for its size.
  const owned = new Map<string, THREE.Vector3[]>();
  const g = skin.geometry;
  for (let i = 0; i < g.attributes.position.count; i++) {
    let best = 0;
    let at = 0;
    for (let k = 0; k < 4; k++) {
      const w = g.attributes.skinWeight.getComponent(i, k);
      if (w > best) {
        best = w;
        at = g.attributes.skinIndex.getComponent(i, k);
      }
    }
    const name = skin.skeleton.bones[at].name;
    if (!name.endsWith(`_${tag}`)) continue;
    const list = owned.get(name) ?? [];
    list.push(skin.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(skin.matrixWorld));
    owned.set(name, list);
  }
  const skinOf = (name: string) => owned.get(`${name}_${tag}`) ?? [];

  // The hand's axes: toward the fingers, across to the index, out of the palm.
  const wrist = pos(hand);
  const knuckle = (f: string) => pos(bone(`${f}_01`));
  const ahead = knuckle("middle").sub(wrist);
  const palmLength = ahead.length();
  ahead.normalize();
  const across = knuckle("index").sub(knuckle("pinky"));
  across.addScaledVector(ahead, -across.dot(ahead)).normalize();
  const palmar = ahead.clone().cross(across).normalize();
  if (pos(bone("thumb_02")).sub(wrist).dot(palmar) < 0) palmar.negate();
  // Turn the object in the palm: positive brings its index end toward the fingers.
  const tilt = (diagonal * Math.PI) / 180;
  across.addScaledVector(ahead, Math.tan(tilt)).normalize();
  ahead.addScaledVector(across, -ahead.dot(across)).normalize();

  const knuckles = FINGERS.map(knuckle);
  const mid = knuckles.reduce((a, k) => a.add(k), new THREE.Vector3()).multiplyScalar(1 / knuckles.length);
  // Palm skin beside the axis, from the middle knuckle's level.
  let palmSkin = 0;
  for (const p of skinOf("hand")) {
    const d = p.clone().sub(knuckle("middle"));
    if (Math.abs(d.dot(ahead) + AHEAD_OF_PALM) < 0.015 && Math.abs(p.clone().sub(mid).dot(across)) < 0.025) {
      palmSkin = Math.max(palmSkin, d.dot(palmar));
    }
  }
  const centre = mid
    .clone()
    .addScaledVector(ahead, knuckle("middle").sub(mid).dot(ahead) - AHEAD_OF_PALM)
    .addScaledVector(palmar, knuckle("middle").sub(mid).dot(palmar) + palmSkin + radius - SKIN_GIVE);

  // Half a finger's thickness and the length past its last joint, from its skin.
  const thickness = (f: string) => {
    const a = pos(bone(`${f}_02`));
    const dir = pos(bone(`${f}_03`)).sub(a).normalize();
    const skinHere = skinOf(`${f}_02`);
    const sum = skinHere.reduce((t, p) => {
      const w = p.clone().sub(a);
      return t + w.addScaledVector(dir, -w.dot(dir)).length();
    }, 0);
    return sum / Math.max(skinHere.length, 1);
  };
  const lastLength = (f: string) => {
    const head = pos(bone(`${f}_03`));
    const dir = head.clone().sub(pos(bone(`${f}_02`))).normalize();
    return skinOf(`${f}_03`).reduce((most, p) => Math.max(most, p.clone().sub(head).dot(dir)), 0);
  };
  const around = (w: number, r: number, angle: number) =>
    centre
      .clone()
      .addScaledVector(across, w)
      .addScaledVector(ahead, r * Math.cos(angle))
      .addScaledVector(palmar, r * Math.sin(angle));

  const midW = mid.clone().sub(centre).dot(across);
  const rest = new Map<THREE.Object3D, THREE.Quaternion>();
  const posed: THREE.Object3D[] = [];
  const keep = (b: THREE.Object3D) => {
    rest.set(b, b.quaternion.clone());
    posed.push(b);
  };

  const pinkyRest = new THREE.Vector3();
  const fingerSize = thickness("index"); // measured here: its skin stays at rest while the bones move
  const indexW = midW + (knuckle("index").sub(centre).dot(across) - midW) * FINGER_GATHER;
  // Each finger stays in its own plane across the object and wraps around it.
  for (const f of FINGERS) {
    const [b1, b2, b3] = ["01", "02", "03"].map((n) => bone(`${f}_${n}`));
    [b1, b2, b3].forEach(keep);
    // The little finger is short, so the edge of the palm cups toward the object it
    // holds, and the finger wraps that object rather than where the others closed.
    const cupped = f === "pinky" && pinkyCup > 0;
    if (cupped) {
      pinkyRest.copy(b1.position);
      b1.position.copy(hand.worldToLocal(pos(b1).addScaledVector(palmar, pinkyCup)));
      b1.updateMatrixWorld(true);
    }
    const shift = cupped ? ahead.clone().multiplyScalar(-intoPalm) : new THREE.Vector3();
    const k = pos(b1).sub(centre).sub(shift);
    const u = k.dot(ahead);
    const v = k.dot(palmar);
    const w = midW + (k.dot(across) - midW) * FINGER_GATHER;
    const r = radius + thickness(f) * (f === "pinky" ? (cupped ? PINKY_WRAP : PINKY_PRESS) : FINGER_PRESS);
    const l1 = pos(b1).distanceTo(pos(b2));
    const l2 = pos(b2).distanceTo(pos(b3));
    const l3 = Math.max(lastLength(f) - thickness(f) * 0.5, 0.01);
    const along = (b: THREE.Object3D, next: THREE.Object3D) => pos(next).sub(pos(b));
    // Where the first bone from the knuckle meets the circle around the object.
    const d = Math.hypot(u, v);
    const x = THREE.MathUtils.clamp((r * r - l1 * l1 + d * d) / (2 * d), -r, r);
    const start = Math.atan2(v, u) + Math.acos(x / r);
    const a2 = start + 2 * Math.asin(Math.min(l2 / (2 * r), 1));
    const a3 = a2 + 2 * Math.asin(Math.min(l3 / (2 * r), 1));
    point(b1, along(b1, b2), around(w, r, start).add(shift));
    point(b2, along(b2, b3), around(w, r, a2).add(shift));
    point(b3, pos(b3).sub(pos(b2)), around(w, r, a3).add(shift));
    if (cupped) {
      // Skin here can't give as a fingertip does, so fold the last joint a little past
      // the handle's surface, or the tip sticks out.
      const fold = new THREE.Quaternion().setFromAxisAngle(ahead.clone().cross(palmar).normalize(), (PINKY_FOLD * Math.PI) / 180);
      b3.quaternion.copy(quat(b3.parent!).invert().multiply(fold).multiply(quat(b3)));
      b3.updateMatrixWorld(true);
    }
  }

  const b1Rest = new THREE.Vector3();
  // In a fist the thumb's first joint comes up beside the object, and the rest of
  // the thumb lies across the first fingers, not reaching up from below.
  {
    const [b1, b2, b3] = ["01", "02", "03"].map((n) => bone(`thumb_${n}`));
    [b1, b2, b3].forEach(keep);
    const thumbSize = thickness("thumb");
    const l1 = pos(b1).distanceTo(pos(b2));
    const l2 = pos(b2).distanceTo(pos(b3));
    const last = Math.max(lastLength("thumb") - thumbSize * 0.5, 0.01);
    // Closing a fist brings the thumb's base across the palm to meet the fingers.
    b1Rest.copy(b1.position);
    const base = pos(b1).addScaledVector(ahead, THUMB_BASE_AHEAD).addScaledVector(palmar, THUMB_BASE_OUT);
    b1.position.copy(hand.worldToLocal(base.clone()));
    b1.updateMatrixWorld(true);
    const deg = THREE.MathUtils.degToRad;
    const over = radius + 2 * fingerSize * FINGER_PRESS + thumbSize * THUMB_ON_FINGERS;
    const joint = around(indexW + THUMB_JOINT_BESIDE, over, deg(THUMB_JOINT_AROUND));
    const toTip = around(indexW - THUMB_PAST_INDEX, over, deg(THUMB_TIP_AROUND)).sub(joint).normalize();
    const tip = joint.clone().addScaledVector(toTip, last);
    // The first joint: as near the object as the two bones allow, on the thumb side.
    const span = joint.clone().sub(base);
    const reach = Math.min(span.length(), l1 + l2 - 0.001);
    span.normalize();
    const closeJoint = base.clone().addScaledVector(span, reach);
    const along = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach);
    const side = across.clone().addScaledVector(span, -across.dot(span)).normalize();
    const first = base
      .clone()
      .addScaledVector(span, along)
      .addScaledVector(side, Math.sqrt(Math.max(l1 * l1 - along * along, 0)));
    point(b1, pos(b2).sub(pos(b1)), first);
    point(b2, pos(b3).sub(pos(b2)), closeJoint);
    point(b3, pos(b3).sub(pos(b2)), closeJoint.clone().add(tip.clone().sub(joint)));
  }

  // Finger bones relative to their parents, so they move with the hand.
  const closed = posed.map((b) => ({ bone: b, q: b.quaternion.clone() }));
  const thumbBase = bone("thumb_01");
  const thumbBaseClosed = thumbBase.position.clone();
  const pinkyBase = bone("pinky_01");
  const pinkyBaseClosed = pinkyBase.position.clone();
  for (const [b, q] of rest) b.quaternion.copy(q);
  thumbBase.position.copy(b1Rest);
  if (pinkyCup > 0) pinkyBase.position.copy(pinkyRest);
  root.updateMatrixWorld(true);

  const inHand = hand.worldToLocal(centre.clone());
  // The object can sit further from the fingers than they closed around.
  const heldInHand = hand.worldToLocal(centre.clone().addScaledVector(ahead, -intoPalm));
  const axisInHand = across.clone().applyQuaternion(quat(hand).invert());
  return {
    palmLength,
    // Close the fingers. Call after anything that sets them, such as a clip.
    close() {
      for (const { bone: b, q } of closed) b.quaternion.copy(q);
      thumbBase.position.copy(thumbBaseClosed);
      pinkyBase.position.copy(pinkyBaseClosed);
      hand.updateMatrixWorld(true);
    },
    // Where the fingers closed, as the hand is now.
    at: () => hand.localToWorld(inHand.clone()),
    // The object's axis.
    held: () => hand.localToWorld(heldInHand.clone()),
    dir: () => axisInHand.clone().applyQuaternion(quat(hand)).normalize(),
  };
}

export function readDumbbellGrip(root: THREE.Object3D, skin: THREE.SkinnedMesh, tag: "l" | "r", radius: number) {
  return readGrip(root, skin, tag, radius, DUMBBELL_GRIP.diagonal, DUMBBELL_GRIP.intoPalm, DUMBBELL_GRIP.pinkyCup);
}
