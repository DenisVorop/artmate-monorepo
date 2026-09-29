"""Регрессия: тот же рисунок без промежуточных файлов, безопасное сохранение."""

import hashlib
import json
from pathlib import Path

import pytest
from PIL import Image, ImageDraw

from mystery_coloring.delivery.adapters.store import FinalPageStore
from mystery_coloring.delivery.application import GenerateRequest
from mystery_coloring.delivery.cli import build_generator, main
from mystery_coloring.delivery.domain import RenderedPage
from mystery_coloring.domain import StageError
from mystery_coloring.layout.application import PreparePagesRequest
from mystery_coloring.layout.cli import build_layout
from mystery_coloring.layout.domain import LayoutSettings


@pytest.mark.parametrize("white_only", [False, True])
@pytest.mark.parametrize("landscape", [False, True])
def test_delivery_matches_diagnostic_pipeline_exactly(tmp_path, monkeypatch, white_only, landscape):
    image = Image.new("RGB", (80, 64) if landscape else (64, 80), "white")
    if not white_only:
        draw = ImageDraw.Draw(image)
        draw.ellipse((5, 6, 56, 73), fill="#1862aa")
        draw.ellipse((18, 27, 44, 55), fill="#de5637")
    source = tmp_path / "input.png"
    image.save(source)
    settings = LayoutSettings(colors=3, min_area_mm2=500, start_page=25)
    diagnostic = tmp_path / "diagnostic"
    build_layout().execute(PreparePagesRequest((source,), diagnostic, settings))
    baseline = diagnostic / "page-025" / "04-numbering"

    def no_diagnostics(*args, **kwargs):
        pytest.fail("Production path invoked a diagnostic writer")

    from mystery_coloring.adapters.artifact_writer import FileResultWriter
    from mystery_coloring.geometry.adapters.writer import GeometryFileWriter
    from mystery_coloring.numbering.adapters.writer import NumberingFileWriter
    from mystery_coloring.subdivision.adapters.writer import SubdivisionFileWriter

    for writer in (
        FileResultWriter,
        GeometryFileWriter,
        SubdivisionFileWriter,
        NumberingFileWriter,
    ):
        monkeypatch.setattr(writer, "write", no_diagnostics)
    output = tmp_path / "final"
    report = build_generator().execute(GenerateRequest(source, output, settings))
    assert {p.name for p in output.iterdir()} == {
        "page.svg",
        "colored-page.svg",
        "page.png",
        "colored-page.png",
        "result.json",
        "manifest.json",
    }
    for name in ("page.svg", "colored-page.svg", "page.png", "colored-page.png"):
        assert (output / name).read_bytes() == (baseline / name).read_bytes(), name
    assert json.loads((output / "result.json").read_text())["quality"] == json.loads(
        (baseline / "page-quality.json").read_text()
    )
    manifest = json.loads((output / "manifest.json").read_text())
    assert manifest["complete"]
    assert manifest["artifact_bytes"] == sum(
        (output / n).stat().st_size for n in manifest["artifacts_sha256"]
    )
    for name, digest in manifest["artifacts_sha256"].items():
        assert hashlib.sha256((output / name).read_bytes()).hexdigest() == digest
    assert report["source"]["sha256"] == hashlib.sha256(source.read_bytes()).hexdigest()
    assert report["quality"]["font_size_css_px"] == 5.16
    assert report["quality"]["scheme_ink"] == "#898989"
    assert report["quality"]["missing_required_labels"] == 0
    if white_only:
        assert report["quality"]["labels"] == report["quality"]["palette_colors"] == 0


def sample_page():
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'
    return RenderedPage(svg, svg, {"algorithm": "test"})


def test_no_preview_does_not_render_png(tmp_path, monkeypatch):
    from mystery_coloring.delivery.adapters import store

    def unexpected(**kwargs):
        pytest.fail("PNG rendering was not requested")

    monkeypatch.setattr(store.resvg_py, "svg_to_bytes", unexpected)
    output = tmp_path / "final"
    FinalPageStore().write(output, sample_page(), False)
    assert {p.name for p in output.iterdir()} == {
        "page.svg",
        "colored-page.svg",
        "result.json",
        "manifest.json",
    }


@pytest.mark.parametrize(
    "error", [OSError("disk full"), RuntimeError("renderer"), KeyboardInterrupt()]
)
def test_failure_removes_only_current_output(tmp_path, monkeypatch, error):
    from mystery_coloring.delivery.adapters import store

    def fail(**kwargs):
        raise error

    monkeypatch.setattr(store.resvg_py, "svg_to_bytes", fail)
    sibling = tmp_path / "keep.txt"
    sibling.write_text("keep")
    output = tmp_path / "failed"
    with pytest.raises(KeyboardInterrupt if isinstance(error, KeyboardInterrupt) else StageError):
        FinalPageStore().write(output, sample_page(), True)
    assert not output.exists()
    assert sibling.read_text() == "keep"


def test_storage_budget_failure_cleans_partial_files(tmp_path):
    page = sample_page()
    # Первое SVG успевает сохраниться; второе пересекает бюджет.
    output = tmp_path / "oversized"
    with pytest.raises(StageError, match="объём"):
        FinalPageStore(max_output_bytes=len(page.outline_svg.encode()) + 1).write(
            output, page, False
        )
    assert not output.exists()


def test_manifest_write_failure_cleans_directory(tmp_path, monkeypatch):
    original = Path.write_bytes

    def write(path, data):
        if path.name == "manifest.json":
            raise OSError("disk full")
        return original(path, data)

    monkeypatch.setattr(Path, "write_bytes", write)
    with pytest.raises(StageError):
        FinalPageStore().write(tmp_path / "final", sample_page(), False)
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize("kind", ["directory", "file", "dangling_symlink"])
def test_existing_destination_is_preserved_before_processing(tmp_path, kind):
    output = tmp_path / "existing"
    if kind == "directory":
        output.mkdir()
    elif kind == "file":
        output.write_text("keep")
    else:
        output.symlink_to(tmp_path / "absent")
    with pytest.raises(StageError, match="уже существует"):
        build_generator().execute(GenerateRequest(tmp_path / "missing.png", output))
    assert output.exists() or output.is_symlink()
    if kind == "file":
        assert output.read_text() == "keep"


def test_invalid_cli_settings_do_not_create_output(tmp_path):
    output = tmp_path / "unused"
    assert main([str(tmp_path / "missing"), "--output", str(output), "--colors", "36"]) == 2
    assert not output.exists()


def test_invalid_source_leaves_no_output(tmp_path):
    source = tmp_path / "bad.png"
    source.write_bytes(b"invalid image")
    with pytest.raises(StageError):
        build_generator().execute(GenerateRequest(source, tmp_path / "final"))
    assert list(tmp_path.iterdir()) == [source]


def test_cli_independent_parameters_and_no_preview(tmp_path):
    source = tmp_path / "white.png"
    Image.new("RGB", (20, 30), "white").save(source)
    output = tmp_path / "final"
    assert (
        main(
            [
                str(source),
                "--output",
                str(output),
                "--colors",
                "19",
                "--min-area-mm2",
                "3.5",
                "--font-size-px",
                "6",
                "--page-number",
                "25",
                "--no-preview",
            ]
        )
        == 0
    )
    report = json.loads((output / "result.json").read_text())
    assert report["settings"] == {
        "colors": 19,
        "min_area_mm2": 3.5,
        "font_size_pt": 4.5,
        "start_page": 25,
        "artificial_grid": True,
    }
    assert not list(output.glob("*.png"))
