import hashlib
import json
import subprocess
import sys

import numpy as np
import pytest
from PIL import Image

from mystery_coloring.cli import main as simplify
from mystery_coloring.regions.adapters.writer import RegionFileWriter
from mystery_coloring.regions.cli import main


def stage_one(tmp_path):
    image = Image.new("RGB", (7, 7), (90, 90, 90))
    image.putpixel((3, 3), (100, 100, 100))
    path = tmp_path / "source.png"
    image.save(path)
    output = tmp_path / "stage1"
    assert (
        simplify([str(path), "--output", str(output), "--colors", "2", "--smoothing", "none"]) == 0
    )
    return output


def test_second_stage_artifacts_reconstruct_pixels_and_preserve_source(tmp_path):
    source = stage_one(tmp_path)
    before = {p.name: p.read_bytes() for p in source.iterdir()}
    output = tmp_path / "stage2"
    assert (
        main([str(source), "--output", str(output), "--image-width-mm", "7", "--min-area-mm2", "2"])
        == 0
    )
    manifest = json.loads((output / "manifest.json").read_text())
    assert manifest["source_manifest_sha256"] == hashlib.sha256(before["manifest.json"]).hexdigest()
    for name, checksum in manifest["artifacts_sha256"].items():
        assert hashlib.sha256((output / name).read_bytes()).hexdigest() == checksum
    labels = np.load(output / "region-map.npy", allow_pickle=False)
    assert labels.dtype == np.dtype("<u4")
    metadata = json.loads((output / "regions.json").read_text())
    palette = json.loads((output / "palette.json").read_text())["colors"]
    with Image.open(output / "color-map.png") as image:
        color_map = np.array(image)
    np.testing.assert_array_equal(
        color_map, np.array([r["color_index"] for r in metadata["regions"]])[labels]
    )
    with Image.open(output / "cleaned.png") as image:
        np.testing.assert_array_equal(
            np.array(image), np.array([p["rgb"] for p in palette])[color_map]
        )
    assert sum(p["pixel_count"] for p in palette) == 49
    quality = json.loads((output / "quality.json").read_text())
    assert quality["initial_regions"] == 2
    assert quality["final_regions"] == 1
    assert quality["changed_pixels"] == 1
    assert not quality["print_ready"]
    assert before == {p.name: p.read_bytes() for p in source.iterdir()}


@pytest.mark.parametrize("name", ["palette.json", "color-map.png", "simplified.png"])
def test_modified_stage_one_artifact_is_rejected(tmp_path, name, capsys):
    source = stage_one(tmp_path)
    with (source / name).open("ab") as file:
        file.write(b"modified")
    output = tmp_path / "stage2"
    assert main([str(source), "--output", str(output)]) == 2
    assert "Контрольная сумма" in capsys.readouterr().err
    assert not output.exists()


@pytest.mark.parametrize(
    "options",
    [
        ["--image-width-mm", "0"],
        ["--min-area-mm2", "-1"],
        ["--max-color-distance", "nan"],
        ["--image-width-mm", "inf"],
    ],
)
def test_invalid_settings_do_not_write(tmp_path, options):
    output = tmp_path / "result"
    assert main(["missing", "--output", str(output), *options]) == 2
    assert not output.exists()


def test_existing_output_is_not_touched(tmp_path):
    marker = tmp_path / "keep.txt"
    marker.write_text("keep")
    assert main(["missing", "--output", str(tmp_path)]) == 2
    assert marker.read_text() == "keep"


def test_failed_region_export_removes_partial_output(tmp_path, monkeypatch):
    source = stage_one(tmp_path)
    output = tmp_path / "stage2"

    def fail(destination, *_):
        (destination / "partial").write_bytes(b"partial")
        raise OSError("disk full")

    monkeypatch.setattr(RegionFileWriter, "_save", staticmethod(fail))
    assert main([str(source), "--output", str(output)]) == 2
    assert not output.exists()


def test_regions_module_entrypoint(tmp_path):
    process = subprocess.run(
        [
            sys.executable,
            "-m",
            "mystery_coloring.regions",
            "missing",
            "--output",
            str(tmp_path / "x"),
        ],
        capture_output=True,
        text=True,
    )
    assert process.returncode == 2
    assert "Не удалось прочитать" in process.stderr
    assert "Traceback" not in process.stderr
