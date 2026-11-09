"""Согласование касательных и сглаживание между подтверждёнными углами."""

from dataclasses import replace
from math import acos, degrees

import numpy as np
from shapely import LineString, Point, get_coordinates, line_interpolate_point

from mystery_coloring.geometry.adapters.curve_fitting import turns
from mystery_coloring.geometry.curves import canonical_curves, sample_curves
from mystery_coloring.geometry.domain import Boundary, Cubic


def _unit(vec):
    magnitude = np.linalg.norm(vec)
    return vec / magnitude if magnitude > 1e-9 else np.zeros(2)


def tangent(curve, end):
    p = np.asarray((curve.start, curve.first, curve.second, curve.end))
    base = p[-1] if end else p[0]
    for point in p[-2::-1] if end else p[1:]:
        direction = base - point if end else point - base
        if np.linalg.norm(direction) > 1e-8:
            return _unit(direction)
    return np.zeros(2)


def _bend(a, b):
    return degrees(acos(np.clip(np.dot(a, b), -1, 1)))


def _joins(curves, closed):
    pairs = list(zip(curves, curves[1:], strict=False))
    if closed and len(curves) > 1:
        pairs.append((curves[-1], curves[0]))
    return pairs


def _sharp_joins(curves, closed):
    return tuple(
        a.end for a, b in _joins(curves, closed) if _bend(tangent(a, True), tangent(b, False)) > 12
    )


def _reference_corners(boundary):
    points = np.asarray(boundary.points)
    if boundary.closed:
        points = points[:-1]
    reach = 9
    if len(points) <= 2 * reach:
        return np.empty((0, 2))
    narrow = turns(points, 4, boundary.closed)
    broad = turns(points, reach, boundary.closed)
    keep = (
        (np.abs(broad) >= np.deg2rad(57))
        & (np.abs(narrow - broad) <= np.deg2rad(13))
        & (broad * narrow > 0)
    )
    if not boundary.closed:
        keep[:reach] = keep[-reach:] = False
    selected = []
    for i in np.flatnonzero(keep):
        left = points[np.arange(i - reach, i + 1) % len(points)]
        right = points[np.arange(i, i + reach + 1) % len(points)]
        if all(
            LineString((side[0], side[-1])).hausdorff_distance(LineString(side)) <= 0.75
            for side in (left, right)
        ):
            selected.append(points[i])
    return np.asarray(selected).reshape(-1, 2)


def _hermite(samples, sigma, closed):
    line = LineString(samples)
    length = line.length
    if length < 2.2:
        return None
    intervals = max(4 if closed else 2, int(np.ceil(length / 0.75)))
    distance = np.linspace(0, length, intervals + 1)
    raw = get_coordinates(line_interpolate_point(line, distance))
    smoothing_step = length / intervals
    radius = max(1, int(np.ceil(2.5 * sigma / smoothing_step)))
    kernel_x = np.arange(-radius, radius + 1) * smoothing_step
    kernel = np.exp(-0.5 * (kernel_x / sigma) ** 2)
    kernel /= kernel.sum()
    core = raw[:-1] if closed else raw
    padded = np.pad(core, ((radius, radius), (0, 0)), mode="wrap" if closed else "edge")
    filtered = np.column_stack([np.convolve(padded[:, i], kernel, mode="valid") for i in (0, 1)])
    if closed:
        filtered = np.vstack((filtered, filtered[0]))
    else:
        filtered[[0, -1]] = raw[[0, -1]]
    # Uniform parameters give adjacent pieces the same derivative at their common knot.
    slopes = np.gradient(filtered, axis=0)
    if closed:
        slopes[[0, -1]] = (filtered[1] - filtered[-2]) / 2
    stride = max(1, int(round(8.0 / smoothing_step)))
    knots = np.unique(
        np.linspace(
            0, intervals, max(4 if closed else 1, int(np.ceil(intervals / stride))) + 1, dtype=int
        )
    )
    curves = []
    for a, b in zip(knots, knots[1:], strict=False):
        reach = (b - a) / 3
        p, q = filtered[a], filtered[b]
        curves.append(Cubic(*map(tuple, (p, p + reach * slopes[a], q - reach * slopes[b], q))))
    return tuple(curves)


