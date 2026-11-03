"""Turn a Mixamo clip into pose data for our rig (apps/web/public/models/<name>.json).

    blender --background --python tools/body/extract_clip.py -- <out.json> <clip.fbx> <first> <last>

The clip must be a Mixamo download ("FBX Binary, With Skin") of the body from
export_mixamo.py, so its bones sit on the same mesh as our rig. Only numbers
derived from it are written; the Mixamo file stays in tools/body/out/.

Per frame and per bone we store the bone's world rotation change since the
rest pose. That change belongs to the body segment, not to either rig's bone
axes, so the web applies ourBone = delta * ourBoneRest. The hips also store
their position change. Quaternions are [x, y, z, w] and positions are metres,
both in glTF axes (Y up).
"""

import json
import sys

import bpy

# our bone -> Mixamo bone
BONES = {
    "pelvis": "Hips",
    "spine_01": "Spine",
    "spine_02": "Spine1",
    "spine_03": "Spine2",
    "neck_01": "Neck",
    "head": "Head",
}
for s, side in (("l", "Left"), ("r", "Right")):
    BONES |= {
        f"clavicle_{s}": f"{side}Shoulder",
        f"upperarm_{s}": f"{side}Arm",
        f"lowerarm_{s}": f"{side}ForeArm",
        f"hand_{s}": f"{side}Hand",
        f"thigh_{s}": f"{side}UpLeg",
        f"calf_{s}": f"{side}Leg",
        f"foot_{s}": f"{side}Foot",
        f"ball_{s}": f"{side}ToeBase",
    }
    for ours, theirs in (("thumb", "Thumb"), ("index", "Index"), ("middle", "Middle"), ("ring", "Ring"), ("pinky", "Pinky")):
        for i in (1, 2, 3):
            BONES[f"{ours}_0{i}_{s}"] = f"{side}Hand{theirs}{i}"


def rot(arm, name):
    m = arm.matrix_world @ arm.pose.bones["mixamorig:" + name].matrix
    return m.to_3x3().normalized().to_quaternion()


def pos(arm, name):
    return arm.matrix_world @ arm.pose.bones["mixamorig:" + name].head


def quat(q):
    # Blender Z-up -> glTF Y-up: (x, y, z) -> (x, z, -y)
    return [round(q.x, 4), round(q.z, 4), round(-q.y, 4), round(q.w, 4)]


def vec(v):
    return [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :]
    out, path, first, last = argv[0], argv[1], int(argv[2]), int(argv[3])
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    bpy.ops.import_scene.fbx(filepath=path)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    scene = bpy.context.scene

    arm.data.pose_position = "REST"
    scene.frame_set(first)
    rest = {b: rot(arm, m) for b, m in BONES.items()}
    hips_rest = pos(arm, "Hips")
    arm.data.pose_position = "POSE"

    frames = []
    for f in range(first, last + 1):
        scene.frame_set(f)
        frames.append(
            {
                "hips": vec(pos(arm, "Hips") - hips_rest),
                "rot": [quat(rot(arm, m) @ rest[b].inverted()) for b, m in BONES.items()],
            }
        )
    data = {"fps": scene.render.fps, "bones": list(BONES), "frames": frames}
    with open(out, "w") as fh:
        json.dump(data, fh, separators=(",", ":"))
    print("WROTE", out, len(frames), "frames, hips rest", hips_rest)


main()
