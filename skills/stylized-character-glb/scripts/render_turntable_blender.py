"""Five-view GLB QA renderer for Blender 4.x. Blender runtime required.

Usage:
  blender -b -P render_turntable_blender.py -- model.glb out_dir [front_yaw_degrees]

Orientation may differ by generator. Adjust front_yaw after first rendering.
This is an inspection aid, not a film-quality beauty render.
"""
from __future__ import annotations
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

def main():
    if "--" not in sys.argv:
        raise SystemExit("Usage: blender -b -P script.py -- model.glb out_dir [yaw]")
    args = sys.argv[sys.argv.index("--")+1:]
    if len(args) < 2:
        raise SystemExit("Provide model and output directory")
    path = Path(args[0]).expanduser().resolve()
    out = Path(args[1]).expanduser().resolve()
    yaw_start = math.radians(float(args[2])) if len(args)>2 else 0.0
    out.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not objects:
        raise RuntimeError("No meshes loaded")
    bpy.context.view_layer.update()
    vertices = [o.matrix_world @ Vector(v) for o in objects for v in o.bound_box]
    lo = Vector([min(v[i] for v in vertices) for i in range(3)])
    hi = Vector([max(v[i] for v in vertices) for i in range(3)])
    center = (lo+hi)/2
    size = hi-lo
    r = max(1.0, size.length * 1.2)
    camera_data = bpy.data.cameras.new("QA_camera")
    camera = bpy.data.objects.new("QA_camera", camera_data)
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(size.z * 1.25, size.x * 1.6, 1.0)
    def light(name, vector, power):
        ld = bpy.data.lights.new(name, type="AREA")
        ld.energy = power
        ld.shape = "DISK"
        ld.size = r
        obj = bpy.data.objects.new(name, ld)
        bpy.context.collection.objects.link(obj)
        obj.location = center+Vector(vector)
    light("QA_Key", (r,-r,r),1300.0)
    light("QA_Fill",(-r,-r/2,r/2),750.0)
    light("QA_Rim",(0,r,r),900.0)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = True
    if not scene.world:
        scene.world = bpy.data.worlds.new("QA_world")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (.65,.65,.68,1)
        bg.inputs["Strength"].default_value = .5
    for deg in (0,45,90,180,270):
        a = yaw_start + math.radians(deg)
        camera.location = center+Vector((r*math.sin(a),-r*math.cos(a),r*.25))
        camera.rotation_euler = (center-camera.location).to_track_quat("-Z","Y").to_euler()
        scene.render.filepath = str(out/f"view_{deg:03d}.png")
        bpy.ops.render.render(write_still=True)
        print("Rendered", scene.render.filepath)

if __name__ == "__main__":
    main()
