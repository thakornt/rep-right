# blender --background --python review.py -- <dir> <target.bin> <out.blend>
# A file to look at and sculpt: "target" (the shape the app will take with the arm overhead) and,
# beside it, "now" (the skin as the app draws it today). Seam-split points are joined so sculpting
# doesn't tear; places.bin maps them back (export with export_target.py).
import bpy, sys, json
import numpy as np
from mathutils import Vector
a = sys.argv[sys.argv.index("--") + 1:]
D = a[0] + "/"; TGT = a[1]; OUT = a[2]
meta = json.load(open(D + "meta.json")); n = meta["n"]
now = np.fromfile(D + "final.bin", dtype=np.float32).reshape(-1, 3)
tgt = np.fromfile(TGT, dtype=np.float32).reshape(-1, 3)
Rr = np.fromfile(D + "rest.bin", dtype=np.float32).reshape(-1, 3)
T = np.fromfile(D + "index.bin", dtype=np.uint32).reshape(-1, 3)
key = {}; place = np.zeros(n, dtype=np.int64)
for i, p in enumerate(Rr):
    place[i] = key.setdefault((round(float(p[0]), 5), round(float(p[1]), 5), round(float(p[2]), 5)), len(key))
place.astype(np.int32).tofile(D + "places.bin")
m = len(key); rep = np.zeros(m, dtype=np.int64); rep[place] = np.arange(n)
faces = [tuple(int(place[v]) for v in t) for t in T if len({place[v] for v in t}) == 3]
bl = lambda A: [(float(p[0]), float(-p[2]), float(p[1])) for p in A]
bpy.ops.wm.read_factory_settings(use_empty=False)
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
def make(name, pts, dx):
    me = bpy.data.meshes.new(name); me.from_pydata(bl(pts[rep]), [], faces); me.update()
    for poly in me.polygons: poly.use_smooth = True
    ob = bpy.data.objects.new(name, me); ob.location.x = dx
    bpy.context.scene.collection.objects.link(ob); return ob
make("now", now, 0.8)
t = make("target", tgt, 0.0)
bpy.context.view_layer.objects.active = t; t.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("saved", OUT, "places", m)
