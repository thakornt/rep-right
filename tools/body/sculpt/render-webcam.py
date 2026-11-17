# Render the owner's sculpt and the web's own shape (web-top.obj) with the web's front and back cameras,
# to compare like with like. Run in tools/body/out/shrug:
#   blender -b <the owner's .blend> --python ../../sculpt/render-webcam.py
import bpy, math, mathutils
import os
out = os.path.abspath("renders"); os.makedirs(out, exist_ok=True)
owner = bpy.data.objects["ShrugBody"]
bpy.ops.wm.obj_import(filepath="web-top.obj", forward_axis='NEGATIVE_Z', up_axis='Y')
web = bpy.context.selected_objects[0]
web.rotation_euler = owner.rotation_euler.copy()
bpy.context.view_layer.objects.active = web
bpy.ops.object.shade_smooth()
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.display.shading.color_type = 'SINGLE'
sc.display.shading.single_color = (0.8, 0.78, 0.76)
sc.render.resolution_x = 536; sc.render.resolution_y = 953
cd = bpy.data.cameras.new("cam"); cd.sensor_fit = 'VERTICAL'; cd.angle = math.radians(32)
cam = bpy.data.objects.new("cam", cd); sc.collection.objects.link(cam); sc.camera = cam
w2b = lambda x, y, z: mathutils.Vector((-x, z, y))  # web axes to Blender world (the object's own turn)
target = w2b(0, 1.0, 0)
for view, pos in {"front": (0, 0.95, 3.3), "back": (0, 0.95, -3.3)}.items():
    d = (w2b(*pos) - target)
    cam.location = target + d.normalized() * d.length * 1.13
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    for name, show in (("owner", owner), ("webmesh", web)):
        owner.hide_render = show is not owner
        web.hide_render = show is not web
        sc.render.filepath = f"{out}/cam-{view}-{name}.png"
        bpy.ops.render.render(write_still=True)
print("rendered")
