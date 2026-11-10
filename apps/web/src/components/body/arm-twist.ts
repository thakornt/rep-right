// Twist bones for the upper arm. The model has none, so a turn of the upper arm about its own length
// was all taken by the skin where the arm meets the shoulder: with the arm overhead and turned far
// (137 degrees from rest, raising one arm behind the head), that skin pinched to a thin band, as if
// the shoulder hung on a strip of skin. Here, once at load, a few bones are added inside each upper
// arm, all at the shoulder, and the arm's skin is shared among them by how far along the arm it sits.
// Each frame they undo part of the arm's turn: none at the elbow, all of it at the shoulder, so the
// turn spreads evenly along the arm. Bending and raising the arm are left as they were.

import * as THREE from "three";

const LEVELS = 4; // twist bones per arm: the turn changes by a quarter of it from one to the next
const FROM = -0.1; // share of the arm's length, from the shoulder, where the skin starts taking the turn
const TO = 0.85; // and where it has all of it
const DONE = "armTwistAdded";

const name = (tag: string, level: number) => `upperarm_twist${level}_${tag}`;

// Call once on the loaded model, at its bind pose, before it is cloned.
export function addArmTwist(root: THREE.Object3D) {
  if (root.userData[DONE]) return;
  root.userData[DONE] = true;
  root.updateMatrixWorld(true);
  let mesh: THREE.SkinnedMesh | undefined;
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh;
  });
  if (!mesh) throw new Error("the body has no skinned mesh");
  const skin = mesh;

  const bones = [...skin.skeleton.bones];
  const inverses = skin.skeleton.boneInverses.map((m) => m.clone());
  const { position, skinIndex, skinWeight } = skin.geometry.attributes;
  const p = new THREE.Vector3();

  for (const tag of ["l", "r"]) {
    const upper = root.getObjectByName(`upperarm_${tag}`) as THREE.Bone;
    const lower = root.getObjectByName(`lowerarm_${tag}`)!;
    const at = bones.indexOf(upper);
    // Level 0 is the arm itself; level k undoes k / LEVELS of its turn.
    const level = [at];
    for (let k = 1; k <= LEVELS; k++) {
      const b = new THREE.Bone();
      b.name = name(tag, k);
      upper.add(b);
      level.push(bones.length);
      bones.push(b);
      inverses.push(inverses[at].clone());
    }
    const shoulder = upper.getWorldPosition(new THREE.Vector3());
    const along = lower.getWorldPosition(new THREE.Vector3()).sub(shoulder);
    const length = along.length();
    along.normalize();

    for (let i = 0; i < position.count; i++) {
      let slot = -1;
      let free = -1;
      for (let k = 0; k < 4; k++) {
        const w = skinWeight.getComponent(i, k);
        if (w > 0 && skinIndex.getComponent(i, k) === at) slot = k;
        if (w === 0 && free < 0) free = k;
      }
      if (slot < 0) continue;
      p.fromBufferAttribute(position, i).applyMatrix4(skin.matrixWorld).sub(shoulder);
      const t = THREE.MathUtils.clamp((p.dot(along) / length - FROM) / (TO - FROM), 0, 1);
      const x = (1 - t) * LEVELS; // which level this skin follows, between two
      const a = Math.floor(x);
      const part = x - a;
      const w = skinWeight.getComponent(i, slot);
      if (a >= LEVELS || part === 0 || free < 0) {
        skinIndex.setComponent(i, slot, level[Math.min(LEVELS, Math.round(x))]);
        continue;
      }
      skinIndex.setComponent(i, slot, level[a]);
      skinWeight.setComponent(i, slot, w * (1 - part));
      skinIndex.setComponent(i, free, level[a + 1]);
      skinWeight.setComponent(i, free, w * part);
    }
  }
  skinIndex.needsUpdate = true;
  skinWeight.needsUpdate = true;
  skin.bind(new THREE.Skeleton(bones, inverses), skin.bindMatrix);
  root.updateMatrixWorld(true);
}

// Lifts that turn the upper arm far switch the twist bones on for their model with this; for the
// others they stay still and the arm's skin moves as it always has.
export function enableArmTwist(root: THREE.Object3D) {
  root.userData.armTwist = true;
}

// Set the twist bones from how the upper arms are turned now. `rest` is each arm's own rotation at
// rest; the model is drawn from these bones, so call before drawing or reading the skin.
export function driveArmTwist(root: THREE.Object3D, rest: Map<THREE.Object3D, THREE.Quaternion>) {
  if (!root.userData.armTwist) return;
  for (const tag of ["l", "r"]) {
    const upper = root.getObjectByName(`upperarm_${tag}`);
    const lower = root.getObjectByName(`lowerarm_${tag}`);
    const r = upper && rest.get(upper);
    if (!upper || !lower || !r) continue;
    // The arm's turn since rest, in its own frame, and the part of it about its length.
    const d = r.clone().invert().multiply(upper.quaternion);
    const axis = lower.position.clone().normalize();
    const v = new THREE.Vector3(d.x, d.y, d.z).projectOnVector(axis);
    const twist = new THREE.Quaternion(v.x, v.y, v.z, d.w).normalize();
    if (twist.w < 0) twist.set(-twist.x, -twist.y, -twist.z, -twist.w); // the short way round
    const undo = twist.invert();
    for (let k = 1; k <= LEVELS; k++) {
      const b = upper.getObjectByName(name(tag, k));
      if (!b) continue;
      b.quaternion.identity().slerp(undo, k / LEVELS);
      b.updateMatrixWorld(true);
    }
  }
}

// Each arm's rotation at rest, read from a model just loaded, for driveArmTwist.
export function armRest(root: THREE.Object3D) {
  const rest = new Map<THREE.Object3D, THREE.Quaternion>();
  for (const tag of ["l", "r"]) {
    const upper = root.getObjectByName(`upperarm_${tag}`);
    if (upper) rest.set(upper, upper.quaternion.clone());
  }
  return rest;
}

// Indices of the skin's bones that carry the upper arm: the arm and its twist bones.
export function upperArmBones(skin: THREE.SkinnedMesh, upper: THREE.Object3D) {
  const out = new Set<number>();
  skin.skeleton.bones.forEach((b, i) => {
    if (b === upper || (b.parent === upper && b.name.startsWith("upperarm_twist"))) out.add(i);
  });
  return out;
}

// Keep the twist bones following the arms whenever the model is drawn, or its skin read on the CPU
// (contact.ts calls userData.beforeSkin). Call on the model as it will be posed, at rest.
export function followArmTwist(root: THREE.Object3D) {
  const rest = armRest(root);
  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const update = mesh.skeleton.update.bind(mesh.skeleton);
    const drive = () => driveArmTwist(root, rest);
    mesh.userData.beforeSkin = drive;
    mesh.skeleton.update = () => {
      drive();
      update();
    };
  });
}
