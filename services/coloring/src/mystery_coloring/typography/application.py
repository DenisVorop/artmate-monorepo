"""Порт общего векторного шрифта."""

from typing import Protocol

from mystery_coloring.typography.domain import GlyphRun


class VectorFont(Protocol):
    name: str
    sha256: str

    def glyphs(self, text: str) -> GlyphRun: ...
