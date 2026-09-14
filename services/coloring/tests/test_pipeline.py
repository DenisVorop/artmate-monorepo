"""Настройки сквозного запуска, настоящий Arial и сохранение физических ограничений."""

import hashlib
import json
import math
from dataclasses import asdict
from pathlib import Path

import pytest
from PIL import Image, ImageDraw

from mystery_coloring.domain import StageError
from mystery_coloring.pipeline.adapters.configuration import load_settings
from mystery_coloring.pipeline.adapters.store import FilePipelineStore
from mystery_coloring.pipeline.application import GenerateColoring, PipelineRequest
from mystery_coloring.pipeline.cli import main
from mystery_coloring.pipeline.domain import PipelineSettings
from mystery_coloring.subdivision.adapters.labels import LabelFitter
from mystery_coloring.subdivision.domain import SubdivisionSettings
from mystery_coloring.typography.adapters.font import ArialFont
from mystery_coloring.typography.domain import SYMBOLS


def test_requested_arial_file_is_used_for_exact_glyphs_and_subdivision(tmp_path, monkeypatch):
    # Работает и при запуске вне каталога проекта; нет подмены системным шрифтом.
    monkeypatch.chdir(tmp_path)
    font = ArialFont()
    assert font.name == "ArialMT"
    assert font.sha256 == "1af5961bd42da9f07a60d977e8d7915bc961537d3d3c2cf9cca1990b08706b2a"
    from shapely import box

    fitter = LabelFitter(SubdivisionSettings(label_font_size_pt=9), 1, font, tuple(SYMBOLS))
    for i, char in enumerate(SYMBOLS):
        run = font.glyphs(char)
        assert run.rings and run.text == char
        space = fitter.fit(box(0, 0, 20, 20), i, i)
        assert space.text == char
        x0, y0, x1, y1 = run.bounds
        assert space.width_mm == pytest.approx((x1 - x0) * 9 * 25.4 / 72)
        assert space.height_mm == pytest.approx((y1 - y0) * 9 * 25.4 / 72)


def test_missing_or_wrong_arial_fails_without_font_substitution(tmp_path, monkeypatch):
    from mystery_coloring.typography.adapters import font as adapter

    monkeypatch.setattr(adapter, "files", lambda package: tmp_path)
    with pytest.raises(StageError, match="ArialMT"):
        ArialFont()
    target = tmp_path / "fonts/Arial/arialmt.ttf"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"not a font")
    with pytest.raises(StageError, match="ArialMT"):
        ArialFont()


def test_json_and_cli_override_defaults_with_validation(tmp_path):
    config = tmp_path / "options.json"
    config.write_text(json.dumps({"colors": 32, "min_area_mm2": 1.5, "font_size_pt": 4}))
    settings = load_settings(config, {"colors": 16, "font_size_pt": None})
    assert asdict(settings) == {
        "colors": 16,
        "min_area_mm2": 1.5,
        "font_size_pt": 4,
        "image_width_mm": 180,
    }
    assert settings.geometry().min_area_mm2 == settings.subdivision().min_area_mm2 == 1.5
    assert settings.numbering().min_area_mm2 == 1.5
    assert settings.subdivision().label_font_size_pt == settings.numbering().font_size_pt == 4


@pytest.mark.parametrize(
    "value",
    [
        {"colors": 36},
        {"colors": 1},
        {"colors": 3.5},
        {"colors": True},
        {"min_area_mm2": 0},
        {"min_area_mm2": "1"},
        {"min_area_mm2": None},
        {"min_area_mm2": math.inf},
        {"font_size_pt": math.nan},
        {"font_size_pt": 2},
        {"font_size_pt": False},
        {"image_width_mm": 0},
    ],
)
def test_invalid_settings_are_rejected_before_work(value):
    with pytest.raises(StageError):
        PipelineSettings(**value)


