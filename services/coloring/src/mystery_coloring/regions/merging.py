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
    mergeable_details: frozenset[int] = frozenset(),
) -> tuple[int, ...]:
    """Возвращает конечного представителя для каждого исходного ID.

    Обычная область поглощает соприкасающиеся контрастные детали своего цвета.
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

    locked = protected - mergeable_details

    def coalesce_same_color(target: int, pending: list[int], affected: set[int]) -> None:
        while pending:
            other = pending.pop()
            if (
                other in neighbors[target]
                and other not in locked
                and colors[other] == colors[target]
            ):
                affected.update(neighbors[other])
                pending.extend(n for n in neighbors[other] if n not in neighbors[target])
                absorb(other, target)

    # Объединяем одинаковые цвета до попытки перекрасить маленькую обычную область.
    touching_paint = {
        other
        for detail in mergeable_details
        for other in neighbors[detail]
        if other not in protected and colors[other] == colors[detail]
    }
    for target in sorted(touching_paint):
        if parent[target] == target:
            coalesce_same_color(target, list(neighbors[target]), set())
    queue = [
        (area, region)
        for region, area in enumerate(sizes)
        if area < min_area and parent[region] == region and region not in protected
    ]
    heapq.heapify(queue)

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
        pending = list(neighbors[source])
        affected = set(pending)
        absorb(source, target)
        coalesce_same_color(target, pending, affected)
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
