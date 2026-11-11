// Which bone the skin round the shoulder follows, set by muscle (owner, 2026-11-11). A muscle runs
// from an origin on one bone to an insertion on another, so the skin over it follows the origin's
// bone near the origin, the insertion's bone near the insertion, and a blend between along its
// fibres. The front deltoid and upper chest both run from the clavicle to the upper arm; with the
// arm overhead they form one sheet over the front of the shoulder joint. Earlier the skin there was
// shared among bones with no regard to the muscles (it wrinkled like a rubber suit), then tied whole
// to the arm (the front of the shoulder twisted away and left a notch).
//
// Here, once at load and in the rest pose, each skin point near the shoulder on one of the muscles
// below gets the upper arm's share from how far along that muscle's fibres it lies (body-regions.ts
// says which muscle). The rest of its weight stays with the bones it already had, in proportion.

import * as THREE from "three";

import { BODY_REGIONS } from "./body-regions";
import { REGION_IDS } from "./muscles";

const NEAR = 0.24; // metres from the shoulder joint within which skin is set
const SMOOTH_ROUNDS = 8; // passes evening out the arm's share between neighbouring skin, so muscles meet without a step
const DONE = "shoulderWeightsSet";

const regions = () => {
  const bin = atob(BODY_REGIONS);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

type Landmarks = Record<string, THREE.Vector3>;

// Origins and insertions, in metres, from the rest skeleton. x is outward on each side, y up, z forward.
function landmarks(root: THREE.Object3D, tag: string): Landmarks {
  const sign = tag === "l" ? 1 : -1;
  const pos = (n: string) => root.getObjectByName(n)!.getWorldPosition(new THREE.Vector3());
  const joint = pos(`upperarm_${tag}`);
  const elbow = pos(`lowerarm_${tag}`);
  const medial = pos(`clavicle_${tag}`);
  const lateral = joint.clone().add(new THREE.Vector3(-sign * 0.02, 0.03, 0));
  const out = (v: THREE.Vector3, x: number, y: number, z: number) => v.clone().add(new THREE.Vector3(sign * x, y, z));
  const down = (k: number) => joint.clone().lerp(elbow, k);
  return {
    joint,
    claviclePecOrigin: medial.clone().lerp(lateral, 0.45).add(new THREE.Vector3(0, 0, 0.03)),
    clavicleDeltOrigin: medial.clone().lerp(lateral, 0.85).add(new THREE.Vector3(0, 0, 0.03)),
    acromion: out(joint, 0, 0.045, 0),
    scapularSpine: out(joint, -0.05, 0.03, -0.07),
    sternumMid: new THREE.Vector3(0, joint.y - 0.12, joint.z + 0.11),
    sternumLow: new THREE.Vector3(0, joint.y - 0.24, joint.z + 0.1),
    lowerBack: new THREE.Vector3(sign * 0.06, joint.y - 0.4, joint.z - 0.1),
    scapulaAngle: out(joint, -0.09, -0.17, -0.1),
    deltoidTuberosity: out(down(0.45), 0.02, 0, 0),
    pecInsertion: out(down(0.17), 0.0, 0, 0.03),
    latInsertion: out(down(0.15), -0.01, 0, 0.0),
  };
}

// Each muscle: its regions on the muscle map, its origin, its insertion. All of these end on the upper
// arm. Muscles that don't (the trapezius) are left with the bones they have.
// `from` and `to`: the share of the way from origin to insertion where the arm's share starts and
// where it is full. With the arm overhead the whole deltoid turns with the upper arm (owner,
// 2026-11-11): the front part rises to the top, nearest the cheek, the middle part opens toward the
// back, and the back part is stretched. So the front and middle parts follow the arm nearly to
// their origins, while the back part, anchored on the shoulder blade, stretches along its length.
const MUSCLES: { regions: number[]; origin: string; insertion: string; from: number; to: number }[] = [
  { regions: [REGION_IDS.delt_front], origin: "clavicleDeltOrigin", insertion: "deltoidTuberosity", from: -0.25, to: 0.35 },
  { regions: [REGION_IDS.delt_side], origin: "acromion", insertion: "deltoidTuberosity", from: -0.6, to: 0.1 },
  { regions: [REGION_IDS.delt_rear], origin: "scapularSpine", insertion: "deltoidTuberosity", from: 0.15, to: 0.85 },
];
// Only the deltoid is set this way. The chest and the lats keep the model's own weights: set by
// their fibres they followed the arm too far, so the chest and the lats bulged or tore (owner,
// 2026-11-11). Skin within BAND of the deltoid blends from its own weights to the deltoid's.
const BAND = 0.05; // metres

// The upper arm's share for a point on a muscle: 0 at the origin, 1 at the insertion.
export function armShareAlong(p: THREE.Vector3, origin: THREE.Vector3, insertion: THREE.Vector3, from: number, to: number) {
  const run = insertion.clone().sub(origin);
  const t = p.clone().sub(origin).dot(run) / run.lengthSq();
  return THREE.MathUtils.smoothstep(t, from, to);
}

// Call once on the loaded model at its bind pose, after shortenPalms, before twist bones are added.
export function setShoulderWeights(root: THREE.Object3D) {
  if (root.userData[DONE]) return;
  root.userData[DONE] = true;
  root.updateMatrixWorld(true);
  let mesh: THREE.SkinnedMesh | undefined;
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh;
  });
  if (!mesh) return;
  const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
  const R = regions();
  if (R.length !== position.count) throw new Error("body-regions.ts is out of date: run tools/body/regions.mjs");
  const bones = mesh.skeleton.bones;
  const at = (n: string) => bones.findIndex((b) => b.name === n);
  const p = new THREE.Vector3();

  // Neighbours along the surface, joining vertices split at seams.
  const key = (i: number) => `${position.getX(i).toFixed(5)},${position.getY(i).toFixed(5)},${position.getZ(i).toFixed(5)}`;
  const place = new Map<string, number[]>();
  for (let i = 0; i < position.count; i++) (place.get(key(i)) ?? place.set(key(i), []).get(key(i))!).push(i);
  const near = Array.from({ length: position.count }, () => new Set<number>());
  const index = mesh.geometry.index;
  const tri = index ? index.count : position.count;
  for (let f = 0; f < tri; f += 3) {
    const v = [0, 1, 2].map((k) => (index ? index.getX(f + k) : f + k));
    for (const a of v) for (const b of v) if (a !== b) near[a].add(b);
  }
  for (const group of place.values()) for (const a of group) for (const b of group) if (a !== b) for (const n of near[b]) near[a].add(n);

  for (const tag of ["l", "r"]) {
    const sign = tag === "l" ? 1 : -1;
    const arm = at(`upperarm_${tag}`);
    const clavicle = at(`clavicle_${tag}`);
    const L = landmarks(root, tag);
    const share = new Map<number, number>();
    const own = new Map<number, number>(); // each skin point's arm share as the model has it
    const delt: THREE.Vector3[] = [];
    const nearby: { i: number; at: THREE.Vector3 }[] = [];
    for (let i = 0; i < position.count; i++) {
      mesh.getVertexPosition(i, p).applyMatrix4(mesh.matrixWorld);
      if (sign * p.x <= 0 || p.distanceTo(L.joint) > NEAR) continue;
      let now = 0;
      for (let k = 0; k < 4; k++) if (skinIndex.getComponent(i, k) === arm) now += skinWeight.getComponent(i, k);
      own.set(i, now);
      const muscle = MUSCLES.find((m) => m.regions.includes(R[i]));
      if (muscle) {
        share.set(i, armShareAlong(p, L[muscle.origin], L[muscle.insertion], muscle.from, muscle.to));
        delt.push(p.clone());
      } else nearby.push({ i, at: p.clone() });
    }
    // How far each other skin point is from the deltoid; within the band it joins the evening out.
    const reach = new Map<number, number>();
    for (const { i, at: q } of nearby) {
      const d = delt.reduce((m, v) => Math.min(m, v.distanceTo(q)), Infinity);
      if (d < BAND) {
        reach.set(i, d);
        share.set(i, own.get(i)!);
      }
    }
    for (let round = 0; round < SMOOTH_ROUNDS; round++) {
      const next = new Map(share);
      for (const [i, v] of share) {
        let sum = v;
        let n = 1;
        for (const j of near[i]) {
          const w = share.get(j);
          if (w !== undefined) {
            sum += w;
            n++;
          }
        }
        next.set(i, sum / n);
      }
      for (const [i, v] of next) share.set(i, v);
    }
    // Out across the band, back to the skin's own weights.
    for (const [i, d] of reach) share.set(i, THREE.MathUtils.lerp(share.get(i)!, own.get(i)!, THREE.MathUtils.smoothstep(d, 0, BAND)));
    for (const [i, s] of share) {
      const w = new Map<number, number>();
      for (let k = 0; k < 4; k++) {
        const v = skinWeight.getComponent(i, k);
        if (v > 0) w.set(skinIndex.getComponent(i, k), (w.get(skinIndex.getComponent(i, k)) ?? 0) + v);
      }
      const others = [...w].filter(([b]) => b !== arm);
      const rest = others.reduce((t, [, v]) => t + v, 0);
      const next = new Map<number, number>();
      if (s > 0) next.set(arm, s);
      if (rest > 1e-6) for (const [b, v] of others) next.set(b, (next.get(b) ?? 0) + ((1 - s) * v) / rest);
      else if (s < 1) next.set(clavicle, 1 - s);
      const top = [...next].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const total = top.reduce((t, [, v]) => t + v, 0);
      for (let k = 0; k < 4; k++) {
        skinIndex.setComponent(i, k, top[k]?.[0] ?? 0);
        skinWeight.setComponent(i, k, top[k] ? top[k][1] / total : 0);
      }
    }
  }
  skinIndex.needsUpdate = true;
  skinWeight.needsUpdate = true;
}
