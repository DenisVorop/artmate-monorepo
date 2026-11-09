"""Сглаживание общих цепочек и проверка их дискретизированной топологии."""

from collections import Counter
from math import fsum, isfinite

from shapely import LineString, MultiPoint, STRtree, polygonize_full

from mystery_coloring.geometry.adapters.curve_fitting import fit_boundary
from mystery_coloring.geometry.adapters.curve_smoothing import align_junctions, smooth_chain
from mystery_coloring.geometry.curves import (
    canonical_curves,
    cubic_signed_area,
    line_cubics,
    region_areas,
    relax_points,
    round_polyline,
    sample_curves,
)
from mystery_coloring.geometry.domain import Boundary, SmoothBoundary


def smooth_boundaries(
    boundaries: tuple[Boundary, ...],
    width: int,
    height: int,
    region_count: int,
    max_deviation: float,
    protected: frozenset[int] = frozenset(),
):
    levels = [0] * len(boundaries)
    originals = [LineString(boundary.points) for boundary in boundaries]
    endpoint_counts = Counter(
        point for boundary in boundaries for point in (boundary.points[0], boundary.points[-1])
    )

    def fit(index: int) -> SmoothBoundary:
        boundary = boundaries[index]
        frame = min(boundary.left, boundary.right) < 0
        level = levels[index]
        detail = boundary.left in protected or boundary.right in protected
        deviation = min(max_deviation, 1.0) if detail else max_deviation
        if frame:
            points = tuple(originals[index].simplify(0).coords)
            curves = line_cubics(points)
        else:
            # При откате ограничиваем смещение каждой точки вместо резкого
            # сокращения проходов: один острый конец не оставляет ступеньки по всей цепочке.
            raw = relax_points(
                boundary.points,
                0.5,
                passes=((10, 10, 5, 0) if detail else (32, 32, 18, 0))[level],
                max_offset=min(0.4, max_deviation * 0.5) if level in (1, 2) else None,
            )
            tolerance = deviation * (0.65, 0.35, 0.2, 0)[level]
            points = tuple(LineString(raw).simplify(tolerance).coords)
            if boundary.closed and len(points) < 4:
                points = tuple(originals[index].simplify(0).coords)
            # Последний уровень также округляет углы, но в пределах четверти ребра сетки.
            curves = round_polyline(
                points,
                fraction=0.48 if level < 3 else 0.25,
                max_cut=(0.8 if level < 3 else 0.25)
                if detail
                else (None if level < 3 else min(0.25, max_deviation)),
                max_shift=deviation * 0.4 if not detail and level in (1, 2) else None,
                preserve_loop_node=boundary.closed and endpoint_counts[boundary.points[0]] > 2,
            )
        curves = canonical_curves(curves)
        return SmoothBoundary(boundary, curves, sample_curves(curves, error=0.005), level > 0)

    fitted = [fit(index) for index in range(len(boundaries))]
    rounds = 0
    while True:
        rounds += 1
        lines = [LineString(boundary.samples) for boundary in fitted]
        invalid = _boundary_conflicts(
            boundaries, lines, originals, width, height, max_deviation, protected
        )
        if not invalid:
            break
        changeable = [index for index in invalid if levels[index] < 3]
        if not changeable:
            raise ValueError("Не удалось сгладить границы без геометрического конфликта.")
        for index in changeable:
            levels[index] = levels[index] + 1 if rounds <= 12 else 3
            fitted[index] = fit(index)
    _validate_coverage(lines, width, height, region_count)
    return (
        tuple(fitted),
        rounds,
        max(
            line.hausdorff_distance(original)
            for line, original in zip(lines, originals, strict=True)
        ),
    )


def _boundary_conflicts(boundaries, lines, originals, width, height, max_deviation, protected):
    invalid = set()
    for index, line in enumerate(lines):
        xmin, ymin, xmax, ymax = line.bounds
        if (
            not line.is_simple
            or xmin < -1e-8
            or ymin < -1e-8
            or xmax > width + 1e-8
            or ymax > height + 1e-8
            or line.hausdorff_distance(originals[index])
            > (
                min(max_deviation, 1.0)
                if boundaries[index].left in protected or boundaries[index].right in protected
                else max_deviation
            )
            + 1e-8
        ):
            invalid.add(index)
    firsts, seconds = STRtree(lines).query(lines, predicate="intersects")
    for first, second in zip(firsts, seconds, strict=True):
        if first >= second:
            continue
        common = {boundaries[first].points[0], boundaries[first].points[-1]} & {
            boundaries[second].points[0],
            boundaries[second].points[-1],
        }
        intersection = lines[first].intersection(lines[second])
        if common:
            intersection = intersection.difference(MultiPoint(list(common)))
        if not intersection.is_empty:
            invalid.update((int(first), int(second)))
    return invalid


