"""Generate the rep-right body model (apps/web/public/models/body.glb).

Run headless with Blender 4.5 + the MPFB2 extension and the CC0
makehuman_system_assets pack installed:

    blender --background --python tools/body/build.py -- <out.glb> [render_dir]

The model is a MakeHuman base mesh (CC0) with the game_engine rig. It writes
out.glb, plus two maps beside it, which the web shader reads:

    muscles.png  per pixel: region id, see MUSCLES below (0 = none), plus
                 CLOTH_STEP x 0 skin, 1 shorts, 2 shoes
    relief.png   normal map: the grooves between muscles

Regions are assigned from the rig weights plus geometric rules in the rest
pose. They are approximate surface areas for teaching, not exact anatomy.
"""

import math
import os
import struct
import sys
import zlib

import bpy
import numpy as np
from mathutils import Vector

from bl_ext.user_default.mpfb.services.exportservice import ExportService
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService

# Keep in sync with apps/web/src/components/body/muscles.ts
MUSCLES = {
    "quads": 1,
    "hamstrings": 2,
    "adductors": 3,
    "glutes": 4,
    "calves": 5,
    "abs": 6,
    "obliques": 7,
    "erectors": 8,
    "lats": 9,
    "upper_back": 10,
    "chest_mid": 11,
    "delt_front": 12,
    "biceps": 13,
    "triceps": 14,
    "forearms": 15,
    "chest_upper": 16,
    "chest_lower": 17,
    "delt_side": 18,
    "delt_rear": 19,
    "teres": 20,
    "teres_over_lats": 21,  # the teres where it lies over lats; follows lats in lifts that don't call on it
}

# The teres on the back, from the shoulder blade's lower corner up and out to the back of
# the armpit: an ellipse, in |x| and height at rest.
TERES_FROM = (0.09, 1.17)
TERES_TO = (0.19, 1.31)
TERES_HALF_WIDTH = 0.04

MAP_SIZE = 2048  # region ids are hard edges; at 1024 a shallow hem shows the pixel steps
RELIEF_SIZE = 1024
WAIST = 0.97  # metres, top of the shorts and of the glutes
CLOTH_STEP = 32  # keep in sync with the shader in body-scene.tsx
RELIEF_DEPTH = 0.005  # metres, the deepest groove between muscles

MACRO = {
    "gender": 1.0,
    "age": 0.5,
    "muscle": 0.9,
    "weight": 0.45,
    "proportions": 0.6,
    "height": 0.5,
    "cupsize": 0.5,
    "firmness": 0.5,
    "race": {"asian": 0.6, "caucasian": 0.2, "african": 0.2},
}


# MakeHuman's per-muscle shape targets (CC0), on top of the overall muscle value.
MUSCLE_TARGETS = {
    "torso-muscle-pectoral-incr": 0.4,
    "torso-muscle-dorsi-incr": 0.5,
    "stomach-tone-incr": 1.0,
    "l-upperarm-muscle-incr": 0.7,
    "r-upperarm-muscle-incr": 0.7,
    "l-upperarm-shoulder-muscle-incr": 1.0,
    "r-upperarm-shoulder-muscle-incr": 1.0,
    "l-lowerarm-muscle-incr": 1.0,
    "r-lowerarm-muscle-incr": 1.0,
    "l-upperleg-muscle-incr": 1.0,
    "r-upperleg-muscle-incr": 1.0,
    "l-lowerleg-muscle-incr": 0.2,
    "r-lowerleg-muscle-incr": 0.2,
}


TRUNK = ["pelvis", "spine_01", "spine_02", "spine_03", "clavicle", "neck_01"]
NECK_TOP = 1.49  # metres, where the trapezius meets the skull
ERECTORS_X = 0.05  # metres from the spine, the outer edge of the erector columns


def abs_edge(z):
    """The outer edge of the abs: narrow at the waistband, widest under the ribs."""
    return 0.06 + 0.025 * ramp(z, 0.97, 1.07)


def traps_edge(x):
    """Lower edge of the trapezius, from mid-back up and out to the shoulder blade."""
    return 1.12 + 1.3 * x


def blade_edge(x):
    """Lower edge of the muscles on the shoulder blade, where lats begin."""
    return 1.24 - 0.45 * x


