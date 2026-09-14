"""Размещение одних и тех же кубических контуров для проверки и SVG."""

from math import cos, radians, sin

from mystery_coloring.geometry.domain import Cubic
from mystery_coloring.numbering.domain import GlyphRun


def place_glyphs(glyphs: GlyphRun, center, size_pt: float, angle: float):
    x0, y0, x1, y1 = glyphs.bounds
    scale = size_pt * 25.4 / 72
    c, s = cos(radians(angle)), sin(radians(angle))

    def point(p):
        x, y = (p[0] - (x0 + x1) / 2) * scale, (p[1] - (y0 + y1) / 2) * scale
        return round(center[0] + c * x - s * y, 6), round(center[1] + s * x + c * y, 6)

    return tuple(
        tuple(Cubic(*(point(p) for p in (g.start, g.first, g.second, g.end))) for g in ring)
        for ring in glyphs.rings
    )
