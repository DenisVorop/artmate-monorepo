"""Чтение завершённого векторного разбиения с проверкой хешей и масштаба."""

import hashlib
import json
from math import isclose, isfinite
from pathlib import Path

from mystery_coloring.domain import StageError
from mystery_coloring.geometry.domain import Cubic
from mystery_coloring.numbering.domain import SYMBOLS, NumberingInput
from mystery_coloring.subdivision.curves import cell_area
from mystery_coloring.subdivision.domain import Cell, Edge, LabelSpace, Mesh, SubdivisionInput
from mystery_coloring.typography.domain import palette_symbols


class SubdivisionReader:
    def read(self, source: Path) -> NumberingInput:
        try:
            raw = (source / "manifest.json").read_bytes()
            manifest = json.loads(raw)
            if manifest["schema_version"] != 1 or manifest["algorithm"] not in {
                "shared-cubic-subdivision-v1",
                "shared-cubic-subdivision-v2",
                "shared-cubic-subdivision-v3",
                "shared-cubic-subdivision-v4",
            }:
                raise ValueError("Ожидается завершённый четвёртый этап.")
            docs = {}
            for name in ("geometry.json", "palette.json", "label-spaces.json"):
                data = (source / name).read_bytes()
                if hashlib.sha256(data).hexdigest() != manifest["artifacts_sha256"][name]:
                    raise ValueError(f"Неверная контрольная сумма {name}.")
                docs[name] = json.loads(data)
            g = docs["geometry.json"]
            width, height = g["working_size"]
            scale = g["mm_per_unit"]
            if (
                g["schema_version"] != 2
                or type(width) is not int
                or type(height) is not int
                or min(width, height) <= 0
                or not isfinite(scale)
                or scale <= 0
                or [width, height] != manifest["working_size"]
                or not all(
                    isclose(a * scale, b)
                    for a, b in zip((width, height), manifest["image_size_mm"], strict=True)
                )
            ):
                raise ValueError("Некорректный физический масштаб.")
            palette = tuple(tuple(c["rgb"]) for c in docs["palette.json"]["colors"])
            if not 1 <= len(palette) <= len(SYMBOLS):
                raise ValueError("Набор 1–9, A–Z поддерживает до 35 цветов.")
            if any(
                len(c) != 3 or any(type(v) is not int or not 0 <= v <= 255 for v in c)
                for c in palette
            ):
                raise ValueError("Неверная палитра.")
            edges = tuple(
                Edge(
                    e["id"],
                    tuple(
                        Cubic(*(tuple(c[k]) for k in ("start", "first", "second", "end")))
                        for c in e["curves"]
                    ),
                    e["source_boundary_id"],
                )
                for e in g["boundaries"]
            )
            edge_map = {e.id: e for e in edges}
            if any(
                type(e.id) is not int
                or e.id <= 0
                or not e.curves
                or any(
                    len(p) != 2 or any(not isfinite(v) for v in p)
                    for c in e.curves
                    for p in (c.start, c.first, c.second, c.end)
                )
                or any(a.end != b.start for a, b in zip(e.curves, e.curves[1:], strict=False))
                for e in edges
            ):
                raise ValueError("Некорректные рёбра.")
            cells = tuple(
                Cell(
                    c["id"],
                    c["parent_region_id"],
                    c["color_index"],
                    tuple(tuple(r) for r in c["rings"]),
                    c.get("prefilled", False),
                    c.get("mergeable_prefilled", False),
                )
                for c in g["regions"]
            )
            for cell, item in zip(cells, g["regions"], strict=True):
                if not 0 <= cell.color_index < len(palette) or not isclose(
                    cell_area(cell, edge_map, scale), item["area_mm2"], abs_tol=1e-7
                ):
                    raise ValueError("Площадь или цвет не соответствует геометрии.")
            hints = tuple(
                LabelSpace(
                    h["cell_id"],
                    h["text"],
                    h["width_mm"],
                    h["height_mm"],
                    tuple(h["center"]) if h["center"] is not None else None,
                    h["angle"],
                )
                for h in docs["label-spaces.json"]["regions"]
            )
            if manifest["algorithm"] in {
                "shared-cubic-subdivision-v3",
                "shared-cubic-subdivision-v4",
            } and any(hint.angle != 0 for hint in hints):
                raise ValueError("В разбиении v3/v4 место под символ должно быть горизонтальным.")
            if manifest["algorithm"] == "shared-cubic-subdivision-v4":
                symbols = palette_symbols(palette)
                if len(hints) != len(cells) or any(
                    h.cell_id != c.id
                    or h.text != symbols[c.color_index]
                    or (
                        not h.required
                        and (h.center is not None or h.width_mm != 0 or h.height_mm != 0)
                    )
                    for h, c in zip(hints, cells, strict=True)
                ):
                    raise ValueError("Резервирование не соответствует символам палитры.")
            return NumberingInput(
                SubdivisionInput(
                    width,
                    height,
                    scale,
                    palette,
                    Mesh(edges, cells),
                    hashlib.sha256(raw).hexdigest(),
                ),
                hints,
            )
        except (OSError, ValueError, TypeError, KeyError, IndexError, OverflowError) as error:
            raise StageError(f"Не удалось прочитать разбиение: {error}") from error
