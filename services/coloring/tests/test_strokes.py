"""General thin dark strokes remain printable as prefilled details."""

from dataclasses import replace
from xml.etree import ElementTree as ET

import cv2
import numpy as np
import pytest

from mystery_coloring.details.adapters import detector as detector_module
from mystery_coloring.details.adapters.detector import ContrastDetailDetector
from mystery_coloring.details.domain import DetailSettings
from mystery_coloring.domain import RGBImage, SimplifySettings, Smoothing


def image(array):
    return RGBImage(array.shape[1], array.shape[0], array.astype(np.uint8).tobytes())


def whisker_scene(size=600):
    rgb = np.full((size, size, 3), (190, 150, 125), np.uint8)
    # A broad two-color boundary gives the whisker different local backgrounds
    # along its length, as on an animal muzzle crossing a fur boundary.
    rgb[:, size // 2 :] = (155, 120, 100)
    points = np.array([[110, 365], [175, 340], [245, 350], [320, 325], [405, 335]])
    cv2.polylines(rgb, [points], False, (38, 24, 20), 2, cv2.LINE_AA)
    return rgb, points


def mask_for(result, shape):
    return np.frombuffer(result.region_ids, "<u4").reshape(shape)


@pytest.mark.parametrize(
    "color,accepted", [((96, 48, 0), False), ((43, 22, 0), True), ((7, 7, 7), True)]
)
def test_extra_strokes_distinguish_saturated_outlines_from_dark_ink(color, accepted):
    from mystery_coloring.details.adapters.strokes import stroke_candidates

    rgb = np.full((160, 240, 3), (225, 170, 60), np.uint8)
    cv2.ellipse(rgb, (120, 80), (35, 8), 0, 0, 360, color, 1, cv2.LINE_AA)
    lab = cv2.cvtColor(rgb.astype(np.float32) / 255, cv2.COLOR_RGB2LAB)
    light = cv2.GaussianBlur(lab[:, :, 0], (3, 3), 0.5)
    candidates = stroke_candidates(rgb, light, DetailSettings(0.18, 3.5))
    assert bool(candidates) is accepted


def test_long_curved_dark_stroke_survives_two_color_background_and_keeps_core_color():
    rgb, points = whisker_scene()
    settings = DetailSettings(0.1, 3.5)
    detector = ContrastDetailDetector()

    first = detector.detect(image(rgb), settings)
    second = detector.detect(image(rgb), settings)

    assert first == second
    mask = mask_for(first, rgb.shape[:2])
    assert all(mask[y, x] > 0 for x, y in points[1:-1])
    selected_colors = {first.colors[index - 1] for index in np.unique(mask) if index}
    assert (38, 24, 20) in selected_colors


def test_step_edge_and_dense_short_dark_texture_are_not_prefilled_as_whiskers():
    rgb = np.full((600, 600, 3), (190, 150, 125), np.uint8)
    rgb[300:] = (155, 120, 100)
    # A plain step has contrast on one side only.
    # Repeated short marks represent fur/engraving texture rather than whiskers.
    for y in range(70, 190, 12):
        for x in range(65, 185, 12):
            cv2.line(rgb, (x, y), (x + 3, y + 1), (38, 24, 20), 1, cv2.LINE_AA)

    result = ContrastDetailDetector().detect(image(rgb), DetailSettings(0.1, 3.5))
    mask = mask_for(result, rgb.shape[:2])

    assert np.count_nonzero(mask[280:320, :]) == 0
    assert np.count_nonzero(mask[55:205, 50:205]) == 0


def test_strokes_share_detail_count_and_pixel_coverage_limits():
    rgb = np.full((700, 700, 3), (190, 150, 125), np.uint8)
    for index in range(6):
        y = 100 + index * 75
        cv2.polylines(
            rgb,
            [np.array([[100, y + 10], [180, y], [260, y + 10], [340, y]])],
            False,
            (38, 24, 20),
            2,
            cv2.LINE_AA,
        )
    settings = replace(DetailSettings(0.1, 3.5), max_details=2, max_coverage=0.0025)

    result = ContrastDetailDetector().detect(image(rgb), settings)
    mask = mask_for(result, rgb.shape[:2])

    assert len(result.colors) <= 2
    assert np.count_nonzero(mask) <= mask.size * settings.max_coverage
    assert np.count_nonzero(mask) > 0


def test_compact_highlights_survive_when_extra_strokes_compete_for_coverage(monkeypatch):
    rgb = np.full((600, 600, 3), (190, 150, 125), np.uint8)
    cv2.circle(rgb, (80, 85), 5, (255, 255, 255), -1, cv2.LINE_AA)
    for index in range(5):
        y = 120 + index * 75
        cv2.polylines(
            rgb,
            [np.array([[200, y + 8], [250, y], [300, y + 7], [355, y]])],
            False,
            (38, 24, 20),
            2,
            cv2.LINE_AA,
        )
    settings = replace(DetailSettings(0.1, 3.5), max_coverage=0.002)
    detector = ContrastDetailDetector()
    real_stroke_candidates = detector_module.stroke_candidates

    monkeypatch.setattr(detector_module, "stroke_candidates", lambda *_: [])
    baseline = detector.detect(image(rgb), settings)
    monkeypatch.setattr(detector_module, "stroke_candidates", real_stroke_candidates)
    with_strokes = detector.detect(image(rgb), settings)

    baseline_mask = mask_for(baseline, rgb.shape[:2]) > 0
    actual_mask = mask_for(with_strokes, rgb.shape[:2]) > 0
    assert np.count_nonzero(baseline_mask) > 0
    assert np.all(actual_mask[baseline_mask])
    highlight_id = mask_for(with_strokes, rgb.shape[:2])[85, 80]
    assert highlight_id > 0
    assert with_strokes.colors[highlight_id - 1] == (255, 255, 255)
    assert np.count_nonzero(actual_mask) <= actual_mask.size * settings.max_coverage


def test_long_stroke_core_color_replaces_overlapping_compact_fragment(monkeypatch):
    rgb = np.full((600, 600, 3), (190, 150, 125), np.uint8)
    cv2.ellipse(rgb, (300, 300), (5, 4), 0, 0, 360, (38, 24, 20), -1, cv2.LINE_AA)
    cv2.circle(rgb, (80, 85), 5, (255, 255, 255), -1, cv2.LINE_AA)
    cv2.polylines(
        rgb,
        [np.array([[310, 250], [345, 244], [385, 250], [430, 242], [470, 247]])],
        False,
        (20, 10, 8),
        2,
        cv2.LINE_AA,
    )
    settings = DetailSettings(0.1, 3.5)
    detector = ContrastDetailDetector()
    monkeypatch.setattr(detector_module, "stroke_candidates", lambda *_: [])
    compact = detector.detect(image(rgb), settings)
    compact_mask = mask_for(compact, rgb.shape[:2])
    yy, xx = np.indices(compact_mask.shape)
    compact_pixels = np.argwhere((compact_mask > 0) & (yy > 285) & (xx > 285))
    assert len(compact_pixels) > 0

    # Simulate the selector receiving the source-confirmed long stroke, whose
    # connected mask includes an already protected compact dark fragment.
    path_y, path_x = np.mgrid[298:303, 300:475]
    stroke_pixels = np.unique(
        np.vstack((compact_pixels, np.column_stack((path_y.ravel(), path_x.ravel())))), axis=0
    )
    stroke = (
        9.0,
        1,
        "stroke",
        (stroke_pixels[:, 0], stroke_pixels[:, 1]),
        (20, 10, 8),
        np.array([390.0, 300.0]),
        False,
    )
    monkeypatch.setattr(detector_module, "stroke_candidates", lambda *_: [stroke])
    result = detector.detect(image(rgb), settings)
    result_mask = mask_for(result, rgb.shape[:2])

    assert np.all(result_mask[compact_mask > 0] == compact_mask[compact_mask > 0])
    compact_id = int(compact_mask[compact_pixels[0, 0], compact_pixels[0, 1]])
    assert result.colors[compact_id - 1] == (20, 10, 8)
    highlight_id = int(result_mask[85, 80])
    assert highlight_id > 0
    assert result.colors[highlight_id - 1] == (255, 255, 255)


def test_long_stroke_does_not_create_palette_accent_near_unselected_chromatic_patch(
    monkeypatch,
):
    rgb = np.full((600, 600, 3), (190, 150, 125), np.uint8)
    cv2.polylines(
        rgb,
        [np.array([[120, 300], [210, 292], [300, 300], [390, 290], [480, 297]])],
        False,
        (38, 24, 20),
        2,
        cv2.LINE_AA,
    )
    rgb[315:333, 292:310] = (205, 135, 75)
    settings = DetailSettings(0.1, 3.5)
    detector = ContrastDetailDetector()
    real_stroke_candidates = detector_module.stroke_candidates

    monkeypatch.setattr(detector_module, "stroke_candidates", lambda *_: [])
    baseline = detector.detect(image(rgb), settings)
    monkeypatch.setattr(detector_module, "stroke_candidates", real_stroke_candidates)
    with_strokes = detector.detect(image(rgb), settings)

    assert baseline.accents == ()
    assert np.count_nonzero(mask_for(with_strokes, rgb.shape[:2])) > np.count_nonzero(
        mask_for(baseline, rgb.shape[:2])
    )
    assert with_strokes.accents == baseline.accents


def test_detected_thin_stroke_reaches_prefilled_svg_without_a_number():
    from mystery_coloring.delivery.adapters.processor import subdivision_input
    from mystery_coloring.geometry.adapters.processor import SmoothGeometryProcessor
    from mystery_coloring.geometry.domain import GeometrySettings
    from mystery_coloring.numbering.adapters.processor import AutomaticNumberingProcessor
    from mystery_coloring.numbering.adapters.svg import svg_document
    from mystery_coloring.numbering.domain import NumberingInput, NumberingSettings
    from mystery_coloring.regions.adapters.segmenter import RasterRegionProcessor
    from mystery_coloring.regions.domain import RegionInput
    from mystery_coloring.subdivision.adapters.processor import CurvedSubdivisionProcessor
    from mystery_coloring.subdivision.domain import SubdivisionSettings
    from mystery_coloring.typography.adapters.font import ArialFont

    rgb = np.full((400, 400, 3), (185, 140, 115), np.uint8)
    cv2.polylines(
        rgb,
        [np.array([[65, 180], [105, 170], [145, 176], [185, 164], [215, 169]])],
        False,
        (38, 24, 20),
        2,
        cv2.LINE_AA,
    )
    details = ContrastDetailDetector().detect(image(rgb), DetailSettings(40 / 400, 3.5))
    detected = mask_for(details, rgb.shape[:2])
    assert np.count_nonzero(detected) > 0

    from mystery_coloring.adapters.opencv_simplifier import OpenCVImageSimplifier

    simplified = OpenCVImageSimplifier().simplify(
        image(rgb), SimplifySettings(colors=2, smoothing=Smoothing.NONE), detail_map=details
    )
    labels = np.frombuffer(simplified.color_indices, np.uint8).reshape(rgb.shape[:2])
    region_input = RegionInput(
        400,
        400,
        tuple(color.rgb for color in simplified.palette),
        labels.tobytes(),
        "b" * 64,
        simplified.prefilled_mask,
    )
    geometry_settings = GeometrySettings(image_width_mm=40, min_area_mm2=3.5)
    geometry = SmoothGeometryProcessor(RasterRegionProcessor()).process(
        region_input, geometry_settings
    )
    assert geometry.prefilled_ids
    vector = subdivision_input(region_input, geometry, geometry_settings)
    font = ArialFont()
    divided = CurvedSubdivisionProcessor(font).process(
        vector, SubdivisionSettings(min_area_mm2=3.5)
    )
    numbered_source = NumberingInput(replace(vector, mesh=divided.mesh), divided.label_spaces)
    numbering_settings = NumberingSettings(min_area_mm2=3.5)
    numbered = AutomaticNumberingProcessor(font).process(numbered_source, numbering_settings)
    svg = ET.fromstring(
        svg_document(numbered_source, numbered, numbering_settings, font, labels=True)
    )

    details_group = svg.find('.//{*}g[@id="prefilled-details"]')
    prefilled_cells = [cell for cell in numbered.mesh.cells if cell.prefilled]
    assert details_group is not None and len(details_group) == len(prefilled_cells)
    label_ids = {label.cell_id for label in numbered.labels}
    assert all(cell.id not in label_ids for cell in prefilled_cells)
    y, x = np.argwhere(detected > 0)[0]
    palette_color = simplified.palette[int(labels[y, x])].rgb
    expected_fill = "#" + "".join(f"{channel:02x}" for channel in palette_color)
    assert any(element.get("fill") == expected_fill for element in details_group)
