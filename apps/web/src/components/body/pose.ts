// Poses the body from a baked clip plus small, bounded adjustments.
// Pure three.js (no React), so tests can pose the body without a browser.

import * as THREE from "three";

import backSquat from "./clips/back-squat-prmd.json";
import { readGrip } from "./grip";
import { faultOffsets, type SquatFaults } from "./squat";

export const X = new THREE.Vector3(1, 0, 0);
export const qx = (rad: number) => new THREE.Quaternion().setFromAxisAngle(X, rad);
export const deg = (d: number) => (d * Math.PI) / 180;

export const worldPos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
export const worldQuat = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());

export function rotateWorld(bone: THREE.Object3D, q: THREE.Quaternion) {
  const parentQ = worldQuat(bone.parent!).invert();
  bone.quaternion.copy(parentQ.multiply(q.clone().multiply(worldQuat(bone))));
  bone.updateMatrixWorld(true);
}

export function setWorldQuat(bone: THREE.Object3D, q: THREE.Quaternion) {
  bone.quaternion.copy(worldQuat(bone.parent!).invert().multiply(q));
  bone.updateMatrixWorld(true);
}

export function setWorldPos(bone: THREE.Object3D, p: THREE.Vector3) {
  bone.position.copy(bone.parent!.worldToLocal(p.clone()));
  bone.updateMatrixWorld(true);
}

// Turn `bone` so its child points at `target`.
export function aim(bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3) {
  const b = worldPos(bone);
  const from = worldPos(child).sub(b).normalize();
  const to = target.clone().sub(b).normalize();
  rotateWorld(bone, new THREE.Quaternion().setFromUnitVectors(from, to));
}

