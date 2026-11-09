"""Единые символы, автономные слияния, физическая геометрия текста и файлы."""

import hashlib
import json
import re
import xml.etree.ElementTree as ET
from dataclasses import asdict, replace
from pathlib import Path

import numpy as np
import pytest
from shapely import Polygon, box
from shapely.affinity import rotate
from shapely.affinity import scale as scale_shape

from mystery_coloring.domain import StageError
from mystery_coloring.geometry.adapters.raster import extract_boundaries
from mystery_coloring.geometry.curves import line_cubics, region_rings
from mystery_coloring.numbering.adapters.placement import SymbolPlacer
from mystery_coloring.numbering.adapters.processor import AutomaticNumberingProcessor
from mystery_coloring.numbering.adapters.reader import SubdivisionReader
from mystery_coloring.numbering.adapters.writer import NumberingFileWriter
from mystery_coloring.numbering.application import NumberGeometry, NumberingRequest
from mystery_coloring.numbering.cli import main
from mystery_coloring.numbering.domain import SYMBOLS, NumberingInput, NumberingSettings, symbol_for
from mystery_coloring.regions.adapters.segmenter import connected_regions
from mystery_coloring.subdivision.adapters.shapes import Shapes, validate_mesh
from mystery_coloring.subdivision.curves import cell_area, separate_touching_rings
from mystery_coloring.subdivision.domain import Cell, Edge, Mesh, SubdivisionInput
from mystery_coloring.typography.adapters.font import ArialFont


def source_for(colors=None, scale=1, palette=((200, 30, 30), (185, 35, 35), (0, 0, 230))):
    colors = (
        np.zeros((20, 20), dtype=np.uint8) if colors is None else np.asarray(colors, dtype=np.uint8)
    )
    labels, indices = connected_regions(colors)
    boundaries = extract_boundaries(labels)
    edges = tuple(Edge(b.id + 1, line_cubics(b.points), b.id) for b in boundaries)
    edge_map = {e.id: e for e in edges}
    rings = region_rings(boundaries)
    cells = tuple(
        Cell(i, i, int(color), separate_touching_rings(rings[i], edge_map))
        for i, color in enumerate(indices)
    )
    return NumberingInput(
        SubdivisionInput(
            colors.shape[1], colors.shape[0], scale, palette, Mesh(edges, cells), "a" * 64
        ),
        (),
    )


def run(source=None, **options):
    source = source or source_for()
    settings = NumberingSettings(**options)
    font = ArialFont()
    return source, settings, font, AutomaticNumberingProcessor(font).process(source, settings)


def save_input(path, source):
    path.mkdir()
    g = source.geometry
    edges = {e.id: e for e in g.mesh.edges}
    documents = {
        "geometry.json": {
            "schema_version": 2,
            "working_size": [g.width, g.height],
            "mm_per_unit": g.mm_per_unit,
            "boundaries": [asdict(e) for e in g.mesh.edges],
            "regions": [
                {**asdict(c), "area_mm2": cell_area(c, edges, g.mm_per_unit)} for c in g.mesh.cells
            ],
        },
        "palette.json": {
            "colors": [{"index": i, "number": i + 1, "rgb": c} for i, c in enumerate(g.palette)]
        },
        "label-spaces.json": {"regions": []},
    }
    for name, value in documents.items():
        (path / name).write_text(json.dumps(value))
    (path / "manifest.json").write_text(
        json.dumps(
            {
                "schema_version": 1,
                "algorithm": "shared-cubic-subdivision-v1",
                "working_size": [g.width, g.height],
                "image_size_mm": [g.width * g.mm_per_unit, g.height * g.mm_per_unit],
                "artifacts_sha256": {
                    name: hashlib.sha256((path / name).read_bytes()).hexdigest()
                    for name in documents
                },
            }
        )
    )


