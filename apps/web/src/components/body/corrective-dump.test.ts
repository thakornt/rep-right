// Writes the skin as drawn at the single-arm pulldown's top, for sculpting the shoulder's corrective
// shape in Blender (tools/body/correctives/README.md). Skipped unless CORRECTIVE_DUMP names a folder.
import fs from "node:fs";
import * as THREE from "three";
import { test } from "vitest";
import { readBody } from "./contact";
import { loadBody } from "./load-body";
import { worldPos } from "./pose";
import { BODY_REGIONS } from "./body-regions";
import { armElevation } from "./shoulder-correctives";
import { posePulldownVariant, readPulldownVariantRig } from "./pose-pulldown-variants";
const OUT = (process.env.CORRECTIVE_DUMP ?? "") + "/";
test.skipIf(!process.env.CORRECTIVE_DUMP)("dump the skin for Blender", async () => {
  const root = await loadBody();
  const body = readBody(root);
  const rig = readPulldownVariantRig(root, "single");
  posePulldownVariant(rig, Number(process.env.DEPTH ?? 0));
  const mesh = body.mesh;
  (mesh.userData.beforeSkin as () => void)();
  const g = mesh.geometry;
  const n = g.attributes.position.count;
  const mush = g.getAttribute("aMush") as THREE.BufferAttribute;
  const { skinIndex, skinWeight } = g.attributes;
  const sk = mesh.skeleton;
  const toWorld = mesh.matrixWorld.clone().multiply(mesh.bindMatrixInverse);
  const mats = sk.bones.map((b, i) => toWorld.clone().multiply(b.matrixWorld).multiply(sk.boneInverses[i]).multiply(mesh.bindMatrix));
  const final = new Float32Array(n * 3), inv = new Float32Array(n * 9), rest = new Float32Array(n * 3);
  const m = new THREE.Matrix4(), l = new THREE.Matrix3(), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    m.elements.fill(0);
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k);
      if (!w) continue;
      const be = mats[skinIndex.getComponent(i, k)].elements;
      for (let j = 0; j < 16; j++) m.elements[j] += be[j] * w;
    }
    p.fromBufferAttribute(g.attributes.position, i);
    p.toArray(rest, i * 3);
    p.add(new THREE.Vector3(mush.getX(i), mush.getY(i), mush.getZ(i))).applyMatrix4(m).toArray(final, i * 3);
    l.setFromMatrix4(m).invert().toArray(inv, i * 9);
  }
  fs.writeFileSync(OUT + "final.bin", Buffer.from(final.buffer));
  fs.writeFileSync(OUT + "inv.bin", Buffer.from(inv.buffer));
  fs.writeFileSync(OUT + "rest.bin", Buffer.from(rest.buffer));
  fs.writeFileSync(OUT + "index.bin", Buffer.from(new Uint32Array(g.index!.array).buffer));
  const trunk = sk.bones.findIndex((b) => b.name === "spine_03");
  fs.writeFileSync(OUT + "trunk.json", JSON.stringify(mats[trunk].elements));
  fs.writeFileSync(OUT + "regions.bin", Buffer.from(atob(BODY_REGIONS), "latin1"));
  const j = (b: string) => worldPos(root.getObjectByName(b)!).toArray();
  fs.writeFileSync(OUT + "meta.json", JSON.stringify({ n, shoulderR: j("upperarm_r"), shoulderL: j("upperarm_l"), elbowR: j("lowerarm_r"), spine3: j("spine_03"), neck: j("neck_01"), elevation: armElevation(root, "r") }));
});
