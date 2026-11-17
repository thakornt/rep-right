# The shape as Blender shows it (shape keys mixed), in the web's axes. Run in tools/body/out/shrug:
#   blender -b <the owner's .blend> --python ../../sculpt/dump.py
import bpy, json
ob = bpy.data.objects["ShrugBody"]
dg = bpy.context.evaluated_depsgraph_get()
me = ob.evaluated_get(dg).to_mesh()
assert len(me.vertices) == 14517
# local axes are the web's own (the OBJ import kept them; the object only turns to stand up)
json.dump([[round(v.co.x, 6), round(v.co.y, 6), round(v.co.z, 6)] for v in me.vertices], open("sculpt-final-web.json", "w"))
print("dumped evaluated", len(me.vertices))
