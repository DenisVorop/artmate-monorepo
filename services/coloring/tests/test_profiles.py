"""Profiles require corroboration; small original eye/lip colors survive merging."""

from dataclasses import replace

import cv2
import numpy as np
import pytest
from test_faces import face, rgb_image

from mystery_coloring.details.adapters import views
from mystery_coloring.details.adapters.detector import ContrastDetailDetector
from mystery_coloring.details.adapters.faces import analyze_faces
from mystery_coloring.details.domain import DetailSettings, FaceAnalysis, ProfileRegion


class Model:
    flip_test = True

    def __init__(self, detections, nose_score=0.95):
        self.detections = iter(detections)
        self.nose_score = nose_score
        self.calls = 0

    def _detect_faces(self, image):
        self.calls += 1
        return next(self.detections, [])

    def __call__(self, image, boxes):
        prediction = face()
        prediction["points"][23][2] = self.nose_score
        return [
            {"bbox": np.asarray(box), "keypoints": np.asarray(prediction["points"])}
            for box in boxes
        ]


def fixture_rotations(monkeypatch):
    monkeypatch.setattr(
        views, "rotated", lambda image, angle: (image, np.array([[1, 0, 0], [0, 1, 0]], float))
    )


def test_existing_face_uses_original_inference_without_extra_views():
    box = face()["bbox"]
    model = Model([[box]])
    result = views.predict_faces(model, np.zeros((300, 300, 3), np.uint8))
    expected = face()
    expected["points"][23][2] = 0.95
    assert result == [expected]
    assert model.calls == 1 and model.flip_test is True


@pytest.mark.parametrize("condition", ["absent", "one_view", "disagree", "weak_landmarks"])
def test_box_evidence_cannot_protect_a_profile_without_corroboration_and_anchor(
    monkeypatch, condition
):
    fixture_rotations(monkeypatch)
    box = [10, 10, 210, 250, 0.98]
    second = [240, 10, 440, 250, 0.96] if condition == "disagree" else box
    detections = [[], [box], [second]]
    if condition == "absent":
        detections = []
    elif condition == "one_view":
        detections = [[], [box]]
    model = Model(detections, nose_score=0.2 if condition == "weak_landmarks" else 0.95)
    assert views.predict_faces(model, np.zeros((500, 500, 3), np.uint8)) == []
    assert model.flip_test is True


def test_agreeing_views_produce_one_profile_region_with_original_coordinates(monkeypatch):
    fixture_rotations(monkeypatch)
    box = [10, 10, 210, 250, 0.98]
    model = Model([[], [box], [box], [box]])
    predictions = views.predict_faces(model, np.zeros((300, 300, 3), np.uint8))
    result = analyze_faces(predictions, 300, 300)
    assert len(predictions) == 1
    assert result.detected_faces == result.protected_faces == 1
    assert result.hints == ()
    assert result.profiles == (ProfileRegion(((10, 10), (210, 10), (210, 250), (10, 250))),)
    assert model.flip_test is True


def test_view_coordinates_round_trip_without_rotating_the_source():
    source = np.zeros((180, 240, 3), np.uint8)
    source[70:80, 100:110] = 255
    original = source.copy()
    rotated, inverse = views.rotated(source, 45)
    matrix = cv2.invertAffineTransform(inverse)
    point = np.array([105, 75])
    transformed = matrix[:, :2] @ point + matrix[:, 2]
    assert np.allclose(inverse[:, :2] @ transformed + inverse[:, 2], point)
    assert np.array_equal(source, original)
    assert rotated.shape[0] > source.shape[0]
    box = np.array([10, 20, 50, 80, 0.99])
    polygon = views.polygon_for(box, inverse)
    assert cv2.contourArea(polygon) == pytest.approx(40 * 60, rel=1e-5)


def profile_image():
    rgb = np.full((400, 400, 3), (190, 140, 110), np.uint8)
    cv2.ellipse(rgb, (120, 130), (10, 16), -30, 0, 360, (15, 15, 20), -1)
    cv2.ellipse(rgb, (121, 134), (5, 9), -30, 0, 360, (235, 240, 250), -1)
    # Lip ink joins a long outside contour, while its red color remains local.
    cv2.line(rgb, (160, 200), (160, 380), (25, 15, 20), 3)
    cv2.ellipse(rgb, (160, 200), (13, 6), 0, 0, 360, (25, 15, 20), -1)
    cv2.ellipse(rgb, (160, 199), (9, 3), 0, 0, 360, (220, 85, 85), -1)
    return rgb_image(rgb)


def test_profile_preserves_eye_and_lip_colors_within_shared_detail_budget():
    source = profile_image()
    profile = ProfileRegion(((40, 40), (300, 40), (300, 300), (40, 300)))
    analysis = FaceAnalysis(detected_faces=1, protected_faces=1, profiles=(profile,))
    settings = DetailSettings(0.1, 3.5)
    detector = ContrastDetailDetector()
    state = np.random.get_state()
    first = detector.detect(source, settings, analysis)
    assert first == detector.detect(source, settings, analysis)
    current_state = np.random.get_state()
    assert all(np.array_equal(a, b) for a, b in zip(state, current_state, strict=True))
    mask = np.frombuffer(first.region_ids, "<u4").reshape(400, 400)
    for x, y, color in [
        (120, 119, (15, 15, 20)),
        (121, 134, (235, 240, 250)),
        (160, 199, (220, 85, 85)),
    ]:
        assert mask[y, x] > 0
        assert first.colors[mask[y, x] - 1] == color
    assert first.face_details >= 3
    assert len(first.colors) <= settings.max_details
    assert np.count_nonzero(mask) <= mask.size * settings.max_coverage
    tight = detector.detect(source, replace(settings, max_details=2), analysis)
    assert len(tight.colors) <= 2


def test_empty_profile_cannot_generate_detail_geometry():
    rgb = np.full((200, 200, 3), (180, 140, 110), np.uint8)
    profile = ProfileRegion(((20, 20), (180, 20), (180, 180), (20, 180)))
    result = ContrastDetailDetector().detect(
        rgb_image(rgb), DetailSettings(0.1, 3.5), FaceAnalysis(profiles=(profile,))
    )
    assert result.colors == ()
    assert not any(result.region_ids)


def test_overlap_residue_keeps_the_stroke_but_removes_tiny_disconnected_fragments():
    from mystery_coloring.details.adapters.profile_colors import printable_pixels

    mask = np.zeros((40, 40), np.uint8)
    mask[12:16, 12:24] = 1
    mask[20, 20:23] = 1
    mask[30, 30] = 1
    yy, xx = np.where(mask)
    kept_y, kept_x = printable_pixels(yy + 400, xx + 300, DetailSettings(0.1, 3.5))
    restored = np.zeros_like(mask)
    restored[kept_y - 400, kept_x - 300] = 1
    assert restored[12:16, 12:24].all()
    assert restored.sum() == 48
