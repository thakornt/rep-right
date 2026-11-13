// Corrective shapes for the shoulder with the arm raised (owner, 2026-11-13). Skinning alone can't
// keep the lat running up to the arm and the front of the shoulder full with the arm overhead; each
// lift that needs one has its own shape, sculpted in Blender at that lift's pose
// (tools/body/correctives/) and approved by the owner. It is added after skinning, turned by each point's own skinning turn (its stretch and
// squash left out), so at the pose it was made for the skin lands exactly on the sculpted shape and
// elsewhere it moves with the skin round it. (Added before skinning, as a morph target, the skin's
// squashing near the armpit shrank it; undoing that squash blew it up three times over in other
// poses; turned with the trunk alone, the armpit's offset stayed behind when the arm moved.) It blends in by how near each upper arm points to
// the direction it was made at. Made for the right arm; the left takes its mirror image.

import * as THREE from "three";

import { CORRECTIVE as OVERHEAD_TWO } from "./shoulder-correctives-overhead-two";
import { CORRECTIVE as PULLDOWN_NEUTRAL } from "./shoulder-correctives-pulldown-neutral";
import { CORRECTIVE as PULLDOWN_SINGLE } from "./shoulder-correctives-pulldown-single";

// One shape per lift it was sculpted for. A lift turns its own on as it poses; every other lift keeps
// the skin as it was.
const SHAPES: Record<"pulldownSingle" | "pulldownNeutral" | "overheadTwo", { arm: number[]; scale: number; data: string; left?: string }> = {
  pulldownSingle: PULLDOWN_SINGLE,
  pulldownNeutral: PULLDOWN_NEUTRAL,
  overheadTwo: OVERHEAD_TWO,
};
export type CorrectiveShape = keyof typeof SHAPES;

// The shape is right only near the arm's direction it was made at (relative to the trunk): pressing
// up and out to the side, it pushed the arm's skin 7 cm into the trunk. So it blends in by how near
// the upper arm points to that direction.
export const CORRECTIVE_FULL = 15; // degrees off that direction within which it is whole
export const CORRECTIVE_NONE = 50; // and beyond which it is none
// The pulldowns' shapes fade over the whole pull instead: from 15 to 50 degrees they came and went
// within a quarter of it, and the lats and teres swelled and sank all at once (owner, 2026-11-13).
// Their arms go 129 (single) and 139 (neutral) degrees off the top's direction at the bottom.
export const FADE: Record<CorrectiveShape, [number, number]> = {
  pulldownSingle: [0, 135],
  pulldownNeutral: [0, 135],
  overheadTwo: [CORRECTIVE_FULL, CORRECTIVE_NONE],
};
export const CORRECTIVE_BONE = "spine_03";

const DONE = "shoulderCorrectivesAdded";

