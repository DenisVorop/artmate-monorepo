"""Общая геометрия, площадь, места под номера и файловый контракт разбиения."""

import hashlib
import json
import math
import random
import re
import xml.etree.ElementTree as ET
from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest
from shapely import Polygon, box

from mystery_coloring.domain import StageError
from mystery_coloring.geometry.adapters.processor import SmoothGeometryProcessor
from mystery_coloring.geometry.adapters.writer import GeometryFileWriter
from mystery_coloring.geometry.curves import line_cubics
from mystery_coloring.geometry.domain import Cubic, GeometrySettings
from mystery_coloring.regions.adapters.segmenter import RasterRegionProcessor
from mystery_coloring.regions.domain import RegionInput
from mystery_coloring.subdivision.adapters.labels import LabelFitter
from mystery_coloring.subdivision.adapters.processor import CurvedSubdivisionProcessor
from mystery_coloring.subdivision.adapters.reader import GeometryReader
from mystery_coloring.subdivision.adapters.shapes import Shapes, validate_mesh
from mystery_coloring.subdivision.adapters.svg import document
from mystery_coloring.subdivision.adapters.writer import SubdivisionFileWriter
from mystery_coloring.subdivision.application import SubdivideGeometry, SubdivisionRequest
from mystery_coloring.subdivision.cli import main
from mystery_coloring.subdivision.curves import cell_area, split_cubic
from mystery_coloring.subdivision.domain import (
    Cell,
    Edge,
    Mesh,
    SubdivisionInput,
    SubdivisionSettings,
)
from mystery_coloring.typography.adapters.font import ArialFont
from mystery_coloring.typography.domain import SYMBOLS


def rectangle(width=20, height=20, scale=1):
    curves = line_cubics(((0, 0), (width, 0), (width, height), (0, height), (0, 0)))
    return SubdivisionInput(
        width,
        height,
        scale,
        ((30, 90, 150),),
        Mesh((Edge(1, curves, 0),), (Cell(0, 0, 0, ((1,),)),)),
        "a" * 64,
    )


def split(source=None, **kwargs):
    source = source or rectangle()
    settings = SubdivisionSettings(target_area_mm2=30, **kwargs)
    return source, settings, CurvedSubdivisionProcessor(ArialFont()).process(source, settings)


def saved_geometry(tmp_path, colors):
    pixels = np.asarray(colors, dtype=np.uint8)
    source = RegionInput(
        pixels.shape[1],
        pixels.shape[0],
        ((0, 0, 0), (255, 255, 255), (200, 40, 40)),
        pixels.tobytes(),
        "a" * 64,
    )
    settings = GeometrySettings(image_width_mm=source.width, min_area_mm2=0.1)
    geometry = SmoothGeometryProcessor(RasterRegionProcessor()).process(source, settings)
    destination = tmp_path / "source"
    GeometryFileWriter().write(destination, source, geometry, settings)
    return destination


def test_recursive_split_preserves_coverage_color_area_and_curves():
    source, settings, result = split()
    assert result.split_count >= 8
    assert len(result.mesh.cells) == len(source.mesh.cells) + result.split_count
    assert min(result.areas_mm2) >= 5
    assert sum(result.areas_mm2) == pytest.approx(400, abs=1e-5)
    assert max(result.areas_mm2) <= 45
    assert all(c.color_index == 0 and c.parent_region_id == 0 for c in result.mesh.cells)
    assert all(s.center is not None for s in result.label_spaces)
    assert all(s.angle == 0 for s in result.label_spaces)
    edges = {e.id: e for e in result.mesh.edges}
    assert all(cell_area(c, edges, 1) >= 5 for c in result.mesh.cells)
    validate_mesh(result.mesh, source.width, source.height, Shapes())
    added = [e for e in result.mesh.edges if e.source_boundary_id is None]

    def bend(edge):
        c = edge.curves[0]
        a, b = np.subtract(c.first, c.start), np.subtract(c.end, c.start)
        return abs(a[0] * b[1] - a[1] * b[0])

    assert added and any(bend(e) > 0.01 for e in added)


def test_deterministic_local_seed_and_detail_control():
    random.seed(101)
    state = random.getstate()
    source, settings, result = split()
    assert random.getstate() == state
    assert CurvedSubdivisionProcessor(ArialFont()).process(source, settings) == result
    varied = CurvedSubdivisionProcessor(ArialFont()).process(source, replace(settings, seed=8))
    assert varied.mesh != result.mesh
    simpler = CurvedSubdivisionProcessor(ArialFont()).process(
        source, replace(settings, target_area_mm2=90)
    )
    assert len(simpler.mesh.cells) < len(result.mesh.cells)
    assert document(source, result, settings, filled=True, outlines=False) == document(
        source, simpler, settings, filled=True, outlines=False
    )


