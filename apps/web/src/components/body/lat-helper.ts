// Helper bones for the lat's skin under the raised arm (owner, 2026-11-13). With the arm overhead, the
// skin of the lats and teres below the back of the armpit followed only the trunk, so it caved in
// under the arm: seen from behind, the side dipped 5 cm inside the line from the waist to where the
// arm meets the trunk. Tying that skin straight to the arm (2026-11-11) tore it: blending the trunk's
// bone with the arm's, which turns 150 degrees and more, folds the skin between them. Pulling it
// toward the arm's insertion without turning it (tried 2026-11-13) drew it in, not out: with the arm
// overhead the insertion sits higher and nearer the middle.
//
// What fills the side is the shoulder blade turning up with the arm and the lat swinging out with
// it. So each shoulder gets a few bones at the joint, each taking a set share of the upper arm's
// swing (not its twist about its own length): a quarter, a half, three quarters, all of it. The lat's
// skin follows a share by how far along the muscle it lies, from its origin low on the back (none)
// to its insertion on the arm (all), and the skin closing over the armpit at least by its nearness
// to the joint, stepping between neighbouring bones so no skin blends two bones far apart in turn.

import * as THREE from "three";

import { BODY_REGIONS } from "./body-regions";
import { REGION_IDS, TERES_OVER_LATS } from "./muscles";

export const LAT_STRETCH = {
  levels: 4, // helper bones per shoulder, taking 1/levels, 2/levels... of the arm's swing
  from: 0.7, // share of the way along the lat, from its origin to its insertion, where the skin starts to follow the arm
  to: 1.3, // and where it follows all of the arm's swing
  nearShare: 0.7, // the share skin right at the joint takes at least
  nearFull: 0.06, // metres from the joint within which it does
  nearNone: 0.16, // and beyond which nearness adds nothing
  pit: 0.12, // metres from the joint within which the hollow of the armpit, behind and under it, follows as the lat does
  reach: 0.3, // metres from the joint beyond which skin is left alone
  smooth: 14, // passes evening the share between neighbouring skin, so there's no step
  foldShare: 0.6, // the share of the arm's own skin behind the armpit given to the three-quarter helper, at most
  foldFull: 0.05, // metres from the joint within which it gives that much
  foldNone: 0.16, // and beyond which none
  blendReach: 0.26, // metres from the joint within which skin shared by the trunk and the arm steps up the helpers
  capShare: 0.5, // the share of the arm's swing beyond capFromAngle the skin over the joint takes
  capFromAngle: 60, // degrees the arm swings from rest (hanging a little out) before the skin over the joint lags
  capReach: 0.12, // metres from the joint within which it is held to that
  capFrom: 0.0, // metres down the arm from the joint where it starts to take more
  capTo: 0.07, // and where it takes all of it
};

const DONE = "latHelpersAdded";

const name = (tag: string, k: number) => `lat_helper${k}_${tag}`;

