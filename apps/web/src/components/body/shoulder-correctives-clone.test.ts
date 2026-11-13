// The app poses a clone of the loaded body (useBody in body-scene.tsx), not the body itself. The
// shoulder's corrective shape must reach that clone: once it didn't (its arrays were kept in
// userData, which the clone copies through JSON), and the app drew the skin with no shape at all
// while every test, posing the loaded body, passed.
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { expect, test } from "vitest";
import { loadBody } from "./load-body";
import { poseOverheadTwo, readOverheadRig } from "./pose-overhead";
import { posePulldownVariant, readPulldownVariantRig } from "./pose-pulldown-variants";
import { correctiveAt, followShoulderCorrectives } from "./shoulder-correctives";

// The largest corrective offset on the clone's skin, in centimetres.
function largest(body: THREE.Object3D) {
  let mesh: THREE.SkinnedMesh | undefined;
  body.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh;
  });
  body.updateMatrixWorld(true);
  (mesh!.userData.beforeSkin as () => void)();
  const v = new THREE.Vector3();
  let most = 0;
  for (let i = 0; i < mesh!.geometry.attributes.position.count; i++) most = Math.max(most, correctiveAt(mesh!, i, v).length());
  return most * 100;
}

test("the single-arm pulldown's shape reaches the viewer's clone", async () => {
  const body = cloneSkinned(await loadBody());
  followShoulderCorrectives(body);
  posePulldownVariant(readPulldownVariantRig(body, "single"), 0);
  expect(largest(body)).toBeGreaterThan(3);
});

test("the two-arm overhead extension's shape reaches the viewer's clone", async () => {
  const body = cloneSkinned(await loadBody());
  followShoulderCorrectives(body);
  poseOverheadTwo(readOverheadRig(body), 1);
  expect(largest(body)).toBeGreaterThan(1);
});

test("the neutral-grip pulldown's shape reaches the viewer's clone, both sides", async () => {
  const body = cloneSkinned(await loadBody());
  followShoulderCorrectives(body);
  posePulldownVariant(readPulldownVariantRig(body, "neutral"), 0);
  expect(largest(body)).toBeGreaterThan(2);
});

// The dev server reloads this module while the loaded body (and its geometry) stays cached, and the
// shapes kept for that geometry are lost with the old module: the viewer threw on the first frame
// (owner, 2026-11-13). Any geometry that carries the shape attributes but has no shapes kept for it
// gets them made again.
test("a body whose geometry has no shapes kept for it still draws them", async () => {
  const body = cloneSkinned(await loadBody());
  body.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh) m.geometry = m.geometry.clone();
  });
  followShoulderCorrectives(body);
  posePulldownVariant(readPulldownVariantRig(body, "neutral"), 0);
  expect(largest(body)).toBeGreaterThan(2);
});
