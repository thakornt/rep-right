// Contact checks on the skinned body: parts that pass through each other, the
// bar sinking into the shoulders, feet through the floor. Done on the CPU from
// the bones as posed now, for tests.

import * as THREE from "three";

export type Part = "armL" | "armR" | "core" | "legL" | "legR" | "none";

// Skin owned mostly (>= 80%) by one bone group; blended skin at the joints
// (armpit, groin) belongs to none, since it is meant to fold.
function partOf(bone: string): Part {
  const side = bone.endsWith("_l") ? "L" : "R";
  if (/^(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)_/.test(bone)) return `arm${side}`;
  if (/^(thigh|calf|foot|ball)_/.test(bone)) return `leg${side}`;
  if (/^(pelvis|spine|clavicle|neck|head)/.test(bone)) return "core";
  return "none";
}

export type Body = ReturnType<typeof readBody>;

export function readBody(root: THREE.Object3D) {
  let mesh: THREE.SkinnedMesh | undefined;
  root.traverse((o) => {
    if (!mesh && (o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh;
  });
  if (!mesh) throw new Error("body has no skinned mesh");
  const g = mesh.geometry;
  const n = g.attributes.position.count;
  const bones = mesh.skeleton.bones;
  const bonePart = bones.map((b) => partOf(b.name));
  const part: Part[] = [];
  for (let i = 0; i < n; i++) {
    const share = new Map<Part, number>();
    for (let k = 0; k < 4; k++) {
      const w = g.attributes.skinWeight.getComponent(i, k);
      if (!w) continue;
      const p = bonePart[g.attributes.skinIndex.getComponent(i, k)];
      share.set(p, (share.get(p) ?? 0) + w);
    }
    let best: Part = "none";
    for (const [p, w] of share) if (w >= 0.8) best = p;
    part.push(best);
  }
  return { mesh, n, part };
}

// World positions and normals of every vertex, as posed now.
function skin(body: Body) {
  const { mesh, n } = body;
  const g = mesh.geometry;
  const sk = mesh.skeleton;
  // Same as three's skinning shader: world <- bind space, per bone.
  const toWorld = mesh.matrixWorld.clone().multiply(mesh.bindMatrixInverse);
  const mats = sk.bones.map((b, i) =>
    toWorld.clone().multiply(b.matrixWorld).multiply(sk.boneInverses[i]).multiply(mesh.bindMatrix),
  );
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const e = m.elements;
  for (let i = 0; i < n; i++) {
    e.fill(0);
    for (let k = 0; k < 4; k++) {
      const w = g.attributes.skinWeight.getComponent(i, k);
      if (!w) continue;
      const be = mats[g.attributes.skinIndex.getComponent(i, k)].elements;
      for (let j = 0; j < 16; j++) e[j] += be[j] * w;
    }
    p.fromBufferAttribute(g.attributes.position, i).applyMatrix4(m);
    q.fromBufferAttribute(g.attributes.normal, i).transformDirection(m);
    p.toArray(pos, i * 3);
    q.toArray(nor, i * 3);
  }
  return { pos, nor };
}

const CELL = 0.04;
const key = (x: number, y: number, z: number) =>
  `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;

export type Contact = {
  // Deepest skin of one part inside another, metres.
  through: { pair: string; depth: number; at: [number, number, number] }[];
  // How far the bar sinks below the skin, metres.
  barSink: number;
  // Lowest skin under the floor (positive = below), metres.
  floor: number;
};

const PAIRS: [Part, Part][] = [
  ["armL", "core"],
  ["armR", "core"],
  ["armL", "legL"],
  ["armR", "legR"],
  ["armL", "armR"],
  ["legL", "legR"],
];

export function contact(body: Body, bar?: { at: THREE.Vector3; dir: THREE.Vector3; radius: number; halfWidth: number }): Contact {
  const { pos, nor } = skin(body);
  const grids = new Map<Part, Map<string, number[]>>();
  const grid = (p: Part) => {
    let gr = grids.get(p);
    if (gr) return gr;
    gr = new Map();
    for (let i = 0; i < body.n; i++) {
      if (body.part[i] !== p) continue;
      const k = key(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      const list = gr.get(k);
      if (list) list.push(i);
      else gr.set(k, [i]);
    }
    grids.set(p, gr);
    return gr;
  };

  const through: Contact["through"] = [];
  for (const [a, b] of PAIRS) {
    const gb = grid(b);
    let worst = { depth: 0, at: [0, 0, 0] as [number, number, number] };
    for (let i = 0; i < body.n; i++) {
      if (body.part[i] !== a) continue;
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      // Nearest skin of the other part; inside it if behind that skin's normal.
      let best = -1;
      let bestD = Infinity;
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            for (const j of gb.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
              const d = (pos[j * 3] - x) ** 2 + (pos[j * 3 + 1] - y) ** 2 + (pos[j * 3 + 2] - z) ** 2;
              if (d < bestD) {
                bestD = d;
                best = j;
              }
            }
          }
      if (best < 0) continue;
      const depth = -((x - pos[best * 3]) * nor[best * 3] + (y - pos[best * 3 + 1]) * nor[best * 3 + 1] + (z - pos[best * 3 + 2]) * nor[best * 3 + 2]);
      if (depth > worst.depth) worst = { depth, at: [x, y, z] };
    }
    through.push({ pair: `${a}/${b}`, ...worst });
  }

  let barSink = 0;
  if (bar) {
    const w = new THREE.Vector3();
    for (let i = 0; i < body.n; i++) {
      if (body.part[i] !== "core") continue;
      w.fromArray(pos, i * 3).sub(bar.at);
      const along = w.dot(bar.dir);
      if (Math.abs(along) > bar.halfWidth) continue;
      const d = w.addScaledVector(bar.dir, -along).length();
      barSink = Math.max(barSink, bar.radius - d);
    }
  }

  let floor = 0;
  for (let i = 0; i < body.n; i++) floor = Math.max(floor, -pos[i * 3 + 1]);

  return { through, barSink, floor };
}
