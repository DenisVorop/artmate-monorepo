"""Автономное размещение символов и конечный цикл исправления тесных областей."""

from collections import defaultdict
from dataclasses import replace
from math import fsum

import cv2
import numpy as np
from shapely.affinity import scale as scale_shape
from shapely.errors import GEOSException

from mystery_coloring.domain import StageError
from mystery_coloring.numbering.adapters.merging import join_cells, same_color_details
from mystery_coloring.numbering.adapters.placement import SymbolPlacer, validate_labels
from mystery_coloring.numbering.domain import MergeRecord, NumberingResult
from mystery_coloring.subdivision.adapters.shapes import FLATNESS, Shapes, validate_mesh
from mystery_coloring.subdivision.curves import cell_area
from mystery_coloring.subdivision.domain import Mesh
from mystery_coloring.typography.domain import palette_symbols


class AutomaticNumberingProcessor:
    def __init__(self, font):
        self.font = font

    def process(self, source, settings):
        try:
            return self._process(source, settings)
        except (ValueError, GEOSException, cv2.error) as error:
            raise StageError(f"Не удалось расставить обозначения: {error}") from error

    def _process(self, source, settings):
        geometry = source.geometry
        scale = geometry.mm_per_unit
        shapes = Shapes()
        validate_mesh(geometry.mesh, geometry.width, geometry.height, shapes)
        cells = {c.id: c for c in geometry.mesh.cells}
        edges = {e.id: e for e in geometry.mesh.edges}
        areas = {c.id: cell_area(c, edges, scale) for c in cells.values()}
        if any(a < settings.min_area_mm2 for i, a in areas.items() if not cells[i].prefilled):
            raise StageError("Во входе есть области меньше минимума. Повторите третий этап.")
        originals = cells.copy()
        original_areas = areas.copy()
        lineage = {i: (i,) for i in cells}
        records = []
        polygons = {
            c.id: scale_shape(shapes.polygon(c, edges), xfact=scale, yfact=scale, origin=(0, 0))
            for c in cells.values()
        }
        placer = SymbolPlacer(self.font, settings, 2 * FLATNESS * scale)
        hints = {
            h.cell_id: tuple(v * scale for v in h.center)
            for h in source.hints
            if h.center is not None
        }
        symbols = palette_symbols(geometry.palette)
        labels = {
            i: (
                placer.fit(polygons[i], i, symbols[c.color_index], hints.get(i))
                if not c.prefilled and symbols[c.color_index] is not None
                else None
            )
            for i, c in cells.items()
        }

        def unplaced():
            return [
                i
                for i, c in cells.items()
                if not c.prefilled and symbols[c.color_index] is not None and labels[i] is None
            ]

        initially = tuple(unplaced())
        rgb = np.asarray(geometry.palette, dtype=np.float32).reshape(1, -1, 3) / 255
        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).reshape(-1, 3)
        distances = np.linalg.norm(lab[:, None] - lab[None, :], axis=2)
        next_id = max(cells) + 1
        has_mergeable_details = any(c.mergeable_prefilled for c in cells.values())
        has_prefilled_details = any(c.prefilled for c in cells.values())

        def printable_detail_merge(uses, *, include_locked):
            for target, cell in sorted(cells.items()):
                if cell.prefilled:
                    continue
                symbol = symbols[cell.color_index]
                details = same_color_details(
                    (target,),
                    cell.color_index,
                    cells,
                    uses,
                    include_locked=include_locked and symbol is not None,
                )
                if not details:
                    continue
                members = (details[0], target, *details[1:])
                try:
                    merged, removed = join_cells(
                        tuple(cells[i] for i in members), edges, next_id, shapes
                    )
                    if cell_area(merged, edges, scale) < settings.min_area_mm2:
                        continue
                    polygon = scale_shape(
                        shapes.polygon(merged, edges), xfact=scale, yfact=scale, origin=(0, 0)
                    )
                    hint = (
                        labels[target].center_mm
                        if labels[target] is not None
                        else hints.get(target)
                    )
                    label = (
                        placer.fit(polygon, next_id, symbol, hint) if symbol is not None else None
                    )
                    if symbol is None or label is not None:
                        return members, merged, removed, polygon, label
                except (StageError, ValueError, GEOSException):
                    continue
            return None

        while True:
            missing = unplaced()
            if not missing and not has_prefilled_details:
                break
            uses = defaultdict(list)
            for c in cells.values():
                for ring in c.rings:
                    for ref in ring:
                        uses[abs(ref)].append(c.id)
            proposal = None
            if missing:
                bad = min(missing, key=lambda i: (areas[i], i))
                neighbors = defaultdict(list)
                for ring in cells[bad].rings:
                    for ref in ring:
                        for other in uses[abs(ref)]:
                            if other != bad:
                                neighbors[other].append(abs(ref))
                candidates = []
                for other, common in sorted(neighbors.items()):
                    if cells[other].prefilled:
                        continue
                    border = sum(
                        sum(np.linalg.norm(np.subtract(c.end, c.start)) for c in edges[e].curves)
                        for e in common
                    )
                    joined = {}
                    for color in sorted({cells[bad].color_index, cells[other].color_index}):
                        details = (
                            same_color_details((bad, other), color, cells, uses)
                            if has_mergeable_details
                            else ()
                        )
                        for detail_group in (details, ()) if details else ((),):
                            members = (bad, other, *detail_group)
                            try:
                                if detail_group not in joined:
                                    merged, removed = join_cells(
                                        tuple(cells[i] for i in members), edges, next_id, shapes
                                    )
                                    polygon = scale_shape(
                                        shapes.polygon(merged, edges),
                                        xfact=scale,
                                        yfact=scale,
                                        origin=(0, 0),
                                    )
                                    joined[detail_group] = merged, removed, polygon
                                merged, removed, polygon = joined[detail_group]
                                candidate = replace(merged, color_index=color)
                                label = (
                                    placer.fit(polygon, next_id, symbols[color])
                                    if symbols[color] is not None
                                    else None
                                )
                                if detail_group and symbols[color] is not None and label is None:
                                    continue
                                # Ошибка цвета учитывает все исходные области в цепочке слияний.
                                cost = fsum(
                                    original_areas[i]
                                    * float(distances[originals[i].color_index, color])
                                    for member in members
                                    for i in lineage[member]
                                )
                                candidates.append(
                                    (
                                        (
                                            symbols[color] is not None and label is None,
                                            cost,
                                            -border,
                                            other,
                                            color,
                                        ),
                                        members,
                                        candidate,
                                        removed,
                                        polygon,
                                        label,
                                    )
                                )
                                break
                            except (StageError, ValueError, GEOSException):
                                continue
                if candidates:
                    _, *proposal = min(candidates, key=lambda c: c[0])
            if proposal is None and (
                has_mergeable_details or (not missing and has_prefilled_details)
            ):
                # Цветовая коррекция завершена, поэтому модельную деталь уже не перекрасят.
                proposal = printable_detail_merge(uses, include_locked=not missing)
            if proposal is None:
                if not missing:
                    break
                raise StageError(
                    "Символ не помещается после доступных объединений. "
                    "Увеличьте весь рисунок или уменьшите единый --font-size-pt."
                )
            members, merged, removed, polygon, label = proposal
            bad = members[0]
            records.append(
                MergeRecord(
                    bad,
                    members[1],
                    next_id,
                    merged.color_index,
                    sum(areas[i] for i in members if cells[i].color_index != merged.color_index),
                    max(
                        float(distances[cells[i].color_index, merged.color_index]) for i in members
                    ),
                    removed,
                )
            )
            lineage[next_id] = tuple(sorted(old for i in members for old in lineage.pop(i)))
            for i in members:
                del cells[i], polygons[i], labels[i], areas[i]
            cells[next_id] = merged
            polygons[next_id] = polygon
            labels[next_id] = label
            areas[next_id] = cell_area(merged, edges, scale)
            for e in removed:
                del edges[e]
            next_id += 1
        for i, cell in cells.items():
            symbol = symbols[cell.color_index]
            if not cell.mergeable_prefilled or symbol is None or areas[i] < settings.min_area_mm2:
                continue
            label = placer.fit(polygons[i], i, symbol)
            if label is not None:
                cells[i] = replace(cell, prefilled=False, mergeable_prefilled=False)
                labels[i] = label
        mesh = Mesh(
            tuple(sorted(edges.values(), key=lambda e: e.id)),
            tuple(sorted(cells.values(), key=lambda c: c.id)),
        )
        validate_mesh(mesh, geometry.width, geometry.height, shapes)
        output_labels = tuple(
            label
            for cell in mesh.cells
            if not cell.prefilled and symbols[cell.color_index] is not None
            for label in placer.repetitions(polygons[cell.id], labels[cell.id])
        )
        validate_labels(output_labels, polygons, settings, placer.margin)
        changed = []
        errors = []
        maximum = 0
        for cell in mesh.cells:
            for original in lineage[cell.id]:
                distance = float(distances[originals[original].color_index, cell.color_index])
                errors.append(original_areas[original] * distance)
                maximum = max(maximum, distance)
                if originals[original].color_index != cell.color_index:
                    changed.append(original_areas[original])
        result = NumberingResult(
            mesh,
            output_labels,
            tuple(lineage[c.id] for c in mesh.cells),
            tuple(records),
            initially,
            self.font.name,
            self.font.sha256,
            tuple(areas[c.id] for c in mesh.cells),
            fsum(changed),
            fsum(errors) / fsum(areas.values()),
            maximum,
        )
        result.validate(source, settings)
        return result
