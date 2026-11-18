# Build the sculpt file from an OBJ the web exported. Run in tools/body/out/shrug:
#   blender -b --python ../../sculpt/build.py
import bpy, sys
import os
src = os.path.abspath("shrug-top-current.obj")
out = os.path.abspath("shrug-top-current.blend")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=src, forward_axis='NEGATIVE_Z', up_axis='Y')
ob = bpy.context.selected_objects[0]
ob.name = "ShrugBody"
me = ob.data
print("verts", len(me.vertices), "faces", len(me.polygons))
# the OBJ's first vertices, to check the order survives
with open(src) as f:
    vs = [l.split()[1:] for l in f if l.startswith("v ")][:3]
for i, v in enumerate(vs):
    x, y, z = map(float, v)
    b = me.vertices[i].co
    print("check", i, (round(x,4), round(-z,4), round(y,4)), tuple(round(c,4) for c in b))
bpy.ops.object.shade_smooth()
import math
# Mesh data stays in the web's axes (local: x, y up, z = -front); the object stands up, facing -Y.
ob.rotation_euler = (math.radians(90), 0, math.radians(180))
ob.shape_key_add(name="Basis", from_mix=False)
k = ob.shape_key_add(name="Shrug", from_mix=False)
k.value = 1.0
ob.active_shape_key_index = 1
me.use_mirror_x = True
bpy.context.view_layer.objects.active = ob
bpy.ops.wm.save_as_mainfile(filepath=out)
print("saved", out)