// Two-bone IK: upper -> lower -> end reaches target, bending toward hint.
export function twoBoneIK(
  upper: THREE.Object3D,
  lower: THREE.Object3D,
  end: THREE.Object3D,
  lenA: number,
  lenB: number,
  target: THREE.Vector3,
  hint: THREE.Vector3,
) {
  const a = worldPos(upper);
  const toTarget = target.clone().sub(a);
  const d = THREE.MathUtils.clamp(toTarget.length(), Math.abs(lenA - lenB) + 1e-3, lenA + lenB - 1e-4);
  const n = toTarget.normalize();
  const cosA = (lenA * lenA + d * d - lenB * lenB) / (2 * lenA * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const h = hint.clone().sub(n.clone().multiplyScalar(hint.dot(n))).normalize();
  const mid = a.clone().add(n.clone().multiplyScalar(lenA * cosA)).add(h.multiplyScalar(lenA * sinA));
  aim(upper, lower, mid);
  aim(lower, end, a.add(n.multiplyScalar(d)));
}

// The knee is a hinge: turn the thigh and the shin about their own length so
// each one's front faces square to the plane of hip, knee and ankle. IK that
// only aims the bones leaves them twisted. Near straight the plane is not
// defined, so the turn fades out below ~20 degrees of bend.
export function keepHinge(s: Rig["l"], ankle: THREE.Vector3) {
  const hip = worldPos(s.thigh);
  const knee = worldPos(s.calf);
  const thigh = knee.clone().sub(hip).normalize();
  const shin = ankle.clone().sub(knee).normalize();
  const axis = thigh.clone().cross(shin);
  const bend = thigh.angleTo(shin);
  const w = THREE.MathUtils.smoothstep(bend, deg(10), deg(30));
  if (w === 0) return;
  axis.normalize();
  if (axis.x < 0) axis.negate();
  const turn = (b: THREE.Object3D, front: THREE.Vector3, dir: THREE.Vector3) => {
    const now = front.clone().applyQuaternion(worldQuat(b));
    now.addScaledVector(dir, -now.dot(dir)).normalize();
    const want = dir.clone().cross(axis);
    const angle = Math.atan2(now.clone().cross(want).dot(dir), now.dot(want));
    rotateWorld(b, new THREE.Quaternion().setFromAxisAngle(dir, angle * w));
  };
  // Turning the thigh swings the shin with it, so aim the shin back at the
  // ankle before turning it in turn (which leaves the ankle where it is).
  turn(s.thigh, s.thighFront, thigh);
  aim(s.calf, s.foot, ankle);
  turn(s.calf, s.shinFront, worldPos(s.foot).sub(knee).normalize());
}

// A clip baked by tools/body/extract_clip.py or prmd_clip.mjs: per frame, each bone's
// world rotation change since rest, plus the hips' position change.
export type Clip = { fps: number; bones: string[]; frames: { hips: number[]; rot: number[][] }[] };
// Trunk and legs from UI-PRMD (a real deep squat, motion capture), arms from
// the Mixamo clip; see tools/body/prmd_clip.mjs.
export const CLIP = backSquat as Clip;

// The back squat played left-right even: each bone is averaged with its mirrored
// partner, so the trunk and head only bend forward and the arms match. The recorded
// subject sways, twists and holds the left elbow further back, and that shows.
function mirrored(clip: Clip): Clip {
  const partner = clip.bones.map((name, n) => {
    const at = clip.bones.indexOf(name.endsWith("_l") ? name.replace(/_l$/, "_r") : name.replace(/_r$/, "_l"));
    return at >= 0 ? at : n; // bones on the midline pair with themselves
  });
  // Reflecting across the body's midline flips a rotation's y and z.
  const flip = ([x, y, z, w]: number[]) => new THREE.Quaternion(x, -y, -z, w);
  return {
    ...clip,
    frames: clip.frames.map((f) => ({
      hips: [0, f.hips[1], f.hips[2]],
      rot: f.rot.map((q, n) => new THREE.Quaternion().fromArray(q).slerp(flip(f.rot[partner[n]]), 0.5).toArray()),
    })),
  };
}
export const SQUAT_CLIP = mirrored(CLIP);

export type Rig = ReturnType<typeof readRig>;

export function readRig(root: THREE.Object3D, clip: Clip = CLIP) {
  root.updateMatrixWorld(true);
  const bone = (name: string) => {
    const b = root.getObjectByName(name);
    if (!b) throw new Error(`body.glb has no bone ${name}`);
    return b;
  };
  const all: THREE.Object3D[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) all.push(o);
  });
  const rest = new Map(all.map((b) => [b, { q: b.quaternion.clone(), p: b.position.clone() }]));
  const front = (b: THREE.Object3D, child: THREE.Object3D) => {
    const dir = worldPos(child).sub(worldPos(b)).normalize();
    const z = new THREE.Vector3(0, 0, 1).addScaledVector(dir, -dir.z).normalize();
    return z.applyQuaternion(worldQuat(b).invert());
  };
  const side = (s: "l" | "r") => {
    const thigh = bone(`thigh_${s}`);
    const calf = bone(`calf_${s}`);
    const foot = bone(`foot_${s}`);
    const upperarm = bone(`upperarm_${s}`);
    const lowerarm = bone(`lowerarm_${s}`);
    const hand = bone(`hand_${s}`);
    return {
      upperarm,
      lowerarm,
      hand,
      lowerarmRest: worldQuat(lowerarm),
      handRest: worldQuat(hand),
      sign: s === "l" ? 1 : -1,
      thigh,
      calf,
      foot,
      ball: bone(`ball_${s}`),
      middle1: bone(`middle_01_${s}`),
      middle3: bone(`middle_03_${s}`),
      thighLen: worldPos(thigh).distanceTo(worldPos(calf)),
      shinLen: worldPos(calf).distanceTo(worldPos(foot)),
      ankle: worldPos(foot),
      // Front of the thigh and shin, fixed in each bone (the knee bends square to it).
      thighFront: front(thigh, calf),
      shinFront: front(calf, foot),
    };
  };
  // Clip order is parent before child, so each bone is set after its parent.
  const clipBones = clip.bones.map((name) => {
    const b = bone(name);
    return { bone: b, rest: worldQuat(b) };
  });
  // The deepest frame; depth 0..1 plays the clip from the first frame to it.
  let bottom = 0;
  clip.frames.forEach((f, i) => {
    if (f.hips[1] < clip.frames[bottom].hips[1]) bottom = i;
  });
  const pelvis = bone("pelvis");
  const spine3 = bone("spine_03");
  // Where the bar should sit: on the upper back, just below the base of the neck.
  const neck = worldPos(bone("neck_01"));
  const barOnBack = new THREE.Vector3(0, neck.y - 0.07, neck.z - 0.09);
  // Skin on top of the traps, either side of the neck, that the bar rests on.
  let skin: THREE.SkinnedMesh | undefined;
  root.traverse((o) => {
    if (!skin && (o as THREE.SkinnedMesh).isSkinnedMesh) skin = o as THREE.SkinnedMesh;
  });
  if (!skin) throw new Error("body.glb has no skinned mesh");
  const traps: number[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i < skin.geometry.attributes.position.count; i++) {
    skin.getVertexPosition(i, p).applyMatrix4(skin.matrixWorld);
    const x = Math.abs(p.x);
    if (x > 0.06 && x < 0.16 && p.y > neck.y - 0.12 && p.y < neck.y + 0.02 && p.z < neck.z) traps.push(i);
  }
  const grips = { l: readGrip(root, skin, "l", BAR_RADIUS, BAR_DIAGONAL), r: readGrip(root, skin, "r", BAR_RADIUS, BAR_DIAGONAL) };
  const rig = {
    clip,
    skin,
    traps,
    rest,
    clipBones,
    barLocal: spine3.worldToLocal(barOnBack),
    spine3Rest: worldQuat(spine3),
    bottom,
    l: { ...side("l"), grip: grips.l },
    r: { ...side("r"), grip: grips.r },
    pelvis,
    pelvisRest: worldPos(pelvis),
    pelvisRestQ: worldQuat(pelvis),
    // Hip position front to back at evenly spaced depths; see plantHips.
    hipBack: [] as number[],
    spine1: bone("spine_01"),
    spine2: bone("spine_02"),
    spine3,
    neck: bone("neck_01"),
  };
  // Plant the feet where the clip stands in its first frame (its stance and
  // toe-out), not where the rig stands at rest.
  playClip(rig, 0);
  for (const s of [rig.l, rig.r]) s.ankle = worldPos(s.foot).setY(s.ankle.y); // on the floor
  // The recorded hips come forward again deep in the squat; going down, ours only
  // go back. Once they have gone as far back as they will, they drop straight down.
  for (let i = 0; i <= HIP_SAMPLES; i++) {
    toRest(rig);
    playClip(rig, (i / HIP_SAMPLES) * bottom);
    plantHips(rig);
    rig.hipBack.push(Math.min(worldPos(pelvis).z, rig.hipBack[i - 1] ?? Infinity));
  }
  toRest(rig);
  root.updateMatrixWorld(true);
  return rig;
}

