"""Независимая модель общего ребра и кубической кривой."""

from dataclasses import dataclass
from math import isfinite

from mystery_coloring.domain import StageError

Point = tuple[float, float]


@dataclass(frozen=True)
class Boundary:
    id: int
    left: int
    right: int
    points: tuple[Point, ...]

    @property
    def closed(self) -> bool:
        return self.points[0] == self.points[-1]


@dataclass(frozen=True)
class Cubic:
    start: Point
    first: Point
    second: Point
    end: Point

    def reversed(self) -> "Cubic":
        return Cubic(self.end, self.second, self.first, self.start)


@dataclass(frozen=True)
class SmoothBoundary:
    source: Boundary
    curves: tuple[Cubic, ...]
    samples: tuple[Point, ...]
    fallback: bool


@dataclass(frozen=True)
class GeometrySettings:
    image_width_mm: float = 180.0
    min_area_mm2: float = 5.0
    smoothing_mm: float = 0.6
    stroke_mm: float = 0.12

    def __post_init__(self) -> None:
        for value, lower, upper, name in (
            (self.image_width_mm, 1, 2000, "Ширина рисунка"),
            (self.min_area_mm2, 0.001, 10000, "Минимальная площадь"),
            (self.smoothing_mm, 0.01, 5, "Допуск сглаживания"),
            (self.stroke_mm, 0.01, 1, "Толщина линии"),
        ):
            if not isfinite(value) or not lower <= value <= upper:
                raise StageError(f"{name}: допустимо от {lower} до {upper}.")


@dataclass(frozen=True)
class GeometryResult:
    width: int
    height: int
    boundaries: tuple[SmoothBoundary, ...]
    color_indices: tuple[int, ...]
    areas_mm2: tuple[float, ...]
    raster_region_ids: bytes
    source_region_ids: tuple[tuple[int, ...], ...]
    initial_count: int
    cleanup_rounds: int
    changed_pixels: int
    max_color_change: float
    topology_rounds: int
    reduced_smoothing_boundaries: int
    max_sampled_deviation_mm: float
    prefilled_ids: frozenset[int] = frozenset()
    mergeable_detail_ids: frozenset[int] = frozenset()

    def validate_min_area(self, minimum: float) -> None:
        if (
            not self.areas_mm2
            or len(self.areas_mm2) != len(self.color_indices)
            or not self.prefilled_ids <= set(range(len(self.areas_mm2)))
            or not self.mergeable_detail_ids <= self.prefilled_ids
            or any(
                not isfinite(area) or area <= 0 or (i not in self.prefilled_ids and area < minimum)
                for i, area in enumerate(self.areas_mm2)
            )
        ):
            raise StageError("Не выполнена минимальная площадь векторных областей.")
