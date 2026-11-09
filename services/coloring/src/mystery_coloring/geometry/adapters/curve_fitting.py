"""Детальная подгонка общих цепочек прямыми, дугами и кубическими кривыми."""

from math import cos, pi, sin, tan

import numpy as np
from shapely import LineString

from mystery_coloring.geometry.curves import canonical_curves, line_cubics, sample_curves
from mystery_coloring.geometry.domain import Boundary, Cubic


def _point(value):
    return float(value[0]), float(value[1])


def _unit(vector):
    length = np.linalg.norm(vector)
    return vector / length if length > 1e-12 else np.zeros(2)


def _admissible(curves, points, limit):
    flatness = min(0.02, limit / 20)
    line = LineString(sample_curves(curves, error=flatness))
    return line.is_simple and line.hausdorff_distance(LineString(points)) <= limit - flatness


def turns(points, step, closed):
    indexes = np.arange(len(points))
    if closed:
        before = points[(indexes - step) % len(points)]
        after = points[(indexes + step) % len(points)]
    else:
        before = points[np.maximum(indexes - step, 0)]
        after = points[np.minimum(indexes + step, len(points) - 1)]
    first, second = points - before, after - points
    return np.arctan2(
        first[:, 0] * second[:, 1] - first[:, 1] * second[:, 0],
        np.einsum("ij,ij->i", first, second),
    )


