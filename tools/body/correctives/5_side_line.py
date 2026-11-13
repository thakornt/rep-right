# blender --background --python clamp.py -- <dir> <base.bin> <out.bin>
# The side under the arm, seen from the front or back, runs as a straight line from the ribs up to
# where the arm joins: skin standing out past that line (a bulge, owner 2026-11-13) is drawn back in.
import bpy, sys, json
import numpy as np
a = sys.argv[sys.argv.index("--") + 1:]
D = a[0] + "/"; BASE = a[1]; OUT = a[2]
meta = json.load(open(D + "meta.json")); n = meta["n"]
X0 = np.fromfile(BASE, dtype=np.float32).reshape(-1, 3).astype(float)
Rr = np.fromfile(D + "rest.bin", dtype=np.float32).reshape(-1, 3).astype(float)
T = np.fromfile(D + "index.bin", dtype=np.uint32).reshape(-1, 3)
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
X = X0[rep]
Y0, Y1 = sh[1] - 0.24, sh[1] - 0.0
out = lambda yy: float((-X[np.abs(X[:, 1] - yy) < 0.012, 0]).max())
o0, o1 = out(Y0), out(Y1)
line = o0 + (o1 - o0) * np.clip((X[:, 1] - Y0) / (Y1 - Y0), 0, 1)
side = (X[:, 0] < -0.05) & (X[:, 1] > Y0 - 0.02) & (X[:, 1] < Y1 - 0.02)
excess = np.where(side, np.maximum(0, -X[:, 0] - line), 0)
disp = np.zeros((m, 3)); disp[:, 0] = excess  # back in toward the middle (+x on the right side)
for _ in range(3): disp = np.array([(disp[k] + disp[nb[k]].sum(0)) / (1 + len(nb[k])) for k in range(m)])
# the easing spread it thinner: scale so the worst excess is fully taken back
scale = excess.max() / max(disp[:, 0][excess.argmax()], 1e-9)
disp *= min(scale, 3.0)
print("most past the line cm", round(float(excess.max() * 100), 2), "line", round(o0 * 100, 1), "->", round(o1 * 100, 1))
(X + disp)[place].astype(np.float32).tofile(OUT)