def _validate_coverage(lines, width, height, region_count):
    faces, cuts, dangles, invalid_rings = polygonize_full(lines)
    if len(faces.geoms) != region_count or any(
        not item.is_empty for item in (cuts, dangles, invalid_rings)
    ):
        raise ValueError("После сглаживания изменилось число граней или появились разрывы.")
    if abs(faces.area - width * height) > max(1e-5, width * height * 1e-10):
        raise ValueError("Сглаженные области не покрывают рисунок.")


def refine_boundaries(
    baseline: tuple[SmoothBoundary, ...],
    baseline_areas: tuple[float, ...],
    width: int,
    height: int,
    scale: float,
    minimum: float,
    max_deviation: float,
    protected: frozenset[int],
) -> tuple[tuple[SmoothBoundary, ...], tuple[float, ...], int, float]:
    """Подробная подгонка, сглаживание и локальный откат к проверенной сетке."""
    boundaries = tuple(item.source for item in baseline)
    endpoint_counts = Counter(
        point for boundary in boundaries for point in (boundary.points[0], boundary.points[-1])
    )
    curves = [item.curves for item in baseline]
    for boundary, original in zip(boundaries, baseline, strict=True):
        if min(boundary.left, boundary.right) < 0 or {boundary.left, boundary.right} & protected:
            continue
        anchored = not boundary.closed or endpoint_counts[boundary.points[0]] > 2
        detailed = fit_boundary(boundary, max_deviation, anchor_closed=anchored)
        curves[boundary.id] = smooth_chain(
            boundary, detailed, original.curves, max_deviation, anchored
        )
    align_junctions(boundaries, curves, protected, max_deviation)

    originals = [LineString(boundary.points) for boundary in boundaries]
    fitted = list(baseline)
    changed = set()
    for boundary, candidate in zip(boundaries, curves, strict=True):
        index = boundary.id
        if candidate != baseline[index].curves:
            start, end = candidate[0].start, candidate[-1].end
            if boundary.closed and start != end:
                continue
            if (not boundary.closed or endpoint_counts[boundary.points[0]] > 2) and (
                start != boundary.points[0] or end != boundary.points[-1]
            ):
                continue
            fitted[index] = SmoothBoundary(
                boundary, candidate, sample_curves(candidate, error=0.005), False
            )
            changed.add(index)
    baseline_integrals = {
        index: fsum(cubic_signed_area(c) for c in baseline[index].curves) for index in changed
    }
    rounds = 0
    while changed and rounds < 8:
        rounds += 1
        lines = [LineString(item.samples) for item in fitted]
        rejected = _boundary_conflicts(
            boundaries, lines, originals, width, height, max_deviation, protected
        )
        if not rejected:
            try:
                _validate_coverage(lines, width, height, len(baseline_areas))
            except ValueError:
                break
            areas = region_areas(fitted, len(baseline_areas), scale)
            if abs(fsum(areas) - width * height * scale**2) > 1e-5:
                break
            undersized = {
                i
                for i, area in enumerate(areas)
                if not isfinite(area) or area <= 0 or (i not in protected and area < minimum)
            }
            if not undersized:
                return (
                    tuple(fitted),
                    areas,
                    rounds,
                    max(
                        line.hausdorff_distance(raw)
                        for line, raw in zip(lines, originals, strict=True)
                    ),
                )
            # Возвращаем по одному ребру с наибольшим выигрышем площади для каждой тесной грани.
            gains: dict[int, tuple[float, int]] = {}
            for index in sorted(changed):
                boundary = boundaries[index]
                if {boundary.left, boundary.right}.isdisjoint(undersized):
                    continue
                gain = baseline_integrals[index] - fsum(
                    cubic_signed_area(c) for c in fitted[index].curves
                )
                for region, change in ((boundary.right, gain), (boundary.left, -gain)):
                    if region in undersized and change > gains.get(region, (0.0, 0))[0]:
                        gains[region] = (change, index)
            rejected = {index for _, index in gains.values()}
        rejected &= changed
        if not rejected:
            break
        for index in rejected:
            fitted[index] = baseline[index]
        changed -= rejected
    return (
        baseline,
        baseline_areas,
        rounds,
        max(
            LineString(item.samples).hausdorff_distance(raw)
            for item, raw in zip(baseline, originals, strict=True)
        ),
    )