def lats_low(x):
    """Lower edge of lats, rising from the hip bone out to the flank."""
    return WAIST + 0.9 * np.maximum(x - 0.07, 0)


def obliques_top(x):
    """Top of the obliques, meeting the chest by the abs and sloping down to the flank."""
    return 1.2 - 0.6 * np.maximum(x - 0.09, 0)


def delto_pec(z):
    """The groove between chest and deltoid, from the collarbone down and out to the arm."""
    return 0.105 + 0.5 * np.maximum(1.38 - z, 0)


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if not argv:
        sys.exit("usage: blender --background --python build.py -- <out.glb> [render_dir]")
    return argv[0], (argv[1] if len(argv) > 1 else None)


def make_human():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    mesh = HumanService.create_human(macro_detail_dict=MACRO)
    for name, weight in MUSCLE_TARGETS.items():
        TargetService.load_target(mesh, TargetService.target_full_path(name), weight=weight)
    rig = HumanService.add_builtin_rig(mesh, "game_engine")
    ExportService.bake_modifiers_remove_helpers(mesh, bake_masks=True, remove_helpers=True, also_proxy=False)
    if mesh.data.shape_keys:
        bpy.context.view_layer.objects.active = mesh
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    mesh.name = "Body"
    rig.name = "Rig"
    return mesh, rig


class Limb:
    """Cylindrical coordinates around a bone: t along it, angle around it."""

    def __init__(self, bone, side):
        self.head = bone.head_local.copy()
        axis = bone.tail_local - bone.head_local
        self.length = axis.length
        self.axis = axis.normalized()
        front = Vector((0, -1, 0))
        self.front = (front - self.axis * front.dot(self.axis)).normalized()
        out = Vector((side, 0, 0))
        out = out - self.axis * out.dot(self.axis) - self.front * out.dot(self.front)
        self.out = out.normalized()

    def coords(self, p):
        d = p - self.head
        t = d.dot(self.axis) / self.length
        r = d - self.axis * d.dot(self.axis)
        # 0 = front, +90 = outside, -90 = inside (toward the midline), 180 = back
        angle = math.degrees(math.atan2(r.dot(self.out), r.dot(self.front)))
        return t, angle


def classify(mesh, rig):
    bones = rig.data.bones
    group_names = {g.index: g.name for g in mesh.vertex_groups}
    limbs = {}
    for name in ("thigh", "calf", "upperarm", "lowerarm"):
        for side, s in (("l", 1), ("r", -1)):
            limbs[f"{name}_{side}"] = Limb(bones[f"{name}_{side}"], s)

    muscle = [0] * len(mesh.data.vertices)
    bases = [""] * len(mesh.data.vertices)
    m = MUSCLES

    for v in mesh.data.vertices:
        weights = {}
        for g in v.groups:
            name = group_names.get(g.group, "")
            if name in bones:
                weights[name] = weights.get(name, 0) + g.weight
        if not weights:
            continue
        bone = max(weights, key=weights.get)
        base = bone[:-2] if bone.endswith(("_l", "_r")) else bone
        bases[v.index] = base
        p, n = v.co, v.normal
        x, z = abs(p.x), p.z
        front, back = n.y < -0.3, n.y > 0.3
        region = 0

        if base == "thigh":
            t, a = limbs[bone].coords(p)
            if t < 0.22 and abs(a) > 115:
                region = m["glutes"]
            elif abs(a) > 125:
                region = m["hamstrings"]
            elif -125 <= a < -55 and t < 0.75:
                region = m["adductors"]
            else:
                region = m["quads"]
        elif base == "calf":
            t, a = limbs[bone].coords(p)
            if t < 0.72 and abs(a) > 95:
                region = m["calves"]
            elif t < 0.08 and abs(a) < 60:
                region = m["quads"]
        elif base == "pelvis":
            if back or p.y > 0.03:
                region = m["glutes"] if z < 1.0 else m["erectors"]
            elif front and z > 0.9:
                region = m["abs"] if x < 0.065 else m["obliques"]
            elif z > 0.93:
                region = m["obliques"]
        elif base.startswith("spine"):
            if front:
                if z > 1.17:
                    region = m["chest_mid"]
                elif z > 0.92:
                    region = m["abs"] if x < 0.07 else m["obliques"]
            elif back:
                if z > 1.24:
                    region = m["upper_back"]
                elif x < 0.06:
                    region = m["erectors"]
                elif z > 1.04:
                    region = m["lats"]
                else:
                    region = m["erectors"] if x < 0.09 else m["obliques"]
            else:
                region = m["lats"] if z > 1.05 else m["obliques"]
        elif base == "clavicle":
            if x > 0.135:  # the cap of the shoulder, front and back
                region = m["delt_front"]
            elif front and z < 1.36:
                region = m["chest_mid"]
            elif back or n.z > 0.5:
                region = m["upper_back"]
            else:
                region = m["delt_front"]
        elif base == "neck_01":
            if (back or n.z > 0.3) and z < 1.5:
                region = m["upper_back"]
        elif base == "upperarm":
            t, a = limbs[bone].coords(p)
            if t < 0.5 and not (-140 < a < -40):  # runs about halfway down the arm
                region = m["delt_front"]
            elif abs(a) < 90:
                region = m["biceps"]
            else:
                region = m["triceps"]
        elif base == "lowerarm":
            t, _ = limbs[bone].coords(p)
            if t < 0.85:
                region = m["forearms"]

        muscle[v.index] = region

    return muscle, bases, limbs


