---
name: anatomy-posing
description: How to pose or change the 3D body in apps/web (back squat now, more exercises later) so it stays anatomically real. Use before touching pose.ts, a clip, a fault toggle, the bar or grip, or adding a new exercise to the 3D viewer.
---

# Posing the 3D body by anatomy

The user is the judge of form. Your job is a pose a real body can make, that
matches the reference, checked before you show it. Past mistakes this guards
against: forearms twisted behind the elbow, wrists bent past their range,
upper arms buried in the chest, a bar floating over the shoulders, and saying
"it's straight" without measuring.

## Where things are

- `apps/web/src/components/body/pose.ts` builds the pose. A baked Mixamo clip
  plays first (`clips/*.json`, made by `tools/body/extract_clip.py`). Then
  small, bounded adjustments run on top: wrists, bar drop, elbows out, bar
  onto the traps, balance, faults.
- `anatomy.ts` holds the joint-range table `LIMITS` and `measure()`. It reads
  joint angles from bone landmarks, because the rig's rest pose is an A-pose,
  not the anatomical position.
- `contact.ts` checks for skin through skin, the bar sinking into the body,
  and the body going through the floor.
- `squat-anatomy.test.ts` runs every depth with every fault. `KNOWN` lists
  today's accepted problems and how far over the limit each may go.

## Rules of the joints (do not break them to reach a position)

- **Knee and elbow are hinges.** They bend in one plane. Sideways bend stays
  within ±10° at the knee and ±20° at the elbow (carrying angle).
- **Turning the hand belongs to the forearm.** Pronation and supination happen
  in the forearm, about 80° each way from thumb-up. They never happen at the
  wrist (twist ±15°) or the elbow.
- **Wrist:** flex up to 80°, extend up to 70°, bend toward the thumb up to 20°
  and toward the little finger up to 30°.
- **Shoulder:**
  - Raise the arm up to 180°.
  - Behind the body, no more than 60°.
  - Rotate out up to 90°, in up to 70°.
  - If the hand can't reach the bar, move the elbow (raise it out or back)
    before you rotate the shoulder further.
- **Hip:** flex up to 125°, extend up to 30°, abduct up to 45°, rotate 45°
  each way.
- **Ankle:** bend the shin over the foot up to about 45° under load. If a pose
  needs more, the hips and knees have to change instead.
- **Spine:**
  - Lower back flexes up to 60° and barely rotates (±15°).
  - Upper back flexes up to 45° and rotates up to 40°.
  - Neck moves up to 50–60° each way.
- **Moving one joint moves what it carries.** Tipping the pelvis moves the
  whole leg chain, so re-plant the feet without twisting the knees.
- **Prefer the smallest change at the right joint.** Don't use IK on a whole
  limb when one joint explains the movement.

Change `LIMITS` only with a source (clinical range of motion, or the
weight-bearing value for a loaded lift), and tell the user.

## Every time you change a pose

1. **Start from a reference.** Use the clip or the user's photo. Write down
   which joints you will move and why, in anatomical terms.
2. **Make the change bounded.** Use one named constant per adjustment, in
   degrees or a 0..1 blend, and keep everything else exactly as approved.
3. **Run `npm test` in `apps/web`.**
   - It must pass.
   - Don't raise a `KNOWN` entry or a limit to make it pass. Fix the pose, or
     report the number to the user and let them decide.
4. **Measure the thing the user asked about.** Use a gap, an angle, or a
   distance. Never claim "straight", "touching" or "centred" without a
   number.
5. **Look before you send.**
   - Take headless screenshots at 4 views (front, back, 45°, side) × 3 depths
     (stand, half, bottom).
   - Compare them against the last approved version.
   - Look for skin through skin, limbs inside the torso, and floating contact
     points.
   - Ask "can a real person do this?" before "does it match the number?"
6. **Report honestly.** Say what changed, what you measured, and what you
   didn't check. Commit only after the user approves the visuals.

## Adding an exercise

1. Get a clip of that movement (Mixamo on our body via
   `tools/body/export_mixamo.py`) or a reference the user approves.
2. Bake it with `extract_clip.py`. Never publish the raw Mixamo files.
3. Write the exercise's own form rules next to its code, for example where
   the bar or handle sits, where the elbows point, and how deep to go.
   Confirm them with the user, because form is their call.
4. Add a test like `squat-anatomy.test.ts` that covers every depth and every
   fault toggle. Faults must stay humanly possible: wrong form, not broken
   joints.
