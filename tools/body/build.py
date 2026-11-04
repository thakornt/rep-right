"""Generate the rep-right body model (apps/web/public/models/body.glb).

Run headless with Blender 4.5 + the MPFB2 extension and the CC0
makehuman_system_assets pack installed:

    blender --background --python tools/body/build.py -- <out.glb> [render_dir]

The model is a MakeHuman base mesh (CC0) with the game_engine rig. Each vertex
gets two custom attributes that the web shader reads:

    _muscle  region id, see MUSCLES below (0 = none)
    _cloth   0 skin, 1 shorts, 2 shoes

Regions are assigned from the rig weights plus simple geometric rules in the
rest pose. They are approximate surface areas for teaching, not anatomy.
"""

import math
import os
import sys

import bpy
from mathutils import Vector

from bl_ext.user_default.mpfb.services.exportservice import ExportService
from bl_ext.user_default.mpfb.services.humanservice import HumanService

# Keep in sync with apps/web/src/components/body/muscles.ts
MUSCLES = {
    "quads": 1,
    "hamstrings": 2,
    "adductors": 3,
    "glutes": 4,
    "calves": 5,
    "abs": 6,
    "obliques": 7,
    "erectors": 8,
    "lats": 9,
    "upper_back": 10,
    "chest": 11,
    "delts": 12,
    "biceps": 13,
    "triceps": 14,
    "forearms": 15,
}

MACRO = {
    "gender": 1.0,
    "age": 0.5,
    "muscle": 0.8,
    "weight": 0.45,
    "proportions": 0.6,
    "height": 0.5,
    "cupsize": 0.5,
    "firmness": 0.5,
    "race": {"asian": 0.6, "caucasian": 0.2, "african": 0.2},
}


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if not argv:
        sys.exit("usage: blender --background --python build.py -- <out.glb> [render_dir]")
    return argv[0], (argv[1] if len(argv) > 1 else None)


def make_human():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    mesh = HumanService.create_human(macro_detail_dict=MACRO)
    rig = HumanService.add_builtin_rig(mesh, "game_engine")
    ExportService.bake_modifiers_remove_helpers(mesh, bake_masks=True, remove_helpers=True, also_proxy=False)
    if mesh.data.shape_keys:
        bpy.context.view_layer.objects.active = mesh
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    mesh.name = "Body"
    rig.name = "Rig"
    return mesh, rig


class Limb:
    """Cylindrical coordinates around a bone: t along it, angle around it."""

    def __init__(self, bone, side):
        self.head = bone.head_local.copy()
        axis = bone.tail_local - bone.head_local
        self.length = axis.length
        self.axis = axis.normalized()
        front = Vector((0, -1, 0))
        self.front = (front - self.axis * front.dot(self.axis)).normalized()
        out = Vector((side, 0, 0))
        out = out - self.axis * out.dot(self.axis) - self.front * out.dot(self.front)
        self.out = out.normalized()

    def coords(self, p):
        d = p - self.head
        t = d.dot(self.axis) / self.length
        r = d - self.axis * d.dot(self.axis)
        # 0 = front, +90 = outside, -90 = inside (toward the midline), 180 = back
        angle = math.degrees(math.atan2(r.dot(self.out), r.dot(self.front)))
        return t, angle