def test_physical_scale_not_pixel_area():
    _, _, result = split(rectangle(200, 200, scale=0.1))
    assert sum(result.areas_mm2) == pytest.approx(400, abs=1e-5)
    assert min(result.areas_mm2) >= 5 and len(result.mesh.cells) > 1


def test_thin_existing_region_is_reported_without_violating_area_or_recoloring():
    source, settings, result = split(rectangle(80, 1))
    assert result.mesh == source.mesh
    assert result.areas_mm2 == (80,)
    assert result.unresolved_large_ids == (0,)
    assert result.stop_reasons == ((0, "no_valid_cut_found"),)
    assert result.label_spaces[0].center is None
    result.validate(settings)


def test_region_budget_is_explicit_not_silent():
    _, _, result = split(max_regions=2)
    assert len(result.mesh.cells) == 2
    assert result.unresolved_large_ids
    assert all(reason == "region_limit" for _, reason in result.stop_reasons)


def test_label_rectangle_avoids_holes_and_includes_stroke_and_padding():
    polygon = Polygon(
        ((0, 0), (10, 0), (10, 10), (0, 10)), holes=[((3, 3), (7, 3), (7, 7), (3, 7))]
    )
    settings = SubdivisionSettings()
    space = LabelFitter(settings, 1, ArialFont(), tuple(SYMBOLS)).fit(polygon, 0, 23)
    assert space.center is not None
    padding = settings.label_padding_mm + settings.stroke_mm / 2 + 0.01
    w, h = space.width_mm / 2 + padding, space.height_mm / 2 + padding
    assert space.angle == 0
    x, y = space.center
    assert polygon.covers(box(x - w, y - h, x + w, y + h))


def test_horizontal_reservation_rejects_space_that_only_fits_sideways():
    fitter = LabelFitter(SubdivisionSettings(), 1, ArialFont(), tuple(SYMBOLS))
    width, height = fitter.measure("1")
    # Высоты хватило бы только после поворота длинного глифа на 90°.
    assert width + 0.54 < 1.2 < height + 0.54
    space = fitter.fit(box(0, 0, 6, 1.2), 0, 0)
    assert space.center is None and space.angle == 0


def test_subdivision_rejects_rotated_reservation_before_writing(tmp_path):
    source, settings, result = split()
    bad = replace(result.label_spaces[0], angle=90)
    with pytest.raises(StageError, match="горизонтальным"):
        SubdivisionFileWriter(ArialFont()).write(
            tmp_path / "bad",
            source,
            replace(result, label_spaces=(bad, *result.label_spaces[1:])),
            settings,
        )
    assert not (tmp_path / "bad").exists()


def test_de_casteljau_preserves_original_curve_at_arbitrary_parameter():
    curve = Cubic((1, 2), (3, 8), (10, -2), (15, 6))
    a, b = split_cubic(curve, 0.37)

    def evaluate(c, t):
        return (
            (1 - t) ** 3 * np.array(c.start)
            + 3 * (1 - t) ** 2 * t * np.array(c.first)
            + 3 * (1 - t) * t * t * np.array(c.second)
            + t**3 * np.array(c.end)
        )

    for t in np.linspace(0, 1, 21):
        assert evaluate(a, t) == pytest.approx(evaluate(curve, t * 0.37))
        assert evaluate(b, t) == pytest.approx(evaluate(curve, 0.37 + t * 0.63))


def test_nested_holes_shared_neighbors_and_color_lineage(tmp_path):
    colors = np.zeros((30, 30), dtype=np.uint8)
    colors[8:22, 8:22] = 1
    colors[12:18, 12:18] = 2
    path = saved_geometry(tmp_path, colors)
    source = GeometryReader().read(path)
    _, settings, result = split(source)
    assert result.split_count > 0
    assert sum(result.areas_mm2) == pytest.approx(900, abs=1e-5)
    parents = {c.id: c.color_index for c in source.mesh.cells}
    assert all(c.color_index == parents[c.parent_region_id] for c in result.mesh.cells)
    assert result.max_parent_area_drift_mm2 < 0.001
    validate_mesh(result.mesh, source.width, source.height, Shapes())


