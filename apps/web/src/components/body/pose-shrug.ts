// Dumbbell shrug, as the owner set it out (2026-11-17). The body holds the lateral raise's position
// all the way: knees a little bent, hips back, the trunk leaning forward a little in one straight
// piece. A dumbbell in each hand beside the body, palms facing in; the arms hang straight down seen
// from the side and about 10 degrees out seen from the front, where straight down they would sink into
// the thighs. The shoulders lift up toward the ears and squeeze in toward the neck, and the upper
// trapezius swells over the tops of the shoulders; only the shoulders
// move, and the arms keep hanging from them. The trapezius's shape at the top is the owner's sculpt.
//
// Depth 0 = shoulders up, 1 = shoulders down, as with the other lifts.

import * as THREE from "three";

import { deg, qx, readRig, rotateWorld, setWorldPos, worldPos, type Rig } from "./pose";
import { holdArm, standFeet } from "./pose-curl";
import { readSide, type PressSide } from "./pose-press";
import { LATERAL_RAISE } from "./pose-raise";
import SHRUG_SCULPT_JSON from "./shrug-sculpt.json";

// Points the owner's sculpt moves (rest space offsets) and the sculpted surface's normals.
export const SHRUG_SCULPT = SHRUG_SCULPT_JSON as { index: number[]; delta: number[]; normalIndex?: number[]; normal?: number[] };

export const DUMBBELL_SHRUG = {
  shoulderUp: 38, // degrees the collarbones rise at the top: with shoulderIn, the shoulders 11.1 cm up toward the ears (owner, 2026-11-17)
  shoulderIn: 15, // degrees the collarbones turn back about the trunk's length at the top: the shoulders squeeze in 2.2 cm toward the neck and 1.4 cm back (owner, 2026-11-17)
  armOutTop: 12, // degrees out with the shoulders all the way up: the shoulders squeeze in 2.2 cm, and this keeps the dumbbells off the hips
  armOut: 10, // degrees the arms hang out from straight down, seen from the front: straight down, the forearms would sink into the thighs on this body (owner chose 10, 2026-11-17)
  // The upper arm's skin runs about 5.5 degrees off its bone, so a straight elbow by the bones looks
  // bent backward (owner, 2026-11-17). Bent this much the skin of the upper arm and the forearm
  // lines up straight.
  elbowBend: 6, // degrees the elbows bend
  elbowBendTop: 8, // and with the shoulders all the way up, keeping the forearm's skin in line with the upper arm's
  armForward: -6, // degrees the upper arms swing forward of straight down: back this far, the arm's skin hangs straight down seen from the side
  armForwardTop: -8, // and with the shoulders all the way up, squeezed in, where the shoulder's skin shifts
  // The body's position, the same as the lateral raise's (owner, 2026-11-17).
  trunkLean: LATERAL_RAISE.trunkLean,
  hipsBack: LATERAL_RAISE.hipsBack,
  hipsDrop: LATERAL_RAISE.hipsDrop,
  neckBack: LATERAL_RAISE.neckBack,
  stance: LATERAL_RAISE.stance,
  toeOut: LATERAL_RAISE.toeOut,
  cameraTarget: [0, 1.0, 0] as [number, number, number],
  cameraReach: 0.6, // metres either side of the middle in view
};

export type ShrugRig = { rig: Rig; l: PressSide; r: PressSide; hips: THREE.Vector3 };

const DOWN = new THREE.Vector3(0, -1, 0);
const ACROSS = new THREE.Vector3(1, 0, 0);
const FRONT = new THREE.Vector3(0, 0, 1);

// The upper trapezius at the top of the shrug, as the owner sculpted it in Blender (2026-11-17), from
// the body posed at the top: each moved point's offset, in the mesh's rest space so it rides with the
// bones. Made with tools/body/out/shrug (not in the repository); 440 points, up to 5.5 cm.
function readShrugSculpt(rig: Rig) {
  const { position } = rig.skin.geometry.attributes;
  const at = new Float32Array(position.count * 3);
  SHRUG_SCULPT.index.forEach((i, k) => at.set(SHRUG_SCULPT.delta.slice(k * 3, k * 3 + 3), i * 3));
  rig.skin.geometry.setAttribute("aShrug", new THREE.BufferAttribute(at, 3));
  // and the sculpted surface's normals, in rest space, where they differ from the mesh's own
  const nor = new Float32Array(position.count * 3);
  const normals = SHRUG_SCULPT.normal ?? [];
  (SHRUG_SCULPT.normalIndex ?? []).forEach((i, k) => nor.set(normals.slice(k * 3, k * 3 + 3), i * 3));
  rig.skin.geometry.setAttribute("aShrugNormal", new THREE.BufferAttribute(nor, 3));
}

// Call once with the body at rest.
export function readShrugRig(root: THREE.Object3D): ShrugRig {
  const rig = readRig(root);
  readShrugSculpt(rig);
  return { rig, l: readSide(root, rig, "l"), r: readSide(root, rig, "r"), hips: worldPos(rig.pelvis) };
}

// How much of the sculpted shape is on at this depth: all of it with the shoulders all the way up.
export const shrugSculpt = (depth: number) => THREE.MathUtils.smoothstep(1 - depth, 0, 1);
// How much of the shoulders' corrective smoothing (delta-mush.ts) stays on: the sculpt was made on the
// plainly skinned body, so the smoothing makes way for it, none of it left at the top.
export const shrugMush = (depth: number) => 1 - shrugSculpt(depth);


export function poseShrug(shrug: ShrugRig, depth: number) {
  const P = DUMBBELL_SHRUG;
  const { rig, hips } = shrug;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);

  // The body's one position: it does not change through the lift.
  setWorldPos(rig.pelvis, new THREE.Vector3(hips.x, hips.y - P.hipsDrop, rig.l.ankle.z - P.hipsBack));
  rotateWorld(rig.pelvis, qx(deg(P.trunkLean)));
  rotateWorld(rig.neck, qx(-deg(P.neckBack)));

  // The shoulders: up toward the ears and squeezed in, about the chest's own axes.
  const up = 1 - depth;
  const chest = qx(deg(P.trunkLean));
  const front = FRONT.clone().applyQuaternion(chest);
  const along = new THREE.Vector3(0, 1, 0).applyQuaternion(chest);
  const out = [shrug.l, shrug.r].map((a) => {
    const { sign } = a.s;
    standFeet(a, P.stance, P.toeOut);
    const clavicle = a.s.upperarm.parent!;
    rotateWorld(clavicle, new THREE.Quaternion().setFromAxisAngle(along, sign * deg(P.shoulderIn * up)));
    rotateWorld(clavicle, new THREE.Quaternion().setFromAxisAngle(front, sign * deg(P.shoulderUp * up)));
    // The arm hangs down from the shoulder, straight to the eye and its crease forward, the palm
    // facing in with the thumb forward.
    const armOut = P.armOut + (P.armOutTop - P.armOut) * up;
    const hang = DOWN.clone().applyAxisAngle(ACROSS, -deg(P.armForward + (P.armForwardTop - P.armForward) * up)).applyAxisAngle(FRONT, sign * deg(armOut));
    const hinge = ACROSS.clone().applyAxisAngle(FRONT, sign * deg(armOut));
    return holdArm(a, hang, hinge, hang, P.elbowBend + (P.elbowBendTop - P.elbowBend) * up, FRONT);
  });
  return { l: out[0], r: out[1] };
}
