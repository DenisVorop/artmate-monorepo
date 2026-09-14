"""Все обозначения и легенда — самодостаточные векторные контуры, единицы SVG в мм."""

from collections import defaultdict
from math import ceil

from mystery_coloring.geometry.adapters.svg import curve_commands
from mystery_coloring.numbering.contours import visible_contour_edges
from mystery_coloring.numbering.curves import place_glyphs
from mystery_coloring.subdivision.adapters.svg import cell_path
from mystery_coloring.typography.domain import numbered_colors

MARGIN_MM = 4
LEGEND_GAP_MM = 6
SCHEME_INK = "#898989"


def path_for(rings):
    return " ".join(curve_commands(ring) + " Z" for ring in rings)


def legend_dimensions(source, settings):
    slot = max(5, settings.font_size_pt * 25.4 / 72 + 1)
    cell_min = max(28, slot + 21)
    width = max(cell_min, source.geometry.width * source.geometry.mm_per_unit)
    columns = max(1, min(6, int(width / cell_min)))
    row_height = max(8, settings.font_size_pt * 25.4 / 72 + 2)
    return (
        width,
        ceil(len(numbered_colors(source.geometry.palette)) / columns) * row_height,
        columns,
    )


def legend_body(source, settings, font):
    width, _, columns = legend_dimensions(source, settings)
    cell_width = width / columns
    slot = max(5, settings.font_size_pt * 25.4 / 72 + 1)
    row_height = max(8, settings.font_size_pt * 25.4 / 72 + 2)
    pieces = ['<g id="legend">']
    for index, (rgb, symbol) in enumerate(numbered_colors(source.geometry.palette)):
        column, row = index % columns, index // columns
        x, y = column * cell_width, row * row_height
        color = "#" + "".join(f"{v:02X}" for v in rgb)
        pieces.append(
            f'<rect x="{x + slot}" y="{y + 1}" width="8" height="5.5" rx="0.6" fill="{color}" '
            'stroke="#999" stroke-width="0.1"/>'
        )
        rings = place_glyphs(
            font.glyphs(symbol), (x + slot / 2, y + row_height / 2), settings.font_size_pt, 0
        )
        pieces.append(
            f'<path data-symbol="{symbol}" data-font-size-pt="{settings.font_size_pt}" '
            f'd="{path_for(rings)}" fill="{SCHEME_INK}"/>'
        )
        hex_rings = place_glyphs(font.glyphs(color), (x + slot + 16, y + row_height / 2), 5, 0)
        pieces.append(f'<path d="{path_for(hex_rings)}" fill="#444"/>')
    pieces.append("</g>")
    return "\n".join(pieces)


def svg_document(
    source,
    result,
    settings,
    font,
    *,
    filled=False,
    labels=False,
    legend=False,
    outlines=True,
    diagnostics=False,
    legend_only=False,
):
    geometry = source.geometry
    scale = geometry.mm_per_unit
    art_width, art_height = geometry.width * scale, geometry.height * scale
    legend_width, legend_height, _ = legend_dimensions(source, settings)
    width = max(art_width, legend_width) + 2 * MARGIN_MM
    height = (
        legend_height
        if legend_only
        else art_height + (LEGEND_GAP_MM + legend_height if legend else 0)
    ) + 2 * MARGIN_MM
    body = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}mm" height="{height}mm" '
        f'viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="white"/>',
        f'<g transform="translate({MARGIN_MM} {MARGIN_MM})">',
    ]
    if not legend_only:
        edges = {e.id: e for e in result.mesh.edges}
        if filled:
            paths = defaultdict(list)
            for cell in result.mesh.cells:
                paths[cell.color_index].append(cell_path(cell, edges))
            body.append(f'<g id="colors" transform="scale({scale})">')
            for index, pieces in sorted(paths.items()):
                color = "#" + "".join(f"{v:02x}" for v in geometry.palette[index])
                body.append(f'<path d="{" ".join(pieces)}" fill="{color}" fill-rule="evenodd"/>')
            body.append("</g>")
        body.append(f'<g id="prefilled-details" transform="scale({scale})">')
        for cell in result.mesh.cells:
            if cell.prefilled:
                color = "#" + "".join(f"{v:02x}" for v in geometry.palette[cell.color_index])
                body.append(
                    f'<path data-cell-id="{cell.id}" d="{cell_path(cell, edges)}" '
                    f'fill="{color}" fill-rule="evenodd"/>'
                )
        body.append("</g>")
        if outlines:
            body.append(
                f'<g id="contours" transform="scale({scale})" fill="none" stroke="{SCHEME_INK}" '
                f'stroke-width="{settings.stroke_mm / scale}" '
                'stroke-linejoin="round" stroke-linecap="round">'
            )
            for edge in visible_contour_edges(result.mesh, geometry.palette):
                body.append(f'<path data-edge-id="{edge.id}" d="{curve_commands(edge.curves)}"/>')
            body.append("</g>")
        if diagnostics:
            original_edges = {e.id: e for e in geometry.mesh.edges}
            changed = set()
            final_colors = {c.id: c.color_index for c in result.mesh.cells}
            before = {c.id: c for c in geometry.mesh.cells}
            for cell, ids in zip(result.mesh.cells, result.source_cell_ids, strict=True):
                changed.update(i for i in ids if before[i].color_index != final_colors[cell.id])
            body.append(
                f'<g id="changed-areas" transform="scale({scale})" '
                'fill="#ed7925" fill-opacity="0.55">'
            )
            for i in sorted(changed):
                body.append(
                    f'<path d="{cell_path(before[i], original_edges)}" fill-rule="evenodd"/>'
                )
            body.append("</g>")
        if labels:
            body.append(f'<g id="labels" fill="{SCHEME_INK}" fill-rule="evenodd">')
            for label in result.labels:
                body.append(
                    f'<path data-cell-id="{label.cell_id}" data-symbol="{label.text}" '
                    f'data-font-size-pt="{label.font_size_pt}" d="{path_for(label.rings_mm)}"/>'
                )
            body.append("</g>")
    if legend or legend_only:
        y = 0 if legend_only else art_height + LEGEND_GAP_MM
        body.append(f'<g transform="translate(0 {y})">{legend_body(source, settings, font)}</g>')
    body.extend(("</g>", "</svg>"))
    return "\n".join(body)
