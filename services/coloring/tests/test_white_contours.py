"""Paper-white highlights have printable boundaries without extra cuts or labels."""

from dataclasses import replace
from xml.etree import ElementTree as ET

import numpy as np
import pytest
from test_numbering import run, source_for

from mystery_coloring.domain import StageError
from mystery_coloring.layout.adapters.numbers import SVG, ReferenceNumbers
from mystery_coloring.layout.adapters.quality import check_page
from mystery_coloring.layout.adapters.svg import page_document
from mystery_coloring.layout.domain import ArtMateTemplate
from mystery_coloring.numbering.adapters.svg import svg_document
from mystery_coloring.subdivision.adapters.processor import CurvedSubdivisionProcessor
from mystery_coloring.subdivision.domain import SubdivisionSettings
from mystery_coloring.typography.adapters.font import ArialFont


def highlight_source(rgb, *, protected_surround=False, scale=1):
    pixels = np.zeros((20, 20), np.uint8)
    pixels[8:12, 8:12] = 1
    source = source_for(pixels, scale=scale, palette=((40, 50, 60), rgb))
    geo = source.geometry
    cells = tuple(
        replace(c, prefilled=c.color_index == 1 or protected_surround) for c in geo.mesh.cells
    )
    return replace(source, geometry=replace(geo, mesh=replace(geo.mesh, cells=cells)))


@pytest.mark.parametrize("rgb", [(255, 255, 255), (250, 251, 250)])
@pytest.mark.parametrize("protected_surround", [False, True])
@pytest.mark.parametrize("filled", [False, True])
def test_white_highlight_has_all_its_original_edges(rgb, protected_surround, filled):
    source = highlight_source(rgb, protected_surround=protected_surround)
    source, settings, font, result = run(source)
    highlight = next(c for c in result.mesh.cells if c.color_index == 1)
    original = {abs(ref) for ring in highlight.rings for ref in ring}
    root = ET.fromstring(svg_document(source, result, settings, font, filled=filled, labels=True))
    contours = root.find(f".//{SVG}g[@id='contours']")
    drawn = {int(p.get("data-edge-id")) for p in contours}
    assert original <= drawn
    assert highlight.id not in {label.cell_id for label in result.labels}
    assert result.mesh == source.geometry.mesh
    body = root.find(SVG + "g")
    details = body.find(f"{SVG}g[@id='prefilled-details']")
    assert list(body).index(details) < list(body).index(contours)


def test_dark_prefilled_stroke_keeps_its_outline_suppressed():
    source, settings, font, result = run(highlight_source((10, 10, 10)))
    detail = next(c for c in result.mesh.cells if c.prefilled)
    detail_edges = {abs(ref) for ring in detail.rings for ref in ring}
    root = ET.fromstring(svg_document(source, result, settings, font, labels=True))
    drawn = {int(p.get("data-edge-id")) for p in root.find(f".//{SVG}g[@id='contours']")}
    assert detail_edges.isdisjoint(drawn)


def test_white_highlight_remains_unsplit_with_no_symbol():
    source = highlight_source((255, 255, 255))
    before = next(c for c in source.geometry.mesh.cells if c.color_index == 1)
    result = CurvedSubdivisionProcessor(ArialFont()).process(
        source.geometry, SubdivisionSettings(target_area_mm2=12, min_area_mm2=1)
    )
    assert result.split_count > 0
    assert [c for c in result.mesh.cells if c.color_index == 1] == [before]
    assert not next(s for s in result.label_spaces if s.cell_id == before.id).required


def test_print_check_rejects_missing_white_contour_and_fill_covering_it():
    template = ArtMateTemplate()
    artwork = template.fit(20, 20)
    source, settings, font, result = run(
        highlight_source((255, 255, 255), scale=artwork.width / 20)
    )
    case = source, result, settings, font, template, artwork, 1, ReferenceNumbers()
    svg = page_document(*case)
    assert check_page(svg, *case)["passed"]
    root = ET.fromstring(svg)
    body = root.find(f"{SVG}g[@id='artwork']")
    contours = body.find(f"{SVG}g[@id='contours']")
    white = next(c for c in result.mesh.cells if c.color_index == 1)
    white_edges = {abs(ref) for ring in white.rings for ref in ring}
    target = next(p for p in contours if int(p.get("data-edge-id")) in white_edges)
    contours.remove(target)
    with pytest.raises(StageError, match="границ"):
        check_page(ET.tostring(root, encoding="unicode"), *case)
    root = ET.fromstring(svg)
    body = root.find(f"{SVG}g[@id='artwork']")
    details = body.find(f"{SVG}g[@id='prefilled-details']")
    body.remove(details)
    body.append(details)
    with pytest.raises(StageError, match="перекрывать"):
        check_page(ET.tostring(root, encoding="unicode"), *case)


@pytest.mark.parametrize("same_color", [True, False])
def test_white_fragments_have_no_artificial_seam_but_distinct_shades_keep_their_boundary(
    same_color,
):
    pixels = np.zeros((20, 20), np.uint8)
    pixels[6:14, 6:10] = 1
    pixels[6:14, 10:14] = 2
    palette = ((40, 50, 60), (255, 255, 255), (250, 251, 250))
    source = source_for(pixels, palette=palette)
    geo = source.geometry
    cells = tuple(
        replace(
            c,
            prefilled=c.color_index == 1,
            color_index=1 if same_color and c.color_index == 2 else c.color_index,
        )
        for c in geo.mesh.cells
    )
    source = replace(source, geometry=replace(geo, mesh=replace(geo.mesh, cells=cells)))
    white_cells = [c for c in cells if c.color_index > 0]
    rings = [{abs(ref) for ring in c.rings for ref in ring} for c in white_cells]
    internal = rings[0] & rings[1]
    assert internal
    source, settings, font, result = run(source)
    root = ET.fromstring(svg_document(source, result, settings, font, labels=True))
    drawn = {int(p.get("data-edge-id")) for p in root.find(f".//{SVG}g[@id='contours']")}
    assert ((rings[0] | rings[1]) - internal) <= drawn
    assert internal.isdisjoint(drawn) if same_color else internal <= drawn
    assert not ({c.id for c in white_cells} & {label.cell_id for label in result.labels})