function toRest(rig: Rig) {
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);
}

// Our leg lengths differ a little from the clip's, so plant the feet where
// they stand at rest: move the hips by the difference, then fit the legs.
function plantHips(rig: Rig) {
  const sides = [rig.l, rig.r];
  const ankles = sides.map((s) => worldPos(s.foot));
  const drift = rig.l.ankle.clone().add(rig.r.ankle).sub(ankles[0]).sub(ankles[1]).multiplyScalar(0.5);
  setWorldPos(rig.pelvis, worldPos(rig.pelvis).add(drift));
  // Correct form stays centred over the feet; the recorded subject drifts sideways.
  setWorldPos(rig.pelvis, worldPos(rig.pelvis).setX((rig.l.ankle.x + rig.r.ankle.x) / 2));
}

// How far the pelvis has tipped forward since standing at rest, radians.
export function pelvisTilt(rig: Rig) {
  const top = new THREE.Vector3(0, 1, 0).applyQuaternion(worldQuat(rig.pelvis).multiply(rig.pelvisRestQ.clone().invert()));
  return Math.atan2(top.z, top.y);
}

const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion();

export function playClip(rig: Rig, frame: number) {
  const { clip } = rig;
  const i = Math.min(Math.floor(frame), clip.frames.length - 1);
  const j = Math.min(i + 1, clip.frames.length - 1);
  const k = frame - i;
  const a = clip.frames[i];
  const b = clip.frames[j];
  rig.clipBones.forEach(({ bone, rest }, n) => {
    q0.fromArray(a.rot[n]).slerp(q1.fromArray(b.rot[n]), k);
    setWorldQuat(bone, q0.clone().multiply(rest));
  });
  const hips = new THREE.Vector3().fromArray(a.hips).lerp(new THREE.Vector3().fromArray(b.hips), k);
  setWorldPos(rig.pelvis, rig.pelvisRest.clone().add(hips));
}

