// Corrective smoothing round the shoulders ("delta mush", what Blender calls Corrective Smooth).
// Plain skinning blends the bones' moves linearly, so where skin follows the trunk and the raised
// arm both, it folds into a ridge or caves in. Here, every frame, that skin is smoothed as posed,
// which irons out the folds, and then its own detail at rest (the bumps of the muscles, kept as
// offsets from a smoothed rest shape) is laid back on in the smoothed surface's own frame, so the
// shape keeps its volume and relief. The result goes to the material as a per-vertex offset before
// skinning (aMush), so the GPU draws it and contact.ts can read it the same way. The smoothed
// surface's normals go with it (aMushNormal): lit with the old ones, the moved skin showed dark
// and light smudges round the shoulders and the side of the neck.

import * as THREE from "three";

const NEAR = 0.13; // metres from a shoulder joint within which the correction applies fully
const FAR = 0.22; // and beyond which not at all
// Below the shoulder joint, in the armpit, the arm's skin meets the side of the chest; smoothing
// there presses the two into each other, so the correction fades out going down into it.
const PIT_FULL = -0.03; // metres below the joint where the correction still applies fully
const PIT_NONE = -0.08; // and where it has faded out
const STRENGTH = 1; // share of the correction taken where it applies fully
const SUPPORT = 0.27; // metres within which skin takes part in the smoothing
const ROUNDS = 24; // smoothing passes
const STEP = 0.5; // how far each pass moves a point toward its neighbours' middle

type Mush = {
  places: number[]; // a representative vertex for each place (vertices split at seams share one)
  place: Int32Array; // each vertex's place
  near: number[][]; // each place's neighbours, by place
  faces: [number, number, number][]; // triangles round the supported places, by place
  facesOf: number[][]; // triangles touching each place
  moving: number[]; // places the smoothing moves, inside the support
  posed: number[]; // places whose posed position is needed: the moving ones and their neighbours
  share: Float32Array; // how much each place takes the correction, 0..1
  detail: Float32Array; // each corrected place's offset from the smoothed rest, in that surface's frame
  corrected: number[]; // places with share > 0
};

const DONE = "deltaMushReady";

// Laplacian smoothing of `pos` (xyz per place) over the moving places; the rest stay put.
function smooth(m: Mush, pos: Float32Array) {
  const next = new Float32Array(pos);
  for (let round = 0; round < ROUNDS; round++) {
    for (const k of m.moving) {
      const ns = m.near[k];
      let x = 0, y = 0, z = 0;
      for (const n of ns) {
        x += pos[n * 3];
        y += pos[n * 3 + 1];
        z += pos[n * 3 + 2];
      }
      const c = ns.length;
      next[k * 3] = pos[k * 3] + STEP * (x / c - pos[k * 3]);
      next[k * 3 + 1] = pos[k * 3 + 1] + STEP * (y / c - pos[k * 3 + 1]);
      next[k * 3 + 2] = pos[k * 3 + 2] + STEP * (z / c - pos[k * 3 + 2]);
    }
    pos.set(next);
  }
  return pos;
}

// The surface's frame at a place: normal from its triangles, tangent toward its first neighbour.
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
function frameAt(m: Mush, pos: Float32Array, k: number, n: THREE.Vector3, t: THREE.Vector3, s: THREE.Vector3) {
  n.set(0, 0, 0);
  for (const f of m.facesOf[k]) {
    const [i, j, l] = m.faces[f];
    a.fromArray(pos, i * 3);
    b.fromArray(pos, j * 3).sub(a);
    c.fromArray(pos, l * 3).sub(a);
    n.add(b.cross(c));
  }
  n.normalize();
  t.fromArray(pos, m.near[k][0] * 3).sub(a.fromArray(pos, k * 3));
  t.addScaledVector(n, -t.dot(n)).normalize();
  s.crossVectors(n, t);
}

