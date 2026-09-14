import hashlib
import json
import subprocess
import sys

import numpy as np
import pytest
from PIL import Image

from mystery_coloring.adapters.artifact_writer import FileResultWriter
from mystery_coloring.cli import main


def test_cli_writes_consistent_artifacts(tmp_path):
    source = tmp_path / "source.png"
    array = np.random.default_rng(2).integers(0, 256, (15, 20, 3), dtype=np.uint8)
    Image.fromarray(array).save(source)
    output = tmp_path / "result"
    assert main([str(source), "--output", str(output), "--colors", "8"]) == 0
    manifest = json.loads((output / "manifest.json").read_text())
    assert manifest["settings"]["colors"] == 8
    assert manifest["working_size"] == [20, 15]
    assert manifest["source_sha256"] == hashlib.sha256(source.read_bytes()).hexdigest()
    for name, checksum in manifest["artifacts_sha256"].items():
        assert hashlib.sha256((output / name).read_bytes()).hexdigest() == checksum
    palette = json.loads((output / "palette.json").read_text())["colors"]
    with Image.open(output / "color-map.png") as image:
        indices = np.array(image)
    with Image.open(output / "simplified.png") as image:
        rgb = np.array(image)
    np.testing.assert_array_equal(rgb, np.array([c["rgb"] for c in palette])[indices])
    assert sum(color["pixel_count"] for color in palette) == 300
    assert set(p.name for p in output.iterdir()) == {
        "normalized.png",
        "simplified.png",
        "comparison.png",
        "palette.png",
        "palette.json",
        "color-map.png",
        "manifest.json",
    }


def test_existing_directory_is_not_modified(tmp_path, capsys):
    marker = tmp_path / "keep.txt"
    marker.write_text("keep me")
    assert main(["missing.png", "--output", str(tmp_path)]) == 2
    assert marker.read_text() == "keep me"
    assert "уже существует" in capsys.readouterr().err


@pytest.mark.parametrize(
    "options",
    [
        ["--colors", "1"],
        ["--colors", "257"],
        ["--max-size", "0"],
        ["--seed", "-1"],
        ["--sample-size", "2"],
    ],
)
def test_invalid_settings_do_not_create_output(tmp_path, options):
    output = tmp_path / "result"
    assert main(["missing.png", "--output", str(output), *options]) == 2
    assert not output.exists()


def test_failed_export_removes_partial_directory(tmp_path, monkeypatch):
    source = tmp_path / "source.png"
    Image.new("RGB", (5, 5), "red").save(source)
    output = tmp_path / "result"

    def failing_save(destination, *_):
        (destination / "partial.png").write_bytes(b"partial")
        raise OSError("disk full")

    monkeypatch.setattr(FileResultWriter, "_save", staticmethod(failing_save))
    assert main([str(source), "--output", str(output)]) == 2
    assert not output.exists()


def test_python_module_entrypoint_reports_missing_input(tmp_path):
    process = subprocess.run(
        [sys.executable, "-m", "mystery_coloring", "missing.png", "--output", str(tmp_path / "x")],
        capture_output=True,
        text=True,
    )
    assert process.returncode == 2
    assert "Не удалось прочитать" in process.stderr
    assert "Traceback" not in process.stderr