export const BAR_RADIUS = 0.014;
const BAR_DIAGONAL = -8; // degrees the bar turns in the palm, so the wrists stay in range with the forearms leaning out
const LEAN_AT_CHEST = 0.65; // share of a forward lean taken at the upper back, at the bottom
const BAR_CLEARANCE = 0.002; // metres the bar settles short of the traps, as other skin rises around it
const BAR_SETTLE_SOFT = 0.004; // metres; skin this much farther than the nearest counts about a third as much
const BAR_LOWER = 0.03; // metres the bar slides down the upper back, away from the neck
const GRIP_HALF = 0.355; // metres from the middle of the bar to each fist, the clip's grip when standing
const ELBOWS_OUT = 18; // degrees the elbows move out from the sides
const BAR_DROP = 0.5; // 0 = bar where the clip's hands are, 1 = on the upper back
const WRIST_STRAIGHTEN = 0.85; // 0 = the clip's wrist angle, 1 = in line with the forearm
const HIP_SAMPLES = 200; // depths sampled for the hips' path
const PELVIS_TILT = 28; // degrees forward the pelvis holds in a deep squat; more and the hip passes its range at the bottom
const PELVIS_HOLD_FROM = 0.45; // depth where the hold starts to apply
const PELVIS_HOLD_FULL = 0.6; // depth where it applies fully

