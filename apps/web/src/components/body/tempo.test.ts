// Every lift shortens its working muscle quickly and lengthens it slowly: the quick way is
// up for most lifts, and down for a pulldown and a pushdown.

import { describe, expect, test } from "vitest";

import { BACK_SQUAT_DOWN_SHARE, DOWN_SHARE, fromBottomDepthAt, fromBottomTimeAt, repDepthAt, repTimeAt } from "./tempo";

const PERIOD = 3.6;
const MAX_QUICK_SHARE = 0.4; // the quick way takes under this share of a rep
const WORK_GOING_UP = ["incline", "shoulder", "hammer", "raise", "squat", "crunch"] as const;
const WORK_GOING_DOWN = ["pulldown", "pushdown"] as const;

describe("tempo", () => {
  test.each(WORK_GOING_UP)("%s comes down slowly and goes up quickly", (lift) => {
    expect(1 - DOWN_SHARE[lift]).toBeLessThan(MAX_QUICK_SHARE);
  });

  test("the back squat comes down slowly and goes up quickly", () => {
    expect(1 - BACK_SQUAT_DOWN_SHARE).toBeLessThan(MAX_QUICK_SHARE);
  });

  test.each(WORK_GOING_DOWN)("%s goes down quickly and comes up slowly", (lift) => {
    expect(DOWN_SHARE[lift]).toBeLessThan(MAX_QUICK_SHARE);
  });

  test.each(Object.entries(DOWN_SHARE))("%s runs from the top, to the bottom at its share, and back with no jump", (_, share) => {
    expect(repDepthAt(0, PERIOD, share)).toBeCloseTo(0, 5);
    expect(repDepthAt(share * PERIOD, PERIOD, share)).toBeCloseTo(1, 5);
    expect(repDepthAt(PERIOD, PERIOD, share)).toBeCloseTo(0, 5);
    let last = 0;
    for (let i = 1; i <= 360; i++) {
      const now = repDepthAt((i / 360) * PERIOD, PERIOD, share);
      expect(Math.abs(now - last)).toBeLessThan(0.03);
      last = now;
    }
    for (const d of [0.2, 0.5, 0.8]) expect(repDepthAt(repTimeAt(d, PERIOD, share), PERIOD, share)).toBeCloseTo(d, 5);
  });

  test("one arm at a time goes quickly up from the bottom and slowly back", () => {
    expect(fromBottomDepthAt(0)).toBeCloseTo(1, 5);
    expect(fromBottomDepthAt(1 - DOWN_SHARE.hammer)).toBeCloseTo(0, 5);
    expect(fromBottomDepthAt(1)).toBeCloseTo(1, 5);
    for (const d of [0.2, 0.5, 0.9]) expect(fromBottomDepthAt(fromBottomTimeAt(d))).toBeCloseTo(d, 5);
  });
});
