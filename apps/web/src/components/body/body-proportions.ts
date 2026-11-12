// The body model's palm is longer than a real one's for its height: 11.0 cm from the wrist to
// the middle knuckle, on a body 1.69 m tall, where about 9.5 is natural. Nothing else in the
// hand changes: the wrist stays, the palm compresses evenly along its length, and the fingers
// and thumb come back with it, keeping their own lengths. Done once on the loaded model, at its
// bind pose, so the skin and bones agree and every lift and grip reads the corrected hand.

import * as THREE from "three";

export const PALM_SHORTER = 0.015; // metres off the palm's length, wrist to middle knuckle

// The outer thigh bulges: from the hip-to-knee line it reaches 4.5 cm out at the hip, 7.4 cm a
// third of the way down and 4.4 cm above the knee. The owner had it brought in toward a straighter
// line (2026-11-12): pulled in by up to THIGH_IN at its widest, fading to nothing toward the hip
// and the knee, and toward the front and back of the thigh.
export const THIGH_IN = 0.015; // metres the outer thigh comes in at its widest
export const THIGH_WIDEST = 0.35; // share of the way from hip to knee where it's widest
const THIGH_FROM = 0.05; // share of the way down where the pull starts
const THIGH_TO = 0.8; // and where it has faded out

const DONE = "palmsShortened";
const THIGHS_DONE = "thighsSlimmed";

const pos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

export function shortenPalms(root: THREE.Object3D) {
  if (root.userData[DONE]) return;
  root.userData[DONE] = true;
  root.updateMatrixWorld(true);

  let skin: THREE.SkinnedMesh | undefined;
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skin = o as THREE.SkinnedMesh;
  });
  if (!skin) throw new Error("the body has no skinned mesh");

  const mesh = skin;
  const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
  const bones = mesh.skeleton.bones;
  const toWorld = mesh.matrixWorld;
  const toMesh = toWorld.clone().invert();
  const p = new THREE.Vector3();

  for (const tag of ["l", "r"]) {
    const hand = root.getObjectByName(`hand_${tag}`)!;
    const wrist = pos(hand);
    const toKnuckle = pos(root.getObjectByName(`middle_01_${tag}`)!).sub(wrist);
    const length = toKnuckle.length();
    const along = toKnuckle.clone().normalize();
    // How far a point comes back: nothing at the wrist, all of it from the knuckles on.
    const back = (at: THREE.Vector3) => (PALM_SHORTER * THREE.MathUtils.clamp(at.clone().sub(wrist).dot(along) / length, 0, 1));

    // The hand's own bones, by name: the hand and everything below it.
    const owned = new Set<number>();
    hand.traverse((b) => {
      const i = bones.indexOf(b as THREE.Bone);
      if (i >= 0) owned.add(i);
    });

    for (let i = 0; i < position.count; i++) {
      let moves = false;
      for (let k = 0; k < 4; k++) if (skinWeight.getComponent(i, k) > 0 && owned.has(skinIndex.getComponent(i, k))) moves = true;
      if (!moves) continue;
      p.fromBufferAttribute(position, i).applyMatrix4(toWorld);
      p.addScaledVector(along, -back(p)).applyMatrix4(toMesh);
      position.setXYZ(i, p.x, p.y, p.z);
    }

    // The fingers and thumb hang off the hand, so moving their first bones carries the rest.
    for (const child of hand.children) {
      const at = pos(child);
      at.addScaledVector(along, -back(at));
      child.position.copy(hand.worldToLocal(at));
    }
  }

  position.needsUpdate = true;
  root.updateMatrixWorld(true);
  mesh.skeleton.calculateInverses();
  root.updateMatrixWorld(true);
}

// Call once on the loaded model at its bind pose, like shortenPalms. Only the skin moves: the
// bones stay, so every pose and test reads the same joints.
export function slimThighs(root: THREE.Object3D) {
  if (root.userData[THIGHS_DONE]) return;
  root.userData[THIGHS_DONE] = true;
  root.updateMatrixWorld(true);

  let skin: THREE.SkinnedMesh | undefined;
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skin = o as THREE.SkinnedMesh;
  });
  if (!skin) throw new Error("the body has no skinned mesh");

  const mesh = skin;
  const { position, normal, skinIndex, skinWeight } = mesh.geometry.attributes;
  const bones = mesh.skeleton.bones;
  const toWorld = mesh.matrixWorld;
  const toMesh = toWorld.clone().invert();
  const p = new THREE.Vector3();
  const smooth = THREE.MathUtils.smoothstep;
  const moved: number[] = [];

  for (const [tag, sign] of [["l", 1], ["r", -1]] as const) {
    const hip = pos(root.getObjectByName(`thigh_${tag}`)!);
    const knee = pos(root.getObjectByName(`calf_${tag}`)!);
    const axis = knee.clone().sub(hip);
    const length = axis.length();
    axis.normalize();
    // Straight out to the side, square to the thigh.
    const out = new THREE.Vector3(sign, 0, 0).addScaledVector(axis, -axis.x * sign).normalize();
    const thigh = bones.findIndex((b) => b.name === `thigh_${tag}`);
    // Down the thigh: rising to full at its widest, falling to nothing above the knee.
    const along = (t: number) => (t < THIGH_WIDEST ? smooth(t, THIGH_FROM, THIGH_WIDEST) : 1 - smooth(t, THIGH_WIDEST, THIGH_TO));

    for (let i = 0; i < position.count; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (skinIndex.getComponent(i, k) === thigh) w += skinWeight.getComponent(i, k);
      if (w <= 0) continue;
      p.fromBufferAttribute(position, i).applyMatrix4(toWorld);
      const r = p.clone().sub(hip);
      const t = r.dot(axis) / length;
      const radial = r.addScaledVector(axis, -r.dot(axis)).normalize();
      // Round the thigh: all of it on the outer side, none at the front, back or inside.
      const side = smooth(radial.dot(out), 0.3, 0.9);
      const by = THIGH_IN * along(t) * side * w;
      if (by <= 0) continue;
      p.addScaledVector(out, -by).applyMatrix4(toMesh);
      position.setXYZ(i, p.x, p.y, p.z);
      moved.push(i);
    }
  }
  position.needsUpdate = true;
  // The moved skin's normals, from its new shape; the rest of the body keeps its own.
  const fresh = mesh.geometry.clone();
  fresh.computeVertexNormals();
  for (const i of moved) normal.setXYZ(i, fresh.attributes.normal.getX(i), fresh.attributes.normal.getY(i), fresh.attributes.normal.getZ(i));
  normal.needsUpdate = true;
  fresh.dispose();
}
