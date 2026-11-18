// The lat pulldown's neutral grip and single arm, from the owner's reference pictures (2026-11-12),
// must stay poses a real body can make through the whole rep: the joints in range, no skin
// through skin, the wrists straight on the handle, the elbows nearly straight at the top and
// coming down in front (neutral) or beside the ribs (single arm), and nothing doubling back.

import * as THREE from "three";
import { beforeAll, describe, expect, test } from "vitest";

import { measure, readAnatomy, violations, type Anatomy } from "./anatomy";
import { contact, readBody, type Body } from "./contact";
import { loadBody } from "./load-body";
import { worldPos } from "./pose";
import { LAT_PULLDOWN } from "./pose-pulldown";
import { PULLDOWN_SINGLE, posePulldownVariant, readPulldownVariantRig, type PulldownGrip, type PulldownVariantRig } from "./pose-pulldown-variants";

const ARMPIT_FOLD = 0.045; // skin folding at the shoulder joint; the same allowance as the other lifts
const THROUGH = 0.01;
const MAX_GRIP_MISS = 0.004; // metres a fist may be off its handle
const MAX_WRIST = 10; // degrees the wrist may bend either way: the hand carries on the forearm's line
const MIN_ELBOW_TOP = 10; // degrees the elbow stays bent at the top: nearly straight, not locked
const MAX_ELBOW_TOP = 35;
const MIN_ELBOW_BOTTOM = 100; // and how far it folds at the bottom
const MAX_STILL = 0.002; // metres the left fist's grip may move off the thigh pad in the single arm
const MAX_FOREARM_OFF_CABLE = 10; // degrees the forearm may be off the cable's line: it pulls the way the cable runs (owner's clip)
const MAX_HANDLE_OFF_SQUARE = 10; // degrees the handle may be off square to the cable: it hangs from it
const MAX_ELBOW_OUT = 0.04; // metres the elbow may sit outside the shoulder: a little out as the owner asked (2026-11-12), not flared
const MAX_ELBOW_IN = 0.04; // metres the elbow may come in from the shoulder: it drives down, it doesn't fold in toward the body (owner, 2026-11-12)
const MAX_GRIPS_APART = 6; // degrees the two fists' grips may be off parallel: one rigid handle
const MAX_S_CURVE = 12;
const MIN_PATH_STEP = 0.004;
const MAX_STEP = 0.012; // metres a hand or elbow may move per 1% of the lift

const DEPTHS = Array.from({ length: 11 }, (_, i) => i / 10);

let root: THREE.Object3D;
let anatomy: Anatomy;
let body: Body;
const rigs = {} as Record<PulldownGrip, PulldownVariantRig>;

beforeAll(async () => {
  root = await loadBody();
  anatomy = readAnatomy(root);
  body = readBody(root);
  rigs.neutral = readPulldownVariantRig(root, "neutral");
  rigs.single = readPulldownVariantRig(root, "single");
});

const angles = (tag: "l" | "r") => (measure(anatomy) as unknown as Record<string, Record<string, number>>)[tag];

