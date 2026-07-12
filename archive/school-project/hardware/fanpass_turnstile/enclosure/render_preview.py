#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

import bpy


THIS_DIR = Path(__file__).resolve().parent
out_dir = THIS_DIR / "outputs"

bpy.context.scene.render.engine = "BLENDER_WORKBENCH"
bpy.context.scene.render.resolution_x = 1400
bpy.context.scene.render.resolution_y = 900
bpy.context.scene.view_settings.view_transform = "Filmic"
bpy.context.scene.view_settings.look = "Medium High Contrast"
bpy.context.scene.world.color = (0.78, 0.80, 0.84)

preview_path = out_dir / "fanpass_turnstile_enclosure_cli_v2_preview.png"
bpy.context.scene.render.filepath = str(preview_path)
bpy.ops.render.render(write_still=True)
print({"preview": str(preview_path)})