def texels(mesh, size):
    """Every map pixel on the body: where it is, its surface, its nearest vertex,
    and how many metres of skin one pixel covers."""
    d = mesh.data
    uv = np.zeros(len(d.uv_layers.active.data) * 2)
    d.uv_layers.active.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2) * size
    co = np.array([v.co[:] for v in d.vertices])
    no = np.array([v.normal[:] for v in d.vertices])
    px, py, pos, nor, dom, scale = [], [], [], [], [], []
    # The same triangles the exporter writes, or edges zigzag across each quad.
    d.calc_loop_triangles()
    for tri in d.loop_triangles:
        a, b, c = uv[tri.loops[0]], uv[tri.loops[1]], uv[tri.loops[2]]
        lo = np.floor(np.min([a, b, c], axis=0)).astype(int)
        hi = np.ceil(np.max([a, b, c], axis=0)).astype(int)
        xs, ys = np.meshgrid(np.arange(lo[0], hi[0] + 1), np.arange(lo[1], hi[1] + 1))
        e0, e1 = b - a, c - a
        den = e0[0] * e1[1] - e1[0] * e0[1]
        if abs(den) < 1e-9:
            continue
        dx, dy = xs + 0.5 - a[0], ys + 0.5 - a[1]
        w1 = (dx * e1[1] - e1[0] * dy) / den
        w2 = (e0[0] * dy - dx * e0[1]) / den
        w0 = 1 - w1 - w2
        inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not inside.any():
            continue
        w = np.stack([w0[inside], w1[inside], w2[inside]], axis=1)
        ids = np.array(tri.vertices)
        px.append(xs[inside])
        py.append(ys[inside])
        pos.append(w @ co[ids])
        nor.append(w @ no[ids])
        dom.append(ids[w.argmax(axis=1)])
        area = np.linalg.norm(np.cross(co[ids[1]] - co[ids[0]], co[ids[2]] - co[ids[0]]))
        scale.append(np.full(len(w), math.sqrt(area / abs(den))))
    return tuple(np.concatenate(a) for a in (px, py, pos, nor, dom, scale))


def wrap(angle):
    return (angle + 180) % 360 - 180


def cloth_of(base, z):
    cloth = np.zeros(len(z), np.uint8)
    cloth[np.isin(base, ["pelvis", "thigh", "calf", "spine_01", "spine_02"]) & (z > 0.6) & (z < WAIST)] = 1
    cloth[np.isin(base, ["foot", "ball", "calf"]) & (z < 0.1)] = 2
    return cloth


