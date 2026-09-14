"""SVG использует одни и те же кубические сегменты для обеих сторон границы."""

from mystery_coloring.geometry.curves import region_rings
from mystery_coloring.geometry.domain import Cubic, SmoothBoundary


def curve_commands(curves: tuple[Cubic, ...], move: bool = True) -> str:
    def point(value):
        return f"{value[0]:.6f},{value[1]:.6f}"

    commands = [f"M{point(curves[0].start)}"] if move else []
    commands.extend(f"C{point(c.first)} {point(c.second)} {point(c.end)}" for c in curves)
    return " ".join(commands)


def svg_document(
    boundaries: tuple[SmoothBoundary, ...],
    width: int,
    height: int,
    colors: tuple[tuple[int, int, int], ...],
    image_width_mm: float = 180,
    filled: bool = False,
    stroke_mm: float = 0.12,
) -> str:
    scale = image_width_mm / width
    body = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{image_width_mm}mm" '
        f'height="{height * scale}mm" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="white"/>',
    ]
    if filled:
        rings = region_rings(tuple(item.source for item in boundaries))
        for region, paths in sorted(rings.items()):
            pieces = []
            for ring in paths:
                start = None
                previous = None
                for index, signed_id in enumerate(ring):
                    curves = boundaries[abs(signed_id) - 1].curves
                    if signed_id < 0:
                        curves = tuple(curve.reversed() for curve in curves[::-1])
                    if previous is not None and previous != curves[0].start:
                        raise ValueError("Границы заливки не соединяются в общем узле.")
                    if start is None:
                        start = curves[0].start
                    pieces.append(curve_commands(curves, move=index == 0))
                    previous = curves[-1].end
                if previous != start:
                    raise ValueError("Кольцо заливки не замкнуто.")
                pieces.append("Z")
            color = "#" + "".join(f"{channel:02x}" for channel in colors[region])
            body.append(f'<path d="{" ".join(pieces)}" fill="{color}" fill-rule="evenodd"/>')
    if stroke_mm > 0:
        body.append(
            f'<g fill="none" stroke="#666666" stroke-width="{stroke_mm / scale}" '
            'stroke-linejoin="round" stroke-linecap="round">'
        )
        for boundary in boundaries:
            body.append(f'<path d="{curve_commands(boundary.curves)}"/>')
        body.append("</g>")
    body.append("</svg>")
    return "\n".join(body)