// Call once on the loaded model at its bind pose, after its skin weights are final, before cloning.
export function prepareDeltaMush(root: THREE.Object3D) {
  if (root.userData[DONE]) return;
  root.userData[DONE] = true;
  root.updateMatrixWorld(true);
  let mesh: THREE.SkinnedMesh | undefined;
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh;
  });
  if (!mesh) throw new Error("the body has no skinned mesh");
  const g = mesh.geometry;
  const { position } = g.attributes;
  const count = position.count;

  const place = new Int32Array(count);
  const firstAt = new Map<string, number>();
  const places: number[] = [];
  for (let i = 0; i < count; i++) {
    const key = `${position.getX(i).toFixed(5)},${position.getY(i).toFixed(5)},${position.getZ(i).toFixed(5)}`;
    let at = firstAt.get(key);
    if (at === undefined) {
      at = places.length;
      firstAt.set(key, at);
      places.push(i);
    }
    place[i] = at;
  }

  // Distance of each place from the nearer shoulder joint, in the mesh's own space.
  const toLocal = mesh.matrixWorld.clone().invert();
  const joints = ["l", "r"].map((t) => root.getObjectByName(`upperarm_${t}`)!.getWorldPosition(new THREE.Vector3()).applyMatrix4(toLocal));
  const scale = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld).x || 1;
  const p = new THREE.Vector3();
  const dist = places.map((i) => Math.min(...joints.map((j) => j.distanceTo(p.fromBufferAttribute(position, i)))) * scale);
  const jointY = root.getObjectByName("upperarm_l")!.getWorldPosition(new THREE.Vector3()).y;
  const below = places.map((i) => p.fromBufferAttribute(position, i).applyMatrix4(mesh!.matrixWorld).y - jointY);

  const nearSets = places.map(() => new Set<number>());
  const faces: [number, number, number][] = [];
  const index = g.index;
  const tri = index ? index.count : count;
  for (let f = 0; f < tri; f += 3) {
    const v = [0, 1, 2].map((k) => place[index ? index.getX(f + k) : f + k]) as [number, number, number];
    if (v[0] === v[1] || v[1] === v[2] || v[2] === v[0]) continue;
    for (let k = 0; k < 3; k++) {
      nearSets[v[k]].add(v[(k + 1) % 3]);
      nearSets[v[k]].add(v[(k + 2) % 3]);
    }
    if (v.some((k) => dist[k] < SUPPORT)) faces.push(v);
  }
  const near = nearSets.map((s) => [...s]);
  const facesOf: number[][] = places.map(() => []);
  faces.forEach((f, n) => f.forEach((k) => facesOf[k].push(n)));
  const moving = places.map((_, k) => k).filter((k) => dist[k] < SUPPORT && near[k].length > 0);
  const posedSet = new Set<number>(moving);
  for (const k of moving) for (const n of near[k]) posedSet.add(n);
  const share = new Float32Array(places.length);
  const corrected: number[] = [];
  for (const k of moving) {
    share[k] = STRENGTH * (1 - THREE.MathUtils.smoothstep(dist[k], NEAR, FAR)) * THREE.MathUtils.smoothstep(below[k], PIT_NONE, PIT_FULL);
    if (share[k] > 0 && facesOf[k].length) corrected.push(k);
  }

  const m: Mush = { places, place, near, faces, facesOf, moving, posed: [...posedSet], share, detail: new Float32Array(places.length * 3), corrected };
  // The rest shape's detail, against its own smoothed self.
  const rest = new Float32Array(places.length * 3);
  for (const k of m.posed) p.fromBufferAttribute(position, places[k]).toArray(rest, k * 3);
  const smoothRest = smooth(m, new Float32Array(rest));
  const n = new THREE.Vector3(), t = new THREE.Vector3(), s = new THREE.Vector3(), d = new THREE.Vector3();
  for (const k of corrected) {
    frameAt(m, smoothRest, k, n, t, s);
    d.fromArray(rest, k * 3).sub(p.fromArray(smoothRest, k * 3));
    m.detail[k * 3] = d.dot(t);
    m.detail[k * 3 + 1] = d.dot(s);
    m.detail[k * 3 + 2] = d.dot(n);
  }
  g.userData.deltaMush = m;
  g.setAttribute("aMush", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  // The corrected skin's normal in the rest pose's space; zero where there is no correction.
  g.setAttribute("aMushNormal", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
}

// Keep the correction following the pose whenever the skeleton updates (each frame it is drawn),
// and when contact.ts reads the skin. Call on the model to be posed, after followArmTwist.
export function followDeltaMush(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const m = mesh.geometry.userData.deltaMush as Mush | undefined;
    if (!m) return;
    const attr = mesh.geometry.getAttribute("aMush") as THREE.BufferAttribute;
    const out = attr.array as Float32Array;
    const normalAttr = mesh.geometry.getAttribute("aMushNormal") as THREE.BufferAttribute;
    const outNormal = normalAttr.array as Float32Array;
    const { normal } = mesh.geometry.attributes;
    const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
    const update = mesh.skeleton.update.bind(mesh.skeleton);
    const posed = new Float32Array(m.places.length * 3);
    const blend = new THREE.Matrix4();
    const e = blend.elements;
    const linear = new THREE.Matrix3();
    const p = new THREE.Vector3(), n = new THREE.Vector3(), t = new THREE.Vector3(), s = new THREE.Vector3(), want = new THREE.Vector3();
    const fixed = new Float32Array(m.places.length * 3); // the posed skin with the correction on
    const undo = new Float32Array(m.places.length * 9); // each corrected place's way back to the rest space
    const restNormal = new THREE.Vector3();
    const correct = () => {
      const bones = mesh.skeleton.boneMatrices!;
      for (const k of m.posed) mesh.applyBoneTransform(m.places[k], p.fromBufferAttribute(position, m.places[k])).toArray(posed, k * 3);
      const smoothed = smooth(m, new Float32Array(posed));
      out.fill(0);
      outNormal.fill(0);
      fixed.set(posed);
      for (const k of m.corrected) {
        frameAt(m, smoothed, k, n, t, s);
        want.fromArray(smoothed, k * 3).addScaledVector(t, m.detail[k * 3]).addScaledVector(s, m.detail[k * 3 + 1]).addScaledVector(n, m.detail[k * 3 + 2]);
        // From where plain skinning put it toward the corrected place, by this place's share.
        want.sub(p.fromArray(posed, k * 3)).multiplyScalar(m.share[k]);
        p.add(want).toArray(fixed, k * 3);
        // Back into the rest pose's space: undo the blend of the bones' turns at this point.
        const i = m.places[k];
        e.fill(0);
        for (let q = 0; q < 4; q++) {
          const w = skinWeight.getComponent(i, q);
          if (!w) continue;
          const at = skinIndex.getComponent(i, q) * 16;
          for (let r = 0; r < 16; r++) e[r] += bones[at + r] * w;
        }
        blend.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
        linear.setFromMatrix4(blend).invert();
        linear.toArray(undo, k * 9);
        want.applyMatrix3(linear);
        want.toArray(out, i * 3);
      }
      // The corrected skin's normals, from its own triangles, taken back into the rest space the
      // way the shader skins normals, and eased into the model's own by the place's share so the
      // edge of the correction doesn't show.
      for (const k of m.corrected) {
        frameAt(m, fixed, k, n, t, s);
        n.applyMatrix3(linear.fromArray(undo, k * 9)).normalize();
        const i = m.places[k];
        restNormal.fromBufferAttribute(normal, i).lerp(n, m.share[k]).normalize();
        restNormal.toArray(outNormal, i * 3);
      }
      // Seams: every vertex at a place takes its place's offset.
      for (let i = 0; i < m.place.length; i++) {
        const k = m.place[i];
        if (m.share[k] > 0 && m.places[k] !== i) {
          out[i * 3] = out[m.places[k] * 3];
          out[i * 3 + 1] = out[m.places[k] * 3 + 1];
          out[i * 3 + 2] = out[m.places[k] * 3 + 2];
          outNormal[i * 3] = outNormal[m.places[k] * 3];
          outNormal[i * 3 + 1] = outNormal[m.places[k] * 3 + 1];
          outNormal[i * 3 + 2] = outNormal[m.places[k] * 3 + 2];
        }
      }
      attr.needsUpdate = true;
      normalAttr.needsUpdate = true;
    };
    mesh.skeleton.update = () => {
      update();
      correct();
    };
    mesh.userData.beforeSkin = () => mesh.skeleton.update();
  });
}
