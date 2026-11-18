# blender --background --python fill.py -- <dir> <base.bin> <out.bin> [radius] [share]
# The front of the shoulder with the arm overhead: the skin between the upper chest and the arm sank
# into a gap and folded (owner, 2026-11-13, seen from above). The deepest gap in front of the joint is
# found against the convex hull round it, and the skin there is filled out to that hull, so the upper
# chest runs into the front deltoid as one rounded mass, then eased so it has no edge.
import bpy, bmesh, sys, json
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index("--") + 1:]
D = a[0] + "/"; BASE = a[1]; OUT = a[2]
RAD = float(a[3]) if len(a) > 3 else 0.075
SHARE = float(a[4]) if len(a) > 4 else 1.0
ROUNDS = int(a[5]) if len(a) > 5 else 80
meta = json.load(open(D + "meta.json")); n = meta["n"]
base = np.fromfile(BASE, dtype=np.float32).reshape(-1, 3).astype(float)
Rr = np.fromfile(D + "rest.bin", dtype=np.float32).reshape(-1, 3).astype(float)
T = np.fromfile(D + "index.bin", dtype=np.uint32).reshape(-1, 3)
sh = np.array(meta["shoulderR"]); neck = np.array(meta["neck"])
def ss(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo), 0, 1); return t * t * (3 - 2 * t)
key = {}; place = np.zeros(n, dtype=np.int64)
for i, p in enumerate(Rr):
    place[i] = key.setdefault((round(p[0], 5), round(p[1], 5), round(p[2], 5)), len(key))
m = len(key); rep = np.zeros(m, dtype=np.int64); rep[place] = np.arange(n)
nb = [set() for _ in range(m)]
for t in T:
    k = [place[v] for v in t]
    for u, v in ((k[0], k[1]), (k[1], k[2]), (k[2], k[0])):
        if u != v: nb[u].add(v); nb[v].add(u)
nb = [list(s) for s in nb]
X = base[rep]
def hull_of(idx):
    bm = bmesh.new()
    for i in idx: bm.verts.new(Vector(X[i]))
    bmesh.ops.convex_hull(bm, input=bm.verts)
    return BVHTree.FromBMesh(bm)
def gap(bvh, idx):
    return np.array([(np.array(bvh.find_nearest(Vector(X[i]))[0]) - X[i]) for i in idx])
# Not the neck and head: away from the line up the neck.
off_neck = ss(np.abs(X[:, 0] - neck[0]), 0.07, 0.1)
# The deepest gap in front of and above the joint, against the hull of the skin round the joint.
d = np.linalg.norm(X - sh, axis=1)
look = np.where((d < 0.13) & (X[:, 2] > sh[2] - 0.02) & (off_neck > 0.5))[0]
g = gap(hull_of(look), look)
deep = look[np.argmax(np.linalg.norm(g, axis=1))]
c = X[deep]
print("deepest gap cm", round(float(np.linalg.norm(g, axis=1).max() * 100), 2), "at (out, up, fwd) cm", np.round((c - sh) * np.array([-100, 100, 100]), 1))
# Fill round it: smooth the skin where it sinks (its neighbours' middle lies outside it) and only
# slide it along the surface where it bulges, so the gap fills from its sides and nothing crosses.
F = np.array([[place[v] for v in t] for t in T if len({place[v] for v in t}) == 3])
def normals(Y):
    fn = np.cross(Y[F[:, 1]] - Y[F[:, 0]], Y[F[:, 2]] - Y[F[:, 0]])
    vn = np.zeros_like(Y)
    for k in range(3): np.add.at(vn, F[:, k], fn)
    return vn / np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)
w = (1 - ss(np.linalg.norm(X - c, axis=1), RAD * 0.5, RAD)) * off_neck
zone = np.where(w > 0.01)[0]
Y = X.copy()
for r in range(ROUNDS):
    L = np.array([Y[nb[k]].mean(0) - Y[k] for k in zone])
    vn = normals(Y)[zone]
    out = (L * vn).sum(1)
    L = np.where(out[:, None] > 0, L, L - out[:, None] * vn)
    Y[zone] += 0.5 * L * (w[zone] * SHARE)[:, None]
disp = Y - X
print("max fill cm", round(float(np.linalg.norm(disp, axis=1).max() * 100), 2))
(X + disp)[place].astype(np.float32).tofile(OUT)
