#!/usr/bin/env python3
"""Generate STL files for the FanPass Arduino/EP8280 bench enclosure.

Units are millimeters. This is intentionally dependency-free so it can run on
the local workstation without OpenSCAD/Blender installed.
"""

from __future__ import annotations

import math
import struct
from pathlib import Path


OUTER_W = 180.0
OUTER_H = 145.0
DEPTH = 80.0
WALL = 3.0
LID_THICKNESS = 3.0
LID_LIP = 6.0

FRONT_Z0 = 0.0
FRONT_Z1 = WALL
BACK_Z = DEPTH

SCANNER_CENTER = (-45.0, 26.0)
SCANNER_WINDOW_W = 70.0
SCANNER_WINDOW_H = 70.0
SCANNER_HOLE_SPACING_X = 58.0
SCANNER_HOLE_SPACING_Y = 44.0
SCANNER_SCREW_CLEARANCE = 4.2

LCD_WINDOW = (6.0, 86.0, 28.0, 64.0)
ULTRASONIC_SLOT = (8.0, 84.0, -55.0, -12.0)

SERVO_SIDE_OPENING = (-52.0, 28.0, 18.0, 70.0)  # y0, y1, z0, z1


def vsub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def vcross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def vnorm(a):
    length = math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2])
    if length == 0:
        return (0.0, 0.0, 0.0)
    return (a[0] / length, a[1] / length, a[2] / length)


