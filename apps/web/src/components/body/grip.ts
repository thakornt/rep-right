// A closed hand around a cylinder, worked out once from this body's own hand:
// the object lies across the palm at the base of the fingers, the fingers curl
// around it and the thumb closes over them. Every hand holds its object this way.

import * as THREE from "three";

const AHEAD_OF_PALM = 0.012; // metres from the middle knuckle back toward the wrist, where the axis crosses the palm
const SKIN_GIVE = 0.002; // metres the palm presses in where it holds the object
const THUMB_AROUND = 108; // degrees around the object from straight past the knuckles, where the thumb's tip lands
const THUMB_BASE_AHEAD = 0.012; // metres the thumb's base moves toward the fingers in a fist
const THUMB_BASE_OUT = 0.01; // and out of the palm
const THUMB_PAST_INDEX = 0.008; // metres the thumb's tip crosses over from the index finger toward the middle
const FINGER_PRESS = 0.75; // share of a finger's thickness kept outside the object: a tight fist presses the skin

const FINGER_GATHER = 0.88; // fingers close up beside each other, from where the knuckles spread them
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

// Call with the body at rest.
export function readGrip(root: THREE.Object3D, skin: THREE.SkinnedMesh, tag: "l" | "r", radius: number, diagonal = 0) {
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

  // Each finger stays in its own plane across the object and wraps around it.
  for (const f of FINGERS) {
    const [b1, b2, b3] = ["01", "02", "03"].map((n) => bone(`${f}_${n}`));
    [b1, b2, b3].forEach(keep);
    const k = pos(b1).sub(centre);
    const u = k.dot(ahead);
    const v = k.dot(palmar);
    const w = midW + (k.dot(across) - midW) * FINGER_GATHER;
    const r = radius + thickness(f) * FINGER_PRESS;
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
    point(b1, along(b1, b2), around(w, r, start));
    point(b2, along(b2, b3), around(w, r, a2));
    point(b3, pos(b3).sub(pos(b2)), around(w, r, a3));
  }

  const b1Rest = new THREE.Vector3();
  // The thumb comes around from the wrist side and closes over the first fingers,
  // staying outside the object all the way (a chain solved by FABRIK).
  {
    const [b1, b2, b3] = ["01", "02", "03"].map((n) => bone(`thumb_${n}`));
    [b1, b2, b3].forEach(keep);
    const thumbSize = thickness("thumb");
    const fingerSize = thickness("index");
    const wTip = knuckle("index").sub(centre).dot(across) - THUMB_PAST_INDEX;
    const chain = [pos(b1), pos(b2), pos(b3)];
    const last = Math.max(lastLength("thumb") - thumbSize * 0.5, 0.01);
    chain.push(chain[2].clone().add(chain[2].clone().sub(chain[1]).normalize().multiplyScalar(last)));
    const lengths = [0, 1, 2].map((i) => chain[i].distanceTo(chain[i + 1]));
    // Closing a fist brings the thumb's base across the palm to meet the fingers.
    b1Rest.copy(b1.position);
    const root0 = chain[0].clone().addScaledVector(ahead, THUMB_BASE_AHEAD).addScaledVector(palmar, THUMB_BASE_OUT);
    b1.position.copy(hand.worldToLocal(root0.clone()));
    b1.updateMatrixWorld(true);
    const clear = radius + thumbSize;
    // The tip lies over the first fingers on the far side of the object. Start the
    // chain bulging out from the object, so the joints bend around it.
    const over = radius + fingerSize * FINGER_PRESS * 1.6 + thumbSize * 0.6;
    const tip = around(wTip, over, THREE.MathUtils.degToRad(THUMB_AROUND));
    const out = root0.clone().lerp(tip, 0.5).sub(centre).normalize();
    chain[1].copy(root0.clone().lerp(tip, 0.35)).addScaledVector(out, 0.02);
    chain[2].copy(root0.clone().lerp(tip, 0.7)).addScaledVector(out, 0.025);
    const outside = (p: THREE.Vector3) => {
      const w = p.clone().sub(centre);
      const along = w.dot(across);
      const off = w.addScaledVector(across, -along);
      if (off.length() < clear) p.copy(centre).addScaledVector(across, along).addScaledVector(off.normalize(), clear);
    };
    for (let pass = 0; pass < 30; pass++) {
      chain[3].copy(tip);
      for (let i = 2; i >= 0; i--) {
        const dir = chain[i].clone().sub(chain[i + 1]).normalize();
        chain[i].copy(chain[i + 1]).addScaledVector(dir, lengths[i]);
        outside(chain[i]);
      }
      chain[0].copy(root0);
      for (let i = 0; i < 3; i++) {
        const dir = chain[i + 1].clone().sub(chain[i]).normalize();
        chain[i + 1].copy(chain[i]).addScaledVector(dir, lengths[i]);
      }
    }
    point(b1, pos(b2).sub(pos(b1)), chain[1]);
    point(b2, pos(b3).sub(pos(b2)), chain[2]);
    point(b3, pos(b3).sub(pos(b2)), chain[3]);
  }

  // Finger bones relative to their parents, so they move with the hand.
  const closed = posed.map((b) => ({ bone: b, q: b.quaternion.clone() }));
  const thumbBase = bone("thumb_01");
  const thumbBaseClosed = thumbBase.position.clone();
  for (const [b, q] of rest) b.quaternion.copy(q);
  thumbBase.position.copy(b1Rest);
  root.updateMatrixWorld(true);

  const inHand = hand.worldToLocal(centre.clone());
  const axisInHand = across.clone().applyQuaternion(quat(hand).invert());
  return {
    palmLength,
    // Close the fingers. Call after anything that sets them, such as a clip.
    close() {
      for (const { bone: b, q } of closed) b.quaternion.copy(q);
      thumbBase.position.copy(thumbBaseClosed);
      hand.updateMatrixWorld(true);
    },
    // The object's axis, as the hand is now.
    at: () => hand.localToWorld(inHand.clone()),
    dir: () => axisInHand.clone().applyQuaternion(quat(hand)).normalize(),
  };
}
