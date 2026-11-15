// Upright row, from the owner's reference clips (2026-11-15): a slight lean forward and a grip wider
// than the shoulders, from one clip, and the arm's movement from the owner's own, filmed from the
// side. The body holds one position: knees a little soft, hips a little back, the trunk leaning
// forward in one straight piece, the eyes ahead.
//
// The elbows lift, and the forearms and hands only follow (owner, 2026-11-15): the hands go straight
// up close in front of the body, from hanging by the thighs with the arms down along it to the top,
// at about the nipples; the elbows go where the joints carry them, out to the sides and a little
// forward, rising to shoulder height and no higher. The top and bottom are where the joints put the
// arm: the upper arm up in its plane, the forearm from hanging to pointing forward and in. Pulled up breathing out, lowered
// slowly breathing in.
//
// Two ways, the same in all else: a bar, or a dumbbell in each hand held a little wider than the
// shoulders, the palms free to turn in a little toward the body (owner, 2026-11-15).
//
// Depth 0 = pulled up, 1 = lowered, as with the lateral raise.

import * as THREE from "three";

import { readGrip } from "./grip";
import { BAR_RADIUS, deg, qx, readRig, rotateWorld, setWorldPos, twoBoneIK, worldPos, worldQuat, type Rig } from "./pose";
import { holdArm, standFeet } from "./pose-curl";
import { frame, readSide, type PressSide } from "./pose-press";

export type UprightRowTool = "barbell" | "dumbbell";

export const UPRIGHT_ROW = {
  trunkLean: 12, // degrees the trunk leans forward from the hips: slightly, as the clip says
  hipsBack: 0.06, // metres the hips sit behind the ankles, balancing the lean
  hipsDrop: 0.02, // metres the hips sink, softening the knees
  neckBack: 10, // degrees the neck lifts back against the lean, so the eyes look ahead
  plane: 10, // degrees the upper arm's plane is forward of straight out to the side at the top: the elbows out to the sides and only a little forward, so the weight comes up near the body, not swung out in front like a front raise (owner, 2026-11-15)
  planeLowBar: 30, // the same with a bar: less, so the bar hangs closer in front of the body (owner, 2026-11-15), still clear of the thighs
  planeLow: 45, // and hanging, where the arm is only a little out from straight down, so this barely moves it: the arms down along the body (owner, 2026-11-15), the weight just in front of the thighs
  raiseTop: 85, // and at the top: about level, the elbow at shoulder height, not above
  bendLow: 14, // degrees the elbow is bent at the bottom with dumbbells, the forearm hanging a little forward of the upper arm: the hands close in front of the body (owner, 2026-11-15), the dumbbells just clear of the thighs
  bendLowBar: 17, // and with a bar: less bends the wrist toward the thumb past its range, the arms hanging out to the wide grip
  hangIn: 35, // degrees the elbow's bend at the bottom faces in from straight forward: the upper arm turned in a little as the hands hang overhand, the elbows pointing out and back
  foreLead: 1.3, // how far the forearm's rise leads the upper arm's, 1 being together: enough that the hands keep their width all the way, with no sudden change where it would run out
  dipTop: 0, // degrees the forearm points below level at the top: forward and only a little down, so the hand is at the nipples with the elbow at the shoulder
  wristFlexLow: 5, // degrees the wrist bends toward the palm with the arms hanging
  wristFlexTop: 20, // and at the top: only enough that the edge of the hand doesn't rise with the forearm (owner, 2026-11-15)
  barDiagonal: 15, // degrees the bar lies across the palm toward the knuckles' line, as a bar does with the forearms angled in: the wrist bends less sideways
  gripHalf: 0.25, // metres from the middle to each hand with a bar: a little wider than the shoulders, so the bar comes near the body with the elbows a little in front (owner, 2026-11-15) and the wrists within their sideways range
  dumbbellHalf: 0.25, // metres with dumbbells: a little wider than the shoulders (owner, 2026-11-15)
  turnIn: -10, // degrees the dumbbells turn from square across, the ends by the thumbs back toward the body, the same all the way: as near square as the wrist allows (owner, 2026-11-15); square bends it 40 sideways, past its range of 30
  stance: 0.13, // metres from the middle to each ankle
  toeOut: 8, // degrees
  barLength: 1.5, // metres
  plateRadius: 0.17, // metres: a small plate
  plateWidth: 0.04, // metres
  plateAt: 0.6, // metres from the middle to each plate's middle
  cameraTarget: [0, 1.0, 0.1] as [number, number, number],
  cameraReach: 0.82, // metres either side of the middle the bar reaches, with a margin
};

const smooth = (t: number) => t * t * (3 - 2 * t);


// thumbEnd: which way along each grip's axis the thumb is, +1 or -1, read once at rest.
type Side = PressSide & { bar: ReturnType<typeof readGrip>; barFrame: THREE.Quaternion; thumbEnd: { bar: number; dumbbell: number } };
export type UprightRowRig = { rig: Rig; tool: UprightRowTool; l: Side; r: Side; hips: THREE.Vector3 };

