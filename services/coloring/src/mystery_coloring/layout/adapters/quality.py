"""Проверка именно подготовленного листа, его масштаба, площади и настоящих глифов."""

from math import isclose
from xml.etree import ElementTree as ET

from fontTools.pens.boundsPen import BoundsPen
from fontTools.svgLib.path import parse_path
from shapely.affinity import scale as scale_shape

from mystery_coloring.domain import StageError
from mystery_coloring.geometry.adapters.svg import curve_commands
from mystery_coloring.layout.adapters.numbers import SVG
from mystery_coloring.layout.adapters.svg import palette_element, rect_attributes
from mystery_coloring.layout.domain import CSS_DPI, PX_MM, check_physical_scale
from mystery_coloring.numbering.adapters.placement import (
    TEXT_FLATNESS_MM,
    ink_geometry,
    validate_labels,
)
from mystery_coloring.numbering.adapters.svg import SCHEME_INK, path_for
from mystery_coloring.numbering.contours import visible_contour_edges
from mystery_coloring.numbering.curves import place_glyphs
from mystery_coloring.palette import PALETTE_ORDER_VERSION, palette_order, paper_white_policy
from mystery_coloring.subdivision.adapters.shapes import FLATNESS, Shapes, validate_mesh
from mystery_coloring.subdivision.adapters.svg import cell_path
from mystery_coloring.subdivision.curves import cell_area
from mystery_coloring.typography.domain import numbered_colors


def bounds(path):
    pen = BoundsPen(None)
    parse_path(path, pen)
    return pen.bounds


def require(condition, message):
    if not condition:
        raise StageError(f"Проверка печатного листа: {message}")


