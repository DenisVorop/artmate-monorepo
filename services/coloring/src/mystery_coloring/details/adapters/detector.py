"""Contrast, quiet surroundings and bounded shape, without trained models."""

import cv2
import numpy as np

from mystery_coloring.details.adapters.profile_colors import printable_pixels, profile_candidates
from mystery_coloring.details.adapters.strokes import stroke_candidates
from mystery_coloring.details.domain import DetailMap, FaceAnalysis


def kernel(radius):
    r = max(1, int(round(radius)))
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


class ContrastDetailDetector:
    def detect(self, image, settings, face_analysis=None):
        face_analysis = face_analysis or FaceAnalysis()
        rgb = np.frombuffer(image.pixels, np.uint8).reshape(image.height, image.width, 3)
        lab = cv2.cvtColor(rgb.astype(np.float32) / 255, cv2.COLOR_RGB2LAB)
        light = cv2.GaussianBlur(lab[:, :, 0], (3, 3), 0.5)
        scale = settings.mm_per_pixel
        focus = np.zeros(light.shape, np.uint8)
        for hint in face_analysis.hints:
            zone = np.zeros(light.shape, np.uint8)
            points = np.rint(hint.points).astype(np.int32)
            if len(points) >= 3:
                cv2.fillConvexPoly(zone, cv2.convexHull(points), 1)
            else:
                for point in points:
                    cv2.circle(zone, tuple(point), 1, 1, -1)
            focus |= cv2.dilate(zone, kernel(hint.padding))
        focused = focus > 0
        local = kernel(1.8 / scale)
        background = cv2.morphologyEx(light, cv2.MORPH_CLOSE, local)
        dark = background - light
        window = 2 * max(1, int(round(0.8 / scale))) + 1
        mean = cv2.blur(background, (window, window))
        quiet = cv2.blur(background**2, (window, window)) - mean**2 < 36
        bright = light - cv2.morphologyEx(light, cv2.MORPH_OPEN, local)
        candidates = []
        max_area = min(18.0, max(5.0, settings.min_area_mm2 * 3))
        for polarity, contrast in (("dark", dark), ("light", bright)):
            mask = (
                contrast
                > np.where(
                    focused, 5 if polarity == "dark" else 12, 9 if polarity == "dark" else 18
                )
            ).astype(np.uint8)
            if polarity == "dark":
                mask *= (quiet | focused).astype(np.uint8)
            else:
                mask *= (light > np.where(focused, 68, 78)).astype(np.uint8)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel(0.16 / scale))
            count, labels, stats, centers = cv2.connectedComponentsWithStats(mask, connectivity=8)
            for identifier in range(1, count):
                x, y, w, h, pixels = map(int, stats[identifier])
                area = pixels * scale**2
                component = labels[y : y + h, x : x + w] == identifier
                guided = np.count_nonzero(focused[y : y + h, x : x + w] & component) >= pixels * 0.6
                if not 0.12 <= area <= max_area or max(w, h) * scale > 11:
                    continue
                if min(x, y) == 0 or x + w >= image.width or y + h >= image.height:
                    continue
                # Work on a bounded crop, never a full image per candidate.
                pad = max(2, int(round(0.8 / scale)))
                x0, y0 = max(0, x - pad), max(0, y - pad)
                x1, y1 = min(image.width, x + w + pad), min(image.height, y + h + pad)
                selected = (labels[y0:y1, x0:x1] == identifier).astype(np.uint8)
                if (
                    2 * cv2.distanceTransform(selected, cv2.DIST_L2, 5).max() * scale
                    < settings.min_width_mm
                ):
                    continue
                ring = (cv2.dilate(selected, kernel(pad)) > 0) & (selected == 0)
                surroundings = light[y0:y1, x0:x1][ring]
                values = light[y0:y1, x0:x1][selected > 0]
                local_contrast = abs(float(np.median(surroundings) - np.median(values)))
                spread = float(np.percentile(surroundings, 80) - np.percentile(surroundings, 20))
                if polarity == "dark":
                    if (
                        local_contrast < (7 if guided else 13)
                        or spread > (55 if guided else 17)
                        or np.median(values) > (65 if guided else 52)
                    ):
                        continue
                elif (
                    local_contrast < (15 if guided else 30)
                    or np.median(values) < (68 if guided else 75)
                    or max(w, h) / min(w, h) > 3
                ):
                    continue
                # A line may be a mouth: elongation alone must not delete it.
                score = local_contrast / (8 + spread) * min(1.0, area / 0.4)
                if guided:
                    score += 10
                # Connect diagonal stroke pixels for the downstream 4-neighbor mesh.
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
                selected[:-1, 1:][diagonal] = 1
                selected[:-1, :-1][opposite] = 1
                holes, hole_ids, hole_stats, _ = cv2.connectedComponentsWithStats(
                    1 - selected, connectivity=4
                )
                for hole in range(1, holes):
                    hx, hy, hw, hh, size = map(int, hole_stats[hole])
                    if (
                        hx > 0
                        and hy > 0
                        and hx + hw < selected.shape[1]
                        and hy + hh < selected.shape[0]
                        and size * scale**2 < 0.12
                    ):
                        selected[hole_ids == hole] = 1
                yy, xx = np.where(selected)
                color = tuple(int(v) for v in np.median(rgb[y0:y1, x0:x1][selected > 0], axis=0))
                if polarity == "light" and np.median(values) > 88:
                    color = (255, 255, 255)
                candidates.append(
                    (
                        score,
                        identifier,
                        polarity,
                        (yy + y0, xx + x0),
                        color,
                        centers[identifier],
                        guided,
                    )
                )
        candidates.extend(profile_candidates(rgb, lab, settings, face_analysis.profiles))
        strokes = stroke_candidates(rgb, light, settings)
        result = np.zeros(light.shape, np.uint32)
        colors = []
        selected_sizes = []
        ordinary_dark_ids = set()
        locked_ids = set()
        covered = 0
        face_details = 0
        accents = None
        # Keep established compact details/highlights first. Extra strokes share
        # the remaining budget instead of displacing eyes or white highlights.
        ordered = sorted(candidates, key=lambda c: (-c[0], c[2], c[1])) + sorted(
            strokes, key=lambda c: (-c[0], c[2], c[1])
        )
        for score, _identifier, polarity, (yy, xx), color, center, guided in ordered:
            if polarity == "stroke" and accents is None:
                # New line masks must not reserve unrelated nearby colors and
                # change the whole image palette (for example flower petals).
                accents = self._accents(rgb, lab, result, scale)
            # Repeated small flecks in the same vicinity are texture evidence.
            similar = sum(
                p == polarity and np.linalg.norm(other - center) * scale < 5
                for _, _, p, _, _, other, _ in (strokes if polarity == "stroke" else candidates)
            )
            if (similar > 7 and not guided) or score < 0.75 or len(colors) >= settings.max_details:
                continue
            overlaps = None
            if polarity == "stroke":
                overlaps = np.unique(result[yy, xx], return_counts=True)
            free = result[yy, xx] == 0
            yy, xx = yy[free], xx[free]
            if face_analysis.profiles or polarity == "stroke":
                yy, xx = printable_pixels(yy, xx, settings)
            if not len(xx) or covered + len(xx) > light.size * settings.max_coverage:
                continue
            if overlaps is not None:
                # A compact detector may already own an antialiased fragment of
                # this line. Give that fragment the same source-core color when
                # most of it is confirmed by the longer stroke. Never recolor
                # white highlights or model-guided details this way.
                for old, overlap in zip(*overlaps, strict=True):
                    if old in ordinary_dark_ids and overlap >= selected_sizes[old - 1] * (2 / 3):
                        colors[old - 1] = color
                        locked_ids.add(int(old))
            colors.append(color)
            if polarity == "stroke" or guided:
                locked_ids.add(len(colors))
            selected_sizes.append(len(xx))
            if polarity == "dark" and not guided:
                ordinary_dark_ids.add(len(colors))
            result[yy, xx] = len(colors)
            covered += len(xx)
            face_details += int(guided)
        # Adjacent protected strokes can jointly enclose sub-printable pinholes.
        holes, hole_ids, hole_stats, _ = cv2.connectedComponentsWithStats(
            (result == 0).astype(np.uint8), connectivity=4
        )
        for hole in range(1, holes):
            x, y, w, h, pixels = map(int, hole_stats[hole])
            if (
                x == 0
                or y == 0
                or x + w >= image.width
                or y + h >= image.height
                or pixels * scale**2 >= 0.12
                or covered + pixels > light.size * settings.max_coverage
            ):
                continue
            crop = result[y - 1 : y + h + 1, x - 1 : x + w + 1]
            selected = (hole_ids[y - 1 : y + h + 1, x - 1 : x + w + 1] == hole).astype(np.uint8)
            touching = crop[(cv2.dilate(selected, kernel(1)) > 0) & (selected == 0)]
            touching = touching[touching > 0]
            if len(touching):
                crop[selected > 0] = np.bincount(touching).argmax()
                covered += pixels
        return DetailMap(
            result.astype("<u4").tobytes(),
            tuple(colors),
            self._accents(rgb, lab, result, scale) if accents is None else accents,
            face_analysis,
            face_details,
            frozenset(locked_ids),
        )

    @staticmethod
    def _accents(rgb, lab, details, scale):
        """Reserve rare local chromatic accents near protected contrast details."""
        chroma = np.linalg.norm(lab[:, :, 1:], axis=2)
        hue = (np.arctan2(lab[:, :, 2], lab[:, :, 1]) + np.pi) / (2 * np.pi)
        groups = np.floor(hue * 12).astype(int) % 12
        near = cv2.dilate((details > 0).astype(np.uint8), kernel(4 / scale)) > 0
        accents = []
        for group in range(12):
            mask = (groups == group) & (chroma > 22)
            if not mask.any() or mask.mean() > 0.008:
                continue
            count, labels, stats, _ = cv2.connectedComponentsWithStats(
                mask.astype(np.uint8), connectivity=8
            )
            for identifier in range(1, count):
                x, y, w, h, pixels = map(int, stats[identifier])
                if not 0.5 <= pixels * scale**2 <= 40 or max(w, h) / min(w, h) > 3:
                    continue
                selected = labels[y : y + h, x : x + w] == identifier
                if not np.any(near[y : y + h, x : x + w][selected]):
                    continue
                color = tuple(
                    int(v) for v in np.median(rgb[y : y + h, x : x + w][selected], axis=0)
                )
                accents.append((pixels, color))
        return tuple(color for _, color in sorted(accents, reverse=True)[:2])
