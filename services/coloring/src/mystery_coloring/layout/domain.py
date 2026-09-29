"""Физическая вёрстка: фиксированный шаблон, вписывание, палитра и страницы."""

from dataclasses import dataclass
from math import isfinite

from mystery_coloring.domain import StageError
from mystery_coloring.pipeline.domain import PipelineResult, PipelineSettings

CSS_DPI = 96
PX_MM = 25.4 / CSS_DPI
TEMPLATE_ID = "artmate-px-v2"
DEFAULT_FONT_SIZE_PX = 5.16
MAX_PAGE_NUMBER = 999999


@dataclass(frozen=True)
class Rectangle:
    x: float
    y: float
    width: float
    height: float

    @property
    def right(self):
        return self.x + self.width

    @property
    def bottom(self):
        return self.y + self.height


@dataclass(frozen=True)
class ArtworkPlacement(Rectangle):
    rotation_deg: int = 0

    @property
    def source_width(self):
        return self.height if self.rotation_deg == -90 else self.width

    @property
    def source_height(self):
        return self.width if self.rotation_deg == -90 else self.height

    @property
    def transform(self):
        if self.rotation_deg == -90:
            return f"translate({self.x} {self.bottom}) rotate(-90)"
        return f"translate({self.x} {self.y})"


@dataclass(frozen=True)
class PaletteLayout:
    x: float
    y: float
    side: float
    step: float
    count: int
    font_size_pt: float

    @property
    def right(self):
        return self.x + (self.count - 1) * self.step + self.side if self.count else self.x


def validate_page_number(number):
    if type(number) is not int or not 1 <= number <= MAX_PAGE_NUMBER:
        raise StageError(f"Номер страницы должен быть целым от 1 до {MAX_PAGE_NUMBER}.")


@dataclass(frozen=True)
class ArtMateTemplate:
    """Пользователь подтвердил размеры в px; печатные измерения при CSS 96 dpi."""

    width_px: float = 612.28
    height_px: float = 858.9
    frame: Rectangle = Rectangle(37 * PX_MM, 28 * PX_MM, 538.276 * PX_MM, 760.306 * PX_MM)
    frame_stroke_mm: float = 0.78 * PX_MM

    @property
    def width_mm(self):
        return self.width_px * PX_MM

    @property
    def height_mm(self):
        return self.height_px * PX_MM

    def fit(self, pixel_width: int, pixel_height: int) -> ArtworkPlacement:
        if any(type(v) is not int or v <= 0 for v in (pixel_width, pixel_height)):
            raise StageError("Размер подготовленного изображения должен быть положительным.")
        rotation = -90 if pixel_width > pixel_height else 0
        if rotation:
            pixel_width, pixel_height = pixel_height, pixel_width
        scale = min(self.frame.width / pixel_width, self.frame.height / pixel_height)
        width, height = pixel_width * scale, pixel_height * scale
        return ArtworkPlacement(
            self.frame.x + (self.frame.width - width) / 2,
            self.frame.y + (self.frame.height - height) / 2,
            width,
            height,
            rotation,
        )

    def palette(self, colors: int, page_number: int) -> PaletteLayout:
        if type(colors) is not int or not 0 <= colors <= 35:
            raise StageError("В палитре страницы должно быть от 0 до 35 цветов для раскрашивания.")
        validate_page_number(page_number)
        # Последний разряд остаётся на месте эталона; дополнительные идут влево.
        number_left = (564.04 - (len(str(page_number)) - 1) * 12.339) * PX_MM
        available = number_left - self.frame.x - 10 * PX_MM
        original_width = (18.5 + (max(1, colors) - 1) * 26) * PX_MM
        factor = min(1, available / original_width)
        side = 18.5 * PX_MM * factor
        return PaletteLayout(
            self.frame.x,
            806.25 * PX_MM - side / 2,
            side,
            26 * PX_MM * factor,
            colors,
            9.25 * 0.75 * factor,
        )


@dataclass(frozen=True)
class LayoutSettings:
    colors: int = 24
    min_area_mm2: float = 5
    font_size_pt: float = DEFAULT_FONT_SIZE_PX * 0.75
    start_page: int = 1
    artificial_grid: bool = True

    def __post_init__(self):
        self.pipeline(180)
        validate_page_number(self.start_page)

    def pipeline(self, fitted_width_mm: float) -> PipelineSettings:
        return PipelineSettings(
            colors=self.colors,
            min_area_mm2=self.min_area_mm2,
            font_size_pt=self.font_size_pt,
            image_width_mm=fitted_width_mm,
            artificial_grid=self.artificial_grid,
        )


@dataclass(frozen=True)
class PageSummary:
    number: int
    source: str
    directory: str
    artwork: ArtworkPlacement
    result: PipelineResult


def check_physical_scale(artwork: ArtworkPlacement, width: float, height: float):
    if not all(isfinite(v) for v in (width, height)) or (
        abs(artwork.source_width - width) > 1e-6 or abs(artwork.source_height - height) > 1e-6
    ):
        raise StageError("Масштаб геометрии отличается от печатной вёрстки. Нужен пересчёт.")
