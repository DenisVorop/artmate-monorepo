"""Кубические кривые и обход граней без файловых и численных библиотек."""

from math import atan2, fsum, hypot, pi

from mystery_coloring.geometry.domain import Boundary, Cubic, Point


def interpolate(first: Point, second: Point, amount: float) -> Point:
    return tuple(a + (b - a) * amount for a, b in zip(first, second, strict=True))


def relax_points(
    points: tuple[Point, ...], weight: float, passes: int = 4, max_offset: float | None = None
) -> tuple[Point, ...]:
    """Убирает чередование пиксельных ступенек; узлы соединения остаются на месте."""
    anchors = points
    for _ in range(passes):
        points = (
            points[0],
            *(
                interpolate(
                    points[index], interpolate(points[index - 1], points[index + 1], 0.5), weight
                )
                for index in range(1, len(points) - 1)
            ),
            points[-1],
        )
        if max_offset is not None:
            # Ограничение относительно исходника не даёт острым концам усов
            # сокращаться при повторных проходах, сохраняя сглаживание вдоль линии.
            bounded = []
            for anchor, point in zip(anchors, points, strict=True):
                distance = hypot(point[0] - anchor[0], point[1] - anchor[1])
                bounded.append(
                    interpolate(anchor, point, min(1.0, max_offset / max(distance, 1e-12)))
                )
            points = tuple(bounded)
    return points


def line_cubics(points: tuple[Point, ...]) -> tuple[Cubic, ...]:
    """Прямые сегменты рамки в том же кубическом формате."""
    return tuple(
        Cubic(start, interpolate(start, end, 1 / 3), interpolate(start, end, 2 / 3), end)
        for start, end in zip(points[:-1], points[1:], strict=True)
    )


def round_polyline(
    points: tuple[Point, ...],
    fraction: float = 0.45,
    max_cut: float | None = None,
    preserve_loop_node: bool = False,
    max_shift: float | None = None,
) -> tuple[Cubic, ...]:
    """Касательные на стыках согласованы; квадратичные дуги лежат в треугольнике угла."""
    closed = points[0] == points[-1] and not preserve_loop_node
    knots = points[:-1] if closed else points
    corners = []

    def offset(center: Point, other: Point, limit: float | None) -> Point:
        distance = hypot(other[0] - center[0], other[1] - center[1])
        amount = fraction if limit is None else min(fraction, limit / distance)
        return interpolate(center, other, amount)

    for index in range(len(knots)) if closed else range(1, len(knots) - 1):
        center = knots[index]
        previous, following = knots[(index - 1) % len(knots)], knots[(index + 1) % len(knots)]
        limit = max_cut
        if max_shift is not None:
            before = hypot(previous[0] - center[0], previous[1] - center[1])
            after = hypot(following[0] - center[0], following[1] - center[1])
            bend = hypot(
                (previous[0] - center[0]) / before + (following[0] - center[0]) / after,
                (previous[1] - center[1]) / before + (following[1] - center[1]) / after,
            )
            # Для равных срезов середина дуги смещена на cut * bend / 4.
            # Пологой дуге нужен длинный срез, острому концу — короткий.
            # Итоговое отклонение всей кривой дополнительно проверяет topology.
            shift_limit = 4 * max_shift / max(bend, 1e-12)
            limit = shift_limit if limit is None else min(limit, shift_limit)
        lead = offset(center, previous, limit)
        trail = offset(center, following, limit)
        corners.append((lead, center, trail))
    current = corners[0][0] if closed else points[0]
    start = current
    result = []

    def line(end: Point) -> None:
        nonlocal current
        if end != current:
            result.append(
                Cubic(
                    current, interpolate(current, end, 1 / 3), interpolate(current, end, 2 / 3), end
                )
            )
        current = end

    for lead, center, trail in corners:
        line(lead)
        result.append(
            Cubic(lead, interpolate(lead, center, 2 / 3), interpolate(trail, center, 2 / 3), trail)
        )
        current = trail
    line(start if closed else points[-1])
    return tuple(result)


def canonical_curves(curves: tuple[Cubic, ...]) -> tuple[Cubic, ...]:
    """Те же округлённые координаты используются проверками и SVG, а не только экспортом."""

    def point(value: Point) -> Point:
        return round(value[0], 6), round(value[1], 6)

    return tuple(Cubic(*(point(p) for p in (c.start, c.first, c.second, c.end))) for c in curves)


