# blender --background --python target.py -- <dir> [hull_share] [smooth_rounds]
# Builds the drawn skin (from final.bin) in Blender, makes the target: the lat side from the ribs up to
# the back of the armpit and the back of the shoulder pushed out to its convex hull, eased at the
# edges. Writes target.bin, saves correctives.blend, renders before/after.
import bpy, bmesh, sys, json, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args = sys.argv[sys.argv.index("--") + 1:]
D = args[0] + "/"
SHARE = float(args[1]) if len(args) > 1 else 1.0
ROUNDS = int(args[2]) if len(args) > 2 else 30
meta = json.load(open(D + "meta.json"))
n = meta["n"]
final = np.fromfile(D + "final.bin", dtype=np.float32).reshape(-1, 3)
tri = np.fromfile(D + "index.bin", dtype=np.uint32).reshape(-1, 3)
R = np.fromfile(D + "regions.bin", dtype=np.uint8)
three2bl = lambda a: np.stack([a[:, 0], -a[:, 2], a[:, 1]], 1)
P = final.astype(np.float64)  # three coords for the maths
sh = np.array(meta["shoulderR"])

def smoothstep(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

# Neighbours (vertices split at seams joined by position).
key = {}
place = np.zeros(n, dtype=np.int64)
for i, p in enumerate(final):
    k = (round(float(p[0]), 5), round(float(p[1]), 5), round(float(p[2]), 5))
    place[i] = key.setdefault(k, len(key))
near = [set() for _ in range(len(key))]
for a, b, c in tri:
    for u, v in ((a, b), (b, c), (c, a)):
        near[place[u]].add(place[v]); near[place[v]].add(place[u])

# The mask, in the drawn pose: the right side from the ribs up past the armpit, back half.
x, y, z = P[:, 0], P[:, 1], P[:, 2]
d = np.linalg.norm(P - sh, axis=1)
side = smoothstep(-x, 0.06, 0.11)
height = smoothstep(y, sh[1] - 0.34, sh[1] - 0.26) * (1 - smoothstep(y, sh[1] + 0.18, sh[1] + 0.26))
back = 1 - smoothstep(z, sh[2] + 0.0, sh[2] + 0.07)
TRUNK = {7, 8, 9, 10, 20, 21}
ARM = {0, 13, 14, 18, 19}  # the back of the arm and the armpit's own skin, near the joint
region = np.array([1.0 if r in TRUNK else (1 - smoothstep(dd, 0.22, 0.3)) if r in ARM else 0.0 for r, dd in zip(R, d)])
w = side * height * back * region
# Even the mask over the surface, per place.
wp = np.zeros(len(key)); cnt = np.zeros(len(key))
np.add.at(wp, place, w); np.add.at(cnt, place, 1); wp /= cnt
for _ in range(6):
    wp = np.array([(wp[k] + sum(wp[j] for j in near[k])) / (1 + len(near[k])) for k in range(len(key))])

# The side seen from behind: how far out the skin reaches at each height, and the line the owner
# drew (from the side at the ribs up to where the arm joins the back), which the side is moved toward.
Y0, Y1 = sh[1] - 0.24, sh[1] + 0.0
def out_at(yy):
    m = (np.abs(y - yy) < 0.01) & (z < sh[2] + 0.15)
    return float((-x[m]).max())
o0, o1 = out_at(Y0), out_at(Y1)
disp = np.zeros((len(key), 3))
rep = np.zeros(len(key), dtype=np.int64); rep[place] = np.arange(n)
outs = {}
for k in range(len(key)):
    i = rep[k]
    if wp[k] <= 0.001 or not (Y0 - 0.06 < y[i] < Y1 + 0.02): continue
    yb = round(float(y[i]), 2)
    if yb not in outs: outs[yb] = out_at(yb)
    o = outs[yb]
    t = min(1.0, max(0.0, (y[i] - Y0) / (Y1 - Y0)))
    want = o + SHARE * max(0.0, o0 + (o1 - o0) * t - o)
    # Points at the edge of the side move all the way; 7 cm in from it, not at all.
    g = smoothstep(-x[i], o - 0.07, o - 0.005)
    ramp = smoothstep(y[i], Y0 - 0.06, Y0 + 0.02) * (1 - smoothstep(y[i], Y1 - 0.01, Y1 + 0.02))
    disp[k] = np.array([-(want - o), 0.0, 0.0]) * g * ramp * min(1.0, wp[k] * 2)
print("raw max push cm", round(float(np.linalg.norm(disp, axis=1).max() * 100), 2), "line", round(o0 * 100, 1), "->", round(o1 * 100, 1))
# Ease the push over the skin, among the points that move, so it has no edge.
moving = np.linalg.norm(disp, axis=1) > 0
for _ in range(ROUNDS):
    nd = disp.copy()
    for k in np.where(moving)[0]:
        nb = [j for j in near[k]]
        nd[k] = (disp[k] + sum(disp[j] for j in nb)) / (1 + len(nb))
    disp = nd
    moving = moving | np.array([any(moving[j] for j in near[k]) for k in range(len(key))])
target = P + disp[place]
target.astype(np.float32).tofile(D + f"target_{SHARE}.bin")
print("max push cm", round(float(np.linalg.norm(disp, axis=1).max() * 100), 2))

# Blender scene: the drawn skin and the target, for looking and for sculpting by hand.
bpy.ops.wm.read_factory_settings(use_empty=True)
def make(name, pts):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in three2bl(pts)], [], [tuple(int(i) for i in t) for t in tri])
    me.update()
    for poly in me.polygons: poly.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob
def merged(ob):
    c = ob.copy(); c.data = ob.data.copy(); c.name = ob.name + "_view"
    bpy.context.scene.collection.objects.link(c)
    bm = bmesh.new(); bm.from_mesh(c.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(c.data); bm.free()
    for poly in c.data.polygons: poly.use_smooth = True
    return c
before = make("drawn_now", P)
after = make("target", target)
bpy.ops.wm.save_as_mainfile(filepath=D + f"correctives_{SHARE}.blend")
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "SINGLE"
scene.display.shading.single_color = (0.75, 0.72, 0.68)
scene.world = bpy.data.worlds.new("w"); scene.world.color = (0.05, 0.05, 0.05)
scene.render.resolution_x = 700; scene.render.resolution_y = 900
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scene.collection.objects.link(cam); scene.camera = cam
cam.data.type = "ORTHO"; cam.data.ortho_scale = 0.75; cam.data.clip_end = 10
c = Vector(three2bl(np.array([sh]))[0]) + Vector((0.08, 0, -0.12))
views = {"back": Vector((0, 1, 0)), "front": Vector((0, -1, 0)), "angle": Vector((-0.7, -0.7, 0)).normalized(), "rback": Vector((-0.7, 0.7, 0)).normalized()}
vb, va = merged(before), merged(after)
before.hide_render = after.hide_render = True
for ob, tag in ((vb, "before"), (va, "after")):
    vb.hide_render = ob is not vb; va.hide_render = ob is not va
    for name, v in views.items():
        cam.location = c + v * 2
        cam.rotation_euler = (-v).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = f"{D}r_{tag}_{name}.png" if tag == "before" else f"{D}r_{SHARE}_{name}.png"
        bpy.ops.render.render(write_still=True)
