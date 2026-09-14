"""Поиск пересечений с кубиками и согласованное разделение общих рёбер."""

from dataclasses import dataclass, replace
from math import fsum

import numpy as np
from shapely import Polygon

from mystery_coloring.geometry.curves import canonical_curves, cubic_signed_area
from mystery_coloring.geometry.domain import Cubic, Point
from mystery_coloring.subdivision.adapters.shapes import Shapes
from mystery_coloring.subdivision.curves import oriented, split_cubic
from mystery_coloring.subdivision.domain import Cell, Edge


@dataclass(frozen=True)
class Hit:
    edge_id: int
    curve_index: int
    t: float
    point: Point
    ring_index: int


def intersections(cell: Cell, edges: dict[int, Edge], normal: Point, offset: float):
    hits = []
    for ring_index, ring in enumerate(cell.rings):
        for ref in ring:
            edge = edges[abs(ref)]
            for index, c in enumerate(edge.curves):
                values = [
                    p[0] * normal[0] + p[1] * normal[1] - offset
                    for p in (c.start, c.first, c.second, c.end)
                ]
                if min(values) >= 0 or max(values) <= 0:
                    continue
                a, b, d, e = values
                coefficients = [-a + 3 * b - 3 * d + e, 3 * (a - 2 * b + d), 3 * (b - a), a]
                for root in np.roots(np.trim_zeros(coefficients, "f")):
                    if abs(root.imag) > 1e-8 or not 1e-6 < root.real < 1 - 1e-6:
                        continue
                    t = float(root.real)
                    derivative = (
                        3 * coefficients[0] * t * t + 2 * coefficients[1] * t + coefficients[2]
                    )
                    if abs(derivative) < 1e-7:  # Касание не разрезает область.
                        continue
                    before, _ = split_cubic(c, t)
                    point = canonical_curves((before,))[0].end
                    hits.append(Hit(edge.id, index, t, point, ring_index))
    return hits


def _replace_edge(cells: dict[int, Cell], old: int, after: int):
    for key, cell in tuple(cells.items()):
        if not any(abs(ref) == old for ring in cell.rings for ref in ring):
            continue
        rings = tuple(
            tuple(
                part
                for ref in ring
                for part in (
                    (old, after) if ref == old else (-after, -old) if ref == -old else (ref,)
                )
            )
            for ring in cell.rings
        )
        cells[key] = replace(cell, rings=rings)


def propose_cut(
    cells: dict[int, Cell],
    edges: dict[int, Edge],
    cell_id: int,
    first: Hit,
    second: Hit,
    cut: Cubic,
    shapes: Shapes,
):
    """Изменения применяются к копиям. Отклонённый кандидат не затрагивает исходную карту."""
    cells, edges = cells.copy(), edges.copy()
    next_edge = max(edges) + 1
    # Если оба конца на одной цепочке, более поздний делится первым.
    for hit in sorted((first, second), key=lambda h: (h.edge_id, h.curve_index, h.t), reverse=True):
        edge = edges[hit.edge_id]
        t = hit.t
        other = second if hit is first else first
        if (
            hit.edge_id == other.edge_id
            and hit.curve_index == other.curve_index
            and hit.t < other.t
        ):
            t /= other.t  # После первого деления параметр оставшегося кубика изменился.
        a, b = split_cubic(edge.curves[hit.curve_index], t)
        a, b = canonical_curves((a, b))
        # Одна каноническая координата узла для всех соседей и новой линии.
        a, b = replace(a, end=hit.point), replace(b, start=hit.point)
        edges[edge.id] = replace(edge, curves=(*edge.curves[: hit.curve_index], a))
        edges[next_edge] = Edge(
            next_edge, (b, *edge.curves[hit.curve_index + 1 :]), edge.source_boundary_id
        )
        _replace_edge(cells, edge.id, next_edge)
        next_edge += 1
    parent = cells.pop(cell_id)
    ring = parent.rings[first.ring_index]
    starts = [oriented(edges[abs(ref)], ref)[0].start for ref in ring]
    try:
        a, b = starts.index(first.point), starts.index(second.point)
    except ValueError:
        return None
    if a == b:
        return None
    rotated = (*ring[a:], *ring[:a])
    b = (b - a) % len(ring)
    edges[next_edge] = Edge(next_edge, (cut,), None)
    id_a = max((*cells, cell_id)) + 1
    child_a = Cell(
        id_a, parent.parent_region_id, parent.color_index, (tuple(rotated[:b]) + (-next_edge,),)
    )
    child_b = Cell(
        id_a + 1, parent.parent_region_id, parent.color_index, (tuple(rotated[b:]) + (next_edge,),)
    )
    shape_a, shape_b = (shapes.polygon(c, edges) for c in (child_a, child_b))
    holes_a, holes_b = [], []
    for index, hole in enumerate(parent.rings):
        if index == first.ring_index:
            continue
        hole_shape = Polygon(shapes.ring_points(hole, edges))
        if shape_a.covers(hole_shape):
            holes_a.append(hole)
        elif shape_b.covers(hole_shape):
            holes_b.append(hole)
        else:
            return None
    cells[child_a.id] = replace(child_a, rings=(*child_a.rings, *holes_a))
    cells[child_b.id] = replace(child_b, rings=(*child_b.rings, *holes_b))
    return cells, edges, (child_a.id, child_b.id)


def outer_ring(cell: Cell, edges: dict[int, Edge]) -> int:
    return max(
        range(len(cell.rings)),
        key=lambda i: fsum(
            cubic_signed_area(c) for ref in cell.rings[i] for c in oriented(edges[abs(ref)], ref)
        ),
    )
