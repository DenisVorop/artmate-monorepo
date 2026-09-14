"""Small original color islands inside independently corroborated profile regions."""

import cv2
import numpy as np

from mystery_coloring.adapters.clustering import initial_labels, nearest


def profile_candidates(rgb, lab, settings, profiles):
    candidates = []
    scale = settings.mm_per_pixel
    max_area = min(18.0, max(5.0, settings.min_area_mm2 * 3))
    pad = max(2, round(0.5 / scale))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * pad + 1, 2 * pad + 1))
    for profile in profiles:
        points = np.asarray(profile.points, np.float32)
        x, y, w, h = cv2.boundingRect(points)
        x, y = max(0, x), max(0, y)
        w, h = min(w, rgb.shape[1] - x), min(h, rgb.shape[0] - y)
        if min(w, h) < 3:
            continue
        crop, values = rgb[y : y + h, x : x + w], lab[y : y + h, x : x + w]
        zone = np.zeros((h, w), np.uint8)
        cv2.fillConvexPoly(zone, np.rint(points - [x, y]).astype(np.int32), 1)
        boundary = zone - cv2.erode(zone, np.ones((3, 3), np.uint8), borderValue=0)
        flat = values.reshape(-1, 3)
        rng = np.random.default_rng(0)
        sample = flat[rng.choice(len(flat), min(10000, len(flat)), replace=False)]
        labels = initial_labels(sample, 12, rng)
        count = int(labels.max()) + 1
        _, _, centers = cv2.kmeans(
            sample,
            count,
            labels.reshape(-1, 1),
            (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_MAX_ITER, 40, 0.05),
            1,
            cv2.KMEANS_USE_INITIAL_LABELS,
        )
        classes = nearest(flat, centers).reshape(h, w)
        for color in range(count):
            number, ids, stats, _ = cv2.connectedComponentsWithStats(
                ((classes == color) & (zone > 0)).astype(np.uint8), connectivity=4
            )
            for identifier in range(1, number):
                cx, cy, cw, ch, size = map(int, stats[identifier])
                area = size * scale**2
                # A stricter floor rejects antialias fragments created by local clustering.
                if not 0.35 <= area <= max_area or max(cw, ch) * scale > 11:
                    continue
                x0, y0 = max(0, cx - pad), max(0, cy - pad)
                x1, y1 = min(w, cx + cw + pad), min(h, cy + ch + pad)
                selected = (ids[y0:y1, x0:x1] == identifier).astype(np.uint8)
                if np.any(selected & boundary[y0:y1, x0:x1]):
                    continue
                if (
                    2 * cv2.distanceTransform(selected, cv2.DIST_L2, 5).max() * scale
                    < settings.min_width_mm
                ):
                    continue
                ring = (cv2.dilate(selected, kernel) > 0) & (selected == 0)
                local_values = values[y0:y1, x0:x1]
                local_color = np.median(local_values[selected > 0], axis=0)
                contrast = float(
                    np.median(np.linalg.norm(local_values[ring] - local_color, axis=1))
                )
                if contrast < 18:
                    continue
                yy, xx = np.where(selected)
                rgb_color = tuple(
                    int(v) for v in np.median(crop[y0:y1, x0:x1][selected > 0], axis=0)
                )
                score = 12 + min(4, contrast / 20) * min(1, area / 0.7)
                candidates.append(
                    (
                        score,
                        len(candidates),
                        "profile",
                        (yy + y + y0, xx + x + x0),
                        rgb_color,
                        np.array([np.mean(xx) + x + x0, np.mean(yy) + y + y0]),
                        True,
                    )
                )
    return candidates


def printable_pixels(yy, xx, settings):
    """Overlapping masks must not leave new sub-printable disconnected fragments."""
    if not len(xx):
        return yy, xx
    x, y = int(xx.min()) - 1, int(yy.min()) - 1
    local = np.zeros((int(yy.max()) - y + 2, int(xx.max()) - x + 2), np.uint8)
    local[yy - y, xx - x] = 1
    count, ids, stats, _ = cv2.connectedComponentsWithStats(local, connectivity=4)
    distances = cv2.distanceTransform(local, cv2.DIST_L2, 5)
    keep = np.zeros(count, bool)
    for identifier in range(1, count):
        keep[identifier] = (
            stats[identifier, cv2.CC_STAT_AREA] * settings.mm_per_pixel**2 >= 0.12
            and 2 * distances[ids == identifier].max() * settings.mm_per_pixel
            >= settings.min_width_mm
        )
    kept = keep[ids[yy - y, xx - x]]
    return yy[kept], xx[kept]