def classify(mesh, rig):
    bones = rig.data.bones
    group_names = {g.index: g.name for g in mesh.vertex_groups}
    limbs = {}
    for name in ("thigh", "calf", "upperarm", "lowerarm"):
        for side, s in (("l", 1), ("r", -1)):
            limbs[f"{name}_{side}"] = Limb(bones[f"{name}_{side}"], s)

    muscle = [0] * len(mesh.data.vertices)
    cloth = [0] * len(mesh.data.vertices)
    m = MUSCLES

    for v in mesh.data.vertices:
        weights = {}
        for g in v.groups:
            name = group_names.get(g.group, "")
            if name in bones:
                weights[name] = weights.get(name, 0) + g.weight
        if not weights:
            continue
        bone = max(weights, key=weights.get)
        base = bone[:-2] if bone.endswith(("_l", "_r")) else bone
        p, n = v.co, v.normal
        x, z = abs(p.x), p.z
        front, back = n.y < -0.3, n.y > 0.3
        region = 0

        if base == "thigh":
            t, a = limbs[bone].coords(p)
            if t < 0.22 and abs(a) > 115:
                region = m["glutes"]
            elif abs(a) > 125:
                region = m["hamstrings"]
            elif -125 <= a < -55 and t < 0.75:
                region = m["adductors"]
            else:
                region = m["quads"]
        elif base == "calf":
            t, a = limbs[bone].coords(p)
            if t < 0.72 and abs(a) > 95:
                region = m["calves"]
            elif t < 0.08 and abs(a) < 60:
                region = m["quads"]
        elif base == "pelvis":
            if back or p.y > 0.03:
                region = m["glutes"] if z < 1.0 else m["erectors"]
            elif front and z > 0.9:
                region = m["abs"] if x < 0.065 else m["obliques"]
            elif z > 0.93:
                region = m["obliques"]
        elif base.startswith("spine"):
            if front:
                if z > 1.17:
                    region = m["chest"]
                elif z > 0.92:
                    region = m["abs"] if x < 0.07 else m["obliques"]
            elif back:
                if z > 1.24:
                    region = m["upper_back"]
                elif x < 0.06:
                    region = m["erectors"]
                elif z > 1.04:
                    region = m["lats"]
                else:
                    region = m["erectors"] if x < 0.09 else m["obliques"]
            else:
                region = m["lats"] if z > 1.05 else m["obliques"]
        elif base == "clavicle":
            if x > 0.135:  # the cap of the shoulder, front and back
                region = m["delts"]
            elif front and z < 1.36:
                region = m["chest"]
            elif back or n.z > 0.5:
                region = m["upper_back"]
            else:
                region = m["delts"]
        elif base == "neck_01":
            if (back or n.z > 0.3) and z < 1.5:
                region = m["upper_back"]
        elif base == "upperarm":
            t, a = limbs[bone].coords(p)
            if t < 0.5 and not (-140 < a < -40):  # runs about halfway down the arm
                region = m["delts"]
            elif abs(a) < 90:
                region = m["biceps"]
            else:
                region = m["triceps"]
        elif base == "lowerarm":
            t, _ = limbs[bone].coords(p)
            if t < 0.85:
                region = m["forearms"]

        muscle[v.index] = region

        if base in ("foot", "ball") or (base == "calf" and z < 0.1):
            cloth[v.index] = 2
        elif base in ("pelvis", "thigh", "spine_01") and 0.6 < z < 0.97:
            cloth[v.index] = 1

    return muscle, cloth


def write_attributes(mesh, muscle, cloth):
    for name, values in (("_muscle", muscle), ("_cloth", cloth)):
        attr = mesh.data.attributes.new(name, "FLOAT", "POINT")
        attr.data.foreach_set("value", [float(x) for x in values])


def export(out):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        use_selection=True,
        export_attributes=True,
        export_texcoords=False,
        export_materials="NONE",
        export_skins=True,
        export_morph=False,
        export_animations=False,
        export_apply=False,
        export_yup=True,
    )


PALETTE = [
    (0.75, 0.75, 0.75), (0.9, 0.2, 0.2), (0.2, 0.6, 0.9), (0.9, 0.8, 0.2), (0.9, 0.4, 0.8),
    (0.2, 0.8, 0.4), (0.95, 0.55, 0.1), (0.5, 0.3, 0.9), (0.1, 0.8, 0.8), (0.6, 0.9, 0.2),
    (0.9, 0.3, 0.5), (0.95, 0.1, 0.1), (0.3, 0.3, 0.9), (0.2, 0.9, 0.9), (0.9, 0.6, 0.6), (0.6, 0.4, 0.2),
]


def render(mesh, muscle, render_dir):
    """Debug renders with one flat color per region, from four sides."""
    colors = mesh.data.color_attributes.new("debug", "FLOAT_COLOR", "POINT")
    for i, r in enumerate(muscle):
        colors.data[i].color = (*PALETTE[r], 1.0)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.color_type = "VERTEX"
    scene.display.shading.light = "STUDIO"
    scene.render.resolution_x, scene.render.resolution_y = 600, 900
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 1.9
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    for name, loc, rot in (
        ("front", (0, -4, 0.85), (90, 0, 0)),
        ("back", (0, 4, 0.85), (90, 0, 180)),
        ("side", (4, 0, 0.85), (90, 0, 90)),
        ("top", (0, -3, 3.5), (40, 0, 0)),
    ):
        cam.location = loc
        cam.rotation_euler = [math.radians(a) for a in rot]
        scene.render.filepath = os.path.join(render_dir, f"{name}.png")
        bpy.ops.render.render(write_still=True)
    mesh.data.color_attributes.remove(colors)


def main():
    out, render_dir = args()
    mesh, rig = make_human()
    muscle, cloth = classify(mesh, rig)
    write_attributes(mesh, muscle, cloth)
    if render_dir:
        render(mesh, muscle, render_dir)
    export(out)
    counts = {k: muscle.count(v) for k, v in MUSCLES.items()}
    print("REGIONS", counts, "none", muscle.count(0), "verts", len(muscle))


if __name__ == "__main__":
    main()
