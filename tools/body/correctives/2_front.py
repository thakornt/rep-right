# blender --background --python front.py -- <dir> <base_target.bin> <out.bin> [stiff] [rounds]
# The front of the shoulder, squeezed flat with the arm overhead: its skin is let back out toward its
# rest lengths (edges as long as at rest), pushing out along the surface's normal as it does, so the
# deltoid stands as a mass. Skin outside the zone stays put; the zone fades in from its edge.
import bpy, bmesh, sys, json
import numpy as np
from mathutils import Vector
a = sys.argv[sys.argv.index("--") + 1:]
D = a[0] + "/"; BASE = a[1]; OUT = a[2]
STIFF = float(a[3]) if len(a) > 3 else 0.5
ROUNDS = int(a[4]) if len(a) > 4 else 60
meta = json.load(open(D + "meta.json")); n = meta["n"]
P = np.fromfile(BASE, dtype=np.float32).reshape(-1, 3).astype(float)
Rr = np.fromfile(D + "rest.bin", dtype=np.float32).reshape(-1, 3).astype(float)
T = np.fromfile(D + "index.bin", dtype=np.uint32).reshape(-1, 3)
R = np.fromfile(D + "regions.bin", dtype=np.uint8)
sh = np.array(meta["shoulderR"])
def ss(x, a_, b_):
    t = np.clip((x - a_) / (b_ - a_), 0, 1); return t * t * (3 - 2 * t)
key = {}; place = np.zeros(n, dtype=np.int64)
for i, p in enumerate(Rr):
    place[i] = key.setdefault((round(p[0], 5), round(p[1], 5), round(p[2], 5)), len(key))
m = len(key); rep = np.zeros(m, dtype=np.int64); rep[place] = np.arange(n)
X = P[rep].copy(); X0 = X.copy(); RR = Rr[rep]
edges = set(); faces = []
for t in T:
    k = [place[v] for v in t]
    if len(set(k)) < 3: continue
    faces.append(k)
    for u, v in ((k[0], k[1]), (k[1], k[2]), (k[2], k[0])): edges.add((min(u, v), max(u, v)))
E = np.array(sorted(edges))
# Rest lengths in the posed scale.
lr = np.linalg.norm(RR[E[:, 0]] - RR[E[:, 1]], axis=1)
lp = np.linalg.norm(X[E[:, 0]] - X[E[:, 1]], axis=1)
s = np.median(lp / np.maximum(lr, 1e-9)); lr = lr * s
# Zone: the deltoid and the skin over the joint, near it.
d = np.linalg.norm(X - sh, axis=1)
reg = R[rep]
zone = np.isin(reg, [12, 18, 0, 13, 16, 10, 19]).astype(float) * (1 - ss(d, 0.09, 0.15))
zone *= np.where(np.isin(reg, [12, 18]), 1.0, 0.6)
F = np.array(faces)
def normals(Y):
    fn = np.cross(Y[F[:, 1]] - Y[F[:, 0]], Y[F[:, 2]] - Y[F[:, 0]])
    vn = np.zeros_like(Y)
    for k in range(3): np.add.at(vn, F[:, k], fn)
    return vn / np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)
nb = [[] for _ in range(m)]
for u, v in E: nb[u].append(v); nb[v].append(u)
def lap(Y):
    return np.array([Y[nb[k]].mean(0) if nb[k] else Y[k] for k in range(m)]) - Y
# 1. Smooth the crumpled skin along the surface only, so it doesn't sink.
for r in range(ROUNDS):
    L = lap(X); vn = normals(X)
    L -= (L * vn).sum(1, keepdims=True) * vn
    X = X + 0.4 * L * zone[:, None]
# 2. How squeezed each point is: its triangles' area now against at rest.
fa = lambda Y: 0.5 * np.linalg.norm(np.cross(Y[F[:, 1]] - Y[F[:, 0]], Y[F[:, 2]] - Y[F[:, 0]]), axis=1)
ratio = fa(X0) / np.maximum(fa(RR) * s * s, 1e-12)
sq = np.zeros(m); cnt = np.zeros(m)
for k in range(3): np.add.at(sq, F[:, k], np.clip(1 - np.sqrt(ratio), 0, 0.7)); np.add.at(cnt, F[:, k], 1)
sq /= np.maximum(cnt, 1)
for _ in range(4): sq = np.array([(sq[k] + sq[nb[k]].sum()) / (1 + len(nb[k])) for k in range(m)])
# 3. Out along the smoothed surface's normal by how squeezed, eased.
out = normals(X) * (STIFF * sq * zone)[:, None]
for _ in range(6): out = out + 0.5 * lap(out)
X = X + out
print("most squeezed", round(float(sq.max()), 2), "max out cm", round(float(np.linalg.norm(out, axis=1).max() * 100), 2))
disp = X - X0
print("max let out cm", round(float(np.linalg.norm(disp, axis=1).max() * 100), 2))
out = P + disp[place]
out.astype(np.float32).tofile(OUT)
