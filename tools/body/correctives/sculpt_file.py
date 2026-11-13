# blender --background --python sculpt_file.py -- <dump dir> <out.blend>
# A file ready to sculpt one corrective by hand (the owner or an artist), from what
# corrective-dump.test.ts wrote:
#   "target": the skin as the app draws it now at that pose; sculpt this one
#   "now":    the same, beside it, locked, to compare against
# Everything away from the shoulders is masked so a stroke can't reach it, sculpting mirrors left
# to right, and the viewport shows the skin's form plainly (matcap). Seam-split points are joined
# so sculpting doesn't tear; places.bin maps them back for export_target.py.
import bpy, sys, json
import numpy as np

a = sys.argv[sys.argv.index("--") + 1:]
D = a[0] + "/"; OUT = a[1]
REACH, FADE = 0.16, 0.04  # metres from a shoulder joint where sculpting is free, and fades to masked

import os
meta = json.load(open(D + "meta.json")); n = meta["n"]
# The skin as drawn, with any corrective already on (shown.bin; older dumps have only final.bin).
now = np.fromfile(D + ("shown.bin" if os.path.exists(D + "shown.bin") else "final.bin"), dtype=np.float32).reshape(-1, 3)
# Which shoulders are raised: both mirror together; one alone (the single-arm pulldown) is the
# only one free, without mirroring, so the lowered side keeps its shape.
up = [s for s, e in (("R", meta["elevation"]), ("L", meta.get("elevationL", meta["elevation"]))) if e > 90] or ["R", "L"]
Rr = np.fromfile(D + "rest.bin", dtype=np.float32).reshape(-1, 3)
T = np.fromfile(D + "index.bin", dtype=np.uint32).reshape(-1, 3)
key = {}; place = np.zeros(n, dtype=np.int64)
for i, p in enumerate(Rr):
    place[i] = key.setdefault((round(float(p[0]), 5), round(float(p[1]), 5), round(float(p[2]), 5)), len(key))
place.astype(np.int32).tofile(D + "places.bin")
m = len(key); rep = np.zeros(m, dtype=np.int64); rep[place] = np.arange(n)
faces = [tuple(int(place[v]) for v in t) for t in T if len({place[v] for v in t}) == 3]
bl = lambda A: [(float(p[0]), float(-p[2]), float(p[1])) for p in A]  # app (y up) -> blender (z up)

bpy.ops.wm.read_factory_settings(use_empty=False)
for o in list(bpy.data.objects): bpy.data.objects.remove(o)

def make(name, pts, dx):
    me = bpy.data.meshes.new(name); me.from_pydata(bl(pts[rep]), [], faces); me.update()
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    ob = bpy.data.objects.new(name, me); ob.location.x = dx
    bpy.context.scene.collection.objects.link(ob)
    return ob

ref = make("now", now, 0.8)
ref.hide_select = True
t = make("target", now, 0.0)
t.data.use_mirror_x = len(up) == 2  # sculpt both shoulders at once

# Masked (1) away from the shoulders, free (0) near them.
p = now[rep]
d = np.min([np.linalg.norm(p - np.array(meta["shoulder" + s]), axis=1) for s in up], axis=0)
mask = np.clip((d - REACH) / FADE, 0, 1).astype(np.float32)
attr = t.data.attributes.new(".sculpt_mask", "FLOAT", "POINT")
attr.data.foreach_set("value", mask)

# Plain form in the viewport: matcap, cavity, a 3/4 view from the front onto the shoulders.
for scr in bpy.data.screens:
    for area in scr.areas:
        if area.type != "VIEW_3D": continue
        for sp in area.spaces:
            if sp.type != "VIEW_3D": continue
            sh = sp.shading
            sh.type = "SOLID"; sh.light = "MATCAP"; sh.show_cavity = True; sh.cavity_type = "BOTH"
            sp.overlay.show_floor = False
            r3 = sp.region_3d
            mid = np.mean([meta["shoulder" + s] for s in up], axis=0)
            r3.view_location = (float(mid[0]), float(-mid[2]), float(mid[1]) - 0.05)
            r3.view_distance = 1.3
            from mathutils import Euler
            r3.view_rotation = Euler((1.3, 0, 0.6)).to_quaternion()

how = bpy.data.texts.new("วิธีปั้น")
side = "ทั้งสองไหล่พร้อมกันได้ (สะท้อนซ้ายขวาเปิดไว้แล้ว: X ที่มุมขวาบนของหน้าต่าง 3D)" if len(up) == 2 else     "เฉพาะไหล่ข้างที่ยกแขน (ปิดสะท้อนซ้ายขวาไว้ เพราะอีกข้างแขนลงอยู่ ในแอปอีกข้างจะได้รูปทรงสะท้อนเองตอนยกแขน)"
how.write(f"""ปั้นรูปทรงแก้ข้อต่อ: ท่านี้ยกแขน {max(meta['elevation'], meta.get('elevationL', 0)):.0f} องศา

1. เลือก object "target" (อยู่กลาง) แล้วเข้า Sculpt Mode (Ctrl+Tab)
   ปั้น{side}
2. ส่วนที่ห่างไหล่เกิน {int(REACH*100)} ซม. ถูก mask ไว้ (สีเข้ม) แปรงไม่โดน
   ถ้าต้องแก้ไกลกว่านั้น: เมนู Mask > Clear Mask
3. "now" (ทางขวา) คือผิวที่แอปวาดตอนนี้ (รวมรูปทรงแก้ที่อนุมัติไว้แล้ว ถ้าท่านี้มี) ไว้เทียบ ล็อกไว้ ไม่ต้องแก้
4. แปรงที่ใช้บ่อย: Grab (G) ดันก้อน, Inflate (I) เพิ่มปริมาตรกล้าม, Smooth (Shift ค้าง) เกลี่ย,
   Clay Strips (C) เติมเนื้อ, Crease ทำร่องรักแร้ ย่อขยายแปรง F, แรง Shift+F
5. ห้ามเพิ่มหรือลบจุด (ห้าม Dyntopo, Remesh, Subdivide, Multires apply) ต้องมีจุดเท่าเดิมทุกจุด
6. เสร็จแล้ว Save (Ctrl+S) แล้วบอก Claude ว่าไฟล์อยู่ไหน
""")
bpy.context.view_layer.objects.active = t; t.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("saved", OUT, "points", m, "free to sculpt", int((mask < 1).sum()))
