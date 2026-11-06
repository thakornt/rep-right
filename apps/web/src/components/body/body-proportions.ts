// The body model's palm is longer than a real one's for its height: 11.0 cm from the wrist to
// the middle knuckle, on a body 1.69 m tall, where about 9.5 is natural. Nothing else in the
// hand changes: the wrist stays, the palm compresses evenly along its length, and the fingers
// and thumb come back with it, keeping their own lengths. Done once on the loaded model, at its
// bind pose, so the skin and bones agree and every lift and grip reads the corrected hand.

import * as THREE from "three";

export const PALM_SHORTER = 0.015; // metres off the palm's length, wrist to middle knuckle

const DONE = "palmsShortened";

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