def _corners(points, closed):
    if len(points) < 12:
        return ()
    narrow = max(2, min(5, len(points) // 14))
    wide = 2 * narrow
    sharp, stable = turns(points, narrow, closed), turns(points, wide, closed)
    magnitude = np.abs(sharp)
    broad = np.abs(stable)
    eligible = (
        (magnitude >= np.deg2rad(31))
        & (broad >= np.deg2rad(32))
        & (magnitude >= 0.68 * broad)
        & (sharp * stable > 0)
    )
    if not closed:
        eligible[:narrow] = False
        eligible[-narrow:] = False
    rank = magnitude + broad
    chosen = []
    for idx in sorted(np.flatnonzero(eligible), key=lambda i: (-rank[i], i)):
        separation = (abs(int(idx) - old) for old in chosen)
        if closed:
            separation = (min(d, len(points) - d) for d in separation)
        if all(d >= wide for d in separation):
            chosen.append(int(idx))
    return tuple(sorted(chosen))


def _denoise(points, closed):
    if len(points) < 5:
        return points.copy()
    samples = points[:-1] if closed else np.pad(points, ((2, 2), (0, 0)), mode="edge")
    if closed:
        samples = np.pad(samples, ((2, 2), (0, 0)), mode="wrap")
    result = (
        sum(
            weight * samples[index : len(samples) - 4 + index]
            for index, weight in enumerate((1, 4, 6, 4, 1))
        )
        / 16
    )
    if closed:
        return np.vstack((result, result[0]))
    result[[0, -1]] = points[[0, -1]]
    return result


def _circle(points, limit, anchored):
    if len(points) < 48:
        return None
    midpoints = (points[:-1] + points[1:]) * 0.5
    mean = midpoints.mean(axis=0)
    samples = midpoints - mean
    system = np.column_stack((2 * samples, np.ones(len(samples))))
    solution, _, rank, _ = np.linalg.lstsq(
        system, np.einsum("ij,ij->i", samples, samples), rcond=None
    )
    if rank < 3:
        return None
    center = mean + solution[:2]
    radii = np.linalg.norm(midpoints - center, axis=1)
    radius = np.linalg.norm(points[0] - center) if anchored else np.mean(radii)
    if radius < 8 or max(abs(radii - radius)) > min(0.85, 0.35 * limit + 0.38):
        return None
    vectors = points - center
    angles = np.unwrap(np.arctan2(vectors[:, 1], vectors[:, 0]))
    rotation = angles[-1] - angles[0]
    if abs(abs(rotation) - 2 * pi) > 1e-6 or np.any(np.diff(angles) * rotation < -1e-9):
        return None
    step = pi / 2 if rotation > 0 else -pi / 2
    reach = (4 / 3) * tan(step / 4) * radius
    knots = [
        center + radius * np.asarray((cos(angles[0] + i * step), sin(angles[0] + i * step)))
        for i in range(4)
    ]
    if anchored:
        knots[0] = points[0]
    knots.append(knots[0])
    curves = []
    for index, (start, end) in enumerate(zip(knots[:-1], knots[1:], strict=True)):
        angle = angles[0] + index * step
        first = start + reach * np.asarray((-sin(angle), cos(angle)))
        second = end - reach * np.asarray((-sin(angle + step), cos(angle + step)))
        curves.append(Cubic(*map(_point, (start, first, second, end))))
    return tuple(curves) if _admissible(tuple(curves), points, limit) else None


def _controls(points, t, left, right):
    start, end = points[0], points[-1]
    reverse = 1 - t
    b0, b1, b2, b3 = reverse**3, 3 * t * reverse**2, 3 * t**2 * reverse, t**3
    fixed = (b0 + b1)[:, None] * start + (b2 + b3)[:, None] * end
    matrix = np.column_stack(((b1[:, None] * left).ravel(), (b2[:, None] * right).ravel()))
    alpha, _, _, _ = np.linalg.lstsq(matrix, (points - fixed).ravel(), rcond=None)
    chord = np.linalg.norm(end - start)
    if min(alpha) < chord * 1e-5 or max(alpha) > chord * 1.5:
        alpha = np.full(2, chord / 3)
    return np.asarray((start, start + left * alpha[0], end + right * alpha[1], end))


def _values(controls, t):
    p0, p1, p2, p3 = controls
    coefficients = p0, 3 * (p1 - p0), 3 * (p2 - 2 * p1 + p0), p3 - 3 * p2 + 3 * p1 - p0
    a, b, c, d = coefficients
    t = t[:, None]
    return (
        ((d * t + c) * t + b) * t + a,
        (3 * d * t + 2 * c) * t + b,
        6 * d * t + 2 * c,
    )


def _fit_span(raw, smooth, left, right, limit, depth=0):
    if len(raw) == 2:
        return line_cubics(tuple(map(_point, smooth)))
    start, end = smooth[0], smooth[-1]
    chord = end - start
    norm = float(chord @ chord)
    if norm > 0:
        direction = chord / np.sqrt(norm)
        normal = np.asarray((-direction[1], direction[0]))
        offsets = np.abs((smooth - start) @ normal)
        if max(offsets) <= min(0.72, limit * 0.64):
            candidate = line_cubics((_point(start), _point(end)))
            if _admissible(candidate, raw, limit):
                return candidate
    lengths = np.linalg.norm(np.diff(smooth, axis=0), axis=1)
    t = np.concatenate(([0.0], lengths.cumsum()))
    if t[-1] == 0 or depth >= 12:
        fallback = raw.copy()
        fallback[[0, -1]] = smooth[[0, -1]]
        return line_cubics(tuple(LineString(fallback).simplify(0).coords))
    t /= t[-1]
    best = None
    for _ in range(4):
        controls = _controls(smooth, t, left, right)
        values, first, second = _values(controls, t)
        residual = values - smooth
        errors = np.linalg.norm(residual, axis=1)
        maximum = float(max(errors))
        if best is None or maximum < best[0]:
            best = maximum, int(np.argmax(errors)), controls
        if maximum <= limit * 0.22:
            break
        divisor = np.einsum("ij,ij->i", first, first) + np.einsum("ij,ij->i", residual, second)
        correction = np.divide(
            np.einsum("ij,ij->i", residual, first),
            divisor,
            out=np.zeros_like(t),
            where=np.abs(divisor) > 1e-12,
        )
        adjusted = np.clip(t - correction, 0, 1)
        if min(np.diff(adjusted)) <= 0:
            break
        t = adjusted
    candidate = (Cubic(*map(_point, best[2])),)
    if _admissible(candidate, raw, limit):
        return candidate
    split = min(len(raw) - 2, max(1, len(raw) // 5, best[1]))
    split = min(split, 4 * len(raw) // 5)
    tangent = _unit(smooth[min(len(raw) - 1, split + 2)] - smooth[max(0, split - 2)])
    return (
        *_fit_span(raw[: split + 1], smooth[: split + 1], left, -tangent, limit, depth + 1),
        *_fit_span(raw[split:], smooth[split:], tangent, right, limit, depth + 1),
    )


def fit_boundary(
    boundary: Boundary, max_deviation: float, *, anchor_closed=True
) -> tuple[Cubic, ...]:
    """Подгоняет общую границу в пикселях, сохраняя узлы с соседями."""
    raw = np.asarray(boundary.points, dtype=float)
    if min(boundary.left, boundary.right) < 0 or max_deviation < 0.28:
        return canonical_curves(line_cubics(tuple(LineString(raw).simplify(0).coords)))
    closed = boundary.closed
    corners = _corners(raw[:-1] if closed else raw, closed)
    if closed and not corners:
        circular = _circle(raw, max_deviation, anchor_closed)
        if circular is not None:
            return canonical_curves(circular)
    smooth = _denoise(raw, closed)
    if corners:
        smooth[list(corners)] = raw[list(corners)]
    if not closed or anchor_closed:
        smooth[[0, -1]] = raw[[0, -1]]
    if closed and 0 in corners:
        smooth[-1] = smooth[0]
    knots = [0, *(i for i in corners if i > 0), len(raw) - 1]
    if closed and len(knots) < 4:
        knots = sorted(set(knots) | {len(raw) // 3, 2 * len(raw) // 3})
    corner_set = set(corners)
    smooth_knots = {
        index: _unit(smooth[min(len(raw) - 1, index + 4)] - smooth[max(0, index - 4)])
        for index in knots[1:-1]
        if index not in corner_set
    }
    curves = []
    for i, j in zip(knots[:-1], knots[1:], strict=True):
        left = smooth_knots[i] if i in smooth_knots else _unit(smooth[min(i + 4, j)] - smooth[i])
        right = -smooth_knots[j] if j in smooth_knots else _unit(smooth[max(j - 4, i)] - smooth[j])
        if closed and 0 not in corner_set:
            step = min(4, (len(raw) - 1) // 3)
            loop_tangent = _unit(smooth[step] - smooth[-step - 1])
            if i == 0:
                left = loop_tangent
            if j == len(raw) - 1:
                right = -loop_tangent
        curves.extend(_fit_span(raw[i : j + 1], smooth[i : j + 1], left, right, max_deviation))
    result = canonical_curves(tuple(curves))
    if not _admissible(result, raw, max_deviation):
        return canonical_curves(line_cubics(tuple(LineString(raw).simplify(0).coords)))
    return result
