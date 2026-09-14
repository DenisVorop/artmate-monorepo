"""Чтение проверенного артефакта третьего этапа, а не произвольного SVG."""

import hashlib
import json
from math import isclose, isfinite
from pathlib import Path

from mystery_coloring.domain import StageError
from mystery_coloring.geometry.curves import region_rings, sample_curves
from mystery_coloring.geometry.domain import Boundary, Cubic
from mystery_coloring.subdivision.curves import cell_area, separate_touching_rings
from mystery_coloring.subdivision.domain import Cell, Edge, Mesh, SubdivisionInput


class GeometryReader:
    def read(self, source: Path) -> SubdivisionInput:
        try:
            raw_manifest = (source / "manifest.json").read_bytes()
            manifest = json.loads(raw_manifest)
            if manifest["schema_version"] != 1 or not manifest["algorithm"].startswith(
                "strict-area-shared-rounded-curves-"
            ):
                raise ValueError("Нужен результат третьего этапа геометрии.")
            documents = {}
            for name in ("geometry.json", "palette.json"):
                raw = (source / name).read_bytes()
                if hashlib.sha256(raw).hexdigest() != manifest["artifacts_sha256"][name]:
                    raise ValueError(f"Не совпала контрольная сумма {name}.")
                documents[name] = json.loads(raw)
            geometry = documents["geometry.json"]
            width, height = manifest["working_size"]
            scale = geometry["mm_per_unit"]
            if (
                geometry["schema_version"] != 1
                or type(width) is not int
                or type(height) is not int
                or min(width, height) <= 0
                or not isfinite(scale)
                or scale <= 0
                or not isclose(scale * width, manifest["settings"]["image_width_mm"])
            ):
                raise ValueError("Некорректный физический масштаб геометрии.")
            palette_data = documents["palette.json"]["colors"]
            palette = tuple(tuple(item["rgb"]) for item in palette_data)
            if not palette or any(
                item["index"] != i
                or item["number"] != i + 1
                or len(palette[i]) != 3
                or any(type(v) is not int or not 0 <= v <= 255 for v in palette[i])
                for i, item in enumerate(palette_data)
            ):
                raise ValueError("Некорректная палитра.")
            edges, boundaries = [], []
            for i, item in enumerate(geometry["boundaries"]):
                if item["id"] != i:
                    raise ValueError("Непоследовательные ID исходных границ.")
                curves = tuple(
                    Cubic(*(tuple(c[k]) for k in ("start", "first", "second", "end")))
                    for c in item["curves"]
                )
                if (
                    not curves
                    or any(
                        len(p) != 2 or any(not isfinite(v) for v in p)
                        for c in curves
                        for p in (c.start, c.first, c.second, c.end)
                    )
                    or any(a.end != b.start for a, b in zip(curves, curves[1:], strict=False))
                ):
                    raise ValueError("Некорректные кубические границы.")
                edges.append(Edge(i + 1, curves, i))
                boundaries.append(
                    Boundary(i, item["left"], item["right"], sample_curves(curves, error=0.005))
                )
            rings = region_rings(tuple(boundaries))
            edge_map = {edge.id: edge for edge in edges}
            cells = tuple(
                Cell(
                    item["id"],
                    item["id"],
                    item["color_index"],
                    separate_touching_rings(rings[item["id"]], edge_map),
                )
                for item in geometry["regions"]
            )
            if not cells or tuple(c.id for c in cells) != tuple(range(len(cells))):
                raise ValueError("Некорректные ID областей.")
            for cell, item in zip(cells, geometry["regions"], strict=True):
                if not 0 <= cell.color_index < len(palette) or not isclose(
                    cell_area(cell, edge_map, scale), item["area_mm2"], abs_tol=1e-7
                ):
                    raise ValueError("Цвет или площадь не соответствует исходной геометрии.")
            return SubdivisionInput(
                width,
                height,
                scale,
                palette,
                Mesh(tuple(edges), cells),
                hashlib.sha256(raw_manifest).hexdigest(),
            )
        except (OSError, ValueError, TypeError, KeyError, IndexError, OverflowError) as error:
            raise StageError(f"Не удалось прочитать векторную геометрию: {error}") from error
