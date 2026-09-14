"""Белый бумаги: пустые цельные области, последовательная легенда и строгая приёмка."""

import hashlib
import json
from dataclasses import replace
from xml.etree import ElementTree as ET

import numpy as np
import pytest
from PIL import Image
from test_numbering import run, save_input, source_for
from test_subdivision import rectangle, split

from mystery_coloring.domain import StageError
from mystery_coloring.layout.adapters.numbers import SVG, ReferenceNumbers
from mystery_coloring.layout.adapters.quality import check_page
from mystery_coloring.layout.adapters.svg import page_document
from mystery_coloring.layout.cli import main as layout_main
from mystery_coloring.layout.domain import ArtMateTemplate
from mystery_coloring.numbering.adapters.reader import SubdivisionReader
from mystery_coloring.numbering.adapters.writer import NumberingFileWriter
from mystery_coloring.palette import is_paper_white, palette_order
from mystery_coloring.subdivision.adapters.processor import CurvedSubdivisionProcessor
from mystery_coloring.subdivision.adapters.writer import SubdivisionFileWriter
from mystery_coloring.subdivision.domain import SubdivisionSettings
from mystery_coloring.typography.adapters.font import ArialFont
from mystery_coloring.typography.domain import palette_symbols


@pytest.mark.parametrize(
    "rgb", [(255, 255, 255), (250, 251, 250), (248, 246, 244), (255, 249, 240)]
)
def test_white_and_near_white_are_paper(rgb):
    assert is_paper_white(rgb)


@pytest.mark.parametrize(
    "rgb",
    [
        (0, 0, 0),
        (239, 239, 239),
        (164, 186, 200),
        (165, 191, 169),
        (231, 185, 157),
        (246, 209, 18),
        (255, 255, 210),
        (224, 248, 255),
    ],
)
def test_gray_and_light_colored_pastels_keep_symbols(rgb):
    assert not is_paper_white(rgb)


def test_multiple_whites_do_not_consume_ordinals_even_inside_legacy_palette():
    palette = ((255, 255, 255), (20, 20, 20), (250, 251, 250), (200, 30, 30))
    assert palette_symbols(palette) == (None, "1", None, "2")
    ordered = tuple(palette[i] for i in palette_order(palette))
    assert tuple(s for s in palette_symbols(ordered) if s is not None) == ("1", "2")


@pytest.mark.parametrize("dimensions", [(80, 1), (60, 60)])
def test_white_region_is_neither_split_nor_repaired_for_text(dimensions):
    geo = replace(rectangle(*dimensions), palette=((250, 251, 250),))
    _, settings, result = split(geo)
    assert result.mesh == geo.mesh
    assert result.split_count == 0
    assert not result.unresolved_large_ids and not result.stop_reasons
    assert all(s.text is None and s.center is None for s in result.label_spaces)
    result.validate(settings)
    source, number_settings, _, numbered = run(
        source_for(np.zeros(tuple(reversed(dimensions)), dtype=np.uint8), palette=geo.palette)
    )
    assert numbered.mesh == source.geometry.mesh and not numbered.labels
    assert not numbered.merges and not numbered.initially_unplaced_ids
    numbered.validate(source, number_settings)


def test_only_colored_neighbors_are_split_around_a_white_hole():
    pixels = np.zeros((50, 50), dtype=np.uint8)
    pixels[10:40, 10:40] = 1
    geo = source_for(pixels, palette=((30, 90, 150), (250, 251, 250))).geometry
    result = CurvedSubdivisionProcessor(ArialFont()).process(geo, SubdivisionSettings())
    white = next(c for c in geo.mesh.cells if c.color_index == 1)
    assert [c.id for c in result.mesh.cells if c.color_index == 1] == [white.id]
    assert result.split_count > 0
    assert next(
        a for c, a in zip(result.mesh.cells, result.areas_mm2, strict=True) if c.id == white.id
    ) == pytest.approx(900)
    assert white.id not in result.unresolved_large_ids


def test_tight_white_stripe_does_not_trigger_neighbor_merging():
    pixels = np.zeros((20, 21), dtype=np.uint8)
    pixels[:, 10] = 1
    source, settings, _, result = run(source_for(pixels, palette=((40, 50, 60), (250, 251, 250))))
    assert not result.merges and not result.initially_unplaced_ids
    assert result.mesh == source.geometry.mesh
    white_ids = result.paper_white_cell_ids(source)
    assert len(white_ids) == 1
    assert all(label.cell_id not in white_ids and label.text == "1" for label in result.labels)
    result.validate(source, settings)
    # A missing colored label still invalidates the result.
    omitted = result.labels[0].cell_id
    with pytest.raises(StageError, match="подписаны"):
        replace(
            result, labels=tuple(label for label in result.labels if label.cell_id != omitted)
        ).validate(source, settings)
    # A white label is not silently accepted as optional decoration.
    with pytest.raises(StageError, match="подписаны"):
        replace(
            result, labels=(*result.labels, replace(result.labels[0], cell_id=white_ids[0]))
        ).validate(source, settings)


