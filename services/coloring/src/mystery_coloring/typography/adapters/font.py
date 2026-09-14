"""Точные контуры ArialMT из поставляемого ресурса fonts/Arial/arialmt.ttf."""

import hashlib
from importlib.resources import files
from io import BytesIO

from fontTools.pens.basePen import BasePen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont, TTLibError

from mystery_coloring.domain import StageError
from mystery_coloring.geometry.curves import interpolate
from mystery_coloring.geometry.domain import Cubic
from mystery_coloring.typography.domain import SYMBOLS, GlyphRun


class OutlinePen(BasePen):
    def __init__(self, glyph_set, upem, offset):
        super().__init__(glyph_set)
        self.upem, self.offset = upem, offset
        self.rings, self.current = [], []

    def point(self, p):
        return (p[0] + self.offset) / self.upem, -p[1] / self.upem

    def _moveTo(self, p):
        self.start = self.last = self.point(p)
        self.current = []

    def _lineTo(self, p):
        end = self.point(p)
        self.current.append(
            Cubic(
                self.last,
                interpolate(self.last, end, 1 / 3),
                interpolate(self.last, end, 2 / 3),
                end,
            )
        )
        self.last = end

    def _curveToOne(self, a, b, end):
        a, b, end = self.point(a), self.point(b), self.point(end)
        self.current.append(Cubic(self.last, a, b, end))
        self.last = end

    def _qCurveToOne(self, control, end):
        control, end = self.point(control), self.point(end)
        self.current.append(
            Cubic(
                self.last,
                interpolate(self.last, control, 2 / 3),
                interpolate(end, control, 2 / 3),
                end,
            )
        )
        self.last = end

    def _closePath(self):
        if self.last != self.start:
            self.current.append(
                Cubic(
                    self.last,
                    interpolate(self.last, self.start, 1 / 3),
                    interpolate(self.last, self.start, 2 / 3),
                    self.start,
                )
            )
        self.rings.append(tuple(self.current))

    def _endPath(self):
        self._closePath()


class ArialFont:
    resource = "fonts/Arial/arialmt.ttf"

    def __init__(self):
        try:
            data = files("mystery_coloring").joinpath(self.resource).read_bytes()
            self._font = TTFont(BytesIO(data))
            self.name = self._font["name"].getDebugName(6)
            if self.name != "ArialMT":
                raise StageError("В fonts/Arial/arialmt.ttf ожидается шрифт ArialMT.")
            self.sha256 = hashlib.sha256(data).hexdigest()
            self._glyphs = self._font.getGlyphSet()
            self._cmap = self._font.getBestCmap() or {}
            self._cache = {}
            for char in SYMBOLS + "0#":
                self.glyphs(char)
        except (OSError, TTLibError, KeyError, ValueError) as error:
            raise StageError(f"Не удалось загрузить ArialMT ({self.resource}): {error}") from error

    def glyphs(self, text: str) -> GlyphRun:
        if text in self._cache:
            return self._cache[text]
        offset = 0
        upem = self._font["head"].unitsPerEm
        rings = []
        bounds = []
        for char in text:
            name = self._cmap.get(ord(char))
            if name is None:
                raise StageError(f"Шрифт не содержит символ {char!r}.")
            pen = OutlinePen(self._glyphs, upem, offset)
            self._glyphs[name].draw(pen)
            rings.extend(pen.rings)
            bp = BoundsPen(self._glyphs)
            self._glyphs[name].draw(bp)
            if bp.bounds:
                x0, y0, x1, y1 = bp.bounds
                bounds.append(((x0 + offset) / upem, -y1 / upem, (x1 + offset) / upem, -y0 / upem))
            offset += self._font["hmtx"][name][0]
        if not bounds:
            raise StageError("У текста нет видимого контура.")
        result = GlyphRun(
            text,
            tuple(rings),
            (
                min(b[0] for b in bounds),
                min(b[1] for b in bounds),
                max(b[2] for b in bounds),
                max(b[3] for b in bounds),
            ),
        )
        self._cache[text] = result
        return result
