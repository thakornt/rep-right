// Anatomy checks for a posed body. Joint angles are measured from the bones
// (where each segment points, and which way its front faces), not from bone
// rotations, then compared with what a human joint can do. A pose a real body
// cannot make fails a test instead of reaching the page.
//
// The rig's rest pose is not the anatomical position (the arms hang out in an
// A-pose with the elbows bent and the hands forward), so every angle below is
// built from landmarks. Only the trunk and legs stand anatomically at rest, so
// the spine uses rotation since rest.

import * as THREE from "three";

// Degrees. Typical upper limits of healthy adults (AAOS / clinical ROM
// tables), widened where a loaded deep squat goes past active range: ankle
// dorsiflexion and knee flexion under body weight. These are "can a human do
// this at all" bounds, not targets for good form.
export const LIMITS = {
  "hip.flexion": [-30, 125], // extension 30
  "hip.abduction": [-30, 45], // adduction 30
  "hip.rotation": [-45, 45], // + = external
  "knee.flexion": [-5, 155], // 135 active; ~155 when sitting into a deep squat
  "knee.varus": [-10, 10], // a hinge: the shank stays in the thigh's plane
  "knee.rotation": [-30, 30], // tibia on femur, only with the knee bent
  "ankle.dorsiflexion": [-50, 45], // 20 active; 35-45 under load
  "ankle.toeOut": [-25, 25], // foot turning about the shin
  "shoulder.elevation": [0, 180],
  "shoulder.rotation": [-70, 90], // + = external
  "elbow.flexion": [-5, 150],
  "elbow.carrying": [-20, 20], // a hinge: the forearm stays in the arm's plane
  "forearm.pronation": [-5, 170], // 0 = palm forward (anatomical), 90 = thumb up
  "wrist.flexion": [-70, 80], // extension 70
  "wrist.deviation": [-30, 20], // + = toward the thumb
  "wrist.twist": [-15, 15], // turning the hand belongs to the forearm
  "lumbar.flexion": [-25, 60],
  "lumbar.lateral": [-25, 25],
  "lumbar.rotation": [-15, 15],
  "thoracic.flexion": [-25, 45],
  "thoracic.lateral": [-30, 30],
  "thoracic.rotation": [-40, 40],
  "neck.flexion": [-60, 50],
  "neck.lateral": [-45, 45],
  "neck.rotation": [-80, 80],
} satisfies Record<string, [number, number]>;

export type Motion = keyof typeof LIMITS;
// Behind the body the shoulder only reaches so far (extension / horizontal
// abduction); measured as elevation in planes more than 45 degrees behind the
// side.
const SHOULDER_BEHIND_MAX = 60;

const DEG = 180 / Math.PI;
const v3 = () => new THREE.Vector3();
const pos = (o: THREE.Object3D) => o.getWorldPosition(v3());
const quat = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());
// A direction fixed in a bone, as it points now.
const carried = (o: THREE.Object3D, local: THREE.Vector3) => local.clone().applyQuaternion(quat(o));
const local = (o: THREE.Object3D, world: THREE.Vector3) => world.clone().applyQuaternion(quat(o).invert());
const reject = (v: THREE.Vector3, axis: THREE.Vector3) => v.clone().addScaledVector(axis, -v.dot(axis)).normalize();
// Signed angle from a to b about axis (all unit, a and b perpendicular to axis).
const about = (a: THREE.Vector3, b: THREE.Vector3, axis: THREE.Vector3) =>
  Math.atan2(a.clone().cross(b).dot(axis), a.dot(b)) * DEG;

// x lateral-ish (world +X at the anatomical position, on both sides),
// y toward the segment's proximal end, z to the front.
type Frame = { x: THREE.Vector3; y: THREE.Vector3; z: THREE.Vector3 };
function frameYZ(y: THREE.Vector3, z: THREE.Vector3): Frame {
  const Y = y.clone().normalize();
  const Z = reject(z, Y);
  return { x: Y.clone().cross(Z), y: Y, z: Z };
}
function frameXY(x: THREE.Vector3, y: THREE.Vector3): Frame {
  const Y = y.clone().normalize();
  const Xn = reject(x, Y);
  return { x: Xn, y: Y, z: Xn.clone().cross(Y) };
}
const inFrame = (f: Frame, v: THREE.Vector3) => new THREE.Vector3(v.dot(f.x), v.dot(f.y), v.dot(f.z));

