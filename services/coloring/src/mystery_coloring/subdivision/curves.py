"""Точное деление Безье и измерения; никакой повторной векторизации."""

from math import fsum

from mystery_coloring.geometry.curves import cubic_signed_area, interpolate
from mystery_coloring.geometry.domain import Cubic
from mystery_coloring.subdivision.domain import Cell, Edge


def split_cubic(curve: Cubic, t: float) -> tuple[Cubic, Cubic]:
    a = interpolate(curve.start, curve.first, t)
    b = interpolate(curve.first, curve.second, t)
    c = interpolate(curve.second, curve.end, t)
    d, e = interpolate(a, b, t), interpolate(b, c, t)
    middle = interpolate(d, e, t)
    return Cubic(curve.start, a, d, middle), Cubic(middle, e, c, curve.end)


def oriented(edge: Edge, reference: int) -> tuple[Cubic, ...]:
    return edge.curves if reference > 0 else tuple(c.reversed() for c in edge.curves[::-1])


def ring_curves(ring: tuple[int, ...], edges: dict[int, Edge]) -> tuple[Cubic, ...]:
    return tuple(c for ref in ring for c in oriented(edges[abs(ref)], ref))


def cell_area(cell: Cell, edges: dict[int, Edge], scale: float) -> float:
    return (
        fsum(
            (1 if ref > 0 else -1) * fsum(cubic_signed_area(c) for c in edges[abs(ref)].curves)
            for ring in cell.rings
            for ref in ring
        )
        * scale**2
    )


def separate_touching_rings(rings, edges):
    """Выделяет петли при повторном посещении узла, не меняя ни одного кубика."""
    pending, output = list(rings), []
    while pending:
        ring = pending.pop(0)
        visited = {}
        for index, ref in enumerate(ring):
            start = oriented(edges[abs(ref)], ref)[0].start
            if start in visited:
                first = visited[start]
                pending.extend((ring[first:index], ring[:first] + ring[index:]))
                break
            visited[start] = index
        else:
            output.append(ring)
    return tuple(output)