export function pose(rig: Rig, depth: number, faults: SquatFaults) {
  toRest(rig);
  playClip(rig, depth * rig.bottom);
  plantHips(rig);
  const sample = depth * HIP_SAMPLES;
  const below = Math.min(Math.floor(sample), HIP_SAMPLES - 1);
  const hipBack = THREE.MathUtils.lerp(rig.hipBack[below], rig.hipBack[below + 1], sample - below);
  setWorldPos(rig.pelvis, worldPos(rig.pelvis).setZ(hipBack));
  const sides = [rig.l, rig.r];
  // Feet as planted now; tipping the upper body below must not tip them.
  const planted = sides.map((s) => {
    const toFoot = worldPos(s.ball).sub(worldPos(s.foot));
    return { q: worldQuat(s.foot), ball: s.ankle.clone().add(toFoot), toFoot, toes: worldQuat(s.ball) };
  });

  // Arms stay exactly as the clip has them. Only the wrists change: the clip's
  // bend back a lot, so turn each hand most of the way into line with its
  // forearm. The bar sits in the fists.
  for (const s of sides) {
    const straight = worldQuat(s.lowerarm).multiply(s.lowerarmRest.clone().invert()).multiply(s.handRest);
    setWorldQuat(s.hand, worldQuat(s.hand).slerp(straight, WRIST_STRAIGHTEN));
    s.grip.close();
  }
  const fist = (s: Rig["l"]) => s.grip.at();
  const barNow = () => fist(rig.l).add(fist(rig.r)).multiplyScalar(0.5);

  // Move a fist by swinging the whole arm at the shoulder, after opening or
  // closing the elbow just enough for the new reach, so the arm keeps its shape.
  const moveFist = (s: Rig["l"], target: THREE.Vector3) => {
    const shoulder = worldPos(s.upperarm);
    const elbow = worldPos(s.lowerarm);
    const f = fist(s);
    const a = shoulder.distanceTo(elbow);
    const b = f.distanceTo(elbow);
    const reach = THREE.MathUtils.clamp(target.distanceTo(shoulder), Math.abs(a - b) + 1e-3, a + b - 1e-3);
    const inner = (d: number) => Math.acos(THREE.MathUtils.clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
    const axis = shoulder.clone().sub(elbow).cross(f.clone().sub(elbow)).normalize();
    if (Number.isFinite(axis.x)) {
      rotateWorld(s.lowerarm, new THREE.Quaternion().setFromAxisAngle(axis, inner(reach) - inner(f.distanceTo(shoulder))));
    }
    const from = fist(s).sub(shoulder).normalize();
    rotateWorld(s.upperarm, new THREE.Quaternion().setFromUnitVectors(from, target.clone().sub(shoulder).normalize()));
  };

  // The clip's hands carry the bar up on the neck. Lower it toward the upper back.
  const onBack = rig.spine3.localToWorld(rig.barLocal.clone());
  for (const s of sides) moveFist(s, fist(s).lerp(onBack.clone().setX(fist(s).x), BAR_DROP));

  // Elbows a little out from the sides: raise each upper arm outward about
  // the chest's forward axis, then turn only the forearm at the elbow so the
  // fist goes back to the bar. The forearm ends up more upright.
  const chestFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(
    worldQuat(rig.spine3).multiply(rig.spine3Rest.clone().invert()),
  );
  for (const s of sides) {
    const grip = fist(s);
    rotateWorld(s.upperarm, new THREE.Quaternion().setFromAxisAngle(chestFwd, s.sign * deg(ELBOWS_OUT)));
    aim(s.lowerarm, s.middle1, worldPos(s.middle1).add(grip.clone().sub(fist(s))));
  }

  // Let the bar settle onto the traps: move it toward the nearest skin on top
  // of the shoulders until it touches, and the fists go with it. The skin
  // moves a little with the arms, so settle twice.
  // The bar is rigid and square to the feet; the recorded shoulders twist a few
  // degrees either way, and a bar that followed them would swing at its ends.
  const along = X;
  // First slide it down the upper back, away from the neck.
  const chestDown = new THREE.Vector3(0, -BAR_LOWER, 0).applyQuaternion(
    worldQuat(rig.spine3).multiply(rig.spine3Rest.clone().invert()),
  );
  for (const s of sides) moveFist(s, fist(s).add(chestDown));
  for (let pass = 0; pass < 2; pass++) {
    const skinPts = rig.traps.map((i) => rig.skin.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(rig.skin.matrixWorld));
    const start = barNow();
    const b = start.clone();
    for (let step = 0; step < 4; step++) {
      // Blend the nearest skin points by distance. Taking only the single nearest
      // makes the bar jump whenever a different point becomes the nearest.
      const toSkin = skinPts.map((p) => {
        const w = p.clone().sub(b);
        return w.addScaledVector(along, -w.dot(along));
      });
      const nearest = Math.min(...toSkin.map((w) => w.length()));
      const near = new THREE.Vector3();
      let total = 0;
      for (const w of toSkin) {
        const weight = Math.exp((nearest - w.length()) / BAR_SETTLE_SOFT);
        near.addScaledVector(w, weight);
        total += weight;
      }
      if (total === 0) break;
      near.divideScalar(total);
      b.addScaledVector(near.clone().normalize(), near.length() - BAR_RADIUS - BAR_CLEARANCE);
    }
    const shift = b.sub(start);
    for (const s of sides) moveFist(s, fist(s).add(shift));
  }

  // A loaded lifter keeps the bar over the middle of the foot; the clip drifts
  // a few centimetres either way. Tip the upper body about the hips to put the
  // bar back there (a few degrees), keeping the eyes where they were.
  const mid = (a: THREE.Object3D, b: THREE.Object3D) => worldPos(a).add(worldPos(b)).multiplyScalar(0.5);
  const midfoot = mid(rig.l.foot, rig.r.foot).lerp(mid(rig.l.ball, rig.r.ball), 0.45).setY(0);
  const tipToMidfoot = (pivot: THREE.Object3D) => {
    const at = worldPos(pivot);
    const v = barNow().sub(at);
    const r = Math.hypot(v.y, v.z);
    return Math.asin(THREE.MathUtils.clamp((midfoot.z - at.z) / r, -1, 1)) - Math.atan2(v.z, v.y);
  };
  const balance = tipToMidfoot(rig.pelvis);
  rotateWorld(rig.pelvis, qx(balance));
  rotateWorld(rig.neck, qx(-balance * 0.8));

  // That tip would roll the pelvis back under a still chest as the squat deepens,
  // which reads as a thrust of the hips. Hold the pelvis forward instead and take
  // the difference out of the lower back, so the chest stays where it was, then
  // set the bar back over the foot from the lower back. Leaning forward and lifting
  // the heels fold the hip further on their own, so those two faults go without it.
  const holdTilt =
    faults.forwardLean || faults.heelRise
      ? 0
      : Math.max(0, deg(PELVIS_TILT) - pelvisTilt(rig)) * THREE.MathUtils.smoothstep(depth, PELVIS_HOLD_FROM, PELVIS_HOLD_FULL);
  rotateWorld(rig.pelvis, qx(holdTilt));
  rotateWorld(rig.spine1, qx(-holdTilt * 0.6));
  rotateWorld(rig.spine2, qx(-holdTilt * 0.4));
  rotateWorld(rig.spine1, qx(tipToMidfoot(rig.spine1)));

  // Form faults are small changes on top of the real movement.
  const f = faultOffsets(depth, faults);
  const lean = deg(f.lean);
  const tuck = deg(f.tuck);
  // Deep down the hips are near their limit, so the lean comes from the upper
  // back dropping instead.
  const chestDrop = lean * LEAN_AT_CHEST * depth;
  rotateWorld(rig.pelvis, qx(lean - chestDrop - tuck));
  rotateWorld(rig.spine3, qx(chestDrop));
  // Butt wink: pelvis tucks, the lower spine rounds, the chest keeps its angle.
  rotateWorld(rig.spine1, qx(tuck * 0.6));
  rotateWorld(rig.spine2, qx(tuck * 0.4));
  rotateWorld(rig.neck, qx(-lean * 0.8));

  const heel = deg(f.heelLift);
  sides.forEach((s, i) => {
    const footQ = planted[i].q;
    const ball = planted[i].ball;
    // Heels lift by turning the foot about the ball of the foot.
    const target = s.ankle.clone().sub(ball).applyQuaternion(qx(heel)).add(ball);
    // The knee bends toward the toes: it tracks over the foot on a smooth path
    // and can't flip backward when the leg is nearly straight.
    const hint = planted[i].toFoot.clone().setY(0).normalize();
    hint.x -= s.sign * f.kneeIn * 0.15;
    twoBoneIK(s.thigh, s.calf, s.foot, s.thighLen, s.shinLen, target, hint);
    keepHinge(s, target);
    setWorldQuat(s.foot, qx(heel).multiply(footQ));
    // The toes stay flat on the floor; a raised heel bends them where they
    // meet the foot.
    setWorldQuat(s.ball, planted[i].toes);
  });

  // One straight bar through both hands. Each hand brings its own grip onto the
  // bar: the forearm turns the palm to meet it, the wrist takes what is left, and
  // the arm carries the hand there. Bodies aren't even, so neither hand decides:
  // the bar stays centred over the feet and each fist holds its own spot on it.
  const bar = barNow().setX((rig.l.ankle.x + rig.r.ankle.x) / 2);
  for (let pass = 0; pass < 3; pass++) {
    for (const s of sides) {
      const want = s.grip.dir().dot(along) > 0 ? along.clone() : along.clone().negate();
      const fore = worldPos(s.hand).sub(worldPos(s.lowerarm)).normalize();
      const flat = (v: THREE.Vector3) => v.clone().addScaledVector(fore, -v.dot(fore)).normalize();
      const now = flat(s.grip.dir());
      const to = flat(want);
      rotateWorld(s.lowerarm, new THREE.Quaternion().setFromAxisAngle(fore, Math.atan2(now.clone().cross(to).dot(fore), now.dot(to))));
      rotateWorld(s.hand, new THREE.Quaternion().setFromUnitVectors(s.grip.dir(), want));
      moveFist(s, bar.clone().addScaledVector(along, s.sign * GRIP_HALF));
    }
  }
  return {
    hip: mid(rig.l.thigh, rig.r.thigh),
    bar,
    // Level, square to the feet.
    barDir: along,
    midfoot,
  };
}