// Ball joint: where the child segment points in the parent's frame, plus how
// far it has turned about its own axis beyond the shortest swing from the
// anatomical position.
function ball(parent: Frame, child: Frame, sign: number) {
  const a = inFrame(parent, child.y.clone().negate()); // distal direction
  const swing = new THREE.Quaternion().setFromUnitVectors(parent.y, child.y);
  const front = parent.z.clone().applyQuaternion(swing);
  return {
    flexion: Math.atan2(a.z, -a.y) * DEG,
    abduction: Math.asin(THREE.MathUtils.clamp(sign * a.x, -1, 1)) * DEG,
    elevation: Math.acos(THREE.MathUtils.clamp(-a.y, -1, 1)) * DEG,
    // 0 = out to the side, 90 = forward, negative = behind
    plane: Math.atan2(a.z, sign * a.x) * DEG,
    rotation: sign * about(reject(front, child.y), child.z, child.y),
  };
}

export type Anatomy = ReturnType<typeof readAnatomy>;

// Call once with the body at rest.
export function readAnatomy(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const bone = (name: string) => {
    const b = root.getObjectByName(name);
    if (!b) throw new Error(`body has no bone ${name}`);
    return b;
  };
  const restQ = (o: THREE.Object3D) => quat(o);
  const Z = new THREE.Vector3(0, 0, 1);
  const side = (s: "l" | "r") => {
    const b = {
      upperarm: bone(`upperarm_${s}`),
      lowerarm: bone(`lowerarm_${s}`),
      hand: bone(`hand_${s}`),
      index: bone(`index_01_${s}`),
      middle: bone(`middle_01_${s}`),
      // Not the little finger's knuckle: it moves when the palm cups around a handle.
      ring: bone(`ring_01_${s}`),
      thigh: bone(`thigh_${s}`),
      calf: bone(`calf_${s}`),
      foot: bone(`foot_${s}`),
      ball: bone(`ball_${s}`),
    };
    const upper = pos(b.lowerarm).sub(pos(b.upperarm));
    const fore = pos(b.hand).sub(pos(b.lowerarm));
    const thighY = pos(b.thigh).sub(pos(b.calf)).normalize();
    const shinY = pos(b.calf).sub(pos(b.foot)).normalize();
    const foot = pos(b.ball).sub(pos(b.foot));
    const shin = frameYZ(shinY, Z);
    return {
      ...b,
      sign: s === "l" ? 1 : -1,
      // The elbow's hinge axis, from the rig's bent rest elbow; it is fixed in
      // the upper arm and points to +X on both sides at the anatomical position.
      hinge: local(b.upperarm, fore.clone().cross(upper).normalize()),
      // Thumb side of the wrist, fixed in the forearm.
      radial: local(b.lowerarm, reject(pos(b.index).sub(pos(b.ring)), fore.clone().normalize())),
      thighFront: local(b.thigh, reject(Z, thighY)),
      shinFront: local(b.calf, reject(Z, shinY)),
      footDown: Math.atan2(-inFrame(shin, foot).y, inFrame(shin, foot).z) * DEG,
      footOut: Math.atan2(inFrame(shin, foot).x * (s === "l" ? 1 : -1), inFrame(shin, foot).z) * DEG,
    };
  };
  const trunk = ["pelvis", "spine_02", "spine_03", "head"].map((n) => {
    const b = bone(n);
    return { bone: b, rest: restQ(b) };
  });
  return { l: side("l"), r: side("r"), trunk, pelvis: bone("pelvis"), spine3: bone("spine_03") };
}

export type Angles = Partial<Record<Motion, number>>;

