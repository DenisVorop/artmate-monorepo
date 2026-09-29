"""Независимый контракт векторного разбиения и проверки места под текст."""

from dataclasses import dataclass
from math import isfinite

from mystery_coloring.domain import StageError
from mystery_coloring.geometry.domain import Cubic, Point


@dataclass(frozen=True)
class Edge:
    id: int  # Положительный; знак ссылки в кольце задаёт направление.
    curves: tuple[Cubic, ...]
    source_boundary_id: int | None


@dataclass(frozen=True)
class Cell:
    id: int
    parent_region_id: int
    color_index: int
    rings: tuple[tuple[int, ...], ...]
    prefilled: bool = False


@dataclass(frozen=True)
class Mesh:
    edges: tuple[Edge, ...]
    cells: tuple[Cell, ...]


@dataclass(frozen=True)
class SubdivisionInput:
    width: int
    height: int
    mm_per_unit: float
    palette: tuple[tuple[int, int, int], ...]
    mesh: Mesh
    source_manifest_sha256: str


@dataclass(frozen=True)
class SubdivisionSettings:
    target_area_mm2: float | None = 60.0
    min_area_mm2: float = 5.0
    curve_bend_mm: float = 1.2
    label_font_size_pt: float = 6.0
    label_padding_mm: float = 0.2
    stroke_mm: float = 0.12
    seed: int = 7
    max_regions: int = 5000

    def __post_init__(self) -> None:
        for value, low, high, name in (
            (self.min_area_mm2, 0.001, 10000, "Минимальная площадь"),
            (self.curve_bend_mm, 0.01, 20, "Изгиб линии"),
            (self.label_font_size_pt, 3, 24, "Размер номера"),
            (self.label_padding_mm, 0, 5, "Отступ номера"),
            (self.stroke_mm, 0.01, 1, "Толщина линии"),
        ):
            if not isfinite(value) or not low <= value <= high:
                raise StageError(f"{name}: допустимо от {low} до {high}.")
        if self.target_area_mm2 is not None and (
            type(self.target_area_mm2) not in (int, float)
            or not isfinite(self.target_area_mm2)
            or not 0.01 <= self.target_area_mm2 <= 1000000
        ):
            raise StageError("Целевая площадь: допустимо от 0.01 до 1000000.")
        if self.target_area_mm2 is not None and self.target_area_mm2 < 2 * self.min_area_mm2:
            raise StageError("Целевая площадь должна быть не меньше двух минимальных.")
        if type(self.seed) is not int or not 0 <= self.seed < 2**32:
            raise StageError("Seed должен быть целым числом от 0 до 2³²−1.")
        if type(self.max_regions) is not int or not 1 <= self.max_regions <= 100000:
            raise StageError("Предел числа областей: от 1 до 100000.")


@dataclass(frozen=True)
class LabelSpace:
    cell_id: int
    text: str | None  # None: белый бумаги, место для глифа не требуется.
    width_mm: float
    height_mm: float
    center: Point | None
    angle: int = 0

    @property
    def required(self) -> bool:
        return self.text is not None


@dataclass(frozen=True)
class SubdivisionResult:
    mesh: Mesh
    areas_mm2: tuple[float, ...]  # В порядке mesh.cells, не по разреженным ID.
    label_spaces: tuple[LabelSpace, ...]
    split_count: int
    unresolved_large_ids: tuple[int, ...]
    stop_reasons: tuple[tuple[int, str], ...]
    max_parent_area_drift_mm2: float

    def validate(self, settings: SubdivisionSettings) -> None:
        if (
            not self.mesh.cells
            or len(self.mesh.cells) != len(self.areas_mm2)
            or any(
                not isfinite(a) or a <= 0 or (not c.prefilled and a < settings.min_area_mm2)
                for c, a in zip(self.mesh.cells, self.areas_mm2, strict=True)
            )
        ):
            raise StageError("Нарушена обязательная минимальная площадь при разбиении.")
        if tuple(c.id for c in self.mesh.cells) != tuple(s.cell_id for s in self.label_spaces):
            raise StageError("Не все области прошли проверку места под номер.")
        if any(
            not s.required and (s.center is not None or s.width_mm != 0 or s.height_mm != 0)
            for s in self.label_spaces
        ):
            raise StageError("Для белого бумаги не должно быть места под символ.")
        if any(
            not s.required and c.id != c.parent_region_id
            for c, s in zip(self.mesh.cells, self.label_spaces, strict=True)
        ):
            raise StageError("Белые области не должны искусственно разделяться.")
        if any(space.angle != 0 for space in self.label_spaces):
            raise StageError("Место под символ должно быть горизонтальным, без поворота.")
        if any(
            c.id != c.parent_region_id and s.required and s.center is None
            for c, s in zip(self.mesh.cells, self.label_spaces, strict=True)
        ):
            raise StageError("В новой дочерней области не найдено место под номер.")
        if not isfinite(self.max_parent_area_drift_mm2) or self.max_parent_area_drift_mm2 > 0.001:
            raise StageError("При разбиении изменились площади исходных цветных областей.")
