"""Площадь окончательных кривых, плавность, покрытие и файловый контракт."""

import json
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
import pytest
from PIL import Image
from shapely import Polygon

from mystery_coloring.domain import StageError
from mystery_coloring.geometry.adapters.processor import SmoothGeometryProcessor
from mystery_coloring.geometry.adapters.raster import extract_boundaries
from mystery_coloring.geometry.adapters.topology import smooth_boundaries
from mystery_coloring.geometry.adapters.writer import GeometryFileWriter
from mystery_coloring.geometry.application import BuildGeometry, GeometryRequest
from mystery_coloring.geometry.cli import main
from mystery_coloring.geometry.curves import (
    cubic_signed_area,
    interpolate,
    region_areas,
    round_polyline,
)
from mystery_coloring.geometry.domain import Cubic, GeometrySettings
from mystery_coloring.regions.adapters.segmenter import RasterRegionProcessor, connected_regions
from mystery_coloring.regions.domain import RegionInput


def source_for(colors):
    data = np.asarray(colors, dtype=np.uint8)
    return RegionInput(
        data.shape[1],
        data.shape[0],
        ((0, 0, 0), (255, 255, 255), (220, 0, 0)),
        data.tobytes(),
        "a" * 64,
    )


def process(colors, minimum=5):
    source = source_for(colors)
    settings = GeometrySettings(image_width_mm=source.width, min_area_mm2=minimum, smoothing_mm=0.6)
    return (
        source,
        settings,
        SmoothGeometryProcessor(RasterRegionProcessor()).process(source, settings),
    )


def test_tiny_high_contrast_island_is_merged_despite_color_difference():
    colors = np.zeros((12, 12), dtype=np.uint8)
    colors[5, 5] = 1
    _, _, result = process(colors)
    assert len(result.areas_mm2) == 1
    assert result.areas_mm2 == pytest.approx((144,))
    assert result.changed_pixels == 1
    assert result.max_color_change > 18


def test_area_is_rechecked_after_curve_smoothing():
    colors = np.zeros((12, 12), dtype=np.uint8)
    colors[5, 3:8] = 1  # Ровно 5 мм² до округления концов.
    _, _, result = process(colors)
    assert result.cleanup_rounds > 1
    assert min(result.areas_mm2) >= 5
    assert len(result.areas_mm2) == 1


def test_long_thin_shape_above_area_threshold_is_allowed():
    colors = np.zeros((14, 14), dtype=np.uint8)
    colors[7, 3:11] = 1  # Ширина 1 мм; ограничение относится к площади.
    _, _, result = process(colors)
    assert len(result.areas_mm2) == 2
    assert min(result.areas_mm2) >= 5
    assert sum(result.areas_mm2) == pytest.approx(196)


def test_holes_are_subtracted_and_shared_areas_cover_page():
    colors = np.zeros((20, 20), dtype=np.uint8)
    colors[5:15, 5:15] = 1
    colors[8:12, 8:12] = 2
    _, _, result = process(colors)
    assert len(result.areas_mm2) == 3
    assert min(result.areas_mm2) >= 5
    assert sum(result.areas_mm2) == pytest.approx(400)
    assert sorted(item for ids in result.source_region_ids for item in ids) == [0, 1, 2]


def test_analytic_cubic_area_against_known_quadratic_arch():
    start, control, end = (0, 0), (1, 1), (2, 0)
    curve = Cubic(start, interpolate(start, control, 2 / 3), interpolate(end, control, 2 / 3), end)
    assert cubic_signed_area(curve) == pytest.approx(-2 / 3)
    assert cubic_signed_area(curve.reversed()) == pytest.approx(2 / 3)


@pytest.mark.parametrize("closed", [False, True])
def test_rounded_segments_share_tangent_direction(closed):
    points = ((0, 0), (8, 0), (8, 8), (0, 8))
    if closed:
        points += (points[0],)
    curves = round_polyline(points)
    pairs = list(zip(curves, curves[1:], strict=False))
    if closed:
        pairs.append((curves[-1], curves[0]))
    for first, second in pairs:
        assert first.end == second.start
        a = np.subtract(first.end, first.second)
        b = np.subtract(second.first, second.start)
        assert abs(a[0] * b[1] - a[1] * b[0]) < 1e-8
        assert np.dot(a, b) > 0


@pytest.mark.parametrize("seed", [1, 7, 19])
def test_dense_junctions_preserve_all_faces_and_area(seed):
    colors = np.random.default_rng(seed).integers(0, 3, (10, 10), dtype=np.uint8)
    labels, palette = connected_regions(colors)
    curves, _, _ = smooth_boundaries(extract_boundaries(labels), 10, 10, len(palette), 0.6)
    areas = region_areas(curves, len(palette), 1)
    assert all(area > 0 for area in areas)
    assert sum(areas) == pytest.approx(100)


