"""Адаптивные плавные разрезы; площадь, отверстия и место под номер проверяются до приёмки."""

import heapq
from collections import defaultdict
from math import atan2, cos, fsum, hypot, pi, sin
from random import Random

import numpy as np
from shapely import LineString, Point
from shapely.errors import GEOSException

from mystery_coloring.domain import StageError
from mystery_coloring.geometry.curves import canonical_curves, sample_curves
from mystery_coloring.geometry.domain import Cubic
from mystery_coloring.subdivision.adapters.cuts import intersections, outer_ring, propose_cut
from mystery_coloring.subdivision.adapters.labels import LabelFitter
from mystery_coloring.subdivision.adapters.shapes import FLATNESS, Shapes, validate_mesh
from mystery_coloring.subdivision.curves import cell_area
from mystery_coloring.subdivision.domain import (
    LabelSpace,
    Mesh,
    SubdivisionInput,
    SubdivisionResult,
    SubdivisionSettings,
)
from mystery_coloring.typography.domain import palette_symbols


def principal_direction(polygon):
    """Длинная ось минимального прямоугольника по рёбрам выпуклой оболочки."""
    hull = np.asarray(polygon.convex_hull.exterior.coords)
    best = (float("inf"), 0.0)
    for vector in np.diff(hull, axis=0):
        length = hypot(*vector)
        if length < 1e-12:
            continue
        axis = vector / length
        across = np.asarray((-axis[1], axis[0]))
        width, height = float(np.ptp(hull @ axis)), float(np.ptp(hull @ across))
        angle = atan2(axis[1], axis[0]) + (pi / 2 if height > width else 0)
        candidate = (width * height, angle % pi)
        if candidate < best:
            best = candidate
    return best[1]


