"""Извлечение каждого общего ребра ровно один раз из целочисленной карты."""

import numpy as np

from mystery_coloring.geometry.domain import Boundary


def extract_boundaries(labels: np.ndarray) -> tuple[Boundary, ...]:
    height, width = labels.shape
    stride = width + 1
    padded = np.pad(labels.astype(np.int64), 1, constant_values=-1)
    vertices_a, vertices_b, lefts, rights = [], [], [], []
    west, east = padded[1:-1, :-1], padded[1:-1, 1:]
    y, x = np.nonzero(west != east)
    vertices_a.extend((y * stride + x).tolist())
    vertices_b.extend(((y + 1) * stride + x).tolist())
    lefts.extend(east[y, x].tolist())
    rights.extend(west[y, x].tolist())
    north, south = padded[:-1, 1:-1], padded[1:, 1:-1]
    y, x = np.nonzero(north != south)
    vertices_a.extend((y * stride + x).tolist())
    vertices_b.extend((y * stride + x + 1).tolist())
    lefts.extend(north[y, x].tolist())
    rights.extend(south[y, x].tolist())
    incident: dict[int, list[int]] = {}
    for edge, (a, b) in enumerate(zip(vertices_a, vertices_b, strict=True)):
        incident.setdefault(a, []).append(edge)
        incident.setdefault(b, []).append(edge)

    def junction(vertex: int) -> bool:
        edges = incident[vertex]
        if len(edges) != 2:
            return True
        first, second = edges
        return {lefts[first], rights[first]} != {lefts[second], rights[second]}

    visited = set()
    result = []

    def walk(start: int, first: int) -> None:
        edge, current = first, start
        forward = vertices_a[first] == start
        left = lefts[first] if forward else rights[first]
        right = rights[first] if forward else lefts[first]
        path = [start]
        while edge not in visited:
            visited.add(edge)
            current = vertices_b[edge] if vertices_a[edge] == current else vertices_a[edge]
            path.append(current)
            if current == start or junction(current):
                break
            edge = next(item for item in incident[current] if item != edge)
        points = tuple((float(vertex % stride), float(vertex // stride)) for vertex in path)
        result.append(Boundary(len(result), left, right, points))

    for vertex in sorted(incident):
        if junction(vertex):
            for edge in incident[vertex]:
                if edge not in visited:
                    walk(vertex, edge)
    for edge, vertex in enumerate(vertices_a):
        if edge not in visited:
            walk(vertex, edge)
    if len(visited) != len(vertices_a):
        raise ValueError("Не все границы извлечены")
    return tuple(result)
