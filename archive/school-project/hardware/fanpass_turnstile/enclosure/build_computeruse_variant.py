#!/usr/bin/env python3
"""Build the Computer Use reviewed Blender-native V5 enclosure.

This variant uses Blender primitives and boolean cutters so the EP8280 screw
holes are round. It is kept separate from the dependency-free CLI STL generator
for comparison.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


THIS_DIR = Path(__file__).resolve().parent
OUT = THIS_DIR / "outputs"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def mat(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = color
    return m


def cube(name, loc, scale, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        obj.data.materials.append(material)
    return obj


def cyl(name, loc, radius, depth, material, vertices=64, rotate_y=False):
    rot = (0, math.pi / 2, 0) if rotate_y else (0, 0, 0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    return obj


def boolean_difference(target, cutter):
    mod = target.modifiers.new("cut_" + cutter.name, "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    bpy.context.view_layer.objects.active = target
    target.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    target.select_set(False)
    bpy.data.objects.remove(cutter, do_unlink=True)


def join_objects(name, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = name
    return joined


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def build_front_panel(material):
    panel = cube("front_panel_boolean", (0, 0, 1.5), (180, 145, 3), material)
    cuts = [
        # Keep the front as an optical opening, not a module-sized hole. The
        # EP8280 screw centers are only 58 x 44 mm, so a larger front cutout
        # removes the material needed for the printed fit-check holes.
        ("scanner_optical_window", (-45, 26, 1.5), (50, 36, 7)),
        ("lcd_window", (46, 46, 1.5), (84, 38, 7)),
        ("ultrasonic_slot", (46, -33.5, 1.5), (82, 48, 7)),
        ("service_slot", (-71, -56, 1.5), (30, 18, 7)),
    ]
    for name, loc, size in cuts:
        boolean_difference(panel, cube(name, loc, size, None))

    # EP8280 round screw holes, center-to-center 58 x 44 mm.
    for dx in (-29, 29):
        for dy in (-22, 22):
            boolean_difference(panel, cyl("ep8280_screw_cut", (-45 + dx, 26 + dy, 1.5), 2.15, 7, None, vertices=40))
    return panel


def build_shell(material, collar_material):
    parts = [build_front_panel(material)]
    x0, x1 = -90, 90
    y0, y1 = -72.5, 72.5
    z0, z1 = 3, 82
    wall = 3

    parts.append(cube("left_wall", (x0 + wall / 2, 0, (z0 + z1) / 2), (wall, 145, z1 - z0), material))
    parts.append(cube("top_wall", (0, y1 - wall / 2, (z0 + z1) / 2), (180, wall, z1 - z0), material))
    parts.append(cube("bottom_wall", (0, y0 + wall / 2, (z0 + z1) / 2), (180, wall, z1 - z0), material))

    # Right wall split around a small flush rectangular service notch. This
    # replaces the earlier external protruding servo box and matches the scale
    # of the smaller front service cutout.
    sy0, sy1, sz0, sz1 = -27, 3, 29, 47
    parts.append(cube("right_wall_lower", (x1 - wall / 2, (y0 + sy0) / 2, (z0 + z1) / 2), (wall, sy0 - y0, z1 - z0), material))
    parts.append(cube("right_wall_upper", (x1 - wall / 2, (sy1 + y1) / 2, (z0 + z1) / 2), (wall, y1 - sy1, z1 - z0), material))
    parts.append(cube("right_wall_front", (x1 - wall / 2, (sy0 + sy1) / 2, (z0 + sz0) / 2), (wall, sy1 - sy0, sz0 - z0), material))
    parts.append(cube("right_wall_rear", (x1 - wall / 2, (sy0 + sy1) / 2, (sz1 + z1) / 2), (wall, sy1 - sy0, z1 - sz1), material))

    # EP8280 screw collars, round and centered. Holes remain cut through panel.
    for dx in (-29, 29):
        for dy in (-22, 22):
            ring = cyl("ep8280_round_collar", (-45 + dx, 26 + dy, 3.7), 5.2, 1.4, collar_material, vertices=48)
            boolean_difference(ring, cyl("ep8280_collar_hole", (-45 + dx, 26 + dy, 3.7), 2.15, 3, None, vertices=40))
            parts.append(ring)

    return join_objects("FanPass Shell ComputerUse V5", parts)


def build_lid(material):
    lid = cube("rear_lid_computeruse_v5", (0, 0, 1.5), (174, 139, 3), material)
    lip = [
        cube("lid_lip_bottom", (0, -62, 6), (154, 4, 6), material),
        cube("lid_lip_top", (0, 62, 6), (154, 4, 6), material),
        cube("lid_lip_left", (-77, 0, 6), (4, 124, 6), material),
        cube("lid_lip_right", (77, 0, 6), (4, 124, 6), material),
    ]
    return join_objects("FanPass Rear Lid ComputerUse V5", [lid, *lip])


def export_stl(obj, path):
    old_location = obj.location.copy()
    obj.location = (0, 0, 0)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.wm.stl_export(filepath=str(path), export_selected_objects=True)
    obj.location = old_location
    bpy.context.view_layer.update()


def main():
    clear_scene()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 0.001
    shell_mat = mat("ComputerUse V5 shell graphite", (0.11, 0.13, 0.16, 1))
    accent = mat("ComputerUse V5 cyan collars", (0.04, 0.75, 0.82, 1))
    lid_mat = mat("ComputerUse V5 lid grey", (0.5, 0.52, 0.56, 1))

    shell = build_shell(shell_mat, accent)
    panel = build_front_panel(accent)
    panel.name = "FanPass Front Panel ComputerUse V5"
    panel.location.x = 260
    lid = build_lid(lid_mat)
    lid.location.x = 520

    bpy.ops.object.light_add(type="AREA", location=(230, -240, 300))
    bpy.context.object.data.energy = 900
    bpy.context.object.data.size = 250
    bpy.ops.object.camera_add(location=(260, -720, 330))
    bpy.context.scene.camera = bpy.context.object
    bpy.context.object.data.lens = 32
    look_at(bpy.context.object, (260, -5, 38))

    OUT.mkdir(parents=True, exist_ok=True)
    blend = OUT / "fanpass_turnstile_enclosure_computeruse_v5.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))

    export_stl(shell, OUT / "fanpass_turnstile_shell_computeruse_v5.stl")
    export_stl(panel, OUT / "fanpass_turnstile_front_panel_fitcheck_computeruse_v5.stl")
    export_stl(lid, OUT / "fanpass_turnstile_rear_lid_computeruse_v5.stl")
    print({"blend": str(blend)})


if __name__ == "__main__":
    main()
