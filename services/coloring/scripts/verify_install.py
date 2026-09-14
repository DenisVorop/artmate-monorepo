"""Smoke test installed wheel outside src; font, assets and real generation."""

import json
import tempfile
from importlib.metadata import version
from pathlib import Path

from PIL import Image

import mystery_coloring
from mystery_coloring.delivery.application import GenerateRequest
from mystery_coloring.delivery.cli import build_generator
from mystery_coloring.details.adapters.model_assets import model_paths
from mystery_coloring.typography.adapters.font import ArialFont

source_tree = Path(__file__).resolve().parents[1] / "src"
assert not Path(mystery_coloring.__file__).resolve().is_relative_to(source_tree)
assert version("mystery-coloring") == "0.4.0"
assert set(model_paths()) == {"yolov3", "hrnetv2"}
assert ArialFont().sha256 == "1af5961bd42da9f07a60d977e8d7915bc961537d3d3c2cf9cca1990b08706b2a"
with tempfile.TemporaryDirectory(prefix="coloring-package-check-") as directory:
    root = Path(directory)
    source = root / "source.png"
    Image.new("RGB", (20, 30), "white").save(source)
    output = root / "result"
    report = build_generator().execute(GenerateRequest(source, output, previews=False))
    assert report["quality"]["passed"]
    assert report["quality"]["missing_required_labels"] == 0
    assert json.loads((output / "manifest.json").read_text())["complete"]
    assert len(list(output.iterdir())) == 4
print("Installed package, bundled ArialMT and page generation: OK")
