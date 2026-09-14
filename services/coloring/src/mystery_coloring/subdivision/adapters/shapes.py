"""Дискретная геометрия использует общие выборки рёбер в обеих областях."""

from collections import defaultdict
from math import fsum

from shapely import Polygon, box, unary_union

from mystery_coloring.domain import StageError
from mystery_coloring.geometry.curves import cubic_signed_area, sample_curves
from mystery_coloring.subdivision.curves import oriented
from mystery_coloring.subdivision.domain import Cell, Edge, Mesh

FLATNESS = 0.005  # Рабочие единицы векторного входа, как у третьего этапа.


class Shapes:
    def __init__(self):
        self._samples = {}

    def ring_points(self, ring: tuple[int, ...], edges: dict[int, Edge]):
        points = []
        for ref in ring:
            edge = edges[abs(ref)]
            # Одинаковый ключ у обеих сторон и после изменения словаря рёбер.
            if edge not in self._samples:
                self._samples[edge] = sample_curves(edge.curves, error=FLATNESS)
            path = self._samples[edge]
            path = path if ref > 0 else path[::-1]
            if points and points[-1] != path[0]:
                raise StageError("Разрыв в кольце векторной области.")
            points.extend(path if not points else path[1:])
        if not points or points[0] != points[-1]:
            raise StageError("Незамкнутое кольцо векторной области.")
        return points

    def polygon(self, cell: Cell, edges: dict[int, Edge]):
        outer, holes = [], []
        for ring in cell.rings:
            area = fsum(
                cubic_signed_area(c) for ref in ring for c in oriented(edges[abs(ref)], ref)
            )
            points = self.ring_points(ring, edges)
            (outer if area > 0 else holes).append(points)
        if len(outer) != 1:
            raise StageError("Ожидалась одна связная внешняя оболочка области.")
        polygon = Polygon(outer[0], holes)
        if not polygon.is_valid or polygon.is_empty:
            raise StageError("Некорректная дискретизированная векторная область.")
        return polygon


def validate_mesh(mesh: Mesh, width: int, height: int, shapes: Shapes) -> None:
    edges = {e.id: e for e in mesh.edges}
    usage = defaultdict(list)
    if len(edges) != len(mesh.edges) or len({c.id for c in mesh.cells}) != len(mesh.cells):
        raise StageError("Повторяющиеся ID в векторной карте.")
    for cell in mesh.cells:
        for ring in cell.rings:
            for ref in ring:
                usage[abs(ref)].append(ref)
    if set(usage) != set(edges) or any(
        len(refs) not in (1, 2) or (len(refs) == 2 and sum(refs) != 0) for refs in usage.values()
    ):
        raise StageError("Нарушено совместное использование границ.")
    polygons = [shapes.polygon(c, edges) for c in mesh.cells]
    combined = unary_union(polygons)
    tolerance = max(1e-5, width * height * 1e-10)
    if (
        combined.symmetric_difference(box(0, 0, width, height)).area > tolerance
        or abs(fsum(p.area for p in polygons) - combined.area) > tolerance
    ):
        raise StageError("Области имеют щели, наложения или не покрывают рисунок.")
