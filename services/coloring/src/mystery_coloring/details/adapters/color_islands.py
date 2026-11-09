"""Small saturated islands that remain visible on contrasting surroundings."""

import cv2
import numpy as np


def color_island_candidates(rgb, lab, settings, local):
    scale = settings.mm_per_pixel
    radius = max(1, round(0.3 / scale))
    halo = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * radius + 1, 2 * radius + 1))
    candidates = []
    for channel in (lab[:, :, 1], lab[:, :, 2]):
        for operation, direction in ((cv2.MORPH_OPEN, 1), (cv2.MORPH_CLOSE, -1)):
            envelope = cv2.morphologyEx(channel, operation, local)
            mask = ((channel - envelope) * direction >= 16).astype(np.uint8)
            count, labels, stats, centers = cv2.connectedComponentsWithStats(mask, connectivity=4)
            for identifier in range(1, count):
                x, y, w, h, size = map(int, stats[identifier])
                area = size * scale**2
                if (
                    not 0.24 <= area < settings.min_area_mm2
                    or max(w, h) * scale > 5
                    or max(w, h) > 3 * min(w, h)
                    or size < 0.32 * w * h
                    or min(x, y) < radius
                    or x + w + radius > rgb.shape[1]
                    or y + h + radius > rgb.shape[0]
                ):
                    continue
                bounds = np.s_[y - radius : y + h + radius, x - radius : x + w + radius]
                selected = labels[bounds] == identifier
                values = lab[bounds]
                core = np.median(values[selected], axis=0)
                if np.linalg.norm(core[1:]) < 22:
                    continue
                ring = (cv2.dilate(selected.astype(np.uint8), halo) > 0) & ~selected
                contrast = np.linalg.norm(values[ring] - core, axis=1)
                if np.percentile(contrast, 25) < 30:
                    continue
                if np.percentile(np.linalg.norm(values[selected] - core, axis=1), 75) > 16:
                    continue
                yy, xx = np.where(selected)
                color = tuple(int(v) for v in np.median(rgb[bounds][selected], axis=0))
                score = min(4.0, float(np.median(contrast)) / 12) * min(1, area / 0.5)
                candidates.append(
                    (
                        score,
                        identifier,
                        "color",
                        (yy + y - radius, xx + x - radius),
                        color,
                        centers[identifier],
                        False,
                    )
                )
    return candidates
