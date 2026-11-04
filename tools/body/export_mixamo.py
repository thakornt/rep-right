"""Export the body mesh (no rig) as FBX for Mixamo's auto-rigger.

    blender --background --python tools/body/export_mixamo.py -- <out.fbx>

Same body as build.py, so poses made on Mixamo line up with our rig.
"""

import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build  # noqa: E402


def main():
    out = sys.argv[sys.argv.index("--") + 1]
    mesh, rig = build.make_human()
    for m in list(mesh.modifiers):
        mesh.modifiers.remove(m)
    mesh.parent = None
    bpy.data.objects.remove(rig)
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.export_scene.fbx(filepath=out, use_selection=True, object_types={"MESH"}, add_leaf_bones=False)
    print("EXPORTED", out, len(mesh.data.vertices))


main()
