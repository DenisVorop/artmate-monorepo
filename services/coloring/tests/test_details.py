"""Protection survives the whole mesh, while paint areas and text remain valid."""

from dataclasses import replace
from xml.etree import ElementTree as ET

import cv2
import numpy as np
import pytest

from mystery_coloring.adapters.opencv_simplifier import OpenCVImageSimplifier
from mystery_coloring.delivery.adapters.processor import subdivision_input
from mystery_coloring.details.adapters.detector import ContrastDetailDetector
from mystery_coloring.details.domain import DetailMap, DetailSettings
from mystery_coloring.domain import RGBImage, SimplifySettings, Smoothing
from mystery_coloring.geometry.adapters.processor import SmoothGeometryProcessor
from mystery_coloring.geometry.domain import GeometrySettings
from mystery_coloring.numbering.adapters.processor import AutomaticNumberingProcessor
from mystery_coloring.numbering.adapters.svg import svg_document
from mystery_coloring.numbering.domain import NumberingInput, NumberingSettings
from mystery_coloring.regions.adapters.segmenter import RasterRegionProcessor
from mystery_coloring.regions.domain import RegionInput, SharedBorder
from mystery_coloring.regions.merging import merge_small_regions
from mystery_coloring.subdivision.adapters.processor import CurvedSubdivisionProcessor
from mystery_coloring.subdivision.domain import SubdivisionSettings
from mystery_coloring.typography.adapters.font import ArialFont


def image(array):
    return RGBImage(array.shape[1], array.shape[0], array.astype(np.uint8).tobytes())


def test_distinct_stroke_is_kept_but_dense_texture_is_suppressed():
    rgb = np.full((300, 300, 3), (185, 140, 115), np.uint8)
    rgb[235:238, 200:235] = (35, 20, 15)
    for y in range(60, 130, 10):
        for x in range(60, 130, 10):
            cv2.circle(rgb, (x, y), 2, (35, 20, 15), -1)
    settings = DetailSettings(0.1, 3.5)
    first = ContrastDetailDetector().detect(image(rgb), settings)
    second = ContrastDetailDetector().detect(image(rgb), settings)
    assert first == second
    mask = np.frombuffer(first.region_ids, "<u4").reshape(300, 300)
    assert np.count_nonzero(mask[232:241, 195:240]) > 50
    assert np.count_nonzero(mask[50:140, 50:140]) == 0
    assert np.count_nonzero(mask) <= mask.size * settings.max_coverage


def test_white_highlight_inside_dark_surround_is_detected():
    rgb = np.full((200, 200, 3), (15, 22, 30), np.uint8)
    cv2.circle(rgb, (100, 100), 5, (255, 255, 255), -1)
    result = ContrastDetailDetector().detect(image(rgb), DetailSettings(0.1, 3.5))
    mask = np.frombuffer(result.region_ids, "<u4").reshape(200, 200)
    assert mask[100, 100] > 0
    assert result.colors[mask[100, 100] - 1] == (255, 255, 255)


def test_rare_accent_stays_in_palette_with_requested_limit():
    rgb = np.full((100, 100, 3), (160, 110, 70), np.uint8)
    rgb[:50] = (40, 110, 45)
    rgb[70:75, 70:75] = (40, 80, 170)
    detail = np.zeros((100, 100), "<u4")
    detail[70:75, 70:75] = 1
    protected = DetailMap(detail.tobytes(), ((40, 80, 170),), ((40, 80, 170),))
    result = OpenCVImageSimplifier().simplify(
        image(rgb), SimplifySettings(colors=3, smoothing=Smoothing.NONE), detail_map=protected
    )
    assert len(result.palette) <= 3
    assert (40, 80, 170) in [c.rgb for c in result.palette]
    palette = np.asarray([c.rgb for c in result.palette], np.uint8)
    final = palette[np.frombuffer(result.color_indices, np.uint8)].reshape(100, 100, 3)
    assert np.all(final[70:75, 70:75] == (40, 80, 170))


def test_protected_region_is_neither_absorbed_nor_used_as_merge_target():
    result = merge_small_regions(
        (1, 1, 20),
        (0, 1, 1),
        (SharedBorder(0, 1, 2), SharedBorder(1, 2, 1)),
        ((0, 1), (1, 0)),
        5,
        300,
        frozenset({0}),
    )
    assert result[0] == 0
    assert result[1] == result[2]