const regions = () => {
  const bin = atob(BODY_REGIONS);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

// Call once on the loaded model, at its bind pose, after the twist bones, before delta mush.
export function addLatStretch(root: THREE.Object3D) {
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
  const R = regions();
  const P = LAT_STRETCH;
  const p = new THREE.Vector3();
  const lat = new Set<number>([REGION_IDS.lats, REGION_IDS.teres, TERES_OVER_LATS]);

  // Neighbours along the surface, joining vertices split at seams, so the share is even across them.
  const key = (i: number) => `${position.getX(i).toFixed(5)},${position.getY(i).toFixed(5)},${position.getZ(i).toFixed(5)}`;
  const place = new Map<string, number[]>();
  for (let i = 0; i < position.count; i++) (place.get(key(i)) ?? place.set(key(i), []).get(key(i))!).push(i);
  const near = Array.from({ length: position.count }, () => new Set<number>());
  const index = skin.geometry.index;
  const tri = index ? index.count : position.count;
  for (let f = 0; f < tri; f += 3) {
    const v = [0, 1, 2].map((k) => (index ? index.getX(f + k) : f + k));
    for (const a of v) for (const b of v) if (a !== b) near[a].add(b);
  }
  for (const group of place.values()) for (const a of group) for (const b of group) if (a !== b) for (const n of near[b]) near[a].add(n);

  for (const tag of ["l", "r"]) {
    const sign = tag === "l" ? 1 : -1;
    const upper = root.getObjectByName(`upperarm_${tag}`) as THREE.Bone;
    const lower = root.getObjectByName(`lowerarm_${tag}`)!;
    const at = bones.indexOf(upper);
    const isArm = (b: number) => b === at || bones[b].parent === upper;
    // The helpers: on the clavicle, at the shoulder joint, at rest as the upper arm is.
    const level = [-1];
    for (let k = 1; k <= P.levels; k++) {
      const helper = new THREE.Bone();
      helper.name = name(tag, k);
      helper.position.copy(upper.position);
      helper.quaternion.copy(upper.quaternion);
      upper.parent!.add(helper);
      level.push(bones.length);
      bones.push(helper);
      inverses.push(inverses[at].clone());
    }
    // And one for the skin over the joint: with the arm, until it is well up, then less (see below).
    const cap = new THREE.Bone();
    cap.name = `lat_cap_${tag}`;
    cap.position.copy(upper.position);
    cap.quaternion.copy(upper.quaternion);
    upper.parent!.add(cap);
    const capAt = bones.length;
    bones.push(cap);
    inverses.push(inverses[at].clone());
    const joint = upper.getWorldPosition(new THREE.Vector3());
    const elbow = lower.getWorldPosition(new THREE.Vector3());
    // The lat runs from low on the back, beside the spine, up to the front of the upper arm a little
    // below the joint.
    const origin = new THREE.Vector3(sign * 0.06, joint.y - 0.4, joint.z - 0.1);
    const insertion = joint.clone().lerp(elbow, 0.15);
    const run = insertion.clone().sub(origin);

    // Each skin point's share of the arm's swing.
    const share = new Map<number, number>();
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).applyMatrix4(skin.matrixWorld);
      if (sign * p.x <= 0 || p.distanceTo(joint) > P.reach) continue;
      const pit = p.distanceTo(joint) < P.pit && p.y < joint.y + 0.01 && p.z < joint.z + 0.02;
      if (!lat.has(R[i]) && !pit) continue;
      const t = p.clone().sub(origin).dot(run) / run.lengthSq();
      const close = P.nearShare * (1 - THREE.MathUtils.smoothstep(p.distanceTo(joint), P.nearFull, P.nearNone));
      share.set(i, Math.max(THREE.MathUtils.smoothstep(t, P.from, P.to), close));
    }
    // Spread over the skin round it too, so the edge of the lats doesn't step.
    for (const i of [...share.keys()]) for (const j of near[i]) if (!share.has(j)) {
      p.fromBufferAttribute(position, j).applyMatrix4(skin.matrixWorld);
      if (sign * p.x > 0 && p.distanceTo(joint) < P.reach) share.set(j, 0);
    }
    for (let round = 0; round < P.smooth; round++) {
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
    // Copies of a vertex along a UV seam take one share, or the skin splits open there.
    for (const group of place.values()) {
      const vals = group.map((i) => share.get(i)).filter((v): v is number => v !== undefined);
      if (!vals.length) continue;
      const mean = vals.reduce((t, v) => t + v, 0) / vals.length;
      for (const i of group) share.set(i, mean);
    }

    // The arm's own skin closing the armpit from behind (the back of the deltoid and the triceps
    // where they meet the lat) hands part of its weight to the three-quarter helper, so it doesn't
    // fold into the armpit: most right under the joint, none a hand's width away.
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).applyMatrix4(skin.matrixWorld);
      if (sign * p.x <= 0 || p.y > joint.y + 0.01 || p.z > joint.z + 0.03) continue;
      const d = p.distanceTo(joint);
      if (d > P.foldNone) continue;
      const give = P.foldShare * (1 - THREE.MathUtils.smoothstep(d, P.foldFull, P.foldNone));
      if (give <= 0.005) continue;
      const w = new Map<number, number>();
      for (let k = 0; k < 4; k++) {
        const v = skinWeight.getComponent(i, k);
        if (v > 0) w.set(skinIndex.getComponent(i, k), (w.get(skinIndex.getComponent(i, k)) ?? 0) + v);
      }
      const armTotal = [...w].filter(([b]) => isArm(b)).reduce((t, [, v]) => t + v, 0);
      if (armTotal <= 0) continue;
      const next = new Map<number, number>();
      for (const [b, v] of w) next.set(b, isArm(b) ? v * (1 - give) : v);
      next.set(level[P.levels - 1], (next.get(level[P.levels - 1]) ?? 0) + armTotal * give);
      const top = [...next].filter(([, v]) => v > 0).sort((u, v) => v[1] - u[1]).slice(0, 4);
      const total = top.reduce((t, [, v]) => t + v, 0);
      for (let k = 0; k < 4; k++) {
        skinIndex.setComponent(i, k, top[k]?.[0] ?? 0);
        skinWeight.setComponent(i, k, top[k] ? top[k][1] / total : 0);
      }
    }

    // The trunk's part of each point's weight steps to the helpers at its share, between two levels.
    for (const [i, s] of share) {
      if (s <= 0) continue;
      const w = new Map<number, number>();
      for (let k = 0; k < 4; k++) {
        const v = skinWeight.getComponent(i, k);
        if (v > 0) w.set(skinIndex.getComponent(i, k), (w.get(skinIndex.getComponent(i, k)) ?? 0) + v);
      }
      const trunk = [...w].filter(([b]) => !isArm(b));
      const trunkTotal = trunk.reduce((t, [, v]) => t + v, 0);
      if (trunkTotal <= 0) continue;
      const x = Math.min(1, s) * P.levels;
      const a = Math.min(P.levels - 1, Math.floor(x));
      const f = x - a;
      const next = new Map<number, number>();
      for (const [b, v] of w) if (isArm(b)) next.set(b, v);
      if (a === 0) for (const [b, v] of trunk) next.set(b, (next.get(b) ?? 0) + v * (1 - f));
      else next.set(level[a], trunkTotal * (1 - f));
      next.set(level[a + 1], (next.get(level[a + 1]) ?? 0) + trunkTotal * f);
      const top = [...next].filter(([, v]) => v > 0).sort((u, v) => v[1] - u[1]).slice(0, 4);
      const total = top.reduce((t, [, v]) => t + v, 0);
      for (let k = 0; k < 4; k++) {
        skinIndex.setComponent(i, k, top[k]?.[0] ?? 0);
        skinWeight.setComponent(i, k, top[k] ? top[k][1] / total : 0);
      }
    }

    // Any other skin round the shoulder shared between the trunk and the arm (the deltoid, the top of
    // the shoulder blade, the front of the shoulder) blended the two bones straight: with the arm
    // overhead they are turned 150 degrees and more apart, and the blend between them shrinks toward
    // the joint, so the top of the shoulder caved behind and the front deltoid flattened (owner,
    // 2026-11-13). The same share now steps up the helpers instead: the trunk at none, each helper
    // at its share, the arm's own bones at all.
    const down = elbow.clone().sub(joint).normalize();
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).applyMatrix4(skin.matrixWorld);
      if (sign * p.x <= 0 || p.distanceTo(joint) > P.blendReach) continue;
      const w = new Map<number, number>();
      for (let k = 0; k < 4; k++) {
        const v = skinWeight.getComponent(i, k);
        if (v > 0) w.set(skinIndex.getComponent(i, k), (w.get(skinIndex.getComponent(i, k)) ?? 0) + v);
      }
      if ([...w.keys()].some((b) => level.includes(b) || b === capAt)) continue; // the lat's skin, done above
      const arm = [...w].filter(([b]) => isArm(b));
      const trunk = [...w].filter(([b]) => !isArm(b));
      const armTotal = arm.reduce((t, [, v]) => t + v, 0);
      const trunkTotal = trunk.reduce((t, [, v]) => t + v, 0);
      if (!arm.length) arm.push([at, 1]);
      if (!trunk.length) trunk.push([bones.indexOf(upper.parent as THREE.Bone), 1]);
      const s = armTotal / (armTotal + trunkTotal);
      // The skin over the joint itself (the top of the deltoid, the front of the shoulder) took the
      // whole arm's turn and, with the arm overhead, swung round the joint and sank toward the neck.
      // In the body the shoulder blade turns up and carries it. Here its arm part goes to the cap
      // bone, which keeps up with the arm until it is well up and then takes only part of the rest
      // of its swing: all of it right over the joint, none a hand's length down the arm.
      const along = p.clone().sub(joint).dot(down);
      const onCap = p.distanceTo(joint) < P.capReach ? 1 - THREE.MathUtils.smoothstep(along, P.capFrom, P.capTo) : 0;
      if (s < 0.01 || (s > 0.99 && onCap < 0.01)) continue;
      const x = s * P.levels;
      const a = Math.min(P.levels - 1, Math.floor(x));
      const f = x - a;
      // Level 0 is the trunk's own bones, level `levels` the arm's own, those between the helpers.
      const put = (lv: number, share: number, next: Map<number, number>) => {
        if (share <= 0) return;
        const group = lv === 0 ? trunk : lv === P.levels ? arm : null;
        if (!group) next.set(level[lv], (next.get(level[lv]) ?? 0) + share);
        else {
          const sum = group.reduce((t, [, v]) => t + v, 0);
          for (const [b, v] of group) next.set(b, (next.get(b) ?? 0) + (share * v) / sum);
        }
      };
      const next = new Map<number, number>();
      put(a, 1 - f, next);
      put(a + 1, f, next);
      for (const [b] of arm) {
        const v = next.get(b);
        if (!v) continue;
        next.set(b, v * (1 - onCap));
        next.set(capAt, (next.get(capAt) ?? 0) + v * onCap);
      }
      const top = [...next].filter(([, v]) => v > 0).sort((u, v) => v[1] - u[1]).slice(0, 4);
      const total = top.reduce((t, [, v]) => t + v, 0);
      for (let k = 0; k < 4; k++) {
        skinIndex.setComponent(i, k, top[k]?.[0] ?? 0);
        skinWeight.setComponent(i, k, top[k] ? top[k][1] / total : 0);
      }
    }
  }
  skinIndex.needsUpdate = true;
  skinWeight.needsUpdate = true;
  skin.bind(new THREE.Skeleton(bones, inverses), skin.bindMatrix);
  root.updateMatrixWorld(true);
}

