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
4. Into the app: `node tools/body/correctives/make-data.mjs $D $D/target_v6.bin`
   (writes `shoulder-correctives-data.ts`).

## Sculpting a new corrective by hand (2026-11-13)

For the owner or an artist to sculpt a pose's shape, instead of scripted steps:

1. Dump the pose (in `apps/web`): `CORRECTIVE_POSE=overhead_two DEPTH=1 CORRECTIVE_DUMP=$D npx vitest run src/components/body/corrective-dump.test.ts`
   (`CORRECTIVE_POSE` is `pulldown_single` or `overhead_two`)
2. Make the file: `blender --background --python sculpt_file.py -- $D $D/<name>.blend`
   "target" starts as the skin the app draws now; away from the shoulders it is masked, and
   sculpting mirrors left to right. The steps, in Thai, are in the file's text "วิธีปั้น".
3. Sculpt "target", save, then `blender $D/<name>.blend --background --python export_target.py -- $D $D/target.bin`.
   An unsculpted file gives back the app's skin exactly (checked: 0.0 mm at every point).
4. Into the app: the app takes one shape today (`shoulder-correctives-data.ts`, the single-arm pulldown);
   a second shape needs `shoulder-correctives.ts` to hold several, each blending in by the arm's direction.
