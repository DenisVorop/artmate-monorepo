"""Общие обозначения и контуры глифов, без внешних зависимостей."""

from dataclasses import dataclass

from mystery_coloring.domain import StageError
from mystery_coloring.geometry.domain import Cubic
from mystery_coloring.palette import is_paper_white

SYMBOLS = "123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def symbol_for(color_index: int) -> str:
    if type(color_index) is not int or not 0 <= color_index < len(SYMBOLS):
        raise StageError("Набор 1–9, A–Z поддерживает не более 35 цветов.")
    return SYMBOLS[color_index]


@dataclass(frozen=True)
class GlyphRun:
    text: str
    rings: tuple[tuple[Cubic, ...], ...]  # В единицах em, Y вниз.
    bounds: tuple[float, float, float, float]


def palette_symbols(palette: tuple[tuple[int, int, int], ...]) -> tuple[str | None, ...]:
    """Последовательные символы после сортировки; белый не занимает обозначение."""
    if not 1 <= len(palette) <= len(SYMBOLS):
        raise StageError("Набор 1–9, A–Z поддерживает от 1 до 35 цветов.")
    symbols: list[str | None] = []
    ordinal = 0
    for rgb in palette:
        if is_paper_white(rgb):
            symbols.append(None)
        else:
            symbols.append(symbol_for(ordinal))
            ordinal += 1
    return tuple(symbols)


def numbered_colors(palette: tuple[tuple[int, int, int], ...]):
    """Цвета печатной легенды в порядке символов; исходные индексы сохраняются."""
    return tuple(
        (rgb, symbol)
        for rgb, symbol in zip(palette, palette_symbols(palette), strict=True)
        if symbol is not None
    )
