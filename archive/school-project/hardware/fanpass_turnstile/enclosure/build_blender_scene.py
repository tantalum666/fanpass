#!/usr/bin/env python3
"""Build a Blender scene for the FanPass turnstile enclosure.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python build_blender_scene.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import bpy
from mathutils import Vector


THIS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(THIS_DIR))

import fanpass_turnstile_enclosure as cad  # noqa: E402


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in list(bpy.data.meshes):
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials):
        if block.users == 0:
            bpy.data.materials.remove(block)


def make_material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    return mat


def object_from_cad_mesh(name, source_mesh, offset_x, material):
    vertices = []
    faces = []
    for _, a, b, c in source_mesh.tris:
        base = len(vertices)
        vertices.extend(
            [
                (a[0] + offset_x, a[1], a[2]),
                (b[0] + offset_x, b[1], b[2]),
                (c[0] + offset_x, c[1], c[2]),
            ]
        )
        faces.append((base, base + 1, base + 2))

    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def add_dimension_marker(name, location, text):
    font_curve = bpy.data.curves.new(name, type="FONT")
    font_curve.body = text
    font_curve.size = 6
    font_curve.align_x = "CENTER"
    obj = bpy.data.objects.new(name, font_curve)
    obj.location = location
    bpy.context.collection.objects.link(obj)
    return obj


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def main():
    clear_scene()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 0.001

    shell_mat = make_material("Prototype dark shell", (0.12, 0.14, 0.18, 1.0))
    panel_mat = make_material("Fit-check cyan panel", (0.05, 0.75, 0.85, 1.0))
    lid_mat = make_material("Rear lid grey", (0.45, 0.48, 0.52, 1.0))

    shell = object_from_cad_mesh("FanPass Turnstile Shell CLI V2", cad.build_shell(), 0, shell_mat)
    panel = object_from_cad_mesh("FanPass Front Panel Fit Check CLI V2", cad.build_front_panel(), 250, panel_mat)
    lid = object_from_cad_mesh("FanPass Rear Lid CLI V2", cad.build_lid(), 500, lid_mat)

    for obj in [shell, panel, lid]:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
        obj.select_set(False)

    add_dimension_marker("ShellLabel", (0, -100, 20), "CLI V2 shell 180 x 145 x 80 mm + servo side bracket")
    add_dimension_marker("PanelLabel", (250, -100, 8), "CLI V2 front fit-check")
    add_dimension_marker("LidLabel", (500, -100, 8), "Rear lid")

    bpy.ops.object.light_add(type="AREA", location=(240, -260, 320))
    bpy.context.object.name = "Softbox"
    bpy.context.object.data.energy = 850
    bpy.context.object.data.size = 240

    bpy.ops.object.camera_add(location=(250, -700, 330))
    bpy.context.scene.camera = bpy.context.object
    bpy.context.object.data.lens = 34
    look_at(bpy.context.object, (250, -5, 38))

    out_dir = THIS_DIR / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)
    blend_path = out_dir / "fanpass_turnstile_enclosure_cli_v2.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    result = {
        "blend": str(blend_path),
        "objects": [shell.name, panel.name, lid.name],
    }
    print(result)


if __name__ == "__main__":
    main()