def paint_map(mesh, muscle, bases, limbs):
    """The region of every pixel, from where the pixel is rather than its nearest
    vertex, so edges run clean across the mesh. Rules follow classify()."""
    px, py, pos, nor, dom, _ = texels(mesh, MAP_SIZE)
    m = MUSCLES
    coarse = np.array(muscle)[dom]
    base = np.array(bases)[dom]
    region = coarse.copy()

    x, y, z = np.abs(pos[:, 0]), pos[:, 1], pos[:, 2]
    front, back = nor[:, 1] < -0.3, nor[:, 1] > 0.3
    # Around each upper arm: t along the bone, a around it (0 front, +90 outside).
    t, a = limb_coords(pos, limbs, "upperarm")

    # Chest outline: a fan of fibres converging on the upper arm, so the heads divide
    # along lines from that point rather than across the body.
    INSERT_X, INSERT_Z = 0.175, 1.30
    spoke = np.degrees(np.arctan2(z - INSERT_Z, np.maximum(INSERT_X - x, 1e-4)))
    pec_top = 1.385 - 0.05 * x
    pec_bottom = 1.17 + 0.13 * (x / INSERT_X) ** 2

    # Trunk, from where the pixel is rather than which bone it follows, so edges run
    # along the grooves carved in carve_relief() instead of the bones' borders.
    pelvis = base == "pelvis"
    trunk = np.isin(base, TRUNK)
    region[trunk] = 0
    shown = z >= WAIST  # the shorts cover the rest
    ahead = trunk & front & shown & (z < pec_bottom)
    region[ahead & (x < abs_edge(z))] = m["abs"]
    region[ahead & (x >= abs_edge(z)) & (z < obliques_top(x))] = m["obliques"]
    behind = trunk & ~front & shown & (z < NECK_TOP)
    # The flank: lats from the hip bone at the back, reaching further forward as they
    # rise to the armpit; obliques in front of them up to the ribs.
    lat = (z > lats_low(x)) & (z > 0.98 + 0.33 * (0.6 - nor[:, 1]))
    region[behind] = np.where(lat[behind], m["lats"], np.where(z[behind] < obliques_top(x[behind]), m["obliques"], 0))
    region[behind & back & (x < ERECTORS_X)] = m["erectors"]
    blade = back & (z > blade_edge(x)) & (x > 0.07) & (x < 0.17)
    region[behind & blade] = m["upper_back"]  # the muscles on the shoulder blade
    traps = (behind | (trunk & (nor[:, 2] > 0.5) & ~front)) & (z > traps_edge(x)) & (z < NECK_TOP)
    neck = np.isin(base, ["neck_01", "head"]) & (nor[:, 1] > -0.1) & (nor[:, 2] > -0.3) & (z < NECK_TOP)
    region[traps | neck] = m["upper_back"]
    rear = pelvis & (back | (y > 0.03))

    # Legs. The hip crease and the knee are lines on the body, not bone borders.
    tt, ta = limb_coords(pos, limbs, "thigh")
    ct, ca = limb_coords(pos, limbs, "calf")
    crease = np.clip(0.8 + 0.93 * (x - 0.03), 0.8, 0.93)  # from the crotch up and out to the hip
    legs = np.isin(base, ["thigh", "calf"])
    thigh = (legs & (tt < 1) & (z < crease)) | (pelvis & ~rear & (z < crease))
    calf = legs & (tt >= 1)
    hip = np.isin(base, ["pelvis", "thigh"]) & (z >= crease) & ~shown
    region[legs | hip] = 0
    # Quads stop above the kneecap, lower on the inside; hamstrings part at the back of
    # the knee, where the calf's two heads begin.
    quads_end = 0.97 - 0.08 * np.cos(np.radians(np.clip(ta, -90, 90))) ** 2
    region[thigh & (tt < quads_end) & (np.abs(ta) <= 125)] = m["quads"]
    region[thigh & (ta >= -125) & (ta < -55) & (tt < 0.75)] = m["adductors"]
    region[thigh & (np.abs(ta) > 125) & (tt < 1 - 0.15 * ramp(np.abs(ta), 140, 175))] = m["hamstrings"]
    region[thigh & (tt < 0.22) & (np.abs(ta) > 115)] = m["glutes"]
    region[hip & (np.abs(ta) > 115)] = m["glutes"]
    # The side of the hip and under the seat, not left over from the rules above.
    region[(pelvis | hip) & ~front & ~shown & (x > 0.03)] = m["glutes"]
    region[pelvis & ~front & (z < 0.85)] = m["glutes"]
    region[(pelvis | legs) & (y > 0) & (x < 0.05) & (z < 0.85) & (tt < 0.22)] = m["glutes"]
    region[(rear | (trunk & ~front)) & ~shown] = m["glutes"]
    region[calf & (ct < 0.72) & (np.abs(ca) > 95) & (ct > 0.08 * ramp(np.abs(ca), 140, 175))] = m["calves"]

    # Elbow: one plane across the joint rather than the bones' border, which zigzags
    # through the crease. The forearm muscles start below the bony tip at the back.
    ft, fa = limb_coords(pos, limbs, "lowerarm")
    limb = np.isin(base, ["upperarm", "lowerarm", "hand"])
    region[limb] = 0
    fore = limb & (ft >= 0)
    region[fore & (ft < 0.85) & (ft > 0.12 * ramp(np.abs(fa), 100, 150))] = m["forearms"]

    # Upper arm: biceps in front, triceps behind.
    arm = limb & (ft < 0) & (base != "hand")
    region[arm & (np.abs(a) < 90)] = m["biceps"]
    region[arm & (np.abs(a) >= 90)] = m["triceps"]
    region[arm & (np.abs(a) >= 90) & (t < 0.22)] = m["lats"]  # behind the armpit, where arm and trunk skin mix

    # Chest, inside the outline above.
    pec = trunk & (nor[:, 1] < -0.1) & (x < delto_pec(z)) & (z < pec_top) & (z > pec_bottom)
    region[pec] = m["chest_mid"]
    region[pec & (spoke > 14)] = m["chest_upper"]
    region[pec & (spoke < -32)] = m["chest_lower"]

    # Deltoid: wraps the shoulder and tapers to a point halfway down the arm. On the
    # trunk it ends at the groove beside the chest in front, and at the shoulder
    # blade behind, both slanting out as they go down.
    wrapped = np.abs(wrap(a - 90))
    edge = np.where(nor[:, 1] < 0, delto_pec(z), 0.155 + 0.3 * np.maximum(1.38 - z, 0))
    shoulder = trunk & (x > edge) & (z > 1.2)
    cap = (arm | shoulder) & (t < 0.5) & (wrapped < 150 - 230 * np.maximum(t, 0))
    region[cap] = m["delt_side"]
    region[cap & (a < 50) & (a > -130)] = m["delt_front"]
    region[cap & ((a > 130) | (a < -130))] = m["delt_rear"]
    # Across the back of the shoulder, the trapezius rather than the border between bones.
    region[(base == "upperarm") & (nor[:, 1] > 0) & (x < 0.15) & (z > traps_edge(x))] = m["upper_back"]

    # Teres: an ellipse over the lower corner of the upper back and the top of lats.
    middle_x, middle_z = (TERES_FROM[0] + TERES_TO[0]) / 2, (TERES_FROM[1] + TERES_TO[1]) / 2
    run_x, run_z = TERES_TO[0] - TERES_FROM[0], TERES_TO[1] - TERES_FROM[1]
    run = np.hypot(run_x, run_z)
    along = ((x - middle_x) * run_x + (z - middle_z) * run_z) / run / (run / 2)
    across = (-(x - middle_x) * run_z + (z - middle_z) * run_x) / run / TERES_HALF_WIDTH
    teres = (along**2 + across**2 <= 1) & (nor[:, 1] > -0.2)
    region[teres & (region == m["lats"])] = m["teres_over_lats"]
    region[teres & (region == m["upper_back"])] = m["teres"]

    image = np.zeros((MAP_SIZE, MAP_SIZE), np.uint8)
    inside = (px >= 0) & (px < MAP_SIZE) & (py >= 0) & (py < MAP_SIZE)
    image[py[inside], px[inside]] = region[inside] + CLOTH_STEP * cloth_of(base, z)[inside]
    # Bleed regions past the UV seams, so sampling there can't pick up "none".
    covered = np.zeros((MAP_SIZE, MAP_SIZE), bool)
    covered[py[inside], px[inside]] = True
    for _ in range(8):
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            moved = np.roll(np.roll(image, dy, 0), dx, 1)
            came = np.roll(np.roll(covered, dy, 0), dx, 1)
            fill = ~covered & came
            image[fill] = moved[fill]
            covered |= fill
    return image


