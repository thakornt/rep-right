# blender --background --python sculpt.py -- <dir> <base.bin> <out.bin> [green_up green_in red_up blue]
# The owner's marks on the front (2026-11-13):
#  green: the front deltoid moves up and in toward the cheek, staying in front of the trapezius;
#  red: the upper chest, joined to it, lifts with it;
#  blue: the side under the armpit stays where the trunk puts it, not drawn up with the arm, so the
#        armpit under the shoulder isn't squeezed short.
import bpy, sys, json
import numpy as np
a = sys.argv[sys.argv.index("--") + 1:]
D = a[0] + "/"; BASE = a[1]; OUT = a[2]
GUP = float(a[3]) if len(a) > 3 else 0.035
GIN = float(a[4]) if len(a) > 4 else 0.02
RUP = float(a[5]) if len(a) > 5 else 0.025
BLUE = float(a[6]) if len(a) > 6 else 0.85
meta = json.load(open(D + "meta.json")); n = meta["n"]
base = np.fromfile(BASE, dtype=np.float32).reshape(-1, 3).astype(float)
P = np.fromfile(D + "final.bin", dtype=np.float32).reshape(-1, 3).astype(float)
Rr = np.fromfile(D + "rest.bin", dtype=np.float32).reshape(-1, 3).astype(float)
T = np.fromfile(D + "index.bin", dtype=np.uint32).reshape(-1, 3)
R = np.fromfile(D + "regions.bin", dtype=np.uint8)
M = np.array(json.load(open(D + "trunk.json"))).reshape(4, 4).T  # column-major -> row-major
trunk_only = (np.c_[Rr, np.ones(n)] @ M.T)[:, :3]
sh = np.array(meta["shoulderR"])
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
def ease(w, rounds):
    for _ in range(rounds): w = np.array([(w[k] + w[nb[k]].sum(0)) / (1 + len(nb[k])) for k in range(m)])
    return w
X, B, TO, reg = P[rep], base[rep], trunk_only[rep], R[rep]
x, y, z = X.T
d = np.linalg.norm(X - sh, axis=1)
front = ss(z, sh[2] - 0.03, sh[2] + 0.01)
# green: the front deltoid
g = np.isin(reg, [12]).astype(float) + 0.5 * np.isin(reg, [18]) * front
g = ease(g * (1 - ss(d, 0.08, 0.14)) * front, 4)
# red: the upper chest near the shoulder, less toward the breastbone
r = np.isin(reg, [16, 11]).astype(float) * ss(-x, 0.03, 0.11) * (1 - ss(d, 0.14, 0.22)) * front
r = ease(r, 4)
# blue: the side under the armpit, not the back (the lat line stays), not the arm
b = np.isin(reg, [20, 21, 9, 0, 7, 17]).astype(float) * ss(-x, 0.08, 0.12) * ss(z, sh[2] - 0.06, sh[2] - 0.02)
b *= ss(sh[1] - y, 0.03, 0.08) * (1 - ss(sh[1] - y, 0.2, 0.28))
b = ease(b, 5)
disp = np.zeros((m, 3))
disp += g[:, None] * np.array([GIN, GUP, 0.006])  # in (toward the middle is +x on the right side), up, a touch forward
disp += r[:, None] * np.array([0.0, RUP, 0.0])
# Only down (and up), as the trunk would hold it: moving it in or out too pushed the side out into a
# bulge under the armpit (owner, 2026-11-13).
drop = (TO - X) * np.array([0.0, 1.0, 0.0])
disp += (BLUE * b)[:, None] * drop
for _ in range(3): disp = np.array([(disp[k] + disp[nb[k]].sum(0)) / (1 + len(nb[k])) for k in range(m)])
print("green max", round(float(g.max()), 2), "red max", round(float(r.max()), 2), "blue max", round(float(b.max()), 2), "blue moves cm", round(float(np.linalg.norm((BLUE * b)[:, None] * drop, axis=1).max() * 100), 1))
(B + disp)[place].astype(np.float32).tofile(OUT)
