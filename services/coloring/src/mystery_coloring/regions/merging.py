"""Детерминированная политика объединения графа, без NumPy, OpenCV и файлов."""

import heapq

from mystery_coloring.regions.domain import SharedBorder


def merge_small_regions(
    areas: tuple[int | float, ...],
    colors: tuple[int, ...],
    borders: tuple[SharedBorder, ...],
    distances: tuple[tuple[float, ...], ...],
    min_area: int | float,
    max_color_distance: float,
    protected: frozenset[int] = frozenset(),
) -> tuple[int, ...]:
    """Возвращает конечного представителя для каждого исходного ID.

    Цвет представителя не меняется. Проверяется отклонение каждого исходного
    цвета группы, поэтому последовательные объединения не обходят ограничение.
    """
    count = len(areas)
    parent = list(range(count))
    sizes = list(areas)
    neighbors: list[dict[int, int]] = [{} for _ in areas]
    histograms = [{color: area} for color, area in zip(colors, areas, strict=True)]
    for border in borders:
        neighbors[border.first][border.second] = border.length_pixels
        neighbors[border.second][border.first] = border.length_pixels
    queue = [
        (area, region)
        for region, area in enumerate(areas)
        if area < min_area and region not in protected
    ]
    heapq.heapify(queue)

    def absorb(source: int, target: int) -> None:
        parent[source] = target
        sizes[target] += sizes[source]
        for color, amount in histograms[source].items():
            histograms[target][color] = histograms[target].get(color, 0) + amount
        histograms[source].clear()
        neighbors[target].pop(source, None)
        for other, length in neighbors[source].items():
            if other == target:
                continue
            neighbors[other].pop(source)
            combined = neighbors[target].get(other, 0) + length
            neighbors[target][other] = combined
            neighbors[other][target] = combined
        neighbors[source].clear()

    while queue:
        area, source = heapq.heappop(queue)
        if parent[source] != source or sizes[source] != area or area >= min_area:
            continue
        candidates = []
        for target, border_length in neighbors[source].items():
            if target in protected:
                continue
            target_color = colors[target]
            # Для target это ограничение уже выполняется; проверяем все цвета source.
            if any(
                distances[color][target_color] > max_color_distance for color in histograms[source]
            ):
                continue
            color_error = (
                sum(
                    amount * distances[color][target_color] ** 2
                    for color, amount in histograms[source].items()
                )
                / area
            )
            candidates.append((color_error, -border_length, -sizes[target], target))
        if not candidates:
            continue
        target = min(candidates)[-1]
        affected = set(neighbors[source])
        same_color = [
            n
            for n in neighbors[source]
            if n != target and n not in protected and colors[n] == colors[target]
        ]
        absorb(source, target)
        # После перекраски может появиться мост к другим областям того же цвета.
        # Убираем искусственные швы даже у крупных одноцветных соседей.
        while same_color:
            other = same_color.pop()
            if parent[other] == other and other in neighbors[target]:
                affected.update(neighbors[other])
                same_color.extend(
                    n
                    for n in neighbors[other]
                    if n != target and n not in protected and colors[n] == colors[target]
                )
                absorb(other, target)
        for changed in sorted(affected | {target}):
            if (
                changed not in protected
                and parent[changed] == changed
                and sizes[changed] < min_area
            ):
                heapq.heappush(queue, (sizes[changed], changed))

    def root(region: int) -> int:
        current = region
        while parent[current] != current:
            current = parent[current]
        while parent[region] != region:
            following = parent[region]
            parent[region] = current
            region = following
        return current

    return tuple(root(region) for region in range(count))