@pytest.mark.parametrize("white", [False, True])
def test_small_protected_hole_survives_smoothing_subdivision_numbering_and_svg(white):
    data = np.zeros((40, 40), np.uint8)
    data[19:21, 17:23] = 1
    mask = (data == 1).astype(np.uint8)
    source = RegionInput(
        40,
        40,
        ((180, 100, 70), (255, 255, 255) if white else (20, 30, 40)),
        data.tobytes(),
        "a" * 64,
        mask.tobytes(),
    )
    settings = GeometrySettings(image_width_mm=20, min_area_mm2=3.5)
    geometry = SmoothGeometryProcessor(RasterRegionProcessor()).process(source, settings)
    geometry.validate_min_area(3.5)
    assert len(geometry.prefilled_ids) == 1
    protected = next(iter(geometry.prefilled_ids))
    assert 0 < geometry.areas_mm2[protected] < 3.5
    vector = subdivision_input(source, geometry, settings)
    font = ArialFont()
    divided = CurvedSubdivisionProcessor(font).process(
        vector, SubdivisionSettings(min_area_mm2=3.5)
    )
    numbered_source = NumberingInput(replace(vector, mesh=divided.mesh), divided.label_spaces)
    numbering_settings = NumberingSettings(min_area_mm2=3.5)
    result = AutomaticNumberingProcessor(font).process(numbered_source, numbering_settings)
    result.validate(numbered_source, numbering_settings)
    details = [c for c in result.mesh.cells if c.prefilled]
    assert len(details) == 1 and details[0].color_index == 1
    assert details[0].id not in {label.cell_id for label in result.labels}
    assert all(
        a >= 3.5
        for c, a in zip(result.mesh.cells, result.areas_mm2, strict=True)
        if not c.prefilled
    )
    svg = ET.fromstring(
        svg_document(numbered_source, result, numbering_settings, font, labels=True)
    )
    group = svg.find('.//{*}g[@id="prefilled-details"]')
    assert len(group) == 1
    assert group[0].get("fill") == ("#ffffff" if white else "#141e28")
    assert sum(result.areas_mm2) == pytest.approx(400)


def test_small_unprotected_area_still_obeys_minimum():
    data = np.zeros((40, 40), np.uint8)
    data[19:21, 17:23] = 1
    source = RegionInput(40, 40, ((180, 100, 70), (20, 30, 40)), data.tobytes(), "a" * 64)
    result = SmoothGeometryProcessor(RasterRegionProcessor()).process(
        source, GeometrySettings(image_width_mm=20, min_area_mm2=3.5)
    )
    assert not result.prefilled_ids
    assert len(result.areas_mm2) == 1


def test_cut_with_invalid_protected_neighbor_is_rejected(monkeypatch):
    from mystery_coloring.subdivision.adapters import processor

    data = np.zeros((40, 40), np.uint8)
    data[19:21, 17:23] = 1
    source = RegionInput(
        40,
        40,
        ((180, 100, 70), (20, 30, 40)),
        data.tobytes(),
        "a" * 64,
        (data == 1).astype(np.uint8).tobytes(),
    )
    settings = GeometrySettings(image_width_mm=20, min_area_mm2=3.5)
    geometry = SmoothGeometryProcessor(RasterRegionProcessor()).process(source, settings)
    vector = subdivision_input(source, geometry, settings)
    original = processor.propose_cut
    attempts = []

    def invalid_neighbor(*args, **kwargs):
        proposal = original(*args, **kwargs)
        if proposal is not None:
            cells, edges, children = proposal
            detail = next(c for c in cells.values() if c.prefilled)
            cells[detail.id] = replace(detail, rings=(*detail.rings, detail.rings[0]))
            attempts.append(detail.id)
        return proposal

    monkeypatch.setattr(processor, "propose_cut", invalid_neighbor)
    result = CurvedSubdivisionProcessor(ArialFont()).process(
        vector, SubdivisionSettings(min_area_mm2=3.5)
    )
    assert attempts
    assert result.split_count == 0
    assert result.mesh == vector.mesh