def test_reader_separates_point_touching_loops_without_moving_edges(tmp_path):
    colors = np.zeros((5, 5), dtype=np.uint8)
    colors[1:4, 1:4] = 1
    colors[2, 2] = 2
    colors[3, 3] = 0
    source = GeometryReader().read(saved_geometry(tmp_path, colors))
    validate_mesh(source.mesh, source.width, source.height, Shapes())


def exported_edge_areas(path):
    # Независимая квадратура Гаусса: интегрируется фактически сохранённый SVG.
    nodes, weights = np.polynomial.legendre.leggauss(4)
    root = ET.parse(path).getroot()
    for item in root.find("{http://www.w3.org/2000/svg}g"):
        values = [float(v) for v in re.findall(r"-?\d+(?:\.\d+)?", item.attrib["d"])]
        start = np.array(values[:2])
        area = 0
        for i in range(2, len(values), 6):
            first, second, end = np.array(values[i : i + 6]).reshape(3, 2)
            for node, weight in zip(nodes, weights, strict=True):
                t = (node + 1) / 2
                p = (
                    (1 - t) ** 3 * start
                    + 3 * (1 - t) ** 2 * t * first
                    + 3 * (1 - t) * t * t * second
                    + t**3 * end
                )
                d = 3 * (
                    (1 - t) ** 2 * (first - start)
                    + 2 * (1 - t) * t * (second - first)
                    + t * t * (end - second)
                )
                area += weight / 4 * (p[0] * d[1] - p[1] * d[0])
            start = end
        yield area


def test_exported_svg_analytic_area_hashes_and_no_overwrite(tmp_path):
    source, settings, result = split()
    destination = tmp_path / "result"
    writer = SubdivisionFileWriter(ArialFont())
    writer.write(destination, source, result, settings)
    areas = dict(
        zip(
            (e.id for e in result.mesh.edges),
            exported_edge_areas(destination / "outlines.svg"),
            strict=True,
        )
    )
    measured = [
        sum((1 if ref > 0 else -1) * areas[abs(ref)] for ring in c.rings for ref in ring)
        for c in result.mesh.cells
    ]
    assert measured == pytest.approx(result.areas_mm2, abs=1e-7)
    assert min(measured) >= 5
    manifest = json.loads((destination / "manifest.json").read_text())
    for name, digest in manifest["artifacts_sha256"].items():
        assert hashlib.sha256((destination / name).read_bytes()).hexdigest() == digest
    with pytest.raises(StageError):
        writer.write(destination, source, result, settings)
    assert (destination / "manifest.json").exists()


def test_writer_removes_unfinished_directory_on_renderer_failure(tmp_path, monkeypatch):
    import mystery_coloring.subdivision.adapters.writer as module

    source, settings, result = split()

    def fail(**kwargs):
        raise RuntimeError("render failed")

    monkeypatch.setattr(module.resvg_py, "svg_to_bytes", fail)
    with pytest.raises(StageError):
        SubdivisionFileWriter(ArialFont()).write(tmp_path / "bad", source, result, settings)
    assert not (tmp_path / "bad").exists()


def test_cli_and_reader_reject_modified_input_and_existing_output(tmp_path, capsys):
    source = saved_geometry(tmp_path, np.zeros((20, 20), dtype=np.uint8))
    args = [str(source), "--output", str(tmp_path / "final"), "--target-area-mm2", "30"]
    assert main(args) == 0
    assert main(args) == 2
    assert "уже существует" in capsys.readouterr().err
    (source / "geometry.json").write_text("{}")
    with pytest.raises(StageError, match="контрольная сумма"):
        GeometryReader().read(source)
    assert main([str(source), "--output", str(tmp_path / "not-created")]) == 2
    assert not (tmp_path / "not-created").exists()


@pytest.mark.parametrize(
    "kwargs",
    [
        {"target_area_mm2": 9},
        {"min_area_mm2": math.nan},
        {"curve_bend_mm": 0},
        {"label_font_size_pt": math.inf},
        {"label_padding_mm": -1},
        {"seed": -1},
        {"max_regions": 0},
    ],
)
def test_invalid_settings(kwargs):
    with pytest.raises(StageError):
        SubdivisionSettings(**kwargs)


def test_application_does_not_publish_invalid_area():
    source, settings, result = split()

    class Reader:
        def read(self, _):
            return source

    class Processor:
        def process(self, *_):
            return replace(result, areas_mm2=(4.9,) * len(result.mesh.cells))

    class Writer:
        def write(self, *_):
            pytest.fail("invalid publication")

    with pytest.raises(StageError, match="минимальная площадь"):
        SubdivideGeometry(Reader(), Processor(), Writer()).execute(
            SubdivisionRequest(Path("in"), Path("out"), settings)
        )
