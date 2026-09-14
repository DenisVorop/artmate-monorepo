"""Validate landmark geometry before allowing local protection hints."""

import cv2
import numpy as np

from mystery_coloring.details.domain import FaceAnalysis, FeatureHint, ProfileRegion


def analyze_faces(predictions, width, height):
    hints = []
    profiles = []
    protected_faces = 0
    for face in predictions[:8]:
        bbox = np.asarray(face["bbox"], dtype=float)
        points = np.asarray(face["points"], dtype=float)
        if (
            bbox.shape != (5,)
            or points.shape != (28, 3)
            or not np.isfinite(bbox).all()
            or not np.isfinite(points).all()
        ):
            continue
        x0, y0, x1, y1, confidence = bbox
        fw, fh = x1 - x0, y1 - y0
        if confidence < 0.8 or min(fw, fh) < 40 or not 0.35 < fw / fh < 2:
            continue
        if x1 < 0 or y1 < 0 or x0 > width or y0 > height:
            continue
        profile = face.get("profile")
        if profile is not None:
            polygon = np.asarray(profile.get("polygon"), dtype=float)
            anchor = np.asarray(profile.get("anchor"), dtype=float)
            if (
                confidence >= 0.95
                and profile.get("views", 0) >= 2
                and profile.get("overlap", 0) >= 0.55
                and polygon.shape == (4, 2)
                and anchor.shape == (3,)
                and np.isfinite(polygon).all()
                and np.isfinite(anchor).all()
                and anchor[2] >= 0.7
                and np.all(polygon >= 0)
                and np.all(polygon[:, 0] < width)
                and np.all(polygon[:, 1] < height)
                and cv2.isContourConvex(polygon.astype(np.float32))
                and cv2.pointPolygonTest(polygon.astype(np.float32), tuple(anchor[:2]), False) >= 0
            ):
                profiles.append(ProfileRegion(tuple(map(tuple, polygon))))
                protected_faces += 1
            continue
        previous = len(hints)
        for kind, indices in (
            ("eye", range(11, 17)),
            ("eye", range(17, 23)),
            ("nose", (23,)),
            ("mouth", range(24, 28)),
        ):
            feature = points[list(indices)]
            xy = feature[:, :2]
            if np.median(feature[:, 2]) < 0.7 or np.min(feature[:, 2]) < 0.5:
                continue
            if (
                np.any(xy[:, 0] < 0)
                or np.any(xy[:, 0] >= width)
                or np.any(xy[:, 1] < 0)
                or np.any(xy[:, 1] >= height)
            ):
                continue
            extent = np.ptp(xy, axis=0)
            if np.max(extent) > fw * 0.65:
                continue
            # Reject landmarks drifting beyond their detected face or into the hair.
            center = np.mean(xy, axis=0)
            if not (x0 <= center[0] <= x1 and y0 + fh * 0.1 <= center[1] <= y1):
                continue
            padding = max(1.5, fw * (0.045 if kind == "nose" else 0.025))
            hints.append(FeatureHint(kind, tuple(map(tuple, xy)), padding))
        protected_faces += len(hints) > previous
    return FaceAnalysis(tuple(hints), len(predictions), protected_faces, tuple(profiles))
