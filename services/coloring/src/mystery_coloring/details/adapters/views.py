"""Corroborate missed profiles across rotations; preserve normal inference exactly."""

import cv2
import numpy as np

from mystery_coloring.details.adapters.faces import analyze_faces

ANGLES = (30, -30, 45, -45, 60, -60)


def rotated(image, angle):
    height, width = image.shape[:2]
    matrix = cv2.getRotationMatrix2D((width / 2, height / 2), angle, 1)
    cosine, sine = abs(matrix[0, 0]), abs(matrix[0, 1])
    size = int(height * sine + width * cosine), int(height * cosine + width * sine)
    matrix[:, 2] += np.array(size) / 2 - np.array([width, height]) / 2
    view = cv2.warpAffine(image, matrix, size, borderValue=(127, 127, 127))
    return view, cv2.invertAffineTransform(matrix)


def polygon_for(box, inverse):
    x0, y0, x1, y1 = box[:4]
    points = np.array([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
    return (points @ inverse[:, :2].T + inverse[:, 2]).astype(np.float32)


def overlap(first, second):
    intersection, _ = cv2.intersectConvexConvex(first, second)
    union = cv2.contourArea(first) + cv2.contourArea(second) - intersection
    return intersection / union if union > 0 else 0


def encoded(prediction):
    return {"bbox": prediction["bbox"].tolist(), "points": prediction["keypoints"].tolist()}


def predict_faces(model, image):
    boxes = model._detect_faces(image)
    boxes = sorted((box for box in boxes if box[4] >= 0.8), key=lambda b: -float(b[4]))[:8]
    if boxes:
        return [encoded(face) for face in model(image, boxes=boxes)]
    height, width = image.shape[:2]
    candidates = []
    for angle in ANGLES:
        view, inverse = rotated(image, angle)
        boxes = sorted(model._detect_faces(view), key=lambda b: -float(b[4]))[:8]
        for box in boxes:
            if not np.isfinite(box).all() or box[4] < 0.9:
                continue
            polygon = polygon_for(box, inverse)
            # Padding outside the original cannot provide corroborating facial evidence.
            if (
                np.any(polygon < 0)
                or np.any(polygon[:, 0] >= width)
                or np.any(polygon[:, 1] >= height)
            ):
                continue
            candidates.append((angle, box, polygon))
    predictions, used = [], []
    flip_test = model.flip_test
    try:
        # Averaging a mirrored face mixes visible and occluded features of a profile.
        model.flip_test = False
        for angle, box, polygon in sorted(candidates, key=lambda c: -float(c[1][4])):
            if box[4] < 0.95 or any(overlap(polygon, other) > 0.3 for other in used):
                continue
            support = [
                overlap(polygon, other)
                for view_angle, _, other in candidates
                if view_angle != angle and overlap(polygon, other) >= 0.55
            ]
            if not support:
                continue
            view, inverse = rotated(image, angle)
            face = encoded(model(view, boxes=[box])[0])
            analysis = analyze_faces([face], view.shape[1], view.shape[0])
            if not any(hint.kind == "nose" for hint in analysis.hints):
                continue
            points = np.asarray(face["points"])
            points[:, :2] = points[:, :2] @ inverse[:, :2].T + inverse[:, 2]
            minimum, maximum = polygon.min(axis=0), polygon.max(axis=0)
            face.update(
                bbox=[*minimum.tolist(), *maximum.tolist(), float(box[4])],
                points=points.tolist(),
                profile={
                    "polygon": polygon.tolist(),
                    "anchor": points[23].tolist(),
                    "views": len(support) + 1,
                    "overlap": max(support),
                },
            )
            if not analyze_faces([face], width, height).profiles:
                continue
            predictions.append(face)
            used.append(polygon)
            if len(predictions) == 8:
                break
    finally:
        model.flip_test = flip_test
    return predictions
