// The corrected palm: shorter by the set amount, with the wrist where it was and the fingers
// keeping their own lengths, and the skin going with the bones.

import * as THREE from "three";
import { expect, test } from "vitest";

import { PALM_SHORTER, shortenPalms } from "./body-proportions";
import { loadBody } from "./load-body";

const ORIGINAL_PALM = 0.11; // metres from the wrist to the middle knuckle on the model as made
const MAX_OFF = 0.001;
const MAX_SKIN_DRIFT = 0.0001; // metres the skin may be off its bind position at rest

const at = (root: THREE.Object3D, name: string) => root.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());

test.each(["l", "r"])("the palm on side %s is shorter and the fingers aren't", async (tag) => {
  const root = await loadBody();
  const palm = at(root, `hand_${tag}`).distanceTo(at(root, `middle_01_${tag}`));
  expect(Math.abs(palm - (ORIGINAL_PALM - PALM_SHORTER))).toBeLessThan(MAX_OFF);
  // The fingers' own bones never moved against each other: about their made length.
  const finger = at(root, `middle_01_${tag}`).distanceTo(at(root, `middle_02_${tag}`)) + at(root, `middle_02_${tag}`).distanceTo(at(root, `middle_03_${tag}`));
  expect(Math.abs(finger - 0.066)).toBeLessThan(MAX_OFF);
});

test("doing it twice changes nothing, and at rest the skin sits where the bones say", async () => {
  const root = await loadBody();
  const before = at(root, "middle_01_l");
  shortenPalms(root);
  expect(at(root, "middle_01_l").distanceTo(before)).toBe(0);

  let mesh!: THREE.SkinnedMesh;
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh;
  });
  mesh.skeleton.update();
  const skinned = new THREE.Vector3();
  const raw = new THREE.Vector3();
  const { position } = mesh.geometry.attributes;
  for (let i = 0; i < position.count; i++) {
    mesh.getVertexPosition(i, skinned);
    raw.fromBufferAttribute(position, i);
    expect(skinned.distanceTo(raw)).toBeLessThan(MAX_SKIN_DRIFT);
  }
});