def svg_sampled_areas(path: Path):
    # Независимое измерение экспортированного SVG: плотная дискретизация формулы Безье.
    tree = ET.parse(path)
    for region in tree.getroot().findall("{http://www.w3.org/2000/svg}path"):
        tokens = re.findall(r"[MCZ]|-?\d+(?:\.\d+)?", region.attrib["d"])
        rings, current, index = [], [], 0
        while index < len(tokens):
            command = tokens[index]
            index += 1
            if command == "M":
                point = np.asarray([float(tokens[index]), float(tokens[index + 1])])
                index += 2
                current = [tuple(point)]
            elif command == "C":
                values = np.asarray([float(v) for v in tokens[index : index + 6]]).reshape(3, 2)
                index += 6
                for t in np.linspace(0, 1, 101)[1:]:
                    sample = (
                        (1 - t) ** 3 * point
                        + 3 * (1 - t) ** 2 * t * values[0]
                        + 3 * (1 - t) * t**2 * values[1]
                        + t**3 * values[2]
                    )
                    current.append(tuple(sample))
                point = values[2]
            elif command == "Z":
                rings.append(Polygon(current))
        shape = rings[0]
        for ring in rings[1:]:
            shape = shape.symmetric_difference(ring)
        yield shape.area


def test_exported_svg_areas_match_report_with_holes(tmp_path):
    colors = np.zeros((20, 20), dtype=np.uint8)
    colors[4:16, 4:16] = 1
    colors[8:12, 8:12] = 2
    source, settings, result = process(colors)
    output = tmp_path / "geometry"
    GeometryFileWriter().write(output, source, result, settings)
    measured = list(svg_sampled_areas(output / "colored.svg"))
    assert measured == pytest.approx(result.areas_mm2, abs=0.002)
    assert min(measured) >= 5
    report = json.loads((output / "quality.json").read_text())
    assert report["below_min_area"] == 0
    assert report["actual_min_area_mm2"] == min(result.areas_mm2)
    assert report["print_ready"] is False
    assert (output / "manifest.json").exists()
    with pytest.raises(StageError, match="сохранить"):
        GeometryFileWriter().write(output, source, result, settings)
    assert (output / "manifest.json").exists()


def test_impossible_page_area_fails():
    with pytest.raises(StageError, match="Весь рисунок"):
        process(np.zeros((2, 2), dtype=np.uint8))


@pytest.mark.parametrize(
    "kwargs",
    [
        {"min_area_mm2": 0},
        {"min_area_mm2": float("nan")},
        {"smoothing_mm": -1},
        {"image_width_mm": 0},
        {"stroke_mm": math.inf},
    ],
)
def test_invalid_geometry_settings_fail(kwargs):
    with pytest.raises(StageError):
        GeometrySettings(**kwargs)


@pytest.mark.parametrize("area", [4.9, float("nan")])
def test_use_case_does_not_publish_invalid_area(area):
    from dataclasses import replace

    source, settings, result = process(np.zeros((10, 10), dtype=np.uint8))

    class Reader:
        def read(self, path):
            return source

    class Processor:
        def process(self, source, settings):
            return replace(result, areas_mm2=(area,))

    class Writer:
        def write(self, *args):
            pytest.fail("Невалидный результат не должен публиковаться")

    with pytest.raises(StageError, match="минимальная площадь"):
        BuildGeometry(Reader(), Processor(), Writer()).execute(
            GeometryRequest(Path("input"), Path("output"), settings)
        )


def test_cli_runs_complete_pipeline_and_rejects_overwrite(tmp_path, capsys):
    from mystery_coloring.cli import main as simplify

    image = tmp_path / "input.png"
    Image.new("RGB", (12, 12), "white").save(image)
    first, final = tmp_path / "first", tmp_path / "final"
    assert simplify([str(image), "--output", str(first), "--colors", "2"]) == 0
    args = [str(first), "--output", str(final), "--image-width-mm", "12"]
    assert main(args) == 0
    report = json.loads((final / "quality.json").read_text())
    assert report["required_min_area_mm2"] == 5
    assert main(args) == 2
    assert "уже существует" in capsys.readouterr().err


def test_closed_boundary_touching_junction_keeps_its_node_and_export_area(tmp_path):
    colors = np.zeros((5, 5), dtype=np.uint8)
    colors[1:4, 1:4] = 1
    colors[2, 2] = 2
    colors[3, 3] = 0  # Внутренняя область касается внешней ровно в узле.
    source, settings, result = process(colors, minimum=0.1)
    output = tmp_path / "junction"
    GeometryFileWriter().write(output, source, result, settings)
    assert list(svg_sampled_areas(output / "colored.svg")) == pytest.approx(
        result.areas_mm2, abs=0.002
    )