def limb_coords(pos, limbs, name):
    """t along the bone and angle a around it (0 front, +90 outside), both sides."""
    t, a = np.zeros(len(pos)), np.zeros(len(pos))
    for tag, sign in (("l", 1), ("r", -1)):
        limb = limbs[f"{name}_{tag}"]
        here = np.sign(pos[:, 0]) * sign >= 0
        d = pos[here] - np.array(limb.head[:])
        along = d @ np.array(limb.axis[:])
        r = d - np.outer(along, np.array(limb.axis[:]))
        t[here] = along / limb.length
        a[here] = np.degrees(np.arctan2(r @ np.array(limb.out[:]), r @ np.array(limb.front[:])))
    return t, a


def ramp(v, lo, hi):
    return np.clip((v - lo) / (hi - lo), 0, 1)


def between(v, lo, hi, fade):
    """1 inside lo..hi, fading to 0 over `fade` outside it."""
    return ramp(v, lo - fade, lo) * (1 - ramp(v, hi, hi + fade))


def groove(d, width):
    return np.exp(-((d / (width * 1.8)) ** 2))


def carve_relief(mesh, bases, limbs):
    """Grooves between muscles, drawn from position so they run clean across the
    mesh and the UV seams. Amounts are shares of RELIEF_DEPTH."""
    px, py, pos, nor, dom, size = texels(mesh, RELIEF_SIZE)
    base = np.array(bases)[dom]
    x, z = np.abs(pos[:, 0]), pos[:, 2]
    shoe = cloth_of(base, z) == 2
    front, back = ramp(-nor[:, 1], 0.0, 0.3), ramp(nor[:, 1], 0.0, 0.3)
    trunk = np.isin(base, ["pelvis", "spine_01", "spine_02", "spine_03", "clavicle"])
    cut = np.zeros(len(pos))

    def carve(mask, amount):
        np.maximum.at(cut, np.nonzero(mask)[0], np.asarray(amount)[mask])

    # Chest, same fan as paint_map.
    INSERT_X, INSERT_Z = 0.175, 1.30
    spoke = np.degrees(np.arctan2(z - INSERT_Z, np.maximum(INSERT_X - x, 1e-4)))
    bottom = 1.17 + 0.13 * (x / INSERT_X) ** 2
    top = 1.385 - 0.05 * x
    chest = trunk & (front > 0) & (x < INSERT_X)
    carve(chest, groove(x, 0.009) * between(z, 1.14, 1.39, 0.02) * front)  # breastbone
    carve(chest, groove(z - bottom, 0.012) * ramp(x, 0.0, 0.03) * front)  # lower edge
    carve(chest, 0.35 * groove(z - top, 0.01) * front)  # under the collarbone
    inner = between(z, bottom, top, 0.01) * front
    carve(chest, 0.3 * groove(spoke - 14, 2.5) * inner)
    carve(chest, 0.2 * groove(spoke + 32, 2.5) * inner)
    carve(chest, 0.04 * (0.5 + 0.5 * np.sin(np.radians(spoke) * 90)) * inner)  # fibres

    # Abs: midline, side edge, and three tendon lines across.
    abdomen = trunk & (front > 0) & (z < 1.19) & (z > 0.93)
    carve(abdomen, 0.85 * groove(x, 0.006) * front)
    carve(abdomen, 0.7 * groove(x - abs_edge(z), 0.008) * front)
    for level in (1.135, 1.075, 1.015):
        carve(abdomen, 0.45 * groove(z - level - 0.15 * x * x, 0.006) * (1 - ramp(x, abs_edge(z) - 0.015, abs_edge(z))) * front)

    # Back: spine, erector columns, lower edge of the traps, lats under the shoulder blade.
    rear = trunk & (back > 0)
    carve(rear, 0.8 * groove(x, 0.009) * between(z, 0.95, 1.45, 0.03) * back)
    carve(rear, 0.45 * groove(x - ERECTORS_X, 0.01) * between(z, 0.97, 1.2, 0.04) * back)
    carve(rear, 0.6 * groove(z - traps_edge(x), 0.009) * between(x, 0.02, 0.17, 0.02) * back)
    carve(rear, 0.5 * groove(z - blade_edge(x), 0.01) * between(x, 0.07, 0.19, 0.02) * back)

    def wrap_groove(a, at, width):
        return groove(wrap(a - at), width)

    # Upper arm: deltoid outline and heads, biceps from triceps.
    t, a = limb_coords(pos, limbs, "upperarm")
    arm = (base == "upperarm") | ((base == "clavicle") & (x > 0.135))
    edge = (np.abs(wrap(a - 90)) - (150 - 230 * np.maximum(t, 0))) / 60
    carve(arm, 0.9 * groove(edge, 0.12) * between(t, 0.0, 0.52, 0.03))
    carve(arm, 0.25 * wrap_groove(a, 50, 7) * (1 - ramp(edge, -0.1, 0)) * ramp(t, 0.02, 0.1))
    carve(arm, 0.25 * wrap_groove(a, 130, 7) * (1 - ramp(edge, -0.1, 0)) * ramp(t, 0.02, 0.1))
    carve(arm, 0.8 * wrap_groove(a, 90, 9) * between(t, 0.42, 0.95, 0.05))
    carve(arm, 0.8 * wrap_groove(a, -90, 9) * between(t, 0.25, 0.95, 0.05))

    # Forearm: the ridge running down from the elbow.
    t, a = limb_coords(pos, limbs, "lowerarm")
    fore = base == "lowerarm"
    carve(fore, 0.4 * wrap_groove(a, 45, 8) * between(t, 0.08, 0.6, 0.1))
    carve(fore, 0.4 * wrap_groove(a, -80, 8) * between(t, 0.08, 0.6, 0.1))

    # Thigh: the front heads, then front from back.
    t, a = limb_coords(pos, limbs, "thigh")
    thigh = base == "thigh"
    carve(thigh, 0.55 * wrap_groove(a, 42, 6) * between(t, 0.35, 0.9, 0.08))
    carve(thigh, 0.55 * wrap_groove(a, -38 + 18 * t, 6) * between(t, 0.5, 0.86, 0.06))
    carve(thigh, 0.7 * wrap_groove(a, 118, 7) * between(t, 0.3, 0.95, 0.05))
    carve(thigh, 0.45 * wrap_groove(a, 180, 7) * between(t, 0.4, 0.9, 0.08))

    # Calf: two heads, ending in a V above the Achilles.
    t, a = limb_coords(pos, limbs, "calf")
    calf = base == "calf"
    carve(calf, 0.55 * wrap_groove(a, 180, 7) * between(t, 0.08, 0.52, 0.06))
    carve(calf, 0.8 * groove(t - (0.42 + 0.0028 * np.abs(wrap(a - 180))), 0.03) * ramp(np.abs(wrap(a)), 75, 95))
    carve(calf, 0.35 * wrap_groove(a, 20, 8) * between(t, 0.1, 0.7, 0.08))

    cut[shoe] = 0
    height, metres = np.zeros((RELIEF_SIZE, RELIEF_SIZE)), np.zeros((RELIEF_SIZE, RELIEF_SIZE))
    inside = (px >= 0) & (px < RELIEF_SIZE) & (py >= 0) & (py < RELIEF_SIZE)
    height[py[inside], px[inside]] = -cut[inside] * RELIEF_DEPTH
    metres[py[inside], px[inside]] = size[inside]
    covered = metres > 0
    # Bleed past the UV seams, as in paint_map, so the slopes don't see an edge.
    for _ in range(4):
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            fill = ~covered & np.roll(np.roll(covered, dy, 0), dx, 1)
            height[fill] = np.roll(np.roll(height, dy, 0), dx, 1)[fill]
            metres[fill] = np.roll(np.roll(metres, dy, 0), dx, 1)[fill]
            covered |= fill
    metres[~covered] = 1
    for _ in range(2):
        height = (height + np.roll(height, 1, 0) + np.roll(height, -1, 0) + np.roll(height, 1, 1) + np.roll(height, -1, 1)) / 5
    # Slope in real units. Rows run against glTF's V, so the Y slope changes sign.
    sx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) / (2 * metres)
    sy = (np.roll(height, 1, 0) - np.roll(height, -1, 0)) / (2 * metres)
    n = np.stack([-sx, -sy, np.ones_like(sx)], axis=2)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return np.round((n * 0.5 + 0.5) * 255).astype(np.uint8)


