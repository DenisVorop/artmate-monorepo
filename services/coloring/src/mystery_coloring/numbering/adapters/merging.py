"""Слияние соседей удаляет только общие рёбра; внешние кубики остаются прежними."""

from mystery_coloring.geometry.curves import region_rings
from mystery_coloring.geometry.domain import Boundary
from mystery_coloring.subdivision.curves import oriented, separate_touching_rings
from mystery_coloring.subdivision.domain import Cell


def join_cells(first, second, edges, new_id, shapes):
    refs = [ref for c in (first, second) for ring in c.rings for ref in ring]
    removed = tuple(sorted(set(abs(r) for r in refs if -r in refs)))
    if not removed:
        raise ValueError("У областей нет общей границы.")
    refs = sorted((r for r in refs if abs(r) not in removed), key=lambda r: (abs(r), r))
    boundaries = []
    for index, ref in enumerate(refs):
        # Ориентируем все рёбра по обходу новой области; её ID здесь локальный 0.
        curves = oriented(edges[abs(ref)], ref)
        points = shapes.ring_points((ref,), edges) if curves[0].start == curves[-1].end else None
        if points is None:
            from mystery_coloring.geometry.curves import sample_curves

            points = sample_curves(curves, error=0.005)
        boundaries.append(Boundary(index, -1, 0, tuple(points)))
    rings = region_rings(tuple(boundaries))[0]
    mapped = tuple(tuple(refs[abs(r) - 1] * (1 if r > 0 else -1) for r in ring) for ring in rings)
    result = Cell(
        new_id, second.parent_region_id, second.color_index, separate_touching_rings(mapped, edges)
    )
    return result, removed
