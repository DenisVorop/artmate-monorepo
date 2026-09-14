"""Face hints are selective, bounded, offline, and optional for other subjects."""

import json
import os
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest

from mystery_coloring.details.adapters.detector import ContrastDetailDetector
from mystery_coloring.details.adapters.faces import analyze_faces
from mystery_coloring.details.adapters.local_faces import LocalFaceLocator
from mystery_coloring.details.domain import DetailSettings, FaceAnalysis, FeatureHint
from mystery_coloring.details.infer import deny_network
from mystery_coloring.domain import RGBImage, StageError


def face():
    points = [[100, 120, 0.95] for _ in range(28)]
    points[11:17] = [
        [x, y, 0.95] for x, y in [(30, 80), (50, 70), (70, 80), (35, 90), (50, 95), (65, 90)]
    ]
    points[17:23] = [[x + 100, y, c] for x, y, c in points[11:17]]
    points[23] = [100, 140, 0.9]
    points[24:28] = [[x, y, 0.9] for x, y in [(80, 180), (100, 175), (120, 180), (100, 185)]]
    return {"bbox": [0, 0, 200, 240, 0.98], "points": points}


def rgb_image(rgb):
    return RGBImage(rgb.shape[1], rgb.shape[0], rgb.tobytes())


def test_face_box_alone_does_not_enable_protection():
    prediction = face()
    for point in prediction["points"]:
        point[2] = 0.4
    result = analyze_faces([prediction], 300, 300)
    assert result.detected_faces == 1
    assert result.protected_faces == 0
    assert result.hints == ()


def test_occluded_features_are_rejected_individually():
    prediction = face()
    for index in range(17, 23):
        prediction["points"][index][2] = 0.3
    prediction["points"][23][2] = 0.3
    result = analyze_faces([prediction], 300, 300)
    assert result.protected_faces == 1
    assert [hint.kind for hint in result.hints] == ["eye", "mouth"]


@pytest.mark.parametrize("damage", ["low_score", "outside", "nonfinite", "shape"])
def test_invalid_face_or_landmarks_cannot_produce_hints(damage):
    prediction = face()
    if damage == "low_score":
        prediction["bbox"][4] = 0.5
    elif damage == "outside":
        for point in prediction["points"]:
            point[0] += 1000
    elif damage == "nonfinite":
        prediction["points"][0][0] = float("nan")
    else:
        prediction["points"] = prediction["points"][:5]
    assert analyze_faces([prediction], 300, 300).hints == ()


def test_no_face_leaves_masks_and_colors_identical():
    rgb = np.full((300, 300, 3), (185, 140, 115), np.uint8)
    rgb[235:239, 200:235] = (35, 20, 15)
    settings = DetailSettings(0.1, 3.5)
    detector = ContrastDetailDetector()
    baseline = detector.detect(rgb_image(rgb), settings)
    rejected = face()
    for point in rejected["points"]:
        point[2] = 0.1
    result = detector.detect(rgb_image(rgb), settings, analyze_faces([rejected], 300, 300))
    assert result.region_ids == baseline.region_ids
    assert result.colors == baseline.colors
    assert result.accents == baseline.accents
    assert result.face_details == 0


def test_face_hint_keeps_a_weak_stroke_without_protecting_similar_background_texture():
    rgb = np.full((300, 300, 3), (185, 140, 115), np.uint8)
    rgb[235:239, 200:230] = (155, 115, 95)
    rgb[135:139, 100:130] = (155, 115, 95)
    hint = FeatureHint("mouth", ((195, 230), (235, 230), (235, 245), (195, 245)), 2)
    result = ContrastDetailDetector().detect(
        rgb_image(rgb), DetailSettings(0.1, 3.5), FaceAnalysis((hint,), 1, 1)
    )
    mask = np.frombuffer(result.region_ids, "<u4").reshape(300, 300)
    assert np.count_nonzero(mask[235:239, 200:230]) > 30
    assert np.count_nonzero(mask[135:139, 100:130]) == 0
    assert result.face_details >= 1
    assert np.count_nonzero(mask) <= mask.size * 0.008


def test_local_process_receives_pixels_but_no_studio_secrets(monkeypatch):
    from mystery_coloring.details.adapters import local_faces

    monkeypatch.setenv("COLORING_PASSWORD_HASH", "test-private-value")
    monkeypatch.setenv("UNRELATED_TOKEN", "also-private")
    seen = []

    def run(command, **kwargs):
        seen.append((command, kwargs))
        return SimpleNamespace(stdout=json.dumps([face()]).encode())

    monkeypatch.setattr(local_faces.subprocess, "run", run)
    source = RGBImage(300, 300, bytes(300 * 300 * 3))
    result = LocalFaceLocator().locate(source)
    assert result.protected_faces == 1
    command, options = seen[0]
    assert command[1:3] == ["-m", "mystery_coloring.details.infer"]
    assert options["input"][8:] == source.pixels
    assert options["env"]["HF_HUB_OFFLINE"] == "1"
    assert "COLORING_PASSWORD_HASH" not in options["env"]
    assert "UNRELATED_TOKEN" not in options["env"]
    assert options["timeout"] == 45


def test_local_inference_timeout_fails_explicitly(monkeypatch):
    from mystery_coloring.details.adapters import local_faces

    def timeout(*args, **kwargs):
        raise subprocess.TimeoutExpired("inference", 45)

    monkeypatch.setattr(local_faces.subprocess, "run", timeout)
    with pytest.raises(StageError, match="локальное определение"):
        LocalFaceLocator().locate(RGBImage(1, 1, b"\0\0\0"))


def test_orphan_model_process_exits_without_loading_models():
    environment = {**os.environ, "PYTHONPATH": str(Path(__file__).parents[1] / "src")}
    result = subprocess.run(
        [sys.executable, "-m", "mystery_coloring.details.infer", "0"],
        input=b"",
        capture_output=True,
        env=environment,
        timeout=5,
    )
    assert result.returncode == 2
    assert not result.stdout


def test_network_is_disabled_inside_inference():
    with pytest.raises(RuntimeError, match="Network is disabled"):
        deny_network("socket.connect", ())
    deny_network("open", ())