// Set each helper from how its upper arm swings now: its share of the swing from rest, none of the twist.
function driveLatHelpers(root: THREE.Object3D, rest: Map<string, THREE.Quaternion>) {
  for (const tag of ["l", "r"]) {
    const upper = root.getObjectByName(`upperarm_${tag}`);
    const lower = root.getObjectByName(`lowerarm_${tag}`);
    const r = rest.get(tag);
    if (!upper || !lower || !r) continue;
    // The arm's turn since rest, in its own rest frame; the twist about its length taken out.
    const d = r.clone().invert().multiply(upper.quaternion);
    const axis = lower.position.clone().normalize();
    const v = new THREE.Vector3(d.x, d.y, d.z).projectOnVector(axis);
    const twist = new THREE.Quaternion(v.x, v.y, v.z, d.w).normalize();
    const spin = twist.clone();
    const swing = d.clone().multiply(twist.invert());
    if (swing.w < 0) swing.set(-swing.x, -swing.y, -swing.z, -swing.w);
    for (let k = 1; k <= LAT_STRETCH.levels; k++) {
      const helper = upper.parent?.getObjectByName(name(tag, k));
      if (!helper) continue;
      helper.quaternion.copy(r).multiply(new THREE.Quaternion().slerp(swing, k / LAT_STRETCH.levels));
      helper.position.copy(upper.position);
      helper.updateMatrixWorld(true);
    }
    const cap = upper.parent?.getObjectByName(`lat_cap_${tag}`);
    if (cap) {
      const angle = 2 * Math.acos(Math.min(1, swing.w));
      const bend = THREE.MathUtils.degToRad(LAT_STRETCH.capFromAngle);
      const keep = angle <= bend ? 1 : (bend + LAT_STRETCH.capShare * (angle - bend)) / angle;
      cap.quaternion.copy(r).multiply(new THREE.Quaternion().slerp(swing, keep)).multiply(spin); // with the arm's twist, as its skin has
      cap.position.copy(upper.position);
      cap.updateMatrixWorld(true);
    }
  }
}

