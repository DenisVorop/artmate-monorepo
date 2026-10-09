"""Единые настройки; преобразование в параметры этапов без файлов и адаптеров."""

from dataclasses import dataclass

from mystery_coloring.domain import SimplifySettings, StageError
from mystery_coloring.geometry.domain import GeometrySettings
from mystery_coloring.numbering.domain import NumberingSettings
from mystery_coloring.subdivision.domain import SubdivisionSettings


@dataclass(frozen=True)
class PipelineSettings:
    colors: int = 24
    min_area_mm2: float = 5
    font_size_pt: float = 6
    image_width_mm: float = 180
    artificial_grid: bool = True

    def __post_init__(self):
        if type(self.colors) is not int or not 2 <= self.colors <= 35:
            raise StageError("Число цветов должно быть целым от 2 до 35 (символы 1–9/A–Z).")
        for name in ("min_area_mm2", "font_size_pt", "image_width_mm"):
            if type(getattr(self, name)) not in (int, float):
                raise StageError(f"{name}: требуется число.")
        if type(self.artificial_grid) is not bool:
            raise StageError("Искусственная сетка: требуется true или false.")
        self.geometry()
        self.subdivision()
        self.numbering()

    def preparation(self) -> SimplifySettings:
        return SimplifySettings(colors=self.colors)

    def geometry(self) -> GeometrySettings:
        return GeometrySettings(image_width_mm=self.image_width_mm, min_area_mm2=self.min_area_mm2)

    def subdivision(self) -> SubdivisionSettings:
        return SubdivisionSettings(
            min_area_mm2=self.min_area_mm2,
            label_font_size_pt=self.font_size_pt,
            target_area_mm2=max(60, 2 * self.min_area_mm2) if self.artificial_grid else None,
        )

    def numbering(self) -> NumberingSettings:
        return NumberingSettings(min_area_mm2=self.min_area_mm2, font_size_pt=self.font_size_pt)


@dataclass(frozen=True)
class PipelineResult:
    colors_used: int
    region_count: int
    label_count: int
    min_area_mm2: float
    font_name: str
    font_sha256: str
    merges: int
    recolored_fraction: float
