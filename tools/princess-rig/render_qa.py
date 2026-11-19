"""Render real, CPU-skinned QA poses with Blender, without changing assets.

node tools/princess-rig/verify-and-pose.mjs /tmp/luma-rig-qa
blender -b -t 4 --python tools/princess-rig/render_qa.py -- /tmp/luma-rig-qa
"""
from pathlib import Path
import math
import sys
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
QA = Path(sys.argv[sys.argv.index('--') + 1])
CASES = [
    ('original-face', ROOT / 'public/princess/luma-princess-hug-v76.glb', 0, 'face'),
    ('open', QA / 'open.glb', 0, 'face'),
    ('half', QA / 'half.glb', 0, 'face'),
    ('closed', QA / 'closed.glb', 0, 'face'),
    ('open-side', QA / 'open.glb', 35, 'face'),
    ('closed-side', QA / 'closed.glb', 35, 'face'),
    ('original-arms', ROOT / 'public/princess/luma-princess-hug-v76.glb', 0, 'arms'),
    ('neutral-arms', QA / 'open.glb', 0, 'arms'),
    ('pet-arms', QA / 'pet.glb', 0, 'arms'),
]
for name, source, angle, framing in CASES:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    scene = bpy.context.scene
    world = bpy.data.worlds.new('QA studio')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (.17, .17, .19, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = .7
    for location, power, size in [((-.65, -1.2, .9), 23, .8), ((.7, -.6, .5), 9, .8), ((.2, .5, .9), 14, .6)]:
        bpy.ops.object.light_add(type='AREA', location=location)
        light = bpy.context.object
        light.data.energy = power
        light.data.shape = 'DISK'
        light.data.size = size
        light.rotation_euler = (Vector((0, 0, .1)) - light.location).to_track_quat('-Z', 'Y').to_euler()
    height, scale = (.373, .135) if framing == 'face' else (.11, .43)
    radians = math.radians(angle)
    bpy.ops.object.camera_add(location=(2 * math.sin(radians), -2 * math.cos(radians), height))
    camera = bpy.context.object
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = scale
    camera.rotation_euler = (Vector((0, 0, height)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = camera
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 12
    scene.cycles.use_denoising = False
    scene.render.resolution_x = scene.render.resolution_y = 650
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'Standard'
    scene.render.filepath = str(QA / f'{name}.png')
    bpy.ops.render.render(write_still=True)
