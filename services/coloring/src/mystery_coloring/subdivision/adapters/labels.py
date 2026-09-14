"""Резервирование фактических габаритов того же шрифта, что и в итоговой схеме."""

from math import hypot

from shapely import Point, box
from shapely.ops import polylabel

from mystery_coloring.subdivision.adapters.shapes import FLATNESS
from mystery_coloring.subdivision.domain import LabelSpace, SubdivisionSettings
from mystery_coloring.typography.application import VectorFont


class LabelFitter:
    def __init__(
        self,
        settings: SubdivisionSettings,
        scale: float,
        font: VectorFont,
        symbols: tuple[str | None, ...],
    ):
        self.settings, self.scale = settings, scale
        self.symbols = symbols
        self.font = font
        self.font_sha256 = font.sha256

    def measure(self, text: str) -> tuple[float, float]:
        x0, y0, x1, y1 = self.font.glyphs(text).bounds
        unit = self.settings.label_font_size_pt * 25.4 / 72
        return (x1 - x0) * unit, (y1 - y0) * unit

    def fit(self, polygon, cell_id: int, color_index: int) -> LabelSpace:
        text = self.symbols[color_index]
        if text is None:
            return LabelSpace(cell_id, None, 0, 0, None)
        width, height = self.measure(text)
        empty = LabelSpace(cell_id, text, width, height, None)
        padding = (
            self.settings.label_padding_mm + self.settings.stroke_mm / 2
        ) / self.scale + 2 * FLATNESS
        half_w, half_h = width / (2 * self.scale) + padding, height / (2 * self.scale) + padding
        xmin, ymin, xmax, ymax = polygon.bounds
        if xmax - xmin < 2 * half_w or ymax - ymin < 2 * half_h:
            return empty
        pole = polylabel(polygon, tolerance=0.025 / self.scale)
        candidates = [pole, polygon.representative_point(), polygon.centroid]
        # Быстрый круговой тест — достаточное условие; затем проверяется весь прямоугольник.
        if polygon.boundary.distance(pole) >= hypot(half_w, half_h):
            return LabelSpace(cell_id, text, width, height, (pole.x, pole.y))
        candidates.extend(
            Point(xmin + (xmax - xmin) * i / 10, ymin + (ymax - ymin) * j / 10)
            for i in range(1, 10)
            for j in range(1, 10)
        )
        for center in candidates:
            rectangle = box(
                center.x - half_w, center.y - half_h, center.x + half_w, center.y + half_h
            )
            if polygon.covers(rectangle):
                return LabelSpace(cell_id, text, width, height, (center.x, center.y))
        # Это результат ограниченного поиска, не доказательство отсутствия любой позиции.
        return empty