// Only in the lift each shape was made for. The single-arm pulldown's shape on the overhead triceps
// extension (its arm within 16 degrees of the same direction, but its shoulder blade risen and rolled
// back further) flared its back out (owner's check, 2026-11-13), so that lift has its own.
export function enableShoulderCorrectives(root: THREE.Object3D, shape: CorrectiveShape | false) {
  root.userData.shoulderCorrectives = shape;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
// How far an arm is raised: the angle, in degrees, between the upper arm and the line down the trunk.
export function armElevation(root: THREE.Object3D, tag: "l" | "r") {
  root.getObjectByName(`upperarm_${tag}`)!.getWorldPosition(_a);
  root.getObjectByName(`lowerarm_${tag}`)!.getWorldPosition(_b);
  root.getObjectByName("neck_01")!.getWorldPosition(_c);
  root.getObjectByName("spine_01")!.getWorldPosition(_d);
  return THREE.MathUtils.radToDeg(_b.sub(_a).angleTo(_d.sub(_c)));
}

const _q = new THREE.Quaternion();
const _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4();
const MADE_AT = Object.fromEntries(Object.entries(SHAPES).map(([k, v]) => [k, new THREE.Vector3(v.arm[0], v.arm[1], v.arm[2])])) as Record<CorrectiveShape, THREE.Vector3>;
// Degrees between an arm's direction now and the one the shape was made at, both in the trunk's
// rest frame (the left arm against the mirror image).
export function armOffShape(mesh: THREE.SkinnedMesh, root: THREE.Object3D, tag: "l" | "r", bone: number, shape: CorrectiveShape) {
  root.getObjectByName(`upperarm_${tag}`)!.getWorldPosition(_a);
  root.getObjectByName(`lowerarm_${tag}`)!.getWorldPosition(_b);
  const sk = mesh.skeleton;
  _m2.multiplyMatrices(sk.bones[bone].matrixWorld, sk.boneInverses[bone]);
  _q.setFromRotationMatrix(_m3.extractRotation(_m2));
  const dir = _b.sub(_a).applyQuaternion(_q.invert()).normalize();
  if (tag === "l") dir.x = -dir.x;
  return THREE.MathUtils.radToDeg(dir.angleTo(MADE_AT[shape]));
}

const SHAPES_OF = new WeakMap<THREE.BufferGeometry, Record<CorrectiveShape, { right: Float32Array; left: Float32Array }>>();

// Call once on the loaded model at its bind pose, after its geometry is final.
export function addShoulderCorrectives(root: THREE.Object3D) {
  if (root.userData[DONE]) return;
  root.userData[DONE] = true;
  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const { position } = mesh.geometry.attributes;
    const place = new Map<string, number[]>();
    const key = (x: number, y: number, z: number) => `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    for (let i = 0; i < position.count; i++) {
      const k = key(position.getX(i), position.getY(i), position.getZ(i));
      (place.get(k) ?? place.set(k, []).get(k)!).push(i);
    }
    const shapes = {} as Record<CorrectiveShape, { right: Float32Array; left: Float32Array }>;
    const decode = (data: string, scale: number) => {
      const out = new Float32Array(position.count * 3);
      const view = new DataView(Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0)).buffer);
      for (let at = 0; at < view.byteLength; at += 10) {
        const i = view.getUint32(at, true);
        for (let k = 0; k < 3; k++) out[i * 3 + k] = view.getInt16(at + 4 + k * 2, true) / scale;
      }
      return out;
    };
    for (const [name, shape] of Object.entries(SHAPES) as [CorrectiveShape, (typeof SHAPES)[CorrectiveShape]][]) {
      const right = decode(shape.data, shape.scale);
      // A shape sculpted on both sides keeps the left as sculpted (its posed skin needn't be the right's
      // mirror image).
      if (shape.left) {
        shapes[name] = { right, left: decode(shape.left, shape.scale) };
        continue;
      }
      // Otherwise the left side's shape: each right point's offset, mirrored across the body's middle,
      // on the point at the mirrored place.
      const left = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
        if (!right[i * 3] && !right[i * 3 + 1] && !right[i * 3 + 2]) continue;
        for (const j of place.get(key(-position.getX(i), position.getY(i), position.getZ(i))) ?? []) {
          left[j * 3] = -right[i * 3];
          left[j * 3 + 1] = right[i * 3 + 1];
          left[j * 3 + 2] = right[i * 3 + 2];
        }
      }
      shapes[name] = { right, left };
    }
    // The shader reads the shape of the lift on screen; followShoulderCorrectives swaps it in. Kept by
    // geometry, which a viewer's clone of the body shares (userData is copied through JSON, which
    // turns the arrays into plain objects).
    SHAPES_OF.set(mesh.geometry, shapes);
    mesh.geometry.setAttribute("aCorrR", new THREE.BufferAttribute(new Float32Array(position.count * 3), 3));
    mesh.geometry.setAttribute("aCorrL", new THREE.BufferAttribute(new Float32Array(position.count * 3), 3));
  });
}

type Corrective = { weights: THREE.Vector2; bone: number };

// The turn of vertex i's skinning, in the mesh's own space, as the shader takes it: the blended
// matrix's first column made unit, the second square to it, the third their cross.
const _m = new THREE.Matrix4(), _bm = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
function skinTurn(mesh: THREE.SkinnedMesh, i: number) {
  const { skinIndex, skinWeight } = mesh.geometry.attributes;
  const sk = mesh.skeleton;
  const e = _m.elements;
  e.fill(0);
  for (let k = 0; k < 4; k++) {
    const w = skinWeight.getComponent(i, k);
    if (!w) continue;
    const b = skinIndex.getComponent(i, k);
    const be = _bm.multiplyMatrices(sk.bones[b].matrixWorld, sk.boneInverses[b]).elements;
    for (let j = 0; j < 16; j++) e[j] += be[j] * w;
  }
  _m.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
  _x.set(e[0], e[1], e[2]).normalize();
  _y.set(e[4], e[5], e[6]);
  _y.addScaledVector(_x, -_y.dot(_x)).normalize();
  _z.crossVectors(_x, _y);
  return _m.makeBasis(_x, _y, _z);
}

// The corrective at vertex i, as added after skinning, in the mesh's own space (into `out`).
const _r = new THREE.Vector3();
export function correctiveAt(mesh: THREE.SkinnedMesh, i: number, out: THREE.Vector3) {
  out.set(0, 0, 0);
  const c = mesh.userData.shoulderCorrective as Corrective | undefined;
  const r = mesh.geometry.getAttribute("aCorrR");
  const l = mesh.geometry.getAttribute("aCorrL");
  if (!c || !r || !l || (!c.weights.x && !c.weights.y)) return out;
  out.fromBufferAttribute(r, i).multiplyScalar(c.weights.x).add(_r.fromBufferAttribute(l, i).multiplyScalar(c.weights.y));
  return out.lengthSq() ? out.applyMatrix4(skinTurn(mesh, i)) : out;
}

// Blend each side's shape in by how high its arm is, whenever the skin is drawn or read. Call on the
// model as it will be posed.
export function followShoulderCorrectives(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.geometry.getAttribute("aCorrR")) return;
    const c: Corrective = { weights: new THREE.Vector2(), bone: mesh.skeleton.bones.findIndex((b) => b.name === CORRECTIVE_BONE) };
    mesh.userData.shoulderCorrective = c;
    const shapes = SHAPES_OF.get(mesh.geometry)!;
    let loaded: CorrectiveShape | undefined;
    const drive = () => {
      const shape = root.userData.shoulderCorrectives as CorrectiveShape | false | undefined;
      if (shape && shape !== loaded) {
        loaded = shape;
        for (const [name, from] of [["aCorrR", shapes[shape].right], ["aCorrL", shapes[shape].left]] as const) {
          const a = mesh.geometry.getAttribute(name) as THREE.BufferAttribute;
          (a.array as Float32Array).set(from);
          a.needsUpdate = true;
        }
      }
      const near = (tag: "l" | "r") =>
        shape ? 1 - THREE.MathUtils.smoothstep(armOffShape(mesh, root, tag, c.bone, shape), ...FADE[shape]) : 0;
      c.weights.set(near("r"), near("l"));
    };
    const update = mesh.skeleton.update.bind(mesh.skeleton);
    mesh.skeleton.update = () => {
      drive();
      update();
    };
    const before = mesh.userData.beforeSkin as (() => void) | undefined;
    mesh.userData.beforeSkin = () => {
      drive();
      before?.();
    };
    // The material reads this mesh's weights and bone as it is drawn.
    mesh.onBeforeRender = (_r, _s, _c, _g, material) => {
      const u = (material as THREE.Material).userData.shoulderCorrective as { weights: THREE.Vector2; bone: { value: number } } | undefined;
      if (!u) return;
      u.weights.copy(c.weights);
      u.bone.value = c.bone;
    };
    // CPU reads of one skin point (the tests, poses that fit to the skin) add it as drawn.
    const read = mesh.getVertexPosition.bind(mesh);
    const add = new THREE.Vector3();
    let last = Infinity;
    mesh.getVertexPosition = (i, target) => {
      if (i <= last) drive();
      last = i;
      read(i, target);
      return target.add(correctiveAt(mesh, i, add));
    };
  });
}

// The GLSL the body material adds: declarations, and the offset after skinning.
export const CORRECTIVE_HEAD = /* glsl */ `
  attribute vec3 aCorrR;
  attribute vec3 aCorrL;
  uniform vec2 uCorr;
  uniform float uCorrBone;
`;
export const CORRECTIVE_AFTER_SKIN = /* glsl */ `
  #ifdef USE_SKINNING
    if (uCorr.x + uCorr.y > 0.0) {
      vec3 corr = aCorrR * uCorr.x + aCorrL * uCorr.y;
      vec3 cx = normalize(skinMatrix[0].xyz);
      vec3 cy = normalize(skinMatrix[1].xyz - dot(skinMatrix[1].xyz, cx) * cx);
      transformed += mat3(cx, cy, cross(cx, cy)) * corr;
    }
  #endif
`;
