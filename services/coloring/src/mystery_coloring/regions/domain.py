"""Независимые модели растровых областей и параметры печатного масштаба."""

from dataclasses import dataclass
from math import ceil, isfinite

from mystery_coloring.domain import StageError


@dataclass(frozen=True)
class RegionSettings:
    image_width_mm: float = 180.0
    min_area_mm2: float = 1.0
    max_color_distance: float = 18.0

    def __post_init__(self) -> None:
        if not isfinite(self.image_width_mm) or not 1 <= self.image_width_mm <= 2000:
            raise StageError("Ширина рисунка должна быть от 1 до 2000 мм.")
        if not isfinite(self.min_area_mm2) or not 0 <= self.min_area_mm2 <= 10000:
            raise StageError("Минимальная площадь должна быть от 0 до 10000 мм².")
        if not isfinite(self.max_color_distance) or not 0 <= self.max_color_distance <= 300:
            raise StageError("Допустимое различие Lab должно быть от 0 до 300.")

    def min_area_pixels(self, width: int) -> int:
        return ceil(self.min_area_mm2 / (self.image_width_mm / width) ** 2)


@dataclass(frozen=True)
class RegionInput:
    width: int
    height: int
    palette: tuple[tuple[int, int, int], ...]
    color_indices: bytes
    source_manifest_sha256: str
    # 0 = paint, 1 = contrast detail, 2 = face feature, 3 = stroke protected through geometry.
    prefilled_mask: bytes = b""

    def __post_init__(self) -> None:
        if not 1 <= self.width * self.height <= 40_000_000 or min(self.width, self.height) < 1:
            raise StageError("Недопустимый размер карты цветов (максимум 40 млн пикселей).")
        if len(self.color_indices) != self.width * self.height:
            raise StageError("Размер карты цветов не совпадает с изображением.")
        if not 1 <= len(self.palette) <= 256:
            raise StageError("Палитра должна содержать 1–256 цветов.")
        if any(
            len(color) != 3 or any(type(c) is not int or not 0 <= c <= 255 for c in color)
            for color in self.palette
        ):
            raise StageError("Недопустимые RGB-значения палитры.")
        if self.prefilled_mask and (
            len(self.prefilled_mask) != self.width * self.height or max(self.prefilled_mask) > 3
        ):
            raise StageError("Некорректная маска готовых деталей.")
        if max(self.color_indices) >= len(self.palette):
            raise StageError("Карта цветов ссылается на отсутствующий цвет.")


@dataclass(frozen=True)
class SharedBorder:
    first: int
    second: int
    length_pixels: int


@dataclass(frozen=True)
class Region:
    id: int
    color_index: int
    area_pixels: int
    perimeter_pixels: int
    bbox: tuple[int, int, int, int]
    centroid: tuple[float, float]
    source_region_ids: tuple[int, ...]
    below_min_area: bool
    prefilled: bool = False


@dataclass(frozen=True)
class RegionResult:
    width: int
    height: int
    # Обе карты содержат uint32 little-endian, построчно; это не 8-битные индексы цветов.
    initial_region_ids: bytes
    region_ids: bytes
    color_indices: bytes
    regions: tuple[Region, ...]
    borders: tuple[SharedBorder, ...]
    initial_count: int
    changed_pixels: int
    max_color_change: float
    mergeable_detail_ids: frozenset[int] = frozenset()
    stroke_ids: frozenset[int] = frozenset()