def test_colored_tight_region_can_be_repaired_into_white_without_inventing_a_label():
    pixels = np.ones((20, 21), dtype=np.uint8)
    pixels[:, 10] = 0
    _, _, _, result = run(source_for(pixels, palette=((230, 230, 230), (250, 251, 250))))
    assert result.merges and result.initially_unplaced_ids
    assert not result.labels
    assert all(c.color_index == 1 for c in result.mesh.cells)


def test_writer_and_page_accept_all_white_with_no_glyphs_or_legend(tmp_path):
    template = ArtMateTemplate()
    artwork = template.fit(20, 20)
    source, settings, font, result = run(
        source_for(scale=artwork.width / 20, palette=((250, 251, 250),))
    )
    destination = tmp_path / "numbered"
    NumberingFileWriter(font).write(destination, source, result, settings)
    quality = json.loads((destination / "quality.json").read_text())
    assert quality["numbering_complete"]
    assert quality["unlabeled_regions"] == quality["paper_white_regions"] == 1
    assert quality["missing_required_labels"] == quality["label_count"] == 0
    assert quality["label_angles_deg"] == []
    palette = json.loads((destination / "palette.json").read_text())["colors"]
    assert palette[0]["symbol"] is None and not palette[0]["label_required"]
    case = source, result, settings, font, template, artwork, 1, ReferenceNumbers()
    svg = page_document(*case)
    report = check_page(svg, *case)
    assert report["palette_colors"] == report["labels"] == 0
    assert report["palette_symbols"] == [] and report["min_label_clearance_mm"] is None
    root = ET.fromstring(svg)
    assert len(root.find(f"{SVG}g[@id='palette']")) == 0
    assert root.findall(f".//{SVG}g[@id='contours']/{SVG}path")
    for name in ("numbered.svg", "legend.svg"):
        doc = ET.parse(destination / name)
        assert not doc.findall(f".//{SVG}path[@data-symbol]")


def test_white_subdivision_v4_roundtrip_and_invalid_omission_rejected(tmp_path):
    source = replace(rectangle(), palette=((250, 251, 250),))
    _, settings, result = split(source)
    destination = tmp_path / "subdivision"
    SubdivisionFileWriter(ArialFont()).write(destination, source, result, settings)
    diagnostics = ET.parse(destination / "label-spaces.svg")
    assert not diagnostics.findall(f".//{SVG}path[@fill='#e34747']")
    assert not diagnostics.findall(f".//{SVG}rect[@fill='#229c68']")
    restored = SubdivisionReader().read(destination)
    assert restored.hints == result.label_spaces
    report = json.loads((destination / "quality.json").read_text())
    assert report["paper_white_region_ids"] == [0]
    assert report["label_position_not_found_ids"] == []
    bad_source = replace(source, palette=((50, 50, 50),))
    with pytest.raises(StageError, match="символам палитры"):
        SubdivisionFileWriter(ArialFont()).write(tmp_path / "bad", bad_source, result, settings)
    assert not (tmp_path / "bad").exists()


def test_legacy_white_hint_is_ignored_and_colored_symbol_is_reassigned(tmp_path):
    pixels = np.zeros((20, 20), dtype=np.uint8)
    pixels[:, 10:] = 1
    source = source_for(pixels, palette=((255, 255, 255), (40, 40, 40)))
    save_input(tmp_path / "legacy", source)
    loaded = SubdivisionReader().read(tmp_path / "legacy")
    _, _, _, result = run(loaded)
    assert {label.text for label in result.labels} == {"1"}
    assert all(
        c.color_index == 1
        for c in result.mesh.cells
        if c.id in {label.cell_id for label in result.labels}
    )


def test_all_white_full_pipeline_keeps_one_empty_region(tmp_path):
    source = tmp_path / "white.png"
    Image.new("RGB", (40, 60), (250, 251, 250)).save(source)
    output = tmp_path / "pages"
    assert layout_main([str(source), "--output", str(output), "--colors", "19"]) == 0
    base = output / "page-001"
    quality = json.loads((base / "04-numbering/page-quality.json").read_text())
    assert quality["passed"] and quality["regions"] == quality["paper_white_regions"] == 1
    assert quality["labels"] == quality["palette_colors"] == quality["missing_required_labels"] == 0
    subdivision = json.loads((base / "03-subdivision/quality.json").read_text())
    assert subdivision["accepted_splits"] == 0 and not subdivision["unresolved_large_ids"]
    for manifest_path in output.rglob("manifest.json"):
        manifest = json.loads(manifest_path.read_text())
        for name, digest in manifest["artifacts_sha256"].items():
            assert hashlib.sha256((manifest_path.parent / name).read_bytes()).hexdigest() == digest