def check_page(svg, source, result, settings, font, template, artwork, number, numbers):
    geo = source.geometry
    scale = geo.mm_per_unit
    check_physical_scale(artwork, geo.width * scale, geo.height * scale)
    result.validate(source, settings)
    require(
        tuple(geo.palette) == tuple(geo.palette[i] for i in palette_order(geo.palette)),
        "цвета должны идти по семействам и светлоте.",
    )
    require(
        result.font_sha256 == font.sha256 and result.font_name == font.name,
        "изменился шрифт символов.",
    )
    shapes = Shapes()
    validate_mesh(result.mesh, geo.width, geo.height, shapes)
    edges = {edge.id: edge for edge in result.mesh.edges}
    areas = [cell_area(cell, edges, scale) for cell in result.mesh.cells]
    paint_areas = [a for c, a in zip(result.mesh.cells, areas, strict=True) if not c.prefilled]
    require(
        all(a >= settings.min_area_mm2 for a in paint_areas),
        "есть слишком маленькая область для раскрашивания.",
    )
    require(
        all(isclose(a, b, abs_tol=1e-7) for a, b in zip(areas, result.areas_mm2, strict=True)),
        "площади не соответствуют кубическим кривым.",
    )
    polygons = {
        cell.id: scale_shape(shapes.polygon(cell, edges), xfact=scale, yfact=scale, origin=(0, 0))
        for cell in result.mesh.cells
    }
    margin = settings.padding_mm + settings.stroke_mm / 2 + 2 * FLATNESS * scale
    validate_labels(result.labels, polygons, settings, margin + 2 * TEXT_FLATNESS_MM)
    root = ET.fromstring(svg)
    require(
        root.get("width") == f"{template.width_px}px"
        and root.get("height") == f"{template.height_px}px"
        and root.get("viewBox") == f"0 0 {template.width_mm} {template.height_mm}"
        and "transform" not in root.attrib,
        "физический масштаб SVG не равен одному миллиметру.",
    )
    body = root.find(f"{SVG}g[@id='artwork']")
    require(
        body is not None and body.get("transform") == f"translate({artwork.x} {artwork.y})",
        "вёрстка изменила масштаб рисунка.",
    )
    frame = root.find(f"{SVG}rect[@id='artwork-frame']")
    require(
        frame is not None
        and frame.get("stroke") == SCHEME_INK
        and all(frame.get(k) == v for k, v in rect_attributes(template.frame).items()),
        "изменились поля рамки.",
    )
    require(
        artwork.x >= template.frame.x - 1e-6
        and artwork.y >= template.frame.y - 1e-6
        and artwork.right <= template.frame.right + 1e-6
        and artwork.bottom <= template.frame.bottom + 1e-6,
        "рисунок выходит из рамки.",
    )
    visible_edges = visible_contour_edges(result.mesh, geo.palette)
    detail_cells = [c for c in result.mesh.cells if c.prefilled]
    details = body.find(f"{SVG}g[@id='prefilled-details']")
    require(
        details is not None
        and details.get("transform") == f"scale({scale})"
        and len(details) == len(detail_cells),
        "неверное число готовых деталей.",
    )
    for path, cell in zip(details, detail_cells, strict=True):
        color = "#" + "".join(f"{v:02x}" for v in geo.palette[cell.color_index])
        require(
            path.attrib
            == {
                "data-cell-id": str(cell.id),
                "d": cell_path(cell, edges),
                "fill": color,
                "fill-rule": "evenodd",
            },
            "изменились готовые детали.",
        )
    contours = body.find(f"{SVG}g[@id='contours']")
    require(
        contours is not None
        and contours.get("transform") == f"scale({scale})"
        and contours.get("stroke-width") == str(settings.stroke_mm / scale)
        and contours.get("stroke") == SCHEME_INK
        and len(contours) == len(visible_edges),
        "изменился масштаб, толщина или число границ.",
    )
    require(
        list(body).index(details) < list(body).index(contours),
        "заливки не должны перекрывать контуры белых деталей.",
    )
    for path, edge in zip(contours, visible_edges, strict=True):
        require(
            path.attrib == {"data-edge-id": str(edge.id), "d": curve_commands(edge.curves)},
            "кривые листа отличаются от проверенной геометрии.",
        )
    label_group = body.find(f"{SVG}g[@id='labels']")
    require(
        label_group is not None
        and label_group.get("fill") == SCHEME_INK
        and "transform" not in label_group.attrib,
        "отсутствуют символы или изменён их масштаб.",
    )
    paths = list(label_group)
    require(len(paths) == len(result.labels), "число символов не совпадает.")
    for path, label in zip(paths, result.labels, strict=True):
        expected = place_glyphs(
            font.glyphs(label.text), label.center_mm, settings.font_size_pt, label.angle_deg
        )
        require(
            label.rings_mm == expected
            and path.get("d") == path_for(expected)
            and path.get("data-font-size-pt") == str(settings.font_size_pt)
            and path.get("data-symbol") == label.text
            and path.get("data-cell-id") == str(label.cell_id)
            and not ({"fill", "stroke", "style"} & path.attrib.keys())
            and "transform" not in path.attrib,
            "глиф отличается от заданного ArialMT.",
        )
        x0, y0, x1, y1 = bounds(path.get("d"))
        require(
            x0 >= -1e-6
            and y0 >= -1e-6
            and x1 <= artwork.width + 1e-6
            and y1 <= artwork.height + 1e-6,
            "символ выходит за рисунок.",
        )
    layout = template.palette(len(numbered_colors(geo.palette)), number)
    palette = root.find(f"{SVG}g[@id='palette']")
    require(
        palette is not None
        and ET.tostring(palette) == ET.tostring(palette_element(geo.palette, layout, font)),
        "палитра отличается от цветов или символов схемы.",
    )
    for swatch in palette:
        x0, y0, x1, y1 = bounds(swatch.find(SVG + "path").get("d"))
        rect = swatch.find(SVG + "rect")
        x, y = float(rect.get("x")), float(rect.get("y"))
        require(
            x0 > x and y0 > y and x1 < x + layout.side and y1 < y + layout.side,
            "символ палитры не помещается в квадрат.",
        )
    counter = root.find(f"{SVG}g[@id='page-number']")
    require(
        counter is not None and ET.tostring(counter) == ET.tostring(numbers.element(number)),
        "неверный номер страницы.",
    )
    require(
        layout.right < (564.04 - (len(str(number)) - 1) * 12.339) * PX_MM,
        "палитра пересекается с номером страницы.",
    )
    require(
        layout.y > template.frame.bottom + template.frame_stroke_mm / 2
        and layout.y + layout.side < template.height_mm,
        "палитра выходит за отведённую полосу.",
    )
    # Сохраняем запас между чернилами и границей для печатной приёмки.
    clearance = min(
        (
            ink_geometry(label.rings_mm).distance(polygons[label.cell_id].boundary)
            for label in result.labels
        ),
        default=None,
    )
    white_ids = result.paper_white_cell_ids(source)
    one = font.glyphs("1").bounds
    size_px = settings.font_size_pt / 0.75
    return {
        "passed": True,
        "page_number": number,
        "units": "mm",
        "artwork_scale_after_layout": 1,
        "page_size_mm": [template.width_mm, template.height_mm],
        "page_size_px": [template.width_px, template.height_px],
        "css_dpi": CSS_DPI,
        "actual_min_area_mm2": min(paint_areas, default=0),
        "actual_min_detail_area_mm2": min(
            (a for c, a in zip(result.mesh.cells, areas, strict=True) if c.prefilled), default=None
        ),
        "prefilled_regions": len(detail_cells),
        "prefilled_region_ids": [c.id for c in detail_cells],
        "required_min_area_mm2": settings.min_area_mm2,
        "regions": len(result.mesh.cells),
        "labels": len(result.labels),
        "unlabeled_regions": len(set(white_ids) | {c.id for c in detail_cells}),
        "paper_white_regions": len(white_ids),
        "paper_white_region_ids": white_ids,
        "missing_required_labels": 0,
        "paper_white_policy": paper_white_policy(),
        "uniform_font_size_pt": settings.font_size_pt,
        "font_size_css_px": settings.font_size_pt / 0.75,
        "rotated_labels": sum(label.angle_deg != 0 for label in result.labels),
        "label_angles_deg": sorted({label.angle_deg for label in result.labels}),
        "unrotated_one_size_px": [(one[2] - one[0]) * size_px, (one[3] - one[1]) * size_px],
        "scheme_ink": SCHEME_INK,
        "font_name": font.name,
        "font_sha256": font.sha256,
        "min_label_clearance_mm": clearance,
        "palette_colors": len(palette),
        "source_palette_colors": len(geo.palette),
        "palette_order": PALETTE_ORDER_VERSION,
        "palette_symbols": [swatch.get("data-symbol") for swatch in palette],
        "palette_font_size_pt": layout.font_size_pt,
        "swatch_side_mm": layout.side,
        "area_check": "analytic cubic integral",
        "geometry_check": "exact shared cubic paths and physical scale in page SVG",
        "label_check": "exact Arial paths + sampled ink with margin",
    }