def cubic_signed_area(curve: Cubic) -> float:
    """Аналитический интеграл 1/2 ∫(x dy − y dx), без растровой оценки площади."""

    def coefficients(axis: int) -> tuple[float, ...]:
        a, b, c, d = (p[axis] for p in (curve.start, curve.first, curve.second, curve.end))
        return a, 3 * (b - a), 3 * (a - 2 * b + c), -a + 3 * b - 3 * c + d

    x, y = coefficients(0), coefficients(1)
    return 0.5 * fsum(
        (x[i] * j * y[j] - y[i] * j * x[j]) / (i + j) for i in range(4) for j in range(1, 4)
    )


def region_areas(boundaries, count: int, scale: float) -> tuple[float, ...]:
    contributions: list[list[float]] = [[] for _ in range(count)]
    for boundary in boundaries:
        area = fsum(cubic_signed_area(curve) for curve in boundary.curves)
        if boundary.source.right >= 0:
            contributions[boundary.source.right].append(area)
        if boundary.source.left >= 0:
            contributions[boundary.source.left].append(-area)
    return tuple(fsum(values) * scale**2 for values in contributions)


def _distance_to_segment(point: Point, start: Point, end: Point) -> float:
    dx, dy = end[0] - start[0], end[1] - start[1]
    squared = dx * dx + dy * dy
    if squared == 0:
        return hypot(point[0] - start[0], point[1] - start[1])
    t = max(0, min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / squared))
    return hypot(point[0] - start[0] - t * dx, point[1] - start[1] - t * dy)


def sample_curves(curves: tuple[Cubic, ...], error: float = 0.02) -> tuple[Point, ...]:
    points = [curves[0].start]

    def sample(curve: Cubic, depth: int = 0) -> None:
        if (
            depth >= 16
            or max(
                _distance_to_segment(curve.first, curve.start, curve.end),
                _distance_to_segment(curve.second, curve.start, curve.end),
            )
            <= error
        ):
            points.append(curve.end)
            return
        a = interpolate(curve.start, curve.first, 0.5)
        b = interpolate(curve.first, curve.second, 0.5)
        c = interpolate(curve.second, curve.end, 0.5)
        d, e = interpolate(a, b, 0.5), interpolate(b, c, 0.5)
        middle = interpolate(d, e, 0.5)
        sample(Cubic(curve.start, a, d, middle), depth + 1)
        sample(Cubic(middle, e, c, curve.end), depth + 1)

    for curve in curves:
        sample(curve)
    return tuple(points)


def region_rings(boundaries: tuple[Boundary, ...]) -> dict[int, tuple[tuple[int, ...], ...]]:
    """Кольца из signed ID: +(id+1) по ходу общего ребра, отрицательный — обратно."""
    halfedges: dict[int, list[int]] = {}
    for boundary in boundaries:
        if boundary.right >= 0:
            halfedges.setdefault(boundary.right, []).append(boundary.id + 1)
        if boundary.left >= 0:
            halfedges.setdefault(boundary.left, []).append(-boundary.id - 1)

    def points(edge: int) -> tuple[Point, ...]:
        original = boundaries[abs(edge) - 1].points
        return original if edge > 0 else original[::-1]

    output = {}
    for region, edges in halfedges.items():
        outgoing: dict[Point, list[int]] = {}
        for edge in edges:
            outgoing.setdefault(points(edge)[0], []).append(edge)
        remaining = set(edges)
        rings = []
        while remaining:
            first = min(remaining, key=lambda edge: (abs(edge), edge))
            ring, current = [], first
            while current in remaining:
                remaining.remove(current)
                ring.append(current)
                path = points(current)
                endpoint = path[-1]
                if endpoint == points(first)[0]:
                    break
                incoming = atan2(endpoint[1] - path[-2][1], endpoint[0] - path[-2][0])
                candidates = [edge for edge in outgoing.get(endpoint, []) if edge in remaining]
                if not candidates:
                    raise ValueError(f"Разомкнутое кольцо области {region}")

                def turn(edge: int, endpoint=endpoint, incoming=incoming) -> tuple[float, int]:
                    following = points(edge)
                    angle = atan2(following[1][1] - endpoint[1], following[1][0] - endpoint[0])
                    return ((pi / 2 - (angle - incoming)) % (2 * pi), abs(edge))

                current = min(candidates, key=turn)
            if points(ring[-1])[-1] != points(first)[0]:
                raise ValueError("Кольцо не замкнуто")
            rings.append(tuple(ring))
        output[region] = tuple(rings)
    return output
