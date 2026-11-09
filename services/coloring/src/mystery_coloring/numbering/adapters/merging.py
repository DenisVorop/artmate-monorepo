"""Слияние соседей удаляет только общие рёбра; внешние кубики остаются прежними."""

from mystery_coloring.geometry.curves import region_rings
from mystery_coloring.geometry.domain import Boundary
from mystery_coloring.subdivision.curves import oriented, separate_touching_rings
from mystery_coloring.subdivision.domain import Cell


def same_color_details(seeds, color, cells, uses, *, include_locked=False):
    pending = list(seeds)
    seen = set(seeds)
    details = []
    while pending:
        cell = cells[pending.pop()]
        for ring in cell.rings:
            for ref in ring:
                for other in uses[abs(ref)]:
                    if other in seen:
                        continue
                    seen.add(other)
                    neighbor = cells[other]
                    if neighbor.color_index == color and (
                        neighbor.mergeable_prefilled or (include_locked and neighbor.prefilled)
                    ):
                        details.append(other)
                        pending.append(other)
    return tuple(sorted(details))


def join_cells(cells, edges, new_id, shapes):
    refs = {ref for c in cells for ring in c.rings for ref in ring}
    removed = tuple(sorted(r for r in refs if r > 0 and -r in refs))
    if not removed:
        raise ValueError("У областей нет общей границы.")
    refs = sorted((r for r in refs if -r not in refs), key=abs)
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
    target = cells[1]
    result = Cell(
        new_id, target.parent_region_id, target.color_index, separate_touching_rings(mapped, edges)
    )
    return result, removed
