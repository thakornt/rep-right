# Shoulder corrective shape (single-arm lat pulldown)

The shape the shoulder takes at the top of the single-arm lat pulldown, sculpted in Blender and
added after skinning in the app (`apps/web/src/components/body/shoulder-correctives.ts`). The owner
approved v4 on 2026-11-13.

Steps (Blender 4.5; `$D` is a folder outside the repo):

1. Dump the skin as drawn, the trunk's move and the muscle map:
   `CORRECTIVE_DUMP=$D npx vitest run src/components/body/corrective-dump.test.ts` (in `apps/web`)
2. Build the shape, each step on the last (`blender --background --python <step> -- $D <in> <out> ...`):
   - `1_lat.py $D 1.0 3`: the side from the ribs to the arm pushed out to a straight line (writes `target_1.0.bin`)
   - `2_front.py $D target_1.0.bin target_front.bin 0.05 12`: the squeezed front of the shoulder let out
   - `3_marks.py $D target_front.bin target_v2.bin`: the owner's marks: front deltoid up toward the
     cheek, upper chest lifted with it, the skin under the armpit held down where the trunk puts it
   - `4_fill.py $D target_v2.bin target_v5.bin 0.1 1.0 120`: the gap between chest and arm filled
   - `5_side_line.py $D target_v5.bin target_v6.bin`: skin past the straight side line drawn back in
3. To look or sculpt by hand: `review.py $D target_v6.bin out.blend` (objects `target` and `now`),
   then `blender out.blend --background --python export_target.py -- $D target_v6.bin`.
4. Into the app: `node tools/body/correctives/make-data.mjs $D $D/target_v6.bin pulldown-single`.

## Sculpting a new corrective by hand (2026-11-13)

For the owner or an artist to sculpt a pose's shape, instead of scripted steps:

1. Dump the pose (in `apps/web`): `CORRECTIVE_POSE=overhead_two DEPTH=1 CORRECTIVE_DUMP=$D npx vitest run src/components/body/corrective-dump.test.ts`
   (`CORRECTIVE_POSE` is `pulldown_single` or `overhead_two`)
2. Make the file: `blender --background --python sculpt_file.py -- $D $D/<name>.blend`
   "target" starts as the skin the app draws now, with any approved corrective on (`shown.bin`);
   away from the raised shoulders it is masked. With both arms up sculpting mirrors left to right;
   with one (the single-arm pulldown) only that shoulder is free and mirroring is off. The steps, in Thai, are in the file's text "วิธีปั้น".
3. Sculpt "target", save, then `blender $D/<name>.blend --background --python export_target.py -- $D $D/target.bin`.
   An unsculpted file gives back the app's skin exactly (checked: 0.0 mm at every point), and for
   the single-arm pulldown `make-data.mjs` on it gives back the approved shape (within 0.1 mm; 8 of
   581 points under 0.1 mm drop out).
4. Into the app: `node tools/body/correctives/make-data.mjs $D $D/target.bin <lift> [mirrored]`
   writes `shoulder-correctives-<lift>.ts` (`pulldown-single`, `overhead-two`). Each lift has its own
   shape, turned on by its pose (`enableShoulderCorrectives(root, "overheadTwo")`); a new lift adds its
   file to `SHAPES` in `shoulder-correctives.ts`. Only the right side is kept and the left is its mirror;
   `mirrored` (both shoulders sculpted at once) halves points on the middle line; `both` also keeps
   the left as sculpted instead of mirroring the right (the overhead and neutral-grip shapes: their
   posed skin isn't symmetric). Each shape fades by how far the arm turns from its sculpted
   direction (`FADE` in `shoulder-correctives.ts`; the pulldowns over the whole pull).
   Shapes in the app now (owner, 2026-11-13): pulldown-single (v5), pulldown-neutral (v2),
   overhead-two.