class Mesh:
    def __init__(self):
        self.tris = []

    def tri(self, a, b, c):
        n = vnorm(vcross(vsub(b, a), vsub(c, a)))
        self.tris.append((n, a, b, c))

    def quad(self, a, b, c, d):
        self.tri(a, b, c)
        self.tri(a, c, d)

    def add_box(self, xmin, xmax, ymin, ymax, zmin, zmax):
        if xmax <= xmin or ymax <= ymin or zmax <= zmin:
            return
        p000 = (xmin, ymin, zmin)
        p001 = (xmin, ymin, zmax)
        p010 = (xmin, ymax, zmin)
        p011 = (xmin, ymax, zmax)
        p100 = (xmax, ymin, zmin)
        p101 = (xmax, ymin, zmax)
        p110 = (xmax, ymax, zmin)
        p111 = (xmax, ymax, zmax)
        self.quad(p000, p100, p110, p010)  # bottom
        self.quad(p001, p011, p111, p101)  # top
        self.quad(p000, p001, p101, p100)  # front edge
        self.quad(p010, p110, p111, p011)  # back edge
        self.quad(p000, p010, p011, p001)  # left
        self.quad(p100, p101, p111, p110)  # right

    def add_annular_cylinder(self, cx, cy, zmin, zmax, outer_r, inner_r, segments=64):
        for i in range(segments):
            a0 = 2 * math.pi * i / segments
            a1 = 2 * math.pi * (i + 1) / segments
            o0b = (cx + outer_r * math.cos(a0), cy + outer_r * math.sin(a0), zmin)
            o1b = (cx + outer_r * math.cos(a1), cy + outer_r * math.sin(a1), zmin)
            o0t = (o0b[0], o0b[1], zmax)
            o1t = (o1b[0], o1b[1], zmax)
            i0b = (cx + inner_r * math.cos(a0), cy + inner_r * math.sin(a0), zmin)
            i1b = (cx + inner_r * math.cos(a1), cy + inner_r * math.sin(a1), zmin)
            i0t = (i0b[0], i0b[1], zmax)
            i1t = (i1b[0], i1b[1], zmax)
            self.quad(o0b, o1b, o1t, o0t)  # outer wall
            self.quad(i1b, i0b, i0t, i1t)  # inner wall
            self.quad(o0t, o1t, i1t, i0t)  # top ring face
            self.quad(o1b, o0b, i0b, i1b)  # bottom ring face

    def add_annular_cylinder_x(self, xmin, xmax, cy, cz, outer_r, inner_r, segments=48):
        for i in range(segments):
            a0 = 2 * math.pi * i / segments
            a1 = 2 * math.pi * (i + 1) / segments
            o0l = (xmin, cy + outer_r * math.cos(a0), cz + outer_r * math.sin(a0))
            o1l = (xmin, cy + outer_r * math.cos(a1), cz + outer_r * math.sin(a1))
            o0r = (xmax, o0l[1], o0l[2])
            o1r = (xmax, o1l[1], o1l[2])
            i0l = (xmin, cy + inner_r * math.cos(a0), cz + inner_r * math.sin(a0))
            i1l = (xmin, cy + inner_r * math.cos(a1), cz + inner_r * math.sin(a1))
            i0r = (xmax, i0l[1], i0l[2])
            i1r = (xmax, i1l[1], i1l[2])
            self.quad(o0l, o0r, o1r, o1l)
            self.quad(i1l, i1r, i0r, i0l)
            self.quad(o0r, i0r, i1r, o1r)
            self.quad(o1l, i1l, i0l, o0l)

    def write_binary_stl(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        header = b"FanPass turnstile enclosure".ljust(80, b"\0")
        with path.open("wb") as f:
            f.write(header)
            f.write(struct.pack("<I", len(self.tris)))
            for normal, a, b, c in self.tris:
                f.write(struct.pack("<12fH", *(normal + a + b + c), 0))


def inside_rect(x, y, rect):
    xmin, xmax, ymin, ymax = rect
    return xmin <= x <= xmax and ymin <= y <= ymax


def add_front_panel(mesh: Mesh):
    """Front panel with exact rectangular openings and printable round bezels."""

    sx, sy = SCANNER_CENTER
    scanner_window = (
        sx - SCANNER_WINDOW_W / 2,
        sx + SCANNER_WINDOW_W / 2,
        sy - SCANNER_WINDOW_H / 2,
        sy + SCANNER_WINDOW_H / 2,
    )

    screw_hole_rects = []
    for hx in (-SCANNER_HOLE_SPACING_X / 2, SCANNER_HOLE_SPACING_X / 2):
        for hy in (-SCANNER_HOLE_SPACING_Y / 2, SCANNER_HOLE_SPACING_Y / 2):
            cx = sx + hx
            cy = sy + hy
            r = SCANNER_SCREW_CLEARANCE / 2
            screw_hole_rects.append((cx - r, cx + r, cy - r, cy + r))

    # Large rectangular openings. The ultrasonic sensor is deliberately one
    # oversized rectangle now; no twin round holes, because module tolerances
    # vary and the user asked for more fit margin.
    openings = [
        scanner_window,                  # EP8280 clear scan window / bezel void
        LCD_WINDOW,                      # LCD display window
        ULTRASONIC_SLOT,                 # HC-SR04 single loose service slot
        (-84.0, -58.0, -64.0, -48.0),    # optional lower-left cable/reset service
        *screw_hole_rects,               # precise EP8280 screw clearance holes
    ]

    xs = [-OUTER_W / 2, OUTER_W / 2]
    ys = [-OUTER_H / 2, OUTER_H / 2]
    for xmin, xmax, ymin, ymax in openings:
        xs += [xmin, xmax]
        ys += [ymin, ymax]
    xs = sorted(set(xs))
    ys = sorted(set(ys))

    for xa, xb in zip(xs, xs[1:]):
        for ya, yb in zip(ys, ys[1:]):
            cx = (xa + xb) / 2
            cy = (ya + yb) / 2
            if any(inside_rect(cx, cy, r) for r in openings):
                continue
            mesh.add_box(xa, xb, ya, yb, FRONT_Z0, FRONT_Z1)

    # Raised EP8280 screw collars. The hole centers are tied to the 58 x 44 mm
    # drawing dimensions and the through clearances are cut above as squares
    # for slicer-safe fit. Drill to final round size after printing if needed.
    for hx in (-SCANNER_HOLE_SPACING_X / 2, SCANNER_HOLE_SPACING_X / 2):
        for hy in (-SCANNER_HOLE_SPACING_Y / 2, SCANNER_HOLE_SPACING_Y / 2):
            mesh.add_annular_cylinder(
                sx + hx,
                sy + hy,
                FRONT_Z1,
                FRONT_Z1 + 1.4,
                4.8,
                SCANNER_SCREW_CLEARANCE / 2,
                segments=40,
            )


def add_shell_walls(mesh: Mesh):
    x0 = -OUTER_W / 2
    x1 = OUTER_W / 2
    y0 = -OUTER_H / 2
    y1 = OUTER_H / 2

    # Left, top, and bottom walls. Back remains open for the separate lid.
    mesh.add_box(x0, x0 + WALL, y0, y1, FRONT_Z1, BACK_Z)
    mesh.add_box(x0, x1, y1 - WALL, y1, FRONT_Z1, BACK_Z)
    mesh.add_box(x0, x1, y0, y0 + WALL, FRONT_Z1, BACK_Z)

    # Right wall with a visible servo service opening.
    sy0, sy1, sz0, sz1 = SERVO_SIDE_OPENING
    mesh.add_box(x1 - WALL, x1, y0, sy0, FRONT_Z1, BACK_Z)
    mesh.add_box(x1 - WALL, x1, sy1, y1, FRONT_Z1, BACK_Z)
    mesh.add_box(x1 - WALL, x1, sy0, sy1, FRONT_Z1, sz0)
    mesh.add_box(x1 - WALL, x1, sy0, sy1, sz1, BACK_Z)

    # Rear screw tabs / lips for a removable lid.
    tab_z0 = BACK_Z - LID_LIP
    mesh.add_box(x0 + WALL, x1 - WALL, y0 + WALL, y0 + WALL + 5, tab_z0, BACK_Z)
    mesh.add_box(x0 + WALL, x1 - WALL, y1 - WALL - 5, y1 - WALL, tab_z0, BACK_Z)
    mesh.add_box(x0 + WALL, x0 + WALL + 5, y0 + WALL, y1 - WALL, tab_z0, BACK_Z)
    mesh.add_box(x1 - WALL - 5, x1 - WALL, y0 + WALL, y1 - WALL, tab_z0, BACK_Z)

    # Internal rails for Arduino / wiring tray. These are intentionally broad so
    # the user can drill exact board holes after choosing orientation.
    mesh.add_box(-84, -8, -66, -62, FRONT_Z1, FRONT_Z1 + 8)
    mesh.add_box(-84, -8, -24, -20, FRONT_Z1, FRONT_Z1 + 8)
    mesh.add_box(-84, -80, -66, -20, FRONT_Z1, FRONT_Z1 + 8)
    mesh.add_box(-12, -8, -66, -20, FRONT_Z1, FRONT_Z1 + 8)

    # Right-side external servo bracket. The horn/arm stays outside the case.
    bracket_x0 = OUTER_W / 2
    bracket_x1 = OUTER_W / 2 + 34
    mesh.add_box(bracket_x0, bracket_x1, sy0 - 5, sy0, sz0, sz1)
    mesh.add_box(bracket_x0, bracket_x1, sy1, sy1 + 5, sz0, sz1)
    mesh.add_box(bracket_x0, bracket_x1, sy0 - 5, sy1 + 5, sz0, sz0 + 5)
    mesh.add_box(bracket_x0, bracket_x1, sy0 - 5, sy1 + 5, sz1 - 5, sz1)
    mesh.add_box(bracket_x1 - 4, bracket_x1, sy0 - 5, sy1 + 5, sz0, sz1)

    # Servo mounting pilot collars on the outside plate. These are marked for
    # SG90-class fit, not final production data; confirm the exact servo model.
    for cy in (-38, 14):
        for cz in (28, 60):
            mesh.add_annular_cylinder_x(bracket_x1, bracket_x1 + 1.4, cy, cz, 3.6, 1.3, segments=32)


def build_shell() -> Mesh:
    mesh = Mesh()
    add_front_panel(mesh)
    add_shell_walls(mesh)
    return mesh


def build_front_panel() -> Mesh:
    mesh = Mesh()
    add_front_panel(mesh)
    return mesh


def build_lid() -> Mesh:
    mesh = Mesh()
    x0 = -OUTER_W / 2 + WALL + 1.0
    x1 = OUTER_W / 2 - WALL - 1.0
    y0 = -OUTER_H / 2 + WALL + 1.0
    y1 = OUTER_H / 2 - WALL - 1.0
    mesh.add_box(x0, x1, y0, y1, 0, LID_THICKNESS)

    # Inset lip that fits inside the shell's rear opening.
    lip_x0 = x0 + 6
    lip_x1 = x1 - 6
    lip_y0 = y0 + 6
    lip_y1 = y1 - 6
    mesh.add_box(lip_x0, lip_x1, lip_y0, lip_y0 + 4, LID_THICKNESS, LID_THICKNESS + 5)
    mesh.add_box(lip_x0, lip_x1, lip_y1 - 4, lip_y1, LID_THICKNESS, LID_THICKNESS + 5)
    mesh.add_box(lip_x0, lip_x0 + 4, lip_y0, lip_y1, LID_THICKNESS, LID_THICKNESS + 5)
    mesh.add_box(lip_x1 - 4, lip_x1, lip_y0, lip_y1, LID_THICKNESS, LID_THICKNESS + 5)
    return mesh


def main():
    out = Path(__file__).resolve().parent / "outputs"
    models = {
        "fanpass_turnstile_shell_cli_v2.stl": build_shell(),
        "fanpass_turnstile_front_panel_fitcheck_cli_v2.stl": build_front_panel(),
        "fanpass_turnstile_rear_lid_cli_v2.stl": build_lid(),
    }
    for name, mesh in models.items():
        path = out / name
        mesh.write_binary_stl(path)
        print(f"{path} triangles={len(mesh.tris)}")


if __name__ == "__main__":
    main()
