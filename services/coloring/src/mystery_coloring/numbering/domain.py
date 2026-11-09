"""Обозначения одного размера, автоматические исправления и векторный результат."""

from dataclasses import dataclass
from math import isfinite

from mystery_coloring.domain import StageError
from mystery_coloring.geometry.domain import Cubic, Point
from mystery_coloring.subdivision.domain import LabelSpace, Mesh, SubdivisionInput
from mystery_coloring.typography.domain import SYMBOLS as SYMBOLS
from mystery_coloring.typography.domain import GlyphRun as GlyphRun
from mystery_coloring.typography.domain import palette_symbols
from mystery_coloring.typography.domain import symbol_for as symbol_for


@dataclass(frozen=True)
class NumberingSettings:
    font_size_pt: float = 6
    padding_mm: float = 0.15
    stroke_mm: float = 0.12
    min_area_mm2: float = 5
    repeat_distance_mm: float = 18
    max_labels_per_region: int = 3

    def __post_init__(self):
        for value, low, high, name in (
            (self.font_size_pt, 3, 24, "Размер обозначений"),
            (self.padding_mm, 0.05, 3, "Отступ обозначений"),
            (self.stroke_mm, 0.01, 1, "Толщина контура"),
            (self.min_area_mm2, 0.001, 10000, "Минимальная площадь"),
            (self.repeat_distance_mm, 3, 100, "Расстояние между повторениями"),
        ):
            if not isfinite(value) or not low <= value <= high:
                raise StageError(f"{name}: допустимо от {low} до {high}.")
        if type(self.max_labels_per_region) is not int or not 1 <= self.max_labels_per_region <= 10:
            raise StageError("Число обозначений в области: от 1 до 10.")


@dataclass(frozen=True)
class NumberingInput:
    geometry: SubdivisionInput
    hints: tuple[LabelSpace, ...]


@dataclass(frozen=True)
class NumberLabel:
    cell_id: int
    text: str
    center_mm: Point
    font_size_pt: float
    angle_deg: float
    rings_mm: tuple[tuple[Cubic, ...], ...]
    repeated: bool = False


@dataclass(frozen=True)
class MergeRecord:
    from_cell_id: int
    into_cell_id: int
    result_cell_id: int
    color_index: int
    recolored_area_mm2: float
    delta_e76: float
    removed_edge_ids: tuple[int, ...]


@dataclass(frozen=True)
class NumberingResult:
    mesh: Mesh
    labels: tuple[NumberLabel, ...]
    source_cell_ids: tuple[tuple[int, ...], ...]
    merges: tuple[MergeRecord, ...]
    initially_unplaced_ids: tuple[int, ...]
    font_name: str
    font_sha256: str
    areas_mm2: tuple[float, ...]
    recolored_area_mm2: float
    mean_delta_e76: float
    max_delta_e76: float

    def validate(self, source: NumberingInput, settings: NumberingSettings):
        cells = {c.id: c for c in self.mesh.cells}
        symbols = palette_symbols(source.geometry.palette)
        if any(
            type(c.color_index) is not int or not 0 <= c.color_index < len(symbols)
            for c in cells.values()
        ):
            raise StageError("Неверный индекс цвета области.")
        required = {
            c.id for c in cells.values() if not c.prefilled and symbols[c.color_index] is not None
        }
        if (
            not cells
            or len(self.areas_mm2) != len(cells)
            or any(
                not isfinite(a) or a <= 0 or (not c.prefilled and a < settings.min_area_mm2)
                for c, a in zip(self.mesh.cells, self.areas_mm2, strict=True)
            )
            or {label.cell_id for label in self.labels} != required
        ):
            raise StageError("Не все области подписаны или нарушена минимальная площадь.")
        for label in self.labels:
            if label.angle_deg != 0:
                raise StageError("Все символы должны быть горизонтальными, без поворота.")
            if (
                label.text != symbols[cells[label.cell_id].color_index]
                or label.font_size_pt != settings.font_size_pt
                or not all(isfinite(v) for v in (*label.center_mm, label.angle_deg))
                or not label.rings_mm
            ):
                raise StageError("Неверный символ или размер обозначения.")
        if len(self.source_cell_ids) != len(cells) or sorted(
            i for ids in self.source_cell_ids for i in ids
        ) != sorted(c.id for c in source.geometry.mesh.cells):
            raise StageError("Нарушено происхождение объединённых областей.")
        originals = {c.id: c for c in source.geometry.mesh.cells}
        for cell, ids in zip(self.mesh.cells, self.source_cell_ids, strict=True):
            members = tuple(originals[i] for i in ids)
            if cell.prefilled:
                if members != (cell,):
                    raise StageError("Готовая деталь изменилась при нумерации.")
            elif any(
                original.prefilled
                and not original.mergeable_prefilled
                and (
                    original.color_index != cell.color_index
                    or symbols[cell.color_index] is None
                    or all(member.prefilled for member in members)
                )
                for original in members
            ):
                raise StageError("Защищённая деталь должна войти в обычную область того же цвета.")

    def paper_white_cell_ids(self, source: NumberingInput) -> tuple[int, ...]:
        symbols = palette_symbols(source.geometry.palette)
        return tuple(c.id for c in self.mesh.cells if symbols[c.color_index] is None)
