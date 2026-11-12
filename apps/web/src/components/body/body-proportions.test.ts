// The corrected palm: shorter by the set amount, with the wrist where it was and the fingers
// keeping their own lengths, and the skin going with the bones.

import * as THREE from "three";
import { expect, test } from "vitest";

import { PALM_SHORTER, shortenPalms, THIGH_IN } from "./body-proportions";
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

// The outer thigh, measured on the model as made: how far the skin reaches out to the side from
// the hip-to-knee line, by share of the way down. Its bulge is what the owner had brought in.
const MADE_OUTER = { hip: 0.045, widest: 0.074, aboveKnee: 0.044 };
const MADE_INNER_WIDEST = 0.105; // and in toward the other leg, at its widest
const MAX_REACH_OFF = 0.003;

function reach(root: THREE.Object3D, tag: "l" | "r", from: number, to: number) {
  let mesh!: THREE.SkinnedMesh;
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh;
  });
  const sign = tag === "l" ? 1 : -1;
  const hip = at(root, `thigh_${tag}`);
  const axis = at(root, `calf_${tag}`).sub(hip);
  const length = axis.length();
  axis.normalize();
  const out = new THREE.Vector3(sign, 0, 0).addScaledVector(axis, -axis.x * sign).normalize();
  const p = new THREE.Vector3();
  let outer = 0;
  let inner = 0;
  for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
    mesh.getVertexPosition(i, p).applyMatrix4(mesh.matrixWorld);
    if (p.x * sign <= 0) continue;
    const r = p.clone().sub(hip);
    const t = r.dot(axis) / length;
    if (t < from || t > to) continue;
    r.addScaledVector(axis, -r.dot(axis));
    if (Math.abs(r.z) > 0.03) continue; // the side of the thigh, seen from the front
    outer = Math.max(outer, r.dot(out));
    inner = Math.max(inner, -r.dot(out));
  }
  return { outer, inner };
}

test.each(["l", "r"] as const)("the outer thigh on side %s comes in at its bulge, and nowhere else", async (tag) => {
  const root = await loadBody();
  expect(Math.abs(reach(root, tag, 0.3, 0.4).outer - (MADE_OUTER.widest - THIGH_IN))).toBeLessThan(MAX_REACH_OFF);
  expect(Math.abs(reach(root, tag, -0.05, 0.05).outer - MADE_OUTER.hip)).toBeLessThan(MAX_REACH_OFF);
  expect(Math.abs(reach(root, tag, 0.75, 0.85).outer - MADE_OUTER.aboveKnee)).toBeLessThan(MAX_REACH_OFF);
  expect(Math.abs(reach(root, tag, 0.3, 0.4).inner - MADE_INNER_WIDEST)).toBeLessThan(MAX_REACH_OFF);
});
