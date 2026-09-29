"""Narrow dark strokes supported by brighter pixels on both sides of the source line."""

import cv2
import numpy as np


def stroke_candidates(rgb, light, settings):
    scale = settings.mm_per_pixel
    radius = max(1, int(round(0.65 / scale)))
    response = np.zeros(light.shape, np.float32)
    # A step edge has a dark side and does not pass this two-sided test. Trying
    # several offsets keeps thin lines crossing different background colors.
    for distance in range(1, radius + 1):
        for dx, dy in ((distance, 0), (0, distance), (distance, distance), (distance, -distance)):
            first = np.roll(light, (dy, dx), (0, 1))
            second = np.roll(light, (-dy, -dx), (0, 1))
            np.maximum(response, np.minimum(first, second) - light, out=response)
    mask = ((response > 5) & (light < 75)).astype(np.uint8)
    # np.roll is only a bounded shift here; wrapping at image edges is never evidence.
    mask[:radius] = mask[-radius:] = 0
    mask[:, :radius] = mask[:, -radius:] = 0
    count, labels, stats, centers = cv2.connectedComponentsWithStats(mask, connectivity=8)
    thick = (
        2 * cv2.distanceTransform((light < 52).astype(np.uint8), cv2.DIST_L2, 5) * scale > 1.2
    ).astype(np.uint8)
    beside_thick = cv2.dilate(
        thick, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * radius + 1, 2 * radius + 1))
    )
    candidates = []
    for identifier in range(1, count):
        x, y, width, height, pixels = map(int, stats[identifier])
        length = max(width, height) * scale
        area = pixels * scale**2
        # A fan of touching whiskers has several narrow branches, so its total
        # area may exceed that of one compact detail without containing a thick patch.
        if not (2 <= length <= 45 and 0.12 <= area <= 40 and area / length <= 1.2):
            continue
        selected = (labels[y : y + height, x : x + width] == identifier).astype(np.uint8)
        # Reject narrow fringes along a broad dark fill (pupil, mouth, foliage).
        # A stroke may meet such a fill at its tip, but must not run along it.
        if np.count_nonzero(selected & beside_thick[y : y + height, x : x + width]) > pixels * 0.2:
            continue
        values = light[y : y + height, x : x + width]
        contrast = response[y : y + height, x : x + width]
        strong = (selected > 0) & (contrast > 18) & (values < 52)
        if np.count_nonzero(strong) < pixels * 0.2:
            continue
        # Padding makes thickness independent of whether a stroke fills its crop.
        thickness = 2 * cv2.distanceTransform(np.pad(selected, 1), cv2.DIST_L2, 5).max() * scale
        if not settings.min_width_mm <= thickness <= 1.2:
            continue
        core = strong & (values <= np.percentile(values[strong], 35))
        color = tuple(int(v) for v in np.median(rgb[y : y + height, x : x + width][core], axis=0))
        core_lab = cv2.cvtColor(np.asarray([[color]], np.float32) / 255, cv2.COLOR_RGB2LAB)[0, 0]
        # Saturated colored outlines belong to the ordinary color regions. Only
        # near-black or low-chroma ink joins this extra family of dark details.
        if core_lab[0] > 20 and np.linalg.norm(core_lab[1:]) > 30:
            continue
        score = min(9.0, 2 + float(np.median(contrast[strong])) / 8)
        # Keep an 8-connected source stroke connected in the downstream 4-neighbor
        # mesh. Choose only a bridge pixel with local source contrast evidence.
        diagonal = (
            (selected[:-1, :-1] > 0)
            & (selected[1:, 1:] > 0)
            & (selected[:-1, 1:] == 0)
            & (selected[1:, :-1] == 0)
        )
        opposite = (
            (selected[:-1, 1:] > 0)
            & (selected[1:, :-1] > 0)
            & (selected[:-1, :-1] == 0)
            & (selected[1:, 1:] == 0)
        )
        selected[:-1, 1:][diagonal & (contrast[:-1, 1:] > 2)] = 1
        selected[1:, :-1][diagonal & (selected[:-1, 1:] == 0) & (contrast[1:, :-1] > 2)] = 1
        selected[:-1, :-1][opposite & (contrast[:-1, :-1] > 2)] = 1
        selected[1:, 1:][opposite & (selected[:-1, :-1] == 0) & (contrast[1:, 1:] > 2)] = 1
        yy, xx = np.where(selected)
        candidates.append(
            (score, identifier, "stroke", (yy + y, xx + x), color, centers[identifier], False)
        )
    return candidates
