# blender <file.blend> --background --python export_target.py -- <dir> <out.bin>
# Writes the (sculpted) "target" object back as target positions per app vertex.
import bpy, sys
import numpy as np
a = sys.argv[sys.argv.index("--") + 1:]
D = a[0] + "/"
place = np.fromfile(D + "places.bin", dtype=np.int32)
ob = bpy.data.objects["target"]
co = np.array([(v.co.x + ob.location.x * 0, v.co.y, v.co.z) for v in ob.data.vertices])
three = np.stack([co[:, 0], co[:, 2], -co[:, 1]], 1)
three[place].astype(np.float32).tofile(a[1])
print("wrote", a[1], len(place))