// Joint angles of the body as posed now, per side ("l", "r") and for the trunk.
export function measure(an: Anatomy) {
  const delta = (t: Anatomy["trunk"][number]) => quat(t.bone).multiply(t.rest.clone().invert());
  const [pelvisD, spine2D, spine3D, headD] = an.trunk.map(delta);
  const trunkFrame = (d: THREE.Quaternion): Frame => ({
    x: new THREE.Vector3(1, 0, 0).applyQuaternion(d),
    y: new THREE.Vector3(0, 1, 0).applyQuaternion(d),
    z: new THREE.Vector3(0, 0, 1).applyQuaternion(d),
  });
  const pelvis = trunkFrame(pelvisD);
  const chest = trunkFrame(spine3D);
  const segment = (from: THREE.Quaternion, to: THREE.Quaternion, name: "lumbar" | "thoracic" | "neck") => {
    const e = new THREE.Euler().setFromQuaternion(from.clone().invert().multiply(to), "YXZ");
    return {
      [`${name}.flexion`]: e.x * DEG,
      [`${name}.lateral`]: e.z * DEG,
      [`${name}.rotation`]: e.y * DEG,
    } as Angles;
  };
  const trunk: Angles = {
    ...segment(pelvisD, spine2D, "lumbar"),
    ...segment(spine2D, spine3D, "thoracic"),
    ...segment(spine3D, headD, "neck"),
  };

  const side = (s: Anatomy["l"]): Angles => {
    const sign = s.sign;
    const hip = pos(s.thigh);
    const knee = pos(s.calf);
    const ankle = pos(s.foot);
    const thigh = frameYZ(hip.clone().sub(knee), carried(s.thigh, s.thighFront));
    const shin = frameYZ(knee.clone().sub(ankle), carried(s.calf, s.shinFront));
    const h = ball(pelvis, thigh, sign);
    const k = inFrame(thigh, shin.y.clone().negate());
    const kneeTurn = ball(thigh, shin, sign);
    const foot = inFrame(shin, pos(s.ball).sub(ankle));

    const shoulder = pos(s.upperarm);
    const elbow = pos(s.lowerarm);
    const wrist = pos(s.hand);
    const arm = frameXY(carried(s.upperarm, s.hinge), shoulder.clone().sub(elbow));
    const sh = ball(chest, arm, sign);
    const fore = wrist.clone().sub(elbow).normalize();
    const e = inFrame(arm, fore);
    const radial = reject(carried(s.lowerarm, s.radial), fore);
    const lateral = reject(arm.x.clone().multiplyScalar(sign), fore);
    const palmar = fore.clone().cross(radial).multiplyScalar(sign);
    const hand = pos(s.middle).sub(wrist).normalize();
    const handRadial = reject(pos(s.index).sub(pos(s.ring)), hand);

    return {
      "hip.flexion": h.flexion,
      "hip.abduction": h.abduction,
      "hip.rotation": h.rotation,
      "knee.flexion": Math.atan2(-k.z, -k.y) * DEG,
      "knee.varus": Math.asin(THREE.MathUtils.clamp(sign * k.x, -1, 1)) * DEG,
      "knee.rotation": kneeTurn.rotation,
      "ankle.dorsiflexion": s.footDown - Math.atan2(-foot.y, foot.z) * DEG,
      "ankle.toeOut": Math.atan2(sign * foot.x, foot.z) * DEG - s.footOut,
      "shoulder.elevation": sh.elevation,
      "shoulder.rotation": sh.rotation,
      "elbow.flexion": Math.atan2(e.z, -e.y) * DEG,
      "elbow.carrying": Math.asin(THREE.MathUtils.clamp(sign * e.x, -1, 1)) * DEG,
      "forearm.pronation": sign * about(lateral, radial, fore),
      "wrist.flexion": Math.atan2(hand.dot(palmar), hand.dot(fore)) * DEG,
      "wrist.deviation": Math.atan2(hand.dot(radial), hand.dot(fore)) * DEG,
      "wrist.twist": about(reject(radial, hand), handRadial, hand),
      // Not limited by itself; used for the "behind the body" rule.
      ...({ "shoulder.plane": sh.plane } as Angles),
    };
  };
  return { trunk, l: side(an.l), r: side(an.r) };
}

export type Violation = { joint: string; value: number; min: number; max: number };

export function violations(m: ReturnType<typeof measure>): Violation[] {
  const out: Violation[] = [];
  const check = (prefix: string, angles: Angles) => {
    for (const [k, value] of Object.entries(angles) as [Motion, number][]) {
      const limit = LIMITS[k];
      if (!limit) continue;
      const [min, max] = limit;
      if (value < min || value > max) out.push({ joint: prefix + k, value, min, max });
    }
  };
  check("", m.trunk);
  for (const s of ["l", "r"] as const) {
    const a = m[s];
    check(`${s} `, a);
    const plane = (a as Record<string, number>)["shoulder.plane"];
    const elevation = a["shoulder.elevation"]!;
    if (plane < -45 && elevation > SHOULDER_BEHIND_MAX) {
      out.push({ joint: `${s} shoulder.behind`, value: elevation, min: 0, max: SHOULDER_BEHIND_MAX });
    }
  }
  return out;
}
