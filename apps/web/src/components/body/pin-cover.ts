// Whether a pin sits over the body on screen, so it can turn see-through and leave the body in view:
// the body lies somewhere along the line from the camera through the pin's spot, in front of it or
// behind. The body is stood in for by a rounded rod along each bone, cheap enough to check every frame.

import * as THREE from "three";

import { worldPos, type Rig } from "./pose";

type Rod = { a: THREE.Vector3; b: THREE.Vector3; r: number };

export const PIN_RADIUS = 14; // pixels: the numbered circles are 28 across
const BEYOND = 3; // metres past the spot the line of sight is followed, for body behind it

// Rods for the body as posed now: the trunk as three side by side, then the head, arms and legs.
function rods(rig: Rig): Rod[] {
  const p = worldPos;
  const head = rig.neck.children.find((c) => c.name === "head") ?? rig.neck;
  const neck = p(rig.neck);
  const skull = p(head);
  const up = skull.clone().sub(neck).normalize();
  const out: Rod[] = [
    { a: p(rig.pelvis), b: neck, r: 0.1 },
    { a: skull, b: skull.clone().addScaledVector(up, 0.12), r: 0.095 },
  ];
  for (const s of [rig.l, rig.r]) {
    out.push(
      // The side of the trunk, stopping short of the shoulder joint, which sits nearer the skin.
      { a: p(s.thigh), b: p(s.thigh).lerp(p(s.upperarm), 0.8), r: 0.08 },
      { a: p(s.upperarm), b: p(s.lowerarm), r: 0.05 },
      { a: p(s.lowerarm), b: p(s.hand), r: 0.04 },
      { a: p(s.hand), b: p(s.middle1), r: 0.03 },
      { a: p(s.thigh), b: p(s.calf), r: 0.075 },
      { a: p(s.calf), b: p(s.foot), r: 0.055 },
      { a: p(s.foot), b: p(s.ball), r: 0.04 },
    );
  }
  return out;
}

// Closest distance between segments p1-q1 and p2-q2, and how far along the first it falls (0..1).
function segmentGap(p1: THREE.Vector3, q1: THREE.Vector3, p2: THREE.Vector3, q2: THREE.Vector3) {
  const d1 = q1.clone().sub(p1);
  const d2 = q2.clone().sub(p2);
  const r = p1.clone().sub(p2);
  const a = d1.dot(d1);
  const e = d2.dot(d2);
  const f = d2.dot(r);
  let s: number;
  let t: number;
  const c = d1.dot(r);
  const b = d1.dot(d2);
  const denom = a * e - b * b;
  s = denom > 1e-12 ? THREE.MathUtils.clamp((b * f - c * e) / denom, 0, 1) : 0;
  t = (b * s + f) / e;
  if (t < 0) {
    t = 0;
    s = THREE.MathUtils.clamp(-c / a, 0, 1);
  } else if (t > 1) {
    t = 1;
    s = THREE.MathUtils.clamp((b - c) / a, 0, 1);
  }
  const c1 = p1.clone().addScaledVector(d1, s);
  const c2 = p2.clone().addScaledVector(d2, t);
  return { gap: c1.distanceTo(c2), along: s };
}

// For each spot, whether the body lies along the line of sight through it, or close enough to
// it that the pin's circle, `radius` pixels on a view `height` pixels tall, reaches over the body.
export function overBody(rig: Rig, camera: THREE.PerspectiveCamera, spots: THREE.Vector3[], radius: number, height: number) {
  const body = rods(rig);
  const eye = camera.position;
  const perPixel = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / height; // metres per pixel, a metre away
  return spots.map((spot) => {
    const span = spot.distanceTo(eye);
    const far = spot.clone().sub(eye).setLength(span + BEYOND).add(eye);
    return body.some((rod) => {
      const { gap, along } = segmentGap(eye, far, rod.a, rod.b);
      // The circle covers more of the world the further from the camera it is.
      return gap < rod.r + radius * perPixel * along * (span + BEYOND);
    });
  });
}
