"""Coalesce generic detail fragments with touching paint of exactly the same color."""

from collections import deque

import numpy as np


def reconcile_details(protected_mask, labels, keys, borders):
    # Locked strokes/face features never participate. The remaining same-color
    # connected component becomes paintable as soon as it touches ordinary paint.
    neighbors = {}
    for border in borders:
        a, b = border.first, border.second
        if keys[a] >= 512 or keys[b] >= 512 or keys[a] % 256 != keys[b] % 256:
            continue
        neighbors.setdefault(a, []).append(b)
        neighbors.setdefault(b, []).append(a)
    queue = deque(i for i in neighbors if keys[i] < 256)
    visited = set(queue)
    while queue:
        for neighbor in neighbors[queue.popleft()]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    released = tuple(i for i in visited if keys[i] >= 256)
    if not released:
        return protected_mask
    result = protected_mask.copy()
    result[np.isin(labels, released)] = 0
    return result
