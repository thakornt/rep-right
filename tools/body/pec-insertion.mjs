// Paints the outer end of the chest, where the pectoral muscle runs out under the front of the
// shoulder to the arm, as its own region (id 23) on the muscle map, as the owner outlined it on the
// machine chest press (2026-11-19). It was part of the front deltoid: lifts that don't call on it
// still show it as the front deltoid (body-scene.tsx), and the shoulder's skin weights treat it as
// one (shoulder-weights.ts). Run after tools/body/build.py, then tools/body/regions.mjs:
//   node tools/body/pec-insertion.mjs [--dry]

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const web = new URL("../../apps/web/", import.meta.url);
const require = createRequire(new URL("package.json", web));
const sharp = require("sharp");
const THREE = await import(new URL("node_modules/three/build/three.module.js", web));
const { GLTFLoader } = await import(new URL("node_modules/three/examples/jsm/loaders/GLTFLoader.js", web));

const DELT_FRONT = 12;
const PEC_INSERTION = 23;
const REGION_BITS = 32; // the region is the map's value mod 32; the cloth step is above it
const MIN_FRONT = Number(process.env.MIN_FRONT ?? 0); // how far the skin must face forward

const buf = readFileSync(new URL("public/models/body.glb", web));
const gltf = await new Promise((ok, no) => new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", ok, no));
let mesh;
gltf.scene.traverse((o) => { if (!mesh && o.isSkinnedMesh) mesh = o; });
gltf.scene.updateMatrixWorld(true);
const g = mesh.geometry;
const pos = g.attributes.position;
const nor = g.attributes.normal;
const uv = g.attributes.uv;
const index = g.index;
const mapPath = fileURLToPath(new URL("public/models/muscles.png", web));
const { data, info } = await sharp(mapPath).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const at = (u, v) => [u * W - 0.5, v * H - 0.5]; // as regions.mjs reads it: v runs down the image

const world = (i) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
const toWorld = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
const normalAt = (i) => new THREE.Vector3().fromBufferAttribute(nor, i).applyMatrix3(toWorld).normalize();
const regionAt = (i) => {
  const [x, y] = at(uv.getX(i), uv.getY(i));
  return data[(Math.min(H - 1, Math.max(0, Math.round(y))) * W + Math.min(W - 1, Math.max(0, Math.round(x)))) * info.channels] % REGION_BITS;
};

// The region's edges, as seen from the front, on both sides (x mirrored), straight lines rather
// than a distance from the chest, which followed the shoulder's curve and came out scalloped
// (owner, 2026-11-19). Outside: from the collarbone where the chest meets the shoulder down to the
// front of the armpit. Top and bottom: the chest's own top and lower edges carried on out, so the
// orange runs on round the corners without a notch.
const TOP = [0.157, 1.393]; // [|x|, y] metres
const BOTTOM = [0.181, 1.3];
const edgeX = (y) => TOP[0] + ((y - TOP[1]) / (BOTTOM[1] - TOP[1])) * (BOTTOM[0] - TOP[0]);
const topY = (x) => 1.38 - (x - 0.107) * 0.05; // the chest's top edge, going down a little outward
const bottomY = (x) => 1.283 + (x - 0.15) * 0.62; // its lower edge, rising out to the armpit
const inside = (p) => {
  const x = Math.abs(p.x);
  return x <= edgeX(p.y) && p.y <= topY(x) && p.y >= bottomY(x);
};

let painted = 0;
const done = new Uint8Array(W * H);
const tri = [0, 0, 0];
for (let f = 0; f < index.count; f += 3) {
  for (let k = 0; k < 3; k++) tri[k] = index.getX(f + k);
  const px = tri.map((i) => at(uv.getX(i), uv.getY(i)));
  const P = tri.map(world);
  const N = tri.map(normalAt);
  const x0 = Math.max(0, Math.floor(Math.min(...px.map((q) => q[0]))));
  const x1 = Math.min(W - 1, Math.ceil(Math.max(...px.map((q) => q[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...px.map((q) => q[1]))));
  const y1 = Math.min(H - 1, Math.ceil(Math.max(...px.map((q) => q[1]))));
  const [[ax, ay], [bx, by], [cx, cy]] = px;
  const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  if (Math.abs(area) < 1e-9) continue;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const k = y * W + x;
      if (done[k] || data[k * info.channels] % REGION_BITS !== DELT_FRONT) continue;
      // Barycentric, with a little slack so pixels on an edge between triangles are covered.
      const w1 = ((x - ax) * (cy - ay) - (cx - ax) * (y - ay)) / area;
      const w2 = ((bx - ax) * (y - ay) - (x - ax) * (by - ay)) / area;
      const w0 = 1 - w1 - w2;
      if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
      const p = P[0].clone().multiplyScalar(w0).addScaledVector(P[1], w1).addScaledVector(P[2], w2);
      const n = N[0].clone().multiplyScalar(w0).addScaledVector(N[1], w1).addScaledVector(N[2], w2).normalize();
      done[k] = 1;
      if (n.z < MIN_FRONT || !inside(p)) continue;
      data[k * info.channels] = data[k * info.channels] - DELT_FRONT + PEC_INSERTION;
      painted++;
    }
  }
}
console.log(`${painted} pixels painted`);
if (!process.argv.includes("--dry")) {
  await sharp(data, { raw: { width: W, height: H, channels: info.channels } }).toColourspace("b-w").png({ compressionLevel: 9 }).toFile(mapPath + ".tmp");
  const { renameSync } = await import("node:fs");
  renameSync(mapPath + ".tmp", mapPath);
}