def write_png(path, image):
    """8-bit grey or RGB PNG. Blender's V runs up and glTF's down, so the rows flip."""
    rows = np.flipud(image)
    raw = b"".join(b"\x00" + rows[i].tobytes() for i in range(rows.shape[0]))
    colour = 2 if image.ndim == 3 else 0

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

    header = struct.pack(">IIBBBBB", image.shape[1], image.shape[0], 8, colour, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def export(out):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        use_selection=True,
        export_texcoords=True,
        export_materials="NONE",
        export_skins=True,
        export_morph=False,
        export_animations=False,
        export_apply=False,
        export_yup=True,
    )


# One clear colour per region for the debug renders; 0 (none) stays skin grey.
PALETTE = np.array([
    (0.75, 0.75, 0.75), (0.9, 0.2, 0.2), (0.2, 0.6, 0.9), (0.9, 0.8, 0.2), (0.9, 0.4, 0.8),
    (0.2, 0.8, 0.4), (0.95, 0.55, 0.1), (0.5, 0.3, 0.9), (0.1, 0.8, 0.8), (0.6, 0.9, 0.2),
    (0.9, 0.3, 0.5), (0.95, 0.1, 0.1), (0.3, 0.3, 0.9), (0.2, 0.9, 0.9), (0.9, 0.6, 0.6), (0.6, 0.4, 0.2),
    (1.0, 0.45, 0.45), (0.55, 0.1, 0.1), (0.1, 0.4, 0.7), (0.4, 0.2, 0.5), (1.0, 1.0, 0.5), (0.4, 0.6, 0.1),
])


