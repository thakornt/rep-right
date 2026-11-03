"""Pull hand grip poses out of Mixamo clips into apps/web/src/components/body/grips.json.

    blender --background --python tools/body/extract_grips.py -- <out.json> \
        <name>=<clip.fbx>@<frame> [<name>=<clip.fbx>@<frame> ...]

The clips must be Mixamo downloads ("FBX Binary, With Skin") of the body from
export_mixamo.py, so their bones sit on the same mesh as our rig. Only finger
rotations relative to the hand are kept, as numbers; the Mixamo files stay in
tools/body/out/ and are never published.

For each finger bone we store G = (hand world delta)^-1 * (finger world delta),
deltas measured from the rest pose. World deltas of the same body segment do
not depend on how either rig orients its bones, so the web applies
finger = handDelta * G * fingerRest on our rig. Quaternions are [x, y, z, w]
in glTF axes (Y up).
"""

import json
import sys

import bpy

FINGERS = {"Thumb": "thumb", "Index": "index", "Middle": "middle", "Ring": "ring", "Pinky": "pinky"}
SIDES = {"Left": "l", "Right": "r"}


def world_rot(arm, name):
    m = arm.matrix_world @ arm.pose.bones[name].matrix
    return m.to_3x3().normalized().to_quaternion()


def snapshot(arm):
    names = [f"mixamorig:{side}Hand" for side in SIDES]
    names += [f"mixamorig:{side}Hand{f}{i}" for side in SIDES for f in FINGERS for i in (1, 2, 3)]
    return {n: world_rot(arm, n) for n in names}


def to_gltf(q):
    # Blender Z-up -> glTF Y-up: (x, y, z) -> (x, z, -y)
    return [round(q.x, 6), round(q.z, 6), round(-q.y, 6), round(q.w, 6)]


def grip(path, frame):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    bpy.ops.import_scene.fbx(filepath=path)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    scene = bpy.context.scene

    arm.data.pose_position = "REST"
    scene.frame_set(frame)
    rest = snapshot(arm)
    arm.data.pose_position = "POSE"
    scene.frame_set(frame)
    pose = snapshot(arm)

    out = {}
    for side, s in SIDES.items():
        hand = f"mixamorig:{side}Hand"
        hand_delta = pose[hand] @ rest[hand].inverted()
        bones = {}
        for f, ours in FINGERS.items():
            for i in (1, 2, 3):
                n = f"mixamorig:{side}Hand{f}{i}"
                finger_delta = pose[n] @ rest[n].inverted()
                bones[f"{ours}_0{i}"] = to_gltf(hand_delta.inverted() @ finger_delta)
        out[s] = bones
    return out


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :]
    out_path, specs = argv[0], argv[1:]
    result = {}
    for spec in specs:
        name, rest = spec.split("=", 1)
        path, frame = rest.rsplit("@", 1)
        result[name] = grip(path, int(frame))
    with open(out_path, "w") as f:
        json.dump(result, f, indent=1)
        f.write("\n")
    print("WROTE", out_path, list(result))


main()