// Call once with the body at rest.
export function readUprightRowRig(root: THREE.Object3D, tool: UprightRowTool): UprightRowRig {
  const rig = readRig(root);
  const side = (tag: "l" | "r"): Side => {
    const a = readSide(root, rig, tag);
    const bar = readGrip(root, rig.skin, tag, BAR_RADIUS, UPRIGHT_ROW.barDiagonal);
    const length = worldPos(a.s.middle1).sub(worldPos(a.s.hand));
    const dir = bar.dir();
    const thumbSide = worldPos(root.getObjectByName(`index_01_${tag}`)!).sub(worldPos(root.getObjectByName(`pinky_01_${tag}`)!));
    const thumbEnd = { bar: Math.sign(dir.dot(thumbSide)) || 1, dumbbell: Math.sign(a.grip.dir().dot(thumbSide)) || 1 };
    return { ...a, bar, thumbEnd, barFrame: frame(length.addScaledVector(dir, -length.dot(dir)), dir) };
  };
  return { rig, tool, l: side("l"), r: side("r"), hips: worldPos(rig.pelvis) };
}

export function poseUprightRow(row: UprightRowRig, depth: number) {
  const P = UPRIGHT_ROW;
  const { rig, hips } = row;
  for (const [b, r] of rig.rest) {
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
  }
  rig.pelvis.parent!.updateMatrixWorld(true);

  // The body's one position: it does not change through the lift.
  setWorldPos(rig.pelvis, new THREE.Vector3(hips.x, hips.y - P.hipsDrop, rig.l.ankle.z - P.hipsBack));
  rotateWorld(rig.pelvis, qx(deg(P.trunkLean)));
  rotateWorld(rig.neck, qx(-deg(P.neckBack)));
  for (const a of [row.l, row.r]) standFeet(a, P.stance, P.toeOut);

  const dumbbell = row.tool === "dumbbell";
  const lift = smooth(1 - depth);
  const half = dumbbell ? P.dumbbellHalf : P.gripHalf;
  const dip = deg(P.dipTop);
  const planeAt = (l: number) => deg((dumbbell ? P.planeLow : P.planeLowBar) + (P.plane - (dumbbell ? P.planeLow : P.planeLowBar)) * l);
  const upperAt = (sign: number, raise: number, l: number) =>
    new THREE.Vector3(sign * Math.sin(raise) * Math.cos(planeAt(l)), -Math.cos(raise), Math.sin(raise) * Math.sin(planeAt(l)));
  // Hanging, the forearm carries on from the upper arm, bent a little forward and in.
  const hangingFore = (upper: THREE.Vector3, sign: number) => {
    const w = new THREE.Vector3(-sign * Math.sin(deg(P.hangIn)), 0, Math.cos(deg(P.hangIn)));
    w.addScaledVector(upper, -w.dot(upper)).normalize();
    const bend = deg(dumbbell ? P.bendLow : P.bendLowBar);
    return upper.clone().multiplyScalar(Math.cos(bend)).addScaledVector(w, Math.sin(bend));
  };
  // At the top: this far below level, and turned in from straight forward.
  const topFore = (sign: number, inward: number) =>
    new THREE.Vector3(-sign * Math.sin(inward) * Math.cos(dip), -Math.sin(dip), Math.cos(inward) * Math.cos(dip));
  // In between, it comes up from one to the other with the upper arm, a little ahead of it, so it can
  // turn in early enough to hold the hands' width as the elbows go out.
  const foreAt = (upper: THREE.Vector3, sign: number, inward: number, l: number) => {
    const from = hangingFore(upper, sign);
    const turn = new THREE.Quaternion().setFromUnitVectors(from, topFore(sign, inward));
    return from.applyQuaternion(new THREE.Quaternion().slerp(turn, 1 - (1 - l) ** P.foreLead));
  };

  const held = [row.l, row.r].map((a) => {
    const s = a.s;
    const sign = s.sign;
    const shoulder = worldPos(s.upperarm);
    // Across the hand, along the bar or handle: level, square across with a bar, turned a little with
    // dumbbells, the same all the way.
    const thumbs = new THREE.Vector3(-sign * Math.cos(deg(dumbbell ? P.turnIn : 0)), 0, Math.sin(deg(dumbbell ? P.turnIn : 0)));
    const grip = dumbbell ? a.grip : a.bar;
    // Find the value that puts the hand at this width, the hand moving out as it grows.
    const solve = (x: (v: number) => number, lo: number, hi: number) => {
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (x(mid) > half) hi = mid;
        else lo = mid;
      }
      return (lo + hi) / 2;
    };
    // The fist sits a little off the wrist: where the hand holds settles in a few passes.
    let offset = 0;
    for (let pass = 0; pass < 5; pass++) {
      const wristX = (upper: THREE.Vector3, fore: THREE.Vector3) =>
        sign * (shoulder.x + upper.x * a.upperLen + fore.x * a.foreLen + offset);
      // The arm as its joints carry it this far up, the hand at its width: the upper arm up in its
      // plane, the forearm turned in by as much as that width takes.
      const low = solve((r) => {
        const u = upperAt(sign, r, 0);
        return wristX(u, hangingFore(u, sign));
      }, 0, deg(60));
      const armAt = (l: number) => {
        const upper = upperAt(sign, low + (deg(P.raiseTop) - low) * l, l);
        const inward = solve((v) => wristX(upper, foreAt(upper, sign, -v, l)), deg(-90), deg(90));
        const fore = foreAt(upper, sign, -inward, l);
        return { upper, wrist: shoulder.clone().addScaledVector(upper, a.upperLen).addScaledVector(fore, a.foreLen) };
      };
      // The elbows lift; the forearms and hands only follow, the hands going straight up close in
      // front of the body, from hanging by the thighs to the top (owner, 2026-11-15). The elbow goes
      // where the joints would take it.
      const wrist = armAt(0).wrist.lerp(armAt(1).wrist, lift);
      twoBoneIK(s.upperarm, s.lowerarm, s.hand, a.upperLen, a.foreLen, wrist, armAt(lift).upper);
      const elbow = worldPos(s.lowerarm);
      const upper = elbow.clone().sub(shoulder).normalize();
      const fore = wrist.clone().sub(elbow).normalize();
      const bend = THREE.MathUtils.radToDeg(upper.angleTo(fore));
      const across = fore.clone().cross(upper);
      const hinge = across.lengthSq() > 1e-8 ? across.normalize() : new THREE.Vector3(1, 0, 0);
      holdArm(a, upper, hinge, upper, bend, thumbs);
      // The wrist bends toward the palm, more as the weight rises, the edge of the hand pointing down
      // rather than carrying on along the forearm, as in the owner's photo. The bar or handle lies as
      // it should all the way, level, square across with a bar and turned a little with dumbbells
      // (owner, 2026-11-15): the forearm turns and the wrist bends sideways by as much as that takes.
      // The wrist doesn't turn: turning the hand belongs to the forearm.
      const flex = -sign * deg(P.wristFlexLow + (P.wristFlexTop - P.wristFlexLow) * lift);
      const foreRest = s.lowerarm.quaternion.clone();
      const handRest = s.hand.quaternion.clone();
      // The grip's axis points to the thumb end or away from it, as read at rest: the same all the way.
      const want = thumbs.clone().multiplyScalar(dumbbell ? a.thumbEnd.dumbbell : a.thumbEnd.bar);
      const place = (turn: number, side: number) => {
        s.lowerarm.quaternion.copy(foreRest);
        s.hand.quaternion.copy(handRest);
        s.lowerarm.updateMatrixWorld(true);
        rotateWorld(s.lowerarm, new THREE.Quaternion().setFromAxisAngle(fore, turn));
        const radialAxis = a.radial.clone().applyQuaternion(worldQuat(s.lowerarm));
        radialAxis.addScaledVector(fore, -radialAxis.dot(fore)).normalize();
        const palmAxis = fore.clone().cross(radialAxis).normalize();
        const q1 = new THREE.Quaternion().setFromAxisAngle(radialAxis, flex);
        const q2 = new THREE.Quaternion().setFromAxisAngle(palmAxis.applyQuaternion(q1), side);
        rotateWorld(s.hand, q2.multiply(q1));
      };
      const miss = (turn: number, side: number) => {
        place(turn, side);
        return grip.dir().sub(want);
      };
      let turn = 0;
      let side = 0;
      for (let k = 0; k < 30; k++) {
        const e = miss(turn, side);
        const h = 1e-4;
        const jt = miss(turn + h, side).sub(e).divideScalar(h);
        const js = miss(turn, side + h).sub(e).divideScalar(h);
        // Least squares in the forearm's turn and the wrist's sideways bend.
        const a11 = jt.dot(jt), a12 = jt.dot(js), a22 = js.dot(js);
        const b1 = -jt.dot(e), b2 = -js.dot(e);
        const det = a11 * a22 - a12 * a12;
        if (Math.abs(det) < 1e-12) break;
        // Small steps: far from the answer the bends are not linear.
        const dt = (a22 * b1 - a12 * b2) / det;
        const ds = (a11 * b2 - a12 * b1) / det;
        const step = Math.min(1, 0.2 / Math.max(Math.abs(dt), Math.abs(ds), 1e-9));
        turn += dt * step;
        side += ds * step;
      }
      place(turn, side);
      grip.close();
      offset = grip.held().x - worldPos(s.hand).x;
    }
    return { grip: grip.held(), handle: grip.dir() };
  });
  // The bar's middle, between the hands.
  const barbell = dumbbell ? undefined : held[0].grip.clone().add(held[1].grip).multiplyScalar(0.5);
  return { l: held[0], r: held[1], barbell };
}