describe.each(["neutral", "single"] as const)("lat pulldown, %s", (grip) => {
  const working = grip === "single" ? (["r"] as const) : (["l", "r"] as const);

  test.each(DEPTHS)("depth %s", (depth) => {
    const pull = rigs[grip];
    const g = posePulldownVariant(pull, depth);
    const problems: string[] = [];
    for (const v of violations(measure(anatomy))) problems.push(`${v.joint} ${v.value.toFixed(0)} (${v.min}..${v.max})`);
    for (const t of contact(body).through) {
      const allowed = t.pair.endsWith("/core") ? ARMPIT_FOLD : THROUGH;
      if (t.depth > allowed) problems.push(`${t.pair} ${(t.depth * 100).toFixed(1)} cm through`);
    }
    for (const tag of working) {
      const a = angles(tag);
      if (Math.abs(a["wrist.flexion"]) > MAX_WRIST) problems.push(`${tag} wrist bent ${a["wrist.flexion"].toFixed(0)}`);
      if (Math.abs(a["wrist.deviation"]) > MAX_WRIST) problems.push(`${tag} wrist sideways ${a["wrist.deviation"].toFixed(0)}`);
      const held = g[tag];
      const shouldBe = grip === "single" ? g.bar : g.bar.clone().setX(held.grip.x);
      if (held.grip.distanceTo(shouldBe) > MAX_GRIP_MISS) problems.push(`${tag} fist ${(held.grip.distanceTo(shouldBe) * 100).toFixed(1)} cm off the handle`);
    }
    expect(problems.join("; ")).toBe("");
  });

  test("the elbows are nearly straight at the top and fold well at the bottom", () => {
    for (const tag of working) {
      posePulldownVariant(rigs[grip], 0);
      expect(angles(tag)["elbow.flexion"]).toBeGreaterThan(MIN_ELBOW_TOP);
      expect(angles(tag)["elbow.flexion"]).toBeLessThan(MAX_ELBOW_TOP);
      posePulldownVariant(rigs[grip], 1);
      expect(angles(tag)["elbow.flexion"]).toBeGreaterThan(MIN_ELBOW_BOTTOM);
    }
  });

  test("the elbows come down in front of the body or beside the ribs, not behind the shoulders", () => {
    posePulldownVariant(rigs[grip], 1);
    for (const tag of working) {
      const s = rigs[grip].rig[tag];
      expect(worldPos(s.lowerarm).z).toBeGreaterThan(worldPos(s.upperarm).z - 0.01);
    }
  });

  test("no joint's path doubles back, and it moves smoothly", () => {
    for (const tag of working) {
      const s = rigs[grip].rig[tag];
      const paths = { hand: [] as THREE.Vector3[], elbow: [] as THREE.Vector3[] };
      for (let i = 0; i <= 100; i++) {
        posePulldownVariant(rigs[grip], i / 100);
        paths.hand.push(worldPos(s.hand));
        paths.elbow.push(worldPos(s.lowerarm));
      }
      const against = (pts: number[][]) => {
        const moves: number[][] = [];
        let last = pts[0];
        for (const q of pts) {
          if (Math.hypot(q[0] - last[0], q[1] - last[1]) > MIN_PATH_STEP) {
            moves.push([q[0] - last[0], q[1] - last[1]]);
            last = q;
          }
        }
        let one = 0;
        let other = 0;
        for (let i = 1; i < moves.length; i++) {
          const [a, b] = [moves[i - 1], moves[i]];
          const turn = Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
          if (turn > 0) one += turn;
          else other -= turn;
        }
        return THREE.MathUtils.radToDeg(Math.min(one, other));
      };
      for (const [k, path] of Object.entries(paths)) {
        expect(against(path.map((p) => [p.z, p.y])), `${tag} ${k} from the side`).toBeLessThan(MAX_S_CURVE);
        expect(against(path.map((p) => [p.x, p.y])), `${tag} ${k} from the front`).toBeLessThan(MAX_S_CURVE);
        for (let i = 1; i < path.length; i++) expect(path[i].distanceTo(path[i - 1])).toBeLessThan(MAX_STEP);
      }
    }
  });

  if (grip === "neutral")
    test("seen from the side the forearms stay on the cable's line, and the elbows never fold in toward the body", () => {
      for (const d of DEPTHS) {
        const g = posePulldownVariant(rigs.neutral, d);
        for (const tag of ["l", "r"] as const) {
          const s = rigs.neutral.rig[tag];
          const fore = worldPos(s.hand).sub(worldPos(s.lowerarm));
          const cable = g.pulley.clone().sub(g[tag].grip);
          const off = THREE.MathUtils.radToDeg(Math.abs(Math.atan2(fore.z, fore.y) - Math.atan2(cable.z, cable.y)));
          expect(off, `${tag} forearm off the cable at ${d}`).toBeLessThan(MAX_FOREARM_OFF_CABLE);
          // In toward the middle is -sign in x.
          const inward = (worldPos(s.upperarm).x - worldPos(s.lowerarm).x) * (tag === "l" ? 1 : -1);
          expect(inward, `${tag} elbow folded in at ${d}`).toBeLessThan(MAX_ELBOW_IN);
        }
        // One rigid handle: the two fists close on parallel grips.
        const apart = THREE.MathUtils.radToDeg(Math.min(g.l.handle.angleTo(g.r.handle), g.l.handle.clone().negate().angleTo(g.r.handle)));
        expect(apart, `grips twisted apart at ${d}`).toBeLessThan(MAX_GRIPS_APART);
      }
    });

  if (grip === "single")
    test("the forearm pulls along the cable, the handle hangs square to it, and the elbow never goes out to the side", () => {
      const r = rigs.single.rig.r;
      for (const d of DEPTHS) {
        const g = posePulldownVariant(rigs.single, d);
        const cable = g.pulley.clone().sub(g.r.grip).normalize();
        const fore = worldPos(r.hand).sub(worldPos(r.lowerarm)).normalize();
        expect(THREE.MathUtils.radToDeg(fore.angleTo(cable)), `forearm off the cable at ${d}`).toBeLessThan(MAX_FOREARM_OFF_CABLE);
        expect(Math.abs(90 - THREE.MathUtils.radToDeg(g.r.handle.angleTo(cable))), `handle off square at ${d}`).toBeLessThan(MAX_HANDLE_OFF_SQUARE);
        // The right arm: out is toward -x.
        expect(worldPos(r.upperarm).x - worldPos(r.lowerarm).x, `elbow out at ${d}`).toBeLessThan(MAX_ELBOW_OUT);
      }
    });

  if (grip === "single")
    // The fist holds the pad (owner, 2026-11-13): its grip stays on the pad's line, where the pad is,
    // while the hand may roll a little round the pad as the trunk leans back.
    test("the free hand holds its thigh pad and stays there", () => {
      const pad = new THREE.Vector3(PULLDOWN_SINGLE.padHold, rigs.single.padY, LAT_PULLDOWN.padAhead);
      for (const d of DEPTHS) {
        const held = posePulldownVariant(rigs.single, d).l;
        expect(held.grip.distanceTo(pad), `grip off the pad at ${d}`).toBeLessThan(MAX_STILL);
        expect(Math.abs(held.handle.x), `fist square to the pad at ${d}`).toBeGreaterThan(0.99);
      }
    });
});
