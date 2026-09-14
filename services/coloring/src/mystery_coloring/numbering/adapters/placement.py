"""Поиск целого символа фиксированного размера, без уменьшения отдельных подписей."""

from math import hypot, sqrt

import cv2
import numpy as np
from shapely import Polygon, STRtree, covers, polygons
from shapely.ops import polylabel

from mystery_coloring.domain import StageError
from mystery_coloring.geometry.curves import sample_curves
from mystery_coloring.numbering.curves import place_glyphs
from mystery_coloring.numbering.domain import NumberLabel

TEXT_FLATNESS_MM = 0.001


def ink_geometry(rings):
    shape = Polygon()
    for ring in rings:
        shape = shape.symmetric_difference(Polygon(sample_curves(ring, error=TEXT_FLATNESS_MM)))
    return shape


class SymbolPlacer:
    def __init__(self, font, settings, geometry_margin_mm):
        self.font, self.settings = font, settings
        self.margin = (
            settings.padding_mm + settings.stroke_mm / 2 + geometry_margin_mm + 2 * TEXT_FLATNESS_MM
        )
        self._candidates = {}

    def candidates(self, polygon):
        key = polygon.wkb
        if key in self._candidates:
            return self._candidates[key]
        xmin, ymin, xmax, ymax = polygon.bounds
        step = max(0.12, sqrt((xmax - xmin) * (ymax - ymin) / 40000))
        width, height = int((xmax - xmin) / step) + 5, int((ymax - ymin) / step) + 5
        origin = np.asarray((xmin - step, ymin - step))
        mask = np.zeros((height, width), dtype=np.uint8)

        def ring(points):
            return np.rint((np.asarray(points) - origin) / step).astype(np.int32)

        cv2.fillPoly(mask, [ring(polygon.exterior.coords)], 1)
        for hole in polygon.interiors:
            cv2.fillPoly(mask, [ring(hole.coords)], 0)
        distances = cv2.distanceTransform(mask, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
        order = np.argsort(-distances.ravel(), kind="stable")
        selected = []
        # Растр только предлагает точки; принятие идёт по векторной геометрии.
        blocked = np.zeros_like(mask, dtype=bool)
        radius = max(1, round(0.3 / step))
        for index in order:
            y, x = divmod(int(index), width)
            if distances[y, x] <= 0:
                break
            if blocked[y, x]:
                continue
            selected.append(tuple(origin + np.asarray((x, y)) * step))
            blocked[max(0, y - radius) : y + radius + 1, max(0, x - radius) : x + radius + 1] = True
            if len(selected) >= 512:
                break
        self._candidates[key] = tuple(selected)
        return tuple(selected)

    def fit(self, polygon, cell_id, text, hint=None, repeated=False, centers=None):
        glyph = self.font.glyphs(text)
        x0, y0, x1, y1 = glyph.bounds
        scale = self.settings.font_size_pt * 25.4 / 72
        w, h = (x1 - x0) * scale / 2 + self.margin, (y1 - y0) * scale / 2 + self.margin
        pole = polylabel(polygon, tolerance=0.015)
        if pole.distance(polygon.boundary) + 0.02 < min(w, h):
            return None
        if centers is None:
            first = [(pole.x, pole.y), tuple(polygon.representative_point().coords)[0]]
            if hint is not None:
                first.insert(0, hint)
            batches = (first, self.candidates(polygon))
        else:
            batches = (centers,)
        for candidates in batches:
            if not candidates:
                continue
            offsets = np.asarray(((-w, -h), (w, -h), (w, h), (-w, h)))
            xy = np.asarray(candidates)
            rectangles = polygons(xy[:, None, :] + offsets)
            for index in np.flatnonzero(covers(polygon, rectangles)):
                center = tuple(float(v) for v in xy[index])
                rings = place_glyphs(glyph, center, self.settings.font_size_pt, 0)
                if polygon.covers(ink_geometry(rings).buffer(self.margin)):
                    return NumberLabel(
                        cell_id, text, center, self.settings.font_size_pt, 0.0, rings, repeated
                    )
        return None

    def repetitions(self, polygon, primary):
        labels = [primary]
        xmin, ymin, xmax, ymax = polygon.bounds
        if hypot(xmax - xmin, ymax - ymin) < self.settings.repeat_distance_mm * 1.5:
            return labels
        candidates = self.candidates(polygon)
        for _ in range(self.settings.max_labels_per_region - 1):
            remaining = [
                p
                for p in candidates
                if min(
                    hypot(p[0] - label.center_mm[0], p[1] - label.center_mm[1]) for label in labels
                )
                >= self.settings.repeat_distance_mm
            ]
            if not remaining:
                break
            remaining.sort(
                key=lambda p: (
                    -min(
                        hypot(p[0] - label.center_mm[0], p[1] - label.center_mm[1])
                        for label in labels
                    )
                )
            )
            extra = self.fit(
                polygon, primary.cell_id, primary.text, repeated=True, centers=remaining
            )
            if extra is None:
                break
            labels.append(extra)
        return labels


def validate_labels(labels, cell_polygons, settings, margin):
    inks = []
    for label in labels:
        ink = ink_geometry(label.rings_mm)
        if (
            ink.is_empty
            or not ink.is_valid
            or not cell_polygons[label.cell_id].covers(ink.buffer(margin))
        ):
            raise StageError("Символ пересекает контур или отверстие области.")
        if label.font_size_pt != settings.font_size_pt:
            raise StageError("Различаются размеры символов.")
        inks.append(ink)
    if len(inks) < 2:
        return
    firsts, seconds = STRtree(inks).query(inks, predicate="intersects")
    if any(a < b for a, b in zip(firsts, seconds, strict=True)):
        raise StageError("Обозначения пересекаются друг с другом.")
