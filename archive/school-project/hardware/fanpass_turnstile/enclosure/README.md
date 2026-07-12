# FanPass Turnstile Enclosure CAD

This folder contains the printable enclosure files for the local Arduino/EP8280 bench turnstile.

Generated STL files live in `outputs/`.

```bash
python3 archive/school-project/hardware/fanpass_turnstile/enclosure/fanpass_turnstile_enclosure.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python archive/school-project/hardware/fanpass_turnstile/enclosure/build_blender_scene.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python archive/school-project/hardware/fanpass_turnstile/enclosure/build_computeruse_variant.py
```

## Files

Preferred current print candidate:

- `outputs/fanpass_turnstile_front_panel_fitcheck_computeruse_v5.stl`: first test print.
- `outputs/fanpass_turnstile_shell_computeruse_v5.stl`: open-back main enclosure with small right-side flush service notch.
- `outputs/fanpass_turnstile_rear_lid_computeruse_v5.stl`: rear lid with inset lip.
- `outputs/fanpass_turnstile_enclosure_computeruse_v5.blend`: Blender scene.
- `outputs/fanpass_turnstile_enclosure_computeruse_v5_preview.png`: rendered preview.
- `outputs/fanpass_turnstile_shell_computeruse_v5_side_notch.png`: right-side notch review render.

Superseded computer-use V4 files:

- `outputs/fanpass_turnstile_front_panel_fitcheck_computeruse_v4.stl`
- `outputs/fanpass_turnstile_shell_computeruse_v4.stl`
- `outputs/fanpass_turnstile_rear_lid_computeruse_v4.stl`
- `outputs/fanpass_turnstile_enclosure_computeruse_v4.blend`
- `outputs/fanpass_turnstile_enclosure_computeruse_v4_preview.png`
- `outputs/fanpass_turnstile_shell_computeruse_v4_side_notch.png`

Superseded computer-use V3 files:

- `outputs/fanpass_turnstile_front_panel_fitcheck_computeruse_v3.stl`
- `outputs/fanpass_turnstile_shell_computeruse_v3.stl`
- `outputs/fanpass_turnstile_rear_lid_computeruse_v3.stl`
- `outputs/fanpass_turnstile_enclosure_computeruse_v3.blend`
- `outputs/fanpass_turnstile_enclosure_computeruse_v3_preview.png`
- `outputs/fanpass_turnstile_front_panel_fitcheck_computeruse_v3_front.png`

Superseded computer-use V2 files:

- `outputs/fanpass_turnstile_front_panel_fitcheck_computeruse_v2.stl`
- `outputs/fanpass_turnstile_shell_computeruse_v2.stl`
- `outputs/fanpass_turnstile_rear_lid_computeruse_v2.stl`
- `outputs/fanpass_turnstile_enclosure_computeruse_v2.blend`
- `outputs/fanpass_turnstile_enclosure_computeruse_v2_preview.png`

Backup CLI V2 files:

- `outputs/fanpass_turnstile_front_panel_fitcheck_cli_v2.stl`
- `outputs/fanpass_turnstile_shell_cli_v2.stl`
- `outputs/fanpass_turnstile_rear_lid_cli_v2.stl`
- `outputs/fanpass_turnstile_enclosure_cli_v2.blend`
- `outputs/fanpass_turnstile_enclosure_cli_v2_preview.png`

V1 files are retained in `outputs/`, but V5 supersedes V1/V2/V3/V4 for printing.

## Print Notes

- Units are millimeters.
- Suggested material: PLA/PETG.
- Suggested nozzle/layer: 0.4 mm nozzle, 0.2 mm layer height.
- Suggested walls: 3 perimeters or more.
- Print `fanpass_turnstile_front_panel_fitcheck_computeruse_v5.stl` first.
- The HC-SR04 opening is one enlarged rectangular slot, not two circles, to absorb module variance.
- EP8280 screw locations are based on the vendor drawing center spacing of 58 mm x 44 mm. V5 keeps the screw holes in printable material around the optical window. Drill to final size after checking against the real module if the printer is tight.
- The right side no longer has a protruding servo box or external screw collars. It has a small flush rectangular service notch in the enclosure wall, about 30 x 18 mm.
- No physical print or fit-test has been completed yet.

This is bench/prototype hardware only and does not close FanPass Ops physical scanner evidence.