// Keep the helpers following the arms whenever the skin is drawn or read. Call on the model as it
// will be posed, at rest, after followArmTwist and before followDeltaMush.
export function followLatStretch(root: THREE.Object3D) {
  const rest = new Map<string, THREE.Quaternion>();
  for (const tag of ["l", "r"]) {
    const upper = root.getObjectByName(`upperarm_${tag}`);
    if (upper) rest.set(tag, upper.quaternion.clone());
  }
  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const update = mesh.skeleton.update.bind(mesh.skeleton);
    const before = mesh.userData.beforeSkin as (() => void) | undefined;
    const drive = () => driveLatHelpers(root, rest);
    mesh.userData.beforeSkin = () => {
      before?.();
      drive();
    };
    mesh.skeleton.update = () => {
      drive();
      update();
    };
    // Reading one skin point on the CPU (what the tests measure) uses the bones as they stand, so
    // the helpers are brought up to the arms first, whenever an arm or its clavicle has moved.
    const uppers = ["l", "r"].map((tag) => root.getObjectByName(`upperarm_${tag}`)).filter((u): u is THREE.Object3D => !!u);
    let seen: number[] = [];
    const read = mesh.getVertexPosition.bind(mesh);
    mesh.getVertexPosition = (i, target) => {
      const now = uppers.flatMap((u) => [...u.quaternion.toArray(), ...u.parent!.matrixWorld.elements]);
      if (now.some((v, k) => v !== seen[k])) {
        drive();
        seen = now;
      }
      return read(i, target);
    };
  });
}