@pytest.mark.parametrize("content", ["[]", '{"colours": 20}', '{"colors": 24, "colors": 12}', "{"])
def test_invalid_json_or_unknown_options_are_not_ignored(tmp_path, content):
    path = tmp_path / "bad.json"
    path.write_text(content)
    with pytest.raises(StageError):
        load_settings(path, {})


def test_large_minimum_remains_consistent_with_subdivision_target():
    settings = PipelineSettings(min_area_mm2=100)
    assert settings.subdivision().target_area_mm2 == 200
    assert settings.geometry().min_area_mm2 == settings.numbering().min_area_mm2 == 100


@pytest.mark.parametrize("options", [(2, 5, 6), (4, 1, 3)])
def test_full_pipeline_applies_settings_to_every_stage_and_export(tmp_path, options):
    colors, area, size = options
    image = Image.new("RGB", (96, 64), "#ffffff")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 32, 95, 63), fill="#005533")
    draw.rectangle((10, 10, 14, 14), fill="#ff3300")
    draw.rectangle((48, 0, 95, 30), fill="#0033ff")
    source = tmp_path / "source.png"
    image.save(source)
    output = tmp_path / "output"
    config = tmp_path / "settings.json"
    config.write_text(
        json.dumps(
            {"colors": colors, "min_area_mm2": area, "font_size_pt": size, "image_width_mm": 48}
        )
    )
    assert main([str(source), "--output", str(output), "--config", str(config)]) == 0
    root = json.loads((output / "manifest.json").read_text())
    assert root["result"]["colors_used"] == colors
    assert root["result"]["font_name"] == "ArialMT"
    for file, digest in root["artifacts_sha256"].items():
        assert hashlib.sha256((output / file).read_bytes()).hexdigest() == digest
    for directory in ("02-geometry", "03-subdivision", "04-numbering"):
        stage = json.loads((output / directory / "manifest.json").read_text())
        assert stage["settings"]["min_area_mm2"] == area
    split = json.loads((output / "03-subdivision/label-spaces.json").read_text())
    labels = json.loads((output / "04-numbering/labels.json").read_text())
    assert split["font"] == labels["font_name"] == "ArialMT"
    assert split["font_sha256"] == labels["font_sha256"] == ArialFont().sha256
    assert split["font_size_pt"] == labels["uniform_font_size_pt"] == size
    import xml.etree.ElementTree as ET

    svg = ET.parse(output / "04-numbering/numbered.svg")
    paths = [item for item in svg.iter() if "data-font-size-pt" in item.attrib]
    assert paths and {float(item.attrib["data-font-size-pt"]) for item in paths} == {size}
    quality = json.loads((output / "04-numbering/quality.json").read_text())
    assert quality["actual_min_area_mm2"] >= area and quality["missing_required_labels"] == 0
    assert quality["unlabeled_regions"] == quality["paper_white_regions"]
    sentinel = output / "keep.txt"
    sentinel.write_text("keep")
    assert main([str(source), "--output", str(output)]) == 2
    assert sentinel.read_text() == "keep"


def test_failed_stage_removes_only_its_own_run(tmp_path):
    class FailingStage:
        def execute(self, request):
            request.destination.mkdir()
            (request.destination / "partial").write_text("incomplete")
            raise StageError("test failure")

    stage = FailingStage()
    case = GenerateColoring(stage, stage, stage, stage, FilePipelineStore())
    output = tmp_path / "run"
    with pytest.raises(StageError, match="test failure"):
        case.execute(PipelineRequest(Path("source"), output, PipelineSettings()))
    assert not output.exists()
    output.mkdir()
    keep = output / "keep"
    keep.write_text("user data")
    with pytest.raises(StageError):
        case.execute(PipelineRequest(Path("source"), output, PipelineSettings()))
    assert keep.read_text() == "user data"


def test_cli_invalid_configuration_does_not_create_outputs(tmp_path):
    destination = tmp_path / "output"
    assert main(["missing.png", "--output", str(destination), "--colors", "36"]) == 2
    assert not destination.exists()