class CurvedSubdivisionProcessor:
    def __init__(self, font):
        self.font = font

    def process(self, source: SubdivisionInput, settings: SubdivisionSettings) -> SubdivisionResult:
        try:
            return self._process(source, settings)
        except (ValueError, GEOSException) as error:
            raise StageError(f"Не удалось разделить векторные области: {error}") from error

    def _process(self, source, settings):
        shapes = Shapes()
        validate_mesh(source.mesh, source.width, source.height, shapes)
        scale = source.mm_per_unit
        edges = {e.id: e for e in source.mesh.edges}
        cells = {c.id: c for c in source.mesh.cells}
        areas = {c.id: cell_area(c, edges, scale) for c in cells.values()}
        if any(a < settings.min_area_mm2 for i, a in areas.items() if not cells[i].prefilled):
            raise StageError("Во входе есть области меньше минимума. Повторите третий этап.")
        if len(cells) > settings.max_regions:
            raise StageError("Вход уже превышает --max-regions.")
        symbols = palette_symbols(source.palette)
        fitter = LabelFitter(settings, scale, self.font, symbols)
        threshold = settings.target_area_mm2 * 1.5
        pending = [
            (-area, i)
            for i, area in areas.items()
            if area > threshold
            and not cells[i].prefilled
            and symbols[cells[i].color_index] is not None
        ]
        heapq.heapify(pending)
        stop_reasons = {}
        split_count = 0
        while pending:
            _, cell_id = heapq.heappop(pending)
            if len(cells) >= settings.max_regions:
                stop_reasons[cell_id] = "region_limit"
                continue
            accepted = self._split(cells, edges, cell_id, shapes, fitter, scale, settings)
            if accepted is None:
                stop_reasons[cell_id] = "no_valid_cut_found"
                continue
            cells, edges, children = accepted
            split_count += 1
            for child in children:
                area = cell_area(cells[child], edges, scale)
                if area > threshold:
                    heapq.heappush(pending, (-area, child))
        mesh = Mesh(
            tuple(sorted(edges.values(), key=lambda e: e.id)),
            tuple(sorted(cells.values(), key=lambda c: c.id)),
        )
        validate_mesh(mesh, source.width, source.height, shapes)
        final_areas = tuple(cell_area(c, edges, scale) for c in mesh.cells)
        labels = tuple(
            LabelSpace(c.id, None, 0, 0, None)
            if c.prefilled
            else fitter.fit(shapes.polygon(c, edges), c.id, c.color_index)
            for c in mesh.cells
        )
        parent_areas = defaultdict(list)
        for c, area in zip(mesh.cells, final_areas, strict=True):
            parent_areas[c.parent_region_id].append(area)
        original_edges = {e.id: e for e in source.mesh.edges}
        drift = max(
            abs(fsum(parent_areas[c.id]) - cell_area(c, original_edges, scale))
            for c in source.mesh.cells
        )
        result = SubdivisionResult(
            mesh,
            final_areas,
            labels,
            split_count,
            tuple(
                c.id
                for c, a in zip(mesh.cells, final_areas, strict=True)
                if a > threshold and not c.prefilled and symbols[c.color_index] is not None
            ),
            tuple(sorted(stop_reasons.items())),
            drift,
        )
        result.validate(settings)
        return result

    @staticmethod
    def _split(cells, edges, cell_id, shapes, fitter, scale, settings):
        cell = cells[cell_id]
        polygon = shapes.polygon(cell, edges)
        shell = outer_ring(cell, edges)
        rng = Random((settings.seed << 32) + cell_id)
        base = principal_direction(polygon)
        attempts = [(rng.uniform(-0.25, 0.25), rng.uniform(0.43, 0.57))]
        attempts.extend(
            (angle, fraction) for angle in (0, 0.4, -0.4, pi / 2) for fraction in (0.5, 0.35, 0.65)
        )
        # Разрез через середину кольцевой области часто проходит через отверстие.
        attempts.extend(
            (angle, fraction) for angle in (0, 0.4, -0.4, pi / 2) for fraction in (0.2, 0.8)
        )
        for angle, fraction in attempts:
            normal = (cos(base + angle), sin(base + angle))
            direction = (-normal[1], normal[0])
            projections = [x * normal[0] + y * normal[1] for x, y in polygon.exterior.coords]
            offset = min(projections) + (max(projections) - min(projections)) * fraction
            hits = sorted(
                intersections(cell, edges, normal, offset),
                key=lambda h: h.point[0] * direction[0] + h.point[1] * direction[1],
            )
            for first, second in zip(hits, hits[1:], strict=False):
                if first.ring_index != shell or second.ring_index != shell:
                    continue
                start, end = first.point, second.point
                midpoint = Point((start[0] + end[0]) / 2, (start[1] + end[1]) / 2)
                if not polygon.contains(midpoint):
                    continue
                dx, dy = end[0] - start[0], end[1] - start[1]
                length = hypot(dx, dy)
                if length * scale < 0.5:
                    continue
                sign = rng.choice((-1, 1))
                for factor in (1, -1, 0.4, -0.4, 0.1):
                    bend = min(settings.curve_bend_mm / scale, length * 0.22) * sign * factor
                    cut = canonical_curves(
                        (
                            Cubic(
                                start,
                                (
                                    start[0] + dx / 3 + normal[0] * bend,
                                    start[1] + dy / 3 + normal[1] * bend,
                                ),
                                (
                                    end[0] - dx / 3 + normal[0] * bend,
                                    end[1] - dy / 3 + normal[1] * bend,
                                ),
                                end,
                            ),
                        )
                    )[0]
                    line = LineString(sample_curves((cut,), error=FLATNESS))
                    # Малый запас учитывает аппроксимацию концов исходной кривой.
                    if not polygon.buffer(2 * FLATNESS).covers(line):
                        continue
                    try:
                        proposal = propose_cut(cells, edges, cell_id, first, second, cut, shapes)
                        if proposal is None:
                            continue
                        new_cells, new_edges, children = proposal
                        # Splitting a shared cubic also changes its neighbors' sampling.
                        # Validate those faces before accepting the candidate, including
                        # tiny prefilled holes exempt from the paint-area threshold.
                        for identifier, neighbor in new_cells.items():
                            if cells.get(identifier) != neighbor:
                                shapes.polygon(neighbor, new_edges)
                        child_polygons = [shapes.polygon(new_cells[i], new_edges) for i in children]
                        if child_polygons[0].intersection(child_polygons[1]).area > 1e-7:
                            continue
                        if (
                            child_polygons[0]
                            .union(child_polygons[1])
                            .symmetric_difference(polygon)
                            .area
                            > 2 * FLATNESS * polygon.length + 1e-5
                        ):
                            continue
                        # Разделение кубика меняет точки дискретизации, но не саму кривую.
                        # Сохранение площади проверяется отдельно аналитически.
                        child_area = fsum(
                            cell_area(new_cells[i], new_edges, scale) for i in children
                        )
                        if abs(child_area - cell_area(cell, edges, scale)) > 0.001:
                            continue
                        # Также проверяем соседей, чьи общие кубики разделены и округлены.
                        if any(
                            cell_area(c, new_edges, scale) < settings.min_area_mm2
                            for i, c in new_cells.items()
                            if cells.get(i) != c and not c.prefilled
                        ):
                            continue
                        if any(
                            (space := fitter.fit(p, i, cell.color_index)).required
                            and space.center is None
                            for p, i in zip(child_polygons, children, strict=True)
                        ):
                            continue
                    except StageError:
                        continue  # Невалидная геометрия кандидата — обычная причина отклонения.
                    return proposal
        return None