def test_symbol_set_is_exact_and_has_no_zero_or_multi_character_numbers():
    assert (
        "".join(symbol_for(i) for i in range(35))
        == SYMBOLS
        == "123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    )
    assert symbol_for(8) == "9" and symbol_for(9) == "A" and symbol_for(34) == "Z"
    for index in (-1, 35, True):
        with pytest.raises(StageError):
            symbol_for(index)


def test_same_size_everywhere_and_deterministic_output_without_ai():
    source, settings, font, result = run()
    assert result == AutomaticNumberingProcessor(font).process(source, settings)
    assert {label.font_size_pt for label in result.labels} == {6}
    assert {label.angle_deg for label in result.labels} == {0}
    assert all(len(label.text) == 1 for label in result.labels)
    assert result.recolored_area_mm2 == 0 and not result.merges
    assert len(result.mesh.cells) == len(source.geometry.mesh.cells)


def test_tight_region_merges_with_suitable_color_neighbor_without_changing_curves():
    colors = np.ones((15, 21), dtype=np.uint8)
    colors[:, 10] = 0
    colors[:, 11:] = 2
    source, settings, font, result = run(source_for(colors))
    assert len(result.merges) == 1
    assert result.merges[0].color_index == 1
    assert result.recolored_area_mm2 == pytest.approx(15)
    old = {e.id: e for e in source.geometry.mesh.edges}
    assert all(edge == old[edge.id] for edge in result.mesh.edges)
    assert min(result.areas_mm2) >= 5
    assert sum(result.areas_mm2) == pytest.approx(315)
    assert len(result.mesh.cells) == 2
    result.validate(source, settings)


def test_numbering_merge_absorbs_same_color_detail_chain_and_preserves_locked_neighbor(tmp_path):
    colors = np.ones((15, 21), dtype=np.uint8)
    colors[:, 10] = 0
    colors[:, 11:] = 2
    colors[3:8, 11:13] = 3
    colors[3:8, 13:15] = 4
    colors[3:8, 15:17] = 5
    source = source_for(colors)
    geometry = source.geometry
    details = {c.color_index: c.id for c in geometry.mesh.cells if c.color_index >= 3}
    cells = tuple(
        replace(
            c,
            color_index=0 if c.color_index == 5 else 1,
            prefilled=True,
            mergeable_prefilled=c.color_index in (3, 4),
        )
        if c.color_index >= 3
        else c
        for c in geometry.mesh.cells
    )
    source = replace(source, geometry=replace(geometry, mesh=replace(geometry.mesh, cells=cells)))
    path = tmp_path / "subdivision"
    save_input(path, source)
    source = SubdivisionReader().read(path)
    _, _, _, result = run(source)
    assert len(result.merges) == 1
    merged, lineage = next(
        (cell, lineage)
        for cell, lineage in zip(result.mesh.cells, result.source_cell_ids, strict=True)
        if cell.id == result.merges[0].result_cell_id
    )
    assert {details[3], details[4]} <= set(lineage)
    assert merged.color_index == 1 and not merged.prefilled
    assert any(label.cell_id == merged.id for label in result.labels)
    locked = next(c for c in cells if c.id == details[5])
    assert [c for c in result.mesh.cells if c.prefilled] == [locked]
    old_edges = {e.id: e for e in geometry.mesh.edges}
    assert all(edge == old_edges[edge.id] for edge in result.mesh.edges)


@pytest.mark.parametrize("mergeable", [True, False], ids=["stroke", "face"])
def test_printable_neighbor_absorbs_same_color_detail_and_keeps_contrast(mergeable):
    colors = np.zeros((20, 20), dtype=np.uint8)
    colors[3:5, 3:5] = 1
    colors[11:13, 11:13] = 2
    source = source_for(colors)
    geometry = source.geometry
    cells = tuple(
        replace(
            c,
            color_index=0 if c.color_index == 1 else 2,
            prefilled=True,
            mergeable_prefilled=mergeable,
        )
        if c.color_index
        else c
        for c in geometry.mesh.cells
    )
    source = replace(source, geometry=replace(geometry, mesh=replace(geometry.mesh, cells=cells)))
    _, _, _, result = run(source)
    assert result.initially_unplaced_ids == ()
    assert [c for c in result.mesh.cells if c.prefilled] == [cells[2]]
    assert (cells[0].id, cells[1].id) in result.source_cell_ids
    assert result.labels and result.recolored_area_mm2 == 0
    assert all(edge in geometry.mesh.edges for edge in result.mesh.edges)


def test_multiple_merges_finish_without_shrinking_font():
    colors = np.tile(np.asarray((0, 1, 0), dtype=np.uint8), (20, 1))
    source, settings, font, result = run(source_for(colors), font_size_pt=18)
    assert len(result.merges) == 2
    assert len(result.mesh.cells) == 1
    assert {label.font_size_pt for label in result.labels} == {18}
    assert sorted(i for ids in result.source_cell_ids for i in ids) == [0, 1, 2]


def test_minimum_area_is_not_a_minimum_width_requirement():
    source, settings, font, result = run(
        source_for(np.zeros((20, 1), dtype=np.uint8)), font_size_pt=3, padding_mm=0.05
    )
    assert not result.merges and result.areas_mm2 == pytest.approx((20,))
    assert result.labels


def test_impossible_uniform_text_size_fails_instead_of_missing_or_smaller_symbol():
    source = source_for(np.zeros((20, 1), dtype=np.uint8))
    with pytest.raises(StageError, match="не помещается"):
        AutomaticNumberingProcessor(ArialFont()).process(source, NumberingSettings())


def test_long_region_repeats_symbol_at_same_size():
    _, settings, _, result = run(source_for(np.zeros((10, 80), dtype=np.uint8)))
    assert len(result.labels) == 3 and sum(label.repeated for label in result.labels) == 2
    assert all(
        label.font_size_pt == settings.font_size_pt and label.text == "1" for label in result.labels
    )


def test_actual_glyph_avoids_hole():
    polygon = Polygon(
        ((0, 0), (10, 0), (10, 10), (0, 10)), holes=[((3, 3), (7, 3), (7, 7), (3, 7))]
    )
    placer = SymbolPlacer(ArialFont(), NumberingSettings(), 0.01)
    label = placer.fit(polygon, 0, "A")
    assert label is not None
    from mystery_coloring.numbering.adapters.placement import ink_geometry

    assert polygon.covers(ink_geometry(label.rings_mm).buffer(placer.margin))


def test_nested_holes_stay_valid_and_every_cell_has_symbol():
    colors = np.zeros((30, 30), dtype=np.uint8)
    colors[8:22, 8:22] = 1
    colors[12:18, 12:18] = 2
    source, settings, _, result = run(source_for(colors))
    validate_mesh(result.mesh, 30, 30, Shapes())
    assert {label.cell_id for label in result.labels} == {c.id for c in result.mesh.cells}
    assert sum(result.areas_mm2) == pytest.approx(900)
    assert len(result.mesh.cells) == 3


def test_physical_size_does_not_depend_on_working_resolution():
    _, _, _, small = run(source_for(np.zeros((20, 20), dtype=np.uint8)))
    _, _, _, large = run(source_for(np.zeros((200, 200), dtype=np.uint8), scale=0.1))
    assert large.areas_mm2 == pytest.approx(small.areas_mm2)
    assert large.labels[0].font_size_pt == small.labels[0].font_size_pt


def independent_svg_ink(data):
    tokens = re.findall(r"[MCZ]|-?\d+(?:\.\d+)?", data)
    index = 0
    points = []
    shape = Polygon()
    while index < len(tokens):
        op = tokens[index]
        index += 1
        if op == "M":
            start = np.asarray([float(tokens[index]), float(tokens[index + 1])])
            index += 2
            points = [start]
        elif op == "C":
            a, b, end = np.asarray([float(v) for v in tokens[index : index + 6]]).reshape(3, 2)
            index += 6
            for t in np.linspace(0, 1, 33)[1:]:
                points.append(
                    (1 - t) ** 3 * start
                    + 3 * (1 - t) ** 2 * t * a
                    + 3 * (1 - t) * t * t * b
                    + t**3 * end
                )
            start = end
        else:
            shape = shape.symmetric_difference(Polygon(points))
    return shape


def test_exported_paths_fit_regions_with_uniform_symbols_and_matching_legend(tmp_path):
    source, settings, font, result = run()
    output = tmp_path / "out"
    NumberingFileWriter(font).write(output, source, result, settings)
    root = ET.parse(output / "numbered.svg").getroot()
    ns = {"s": "http://www.w3.org/2000/svg"}
    assert not root.findall(".//s:text", ns) and not root.findall(".//s:image", ns)
    paths = root.findall('.//s:g[@id="labels"]/s:path', ns)
    assert len(paths) == len(result.labels)
    shapes = Shapes()
    edges = {e.id: e for e in result.mesh.edges}
    cells = {c.id: c for c in result.mesh.cells}
    for path in paths:
        region = scale_shape(
            shapes.polygon(cells[int(path.attrib["data-cell-id"])], edges),
            xfact=source.geometry.mm_per_unit,
            yfact=source.geometry.mm_per_unit,
            origin=(0, 0),
        )
        assert region.covers(
            independent_svg_ink(path.attrib["d"]).buffer(
                settings.padding_mm + settings.stroke_mm / 2
            )
        )
        assert float(path.attrib["data-font-size-pt"]) == 6
    legend = root.findall('.//s:g[@id="legend"]/s:path[@data-symbol]', ns)
    assert [p.attrib["data-symbol"] for p in legend] == ["1", "2", "3"]
    assert {float(p.attrib["data-font-size-pt"]) for p in legend} == {6}
    manifest = json.loads((output / "manifest.json").read_text())
    for name, digest in manifest["artifacts_sha256"].items():
        assert hashlib.sha256((output / name).read_bytes()).hexdigest() == digest
    quality = json.loads((output / "quality.json").read_text())
    assert quality["numbering_complete"] and quality["unlabeled_regions"] == 0
    assert quality["ai_required"] is False and quality["print_ready"] is False
    with pytest.raises(StageError):
        NumberingFileWriter(font).write(output, source, result, settings)


def test_writer_rejects_symbol_moved_outside_before_creating_directory(tmp_path):
    source, settings, font, result = run()
    from mystery_coloring.numbering.curves import place_glyphs

    label = result.labels[0]
    bad = replace(label, rings_mm=place_glyphs(font.glyphs("1"), (-10, -10), 6, 0))
    with pytest.raises(StageError):
        NumberingFileWriter(font).write(
            tmp_path / "bad", source, replace(result, labels=(bad,)), settings
        )
    assert not (tmp_path / "bad").exists()


@pytest.mark.parametrize("error_type", [RuntimeError, StageError])
def test_writer_cleans_partial_output_after_render_failure(tmp_path, monkeypatch, error_type):
    import mystery_coloring.numbering.adapters.writer as module

    source, settings, font, result = run()

    def fail(**kwargs):
        raise error_type("render failure")

    monkeypatch.setattr(module.resvg_py, "svg_to_bytes", fail)
    with pytest.raises(StageError):
        NumberingFileWriter(font).write(tmp_path / "bad", source, result, settings)
    assert not (tmp_path / "bad").exists()


def test_cli_runs_then_rejects_overwrite_and_corrupt_input(tmp_path, capsys):
    path = tmp_path / "in"
    save_input(path, source_for())
    args = [str(path), "--output", str(tmp_path / "out")]
    assert main(args) == 0 and main(args) == 2
    assert "уже существует" in capsys.readouterr().err
    (path / "geometry.json").write_text("{}")
    with pytest.raises(StageError, match="контрольная сумма"):
        SubdivisionReader().read(path)


def test_reader_rejects_more_than_35_colors(tmp_path):
    source = source_for(palette=tuple((i, i, i) for i in range(36)))
    path = tmp_path / "in"
    save_input(path, source)
    with pytest.raises(StageError, match="35 цветов"):
        SubdivisionReader().read(path)


@pytest.mark.parametrize(
    "kwargs",
    [
        {"font_size_pt": 0},
        {"font_size_pt": float("nan")},
        {"padding_mm": -1},
        {"repeat_distance_mm": 0},
        {"max_labels_per_region": 0},
    ],
)
def test_invalid_settings(kwargs):
    with pytest.raises(StageError):
        NumberingSettings(**kwargs)


@pytest.mark.parametrize("bad_size", [5, 7])
def test_application_never_publishes_mixed_size_symbols(bad_size):
    source, settings, _, result = run()

    class Reader:
        def read(self, _):
            return source

    class Processor:
        def process(self, *_):
            return replace(result, labels=(replace(result.labels[0], font_size_pt=bad_size),))

    class Writer:
        def write(self, *_):
            pytest.fail("invalid publication")

    with pytest.raises(StageError, match="размер"):
        NumberGeometry(Reader(), Processor(), Writer()).execute(
            NumberingRequest(Path("in"), Path("out"), settings)
        )


def test_all_35_symbols_have_valid_glyphs_and_fit_without_changing_size():
    colors = np.tile(np.repeat(np.arange(35, dtype=np.uint8), 3), (8, 1))
    source = source_for(colors, palette=tuple((i * 7, i * 7, i * 7) for i in range(35)))
    _, settings, _, result = run(source)
    assert not result.merges
    assert {label.text for label in result.labels} == set(SYMBOLS)
    assert all(label.font_size_pt == settings.font_size_pt for label in result.labels)
    assert all(label.angle_deg == 0 for label in result.labels)


def test_slanted_region_does_not_allow_rotation_to_make_a_symbol_fit():
    from mystery_coloring.numbering.adapters.placement import ink_geometry
    from mystery_coloring.numbering.curves import place_glyphs

    font = ArialFont()
    placer = SymbolPlacer(font, NumberingSettings(), 0.01)
    polygon = rotate(box(-0.55, -3, 0.55, 3), 30, origin=(0, 0))
    rotated = place_glyphs(font.glyphs("1"), (0, 0), 6, 30)
    assert polygon.covers(ink_geometry(rotated).buffer(placer.margin))
    assert placer.fit(polygon, 0, "1") is None


def test_primary_and_repeated_symbols_stay_horizontal_in_slanted_region():
    placer = SymbolPlacer(ArialFont(), NumberingSettings(), 0.01)
    polygon = rotate(box(-25, -5, 25, 5), 25, origin=(0, 0))
    primary = placer.fit(polygon, 1, "A")
    assert primary is not None
    labels = placer.repetitions(polygon, primary)
    assert any(label.repeated for label in labels)
    assert {label.angle_deg for label in labels} == {0}


@pytest.mark.parametrize("angle", [-30, 15, 90])
def test_result_rejects_rotated_symbol(angle):
    source, settings, _, result = run()
    bad = replace(result.labels[0], angle_deg=angle)
    with pytest.raises(StageError, match="горизонтальными"):
        replace(result, labels=(bad, *result.labels[1:])).validate(source, settings)


def test_writer_rejects_rotated_ink_even_when_angle_metadata_says_zero(tmp_path):
    from mystery_coloring.numbering.curves import place_glyphs

    source, settings, font, result = run()
    label = result.labels[0]
    bad = replace(
        label,
        rings_mm=place_glyphs(font.glyphs(label.text), label.center_mm, settings.font_size_pt, 15),
    )
    assert bad.angle_deg == 0
    with pytest.raises(StageError, match="горизонтального глифа"):
        NumberingFileWriter(font).write(
            tmp_path / "bad", source, replace(result, labels=(bad, *result.labels[1:])), settings
        )
    assert not (tmp_path / "bad").exists()


@pytest.mark.parametrize("version", [1, 2, 3, 4])
def test_legacy_rotated_hints_are_rechecked_but_new_versions_require_horizontal_hints(
    tmp_path, version
):
    path = tmp_path / "input"
    save_input(path, source_for())
    spaces = {
        "regions": [
            {
                "cell_id": 0,
                "text": "1",
                "width_mm": 0.56,
                "height_mm": 1.52,
                "center": [10, 10],
                "angle": 90,
            }
        ]
    }
    data = json.dumps(spaces).encode()
    (path / "label-spaces.json").write_bytes(data)
    manifest = json.loads((path / "manifest.json").read_text())
    manifest["algorithm"] = f"shared-cubic-subdivision-v{version}"
    manifest["artifacts_sha256"]["label-spaces.json"] = hashlib.sha256(data).hexdigest()
    (path / "manifest.json").write_text(json.dumps(manifest))
    if version >= 3:
        with pytest.raises(StageError, match="горизонтальным"):
            SubdivisionReader().read(path)
    else:
        _, _, _, result = run(SubdivisionReader().read(path))
        assert {label.angle_deg for label in result.labels} == {0}
