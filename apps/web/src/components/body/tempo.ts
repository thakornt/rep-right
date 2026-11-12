// How long each way of a rep takes. The muscle shortens quickly, breathing out, and lengthens
// slowly against the weight, breathing in. Which way that is depends on the lift: most lifts work
// on the way up, so they come down slowly, but in a pulldown or pushdown the work is on the way
// down, so that way is the quick one.

import type { PressExercise } from "./press";

const QUICK_UP = 0.3; // share of a rep the quick way up takes, about what the lat pulldown's video shows for its quick way

// Share of a rep spent going down. Depth 0 is the top and 1 the bottom in every lift.
export const DOWN_SHARE: Record<PressExercise, number> = {
  incline: 1 - QUICK_UP,
  shoulder: 1 - QUICK_UP,
  hammer: 1 - QUICK_UP,
  raise: 1 - QUICK_UP,
  squat: 1 - QUICK_UP,
  crunch: 1 - QUICK_UP,
  pulldown: 0.29, // the work is on the way down; measured off the video
  pushdown: 0.36, // the work is on the way down; measured off the video
  pushup: 1 - QUICK_UP, // pushed up quickly breathing out, lowered slowly breathing in, as the owner asked
  overheadOne: 1 - QUICK_UP,
  overheadTwo: 1 - QUICK_UP,
  row: 1 - QUICK_UP, // rowed up quickly, lowered slowly
  rdl: 1 - QUICK_UP, // up quickly driving the hips forward, lowered slowly
};
export const BACK_SQUAT_DOWN_SHARE = 1 - QUICK_UP;

// Depth at this time in a rep that starts at the top.
export function repDepthAt(seconds: number, period: number, downShare: number) {
  const u = (((seconds % period) + period) % period) / period;
  return u < downShare ? (1 - Math.cos((Math.PI * u) / downShare)) / 2 : (1 + Math.cos((Math.PI * (u - downShare)) / (1 - downShare))) / 2;
}

// The time on the way down at a depth, to pick up from the slider.
export const repTimeAt = (depth: number, period: number, downShare: number) => (Math.acos(1 - 2 * depth) / Math.PI) * downShare * period;

// One arm at a time starts at the bottom: quickly up, slowly back down.
export function fromBottomDepthAt(into: number) {
  return into < QUICK_UP ? (1 + Math.cos((Math.PI * into) / QUICK_UP)) / 2 : (1 - Math.cos((Math.PI * (into - QUICK_UP)) / (1 - QUICK_UP))) / 2;
}

// The share of that rep at a depth, on the way up.
export const fromBottomTimeAt = (depth: number) => (Math.acos(2 * depth - 1) / Math.PI) * QUICK_UP;
