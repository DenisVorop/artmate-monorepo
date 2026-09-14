"""Цветные заливки исходных областей и новые общие контуры, без швов внутри цвета."""

from mystery_coloring.geometry.adapters.svg import curve_commands
from mystery_coloring.subdivision.curves import ring_curves


def cell_path(cell, edges):
    pieces = []
    for ring in cell.rings:
        curves = ring_curves(ring, edges)
        if curves[-1].end != curves[0].start or any(
            a.end != b.start for a, b in zip(curves, curves[1:], strict=False)
        ):
            raise ValueError("Разомкнутая заливка области.")
        pieces.append(curve_commands(curves) + " Z")
    return " ".join(pieces)


def document(source, result, settings, *, filled=False, outlines=True, diagnostics=False):
    scale = source.mm_per_unit
    body = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{source.width * scale}mm" '
        f'height="{source.height * scale}mm" viewBox="0 0 {source.width} {source.height}">',
        '<rect width="100%" height="100%" fill="white"/>',
    ]
    if filled:
        # Родительские заливки исключают артефакты антиалиасинга между частями одного цвета.
        edges = {e.id: e for e in source.mesh.edges}
        for cell in source.mesh.cells:
            color = "#" + "".join(f"{c:02x}" for c in source.palette[cell.color_index])
            body.append(f'<path d="{cell_path(cell, edges)}" fill="{color}" fill-rule="evenodd"/>')
    if outlines:
        body.append(
            f'<g fill="none" stroke="#666666" stroke-width="{settings.stroke_mm / scale}" '
            'stroke-linecap="round" stroke-linejoin="round">'
        )
        for edge in result.mesh.edges:
            body.append(f'<path d="{curve_commands(edge.curves)}"/>')
        body.append("</g>")
    if diagnostics:
        edges = {e.id: e for e in result.mesh.edges}
        cells = {c.id: c for c in result.mesh.cells}
        for space in result.label_spaces:
            if not space.required:
                continue
            if space.center is None:
                body.append(
                    f'<path d="{cell_path(cells[space.cell_id], edges)}" '
                    'fill="#e34747" fill-opacity="0.5" fill-rule="evenodd"/>'
                )
                continue
            x, y = space.center
            padding = settings.label_padding_mm + settings.stroke_mm / 2
            w, h = (space.width_mm + 2 * padding) / scale, (space.height_mm + 2 * padding) / scale
            body.append(
                f'<rect x="{x - w / 2}" y="{y - h / 2}" width="{w}" height="{h}" '
                f'transform="rotate({space.angle} {x} {y})" fill="#229c68" fill-opacity="0.35"/>'
            )
    body.append("</svg>")
    return "\n".join(body)
