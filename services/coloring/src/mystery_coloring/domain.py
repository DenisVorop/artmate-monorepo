"""Модели и ограничения без зависимостей от файлов, CLI и библиотек изображений."""

from dataclasses import dataclass
from enum import StrEnum


class StageError(Exception):
    """Ожидаемая ошибка, которую можно показать пользователю."""


class Smoothing(StrEnum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass(frozen=True)
class SimplifySettings:
    colors: int = 24
    smoothing: Smoothing = Smoothing.MEDIUM
    max_size: int = 1600
    sample_size: int = 50_000
    seed: int = 42

    def __post_init__(self) -> None:
        if not 2 <= self.colors <= 256:
            raise StageError("Число цветов должно быть от 2 до 256.")
        if not isinstance(self.smoothing, Smoothing):
            raise StageError("Неизвестный режим сглаживания.")
        if not 1 <= self.max_size <= 8192:
            raise StageError("Максимальная сторона должна быть от 1 до 8192 пикселей.")
        if not self.colors <= self.sample_size <= 1_000_000:
            raise StageError("Выборка должна быть не меньше числа цветов и не больше 1000000.")
        if not 0 <= self.seed <= 2**32 - 1:
            raise StageError("Seed должен быть от 0 до 4294967295.")


@dataclass(frozen=True)
class RGBImage:
    width: int
    height: int
    pixels: bytes

    def __post_init__(self) -> None:
        if self.width < 1 or self.height < 1 or len(self.pixels) != self.width * self.height * 3:
            raise StageError("Некорректный RGB-буфер изображения.")


@dataclass(frozen=True)
class PreparedImage:
    image: RGBImage
    source_sha256: str
    original_size: tuple[int, int]
    oriented_size: tuple[int, int]
    profile_handling: str


@dataclass(frozen=True)
class PaletteColor:
    rgb: tuple[int, int, int]
    pixel_count: int


@dataclass(frozen=True)
class SimplifiedImage:
    image: RGBImage
    palette: tuple[PaletteColor, ...]
    color_indices: bytes
    prefilled_mask: bytes = b""