def render(mesh, image, render_dir):
    """Debug renders of the painted map, one flat colour per region, from four sides."""
    rgb = PALETTE[image % CLOTH_STEP]
    rgb[image // CLOTH_STEP > 0] *= 0.55  # shorts and shoes darker
    img = bpy.data.images.new("regions", MAP_SIZE, MAP_SIZE)
    img.pixels.foreach_set(np.concatenate([rgb, np.ones((*image.shape, 1))], axis=2).astype(np.float32).ravel())
    mat = bpy.data.materials.new("regions")
    mat.use_nodes = True
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Closest"
    mat.node_tree.links.new(tex.outputs["Color"], mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
    mesh.data.materials.clear()
    mesh.data.materials.append(mat)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.color_type = "TEXTURE"
    scene.display.shading.light = "STUDIO"
    scene.render.resolution_x, scene.render.resolution_y = 900, 1200
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    for name, loc, rot, scale in (
        ("front", (0, -4, 1.0), (90, 0, 0), 1.3),
        ("back", (0, 4, 1.0), (90, 0, 180), 1.3),
        ("side", (4, 0, 1.0), (90, 0, 90), 1.3),
        ("angle", (2.8, 2.8, 1.15), (90, 0, 135), 1.3),
        ("arm", (1.2, -2.0, 1.25), (90, 0, 30), 0.7),
        ("arm_back", (1.2, 2.0, 1.25), (90, 0, 150), 0.7),
    ):
        cam_data.ortho_scale = scale
        cam.location = loc
        cam.rotation_euler = [math.radians(a) for a in rot]
        scene.render.filepath = os.path.join(render_dir, f"{name}.png")
        bpy.ops.render.render(write_still=True)
    mesh.data.materials.clear()


def main():
    out, render_dir = args()
    mesh, rig = make_human()
    muscle, bases, limbs = classify(mesh, rig)
    painted = paint_map(mesh, muscle, bases, limbs)
    write_png(os.path.join(os.path.dirname(out), "muscles.png"), painted)
    write_png(os.path.join(os.path.dirname(out), "relief.png"), carve_relief(mesh, bases, limbs))
    export(out)
    if render_dir:
        render(mesh, painted, render_dir)
    counts = {k: int((painted % CLOTH_STEP == v).sum()) for k, v in MUSCLES.items()}
    print("REGIONS (pixels)", counts)


if __name__ == "__main__":
    main()
