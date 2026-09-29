"""Самодостаточное SVG-превью листа; вёрстка в мм без масштабирования символов."""

from xml.etree import ElementTree as ET

from mystery_coloring.layout.adapters.numbers import SVG
from mystery_coloring.layout.domain import PX_MM, TEMPLATE_ID, check_physical_scale
from mystery_coloring.numbering.adapters.svg import SCHEME_INK, path_for, svg_document
from mystery_coloring.numbering.curves import place_glyphs
from mystery_coloring.typography.domain import numbered_colors

ET.register_namespace("", "http://www.w3.org/2000/svg")


def rect_attributes(rectangle):
    return {key: str(getattr(rectangle, key)) for key in ("x", "y", "width", "height")}


def palette_element(palette, layout, font):
    group = ET.Element(SVG + "g", {"id": "palette", "data-font-name": font.name})
    for index, (rgb, symbol) in enumerate(numbered_colors(palette)):
        color = "#" + "".join(f"{v:02X}" for v in rgb)
        brightness = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
        x = layout.x + index * layout.step
        swatch = ET.SubElement(group, SVG + "g", {"data-symbol": symbol})
        rect = ET.SubElement(
            swatch,
            SVG + "rect",
            {
                "x": str(x),
                "y": str(layout.y),
                "width": str(layout.side),
                "height": str(layout.side),
                "fill": color,
                "data-palette": "color",
            },
        )
        if brightness >= 230:
            rect.set("stroke", "#000102")
            rect.set("stroke-width", str(0.45 * PX_MM))
        glyphs = place_glyphs(
            font.glyphs(symbol),
            (x + layout.side / 2, layout.y + layout.side / 2),
            layout.font_size_pt,
            0,
        )
        ET.SubElement(
            swatch,
            SVG + "path",
            {
                "d": path_for(glyphs),
                "data-palette": "label",
                "data-symbol": symbol,
                "data-font-size-pt": str(layout.font_size_pt),
                "fill": "#000000" if brightness > 127.5 else "#FFFFFF",
            },
        )
    return group


def page_document(
    source, result, settings, font, template, artwork, number, numbers, *, filled=False
):
    geo = source.geometry
    check_physical_scale(artwork, geo.width * geo.mm_per_unit, geo.height * geo.mm_per_unit)
    root = ET.Element(
        SVG + "svg",
        {
            "width": f"{template.width_px}px",
            "height": f"{template.height_px}px",
            "viewBox": f"0 0 {template.width_mm} {template.height_mm}",
            "data-page-number": str(number),
            "data-template": TEMPLATE_ID,
        },
    )
    ET.SubElement(root, SVG + "rect", {"width": "100%", "height": "100%", "fill": "white"})
    # Переиспользуем проверенные кривые и глифы пятого этапа, заменяя только внешний сдвиг.
    previous = ET.fromstring(
        svg_document(
            source,
            result,
            settings,
            font,
            filled=filled,
            labels=not filled,
        )
    )
    body = previous.find(SVG + "g")
    body.set("id", "artwork")
    body.set("transform", artwork.transform)
    body.set("data-rotation-deg", str(artwork.rotation_deg))
    root.append(body)
    ET.SubElement(
        root,
        SVG + "rect",
        {
            "id": "artwork-frame",
            **rect_attributes(template.frame),
            "fill": "none",
            "stroke": SCHEME_INK,
            "stroke-width": str(template.frame_stroke_mm),
        },
    )
    root.append(
        palette_element(
            geo.palette,
            template.palette(len(numbered_colors(geo.palette)), number),
            font,
        )
    )
    root.append(numbers.element(number))
    return ET.tostring(root, encoding="unicode")