def smooth_chain(
    boundary: Boundary,
    original: tuple[Cubic, ...],
    baseline: tuple[Cubic, ...],
    limit: float,
    anchored: bool,
) -> tuple[Cubic, ...]:
    if min(boundary.left, boundary.right) < 0 or not _sharp_joins(original, boundary.closed):
        return original
    reference = LineString(boundary.points)
    true_corners = _reference_corners(boundary)

    def is_corner(point):
        return np.any(np.linalg.norm(true_corners - point, axis=1) < 1.6)

    fixed = [
        a.end
        for a, b in _joins(original, boundary.closed)
        if _bend(tangent(a, True), tangent(b, False)) > 45 and is_corner(a.end)
    ]

    def score(chain):
        return sum(not is_corner(p) for p in _sharp_joins(chain, boundary.closed)), len(chain)

    best = original
    baseline_line = LineString(sample_curves(baseline, error=0.006))
    if all(baseline_line.distance(Point(corner)) < 0.12 for corner in fixed):
        if score(baseline) < score(best):
            best = baseline
    if not score(best)[0] and best == original:
        return best
    cuts = [0]
    cuts.extend(index for index, (a, _) in enumerate(_joins(original, False), 1) if a.end in fixed)
    cuts.append(len(original))
    for sigma in (2.4, 1.55, 0.9):
        result = []
        for a, b in zip(cuts, cuts[1:], strict=False):
            run = original[a:b]
            ring = boundary.closed and not anchored and len(cuts) == 2 and not fixed
            candidate = _hermite(sample_curves(run, error=0.04), sigma, ring)
            result.extend(candidate or run)
        result = canonical_curves(tuple(result))
        if score(result) >= score(best):
            continue
        line = LineString(sample_curves(result, error=0.006))
        if line.is_simple and line.hausdorff_distance(reference) <= limit - 0.006:
            best = result
    return best


def align_junctions(
    boundaries: tuple[Boundary, ...],
    curves: list[tuple[Cubic, ...]],
    protected: frozenset[int],
    tolerance: float,
) -> None:
    endpoints = {}
    loop_nodes = {b.points[0] for b in boundaries if b.closed}
    for b, chain in zip(boundaries, curves, strict=True):
        if not b.closed:
            endpoints.setdefault(chain[0].start, []).append((b.id, False))
            endpoints.setdefault(chain[-1].end, []).append((b.id, True))
    for node, arms in endpoints.items():
        if len(arms) != 3 or node in loop_nodes:
            continue
        vectors = []
        for i, end in arms:
            current = curves[i][-1] if end else curves[i][0]
            vectors.append(tangent(current, end) * (-1 if end else 1))
        alternatives = sorted(
            (_bend(vectors[a], -vectors[b]), a, b) for a, b in ((0, 1), (0, 2), (1, 2))
        )
        angle, first, second = alternatives[0]
        if not 10 < angle < 46 or alternatives[1][0] - angle < 12:
            continue
        direction = _unit(vectors[first] - vectors[second])
        updated = {}
        for position, sign in ((first, 1), (second, -1)):
            i, end = arms[position]
            boundary = boundaries[i]
            if (
                min(boundary.left, boundary.right) < 0
                or {boundary.left, boundary.right} & protected
            ):
                break
            chain = curves[i]
            current = chain[-1] if end else chain[0]
            handle = current.second if end else current.first
            point = tuple(
                np.asarray(node) + direction * sign * np.linalg.norm(np.subtract(handle, node))
            )
            revision = replace(current, **{"second" if end else "first": point})
            candidate = canonical_curves((*chain[:-1], revision) if end else (revision, *chain[1:]))
            line = LineString(sample_curves(candidate, error=0.006))
            if (
                not line.is_simple
                or line.hausdorff_distance(LineString(boundary.points)) > tolerance - 0.006
            ):
                break
            updated[i] = candidate
        if len(updated) == 2:
            for i, candidate in updated.items():
                curves[i] = candidate
