"""4-связные компоненты, граф соседства и измерения на пиксельной сетке."""

from dataclasses import replace

import cv2
import numpy as np

from mystery_coloring.domain import StageError
from mystery_coloring.regions.adapters.details import reconcile_details
from mystery_coloring.regions.domain import (
    Region,
    RegionInput,
    RegionResult,
    RegionSettings,
    SharedBorder,
)
from mystery_coloring.regions.merging import merge_small_regions

MAX_REGIONS = 100_000


def connected_regions(color_map: np.ndarray) -> tuple[np.ndarray, tuple[int, ...]]:
    labels = np.empty(color_map.shape, dtype=np.int32)
    colors = []
    for color in np.unique(color_map):
        mask = (color_map == color).astype(np.uint8)
        count, local = cv2.connectedComponentsWithAlgorithm(mask, 4, cv2.CV_32S, cv2.CCL_WU)
        if len(colors) + count - 1 > MAX_REGIONS:
            raise StageError("Больше 100000 областей. Усильте сглаживание или уменьшите исходник.")
        selected = mask.astype(bool)
        labels[selected] = local[selected] - 1 + len(colors)
        colors.extend([int(color)] * (count - 1))
    return labels, tuple(colors)


def shared_borders(labels: np.ndarray) -> tuple[SharedBorder, ...]:
    count = int(labels.max()) + 1
    encoded = []
    for first, second in ((labels[:, :-1], labels[:, 1:]), (labels[:-1], labels[1:])):
        different = first != second
        a, b = first[different].astype(np.int64), second[different].astype(np.int64)
        encoded.append(np.minimum(a, b) * count + np.maximum(a, b))
    pairs, lengths = np.unique(np.concatenate(encoded), return_counts=True)
    return tuple(
        SharedBorder(int(pair // count), int(pair % count), int(length))
        for pair, length in zip(pairs, lengths, strict=True)
    )


def measure_regions(
    labels: np.ndarray,
    colors: tuple[int, ...],
    borders: tuple[SharedBorder, ...],
    lineage: tuple[tuple[int, ...], ...],
    min_area: int,
) -> tuple[Region, ...]:
    count = len(colors)
    flat = labels.ravel()
    areas = np.bincount(flat, minlength=count)
    y, x = np.indices(labels.shape, dtype=np.int32)
    xmin, ymin = np.full(count, labels.shape[1]), np.full(count, labels.shape[0])
    xmax, ymax = np.zeros(count, dtype=int), np.zeros(count, dtype=int)
    np.minimum.at(xmin, flat, x.ravel())
    np.minimum.at(ymin, flat, y.ravel())
    np.maximum.at(xmax, flat, x.ravel())
    np.maximum.at(ymax, flat, y.ravel())
    cx = np.bincount(flat, weights=x.ravel() + 0.5, minlength=count) / areas
    cy = np.bincount(flat, weights=y.ravel() + 0.5, minlength=count) / areas
    perimeters = np.zeros(count, dtype=np.int64)
    for border in borders:
        perimeters[border.first] += border.length_pixels
        perimeters[border.second] += border.length_pixels
    # Внешние края учитываются отдельно; у картинки высотой 1 верх и низ различны.
    for outside in (labels[0], labels[-1], labels[:, 0], labels[:, -1]):
        perimeters += np.bincount(outside, minlength=count)
    return tuple(
        Region(
            region,
            colors[region],
            int(areas[region]),
            int(perimeters[region]),
            (
                int(xmin[region]),
                int(ymin[region]),
                int(xmax[region] - xmin[region] + 1),
                int(ymax[region] - ymin[region] + 1),
            ),
            (float(cx[region]), float(cy[region])),
            lineage[region],
            bool(areas[region] < min_area),
        )
        for region in range(count)
    )


class RasterRegionProcessor:
    def process(self, source: RegionInput, settings: RegionSettings) -> RegionResult:
        try:
            return self._process(source, settings)
        except cv2.error as error:
            raise StageError(f"Ошибка построения областей: {error}") from error

    def _process(self, source: RegionInput, settings: RegionSettings) -> RegionResult:
        color_map = np.frombuffer(source.color_indices, np.uint8).reshape(
            source.height, source.width
        )
        protected_mask = (
            np.frombuffer(source.prefilled_mask, np.uint8).reshape(color_map.shape)
            if source.prefilled_mask
            else np.zeros_like(color_map)
        )
        initial, keys = connected_regions(
            color_map.astype(np.uint16) + protected_mask.astype(np.uint16) * 256
        )
        initial_colors = tuple(key % 256 for key in keys)
        protected = frozenset(i for i, key in enumerate(keys) if key >= 256)
        locked = frozenset(i for i, key in enumerate(keys) if key >= 512)
        areas = tuple(int(a) for a in np.bincount(initial.ravel()))
        borders = shared_borders(initial)
        rgb = np.asarray(source.palette, dtype=np.float32).reshape(1, -1, 3) / 255.0
        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).reshape(-1, 3)
        distances = np.sqrt(np.sum((lab[:, None] - lab[None, :]) ** 2, axis=2))
        threshold = settings.min_area_pixels(source.width)
        representatives = merge_small_regions(
            areas,
            initial_colors,
            borders,
            tuple(tuple(float(d) for d in row) for row in distances),
            threshold,
            settings.max_color_distance,
            protected,
        )
        roots, remap = np.unique(representatives, return_inverse=True)
        labels = remap[initial].astype(np.int32)
        colors = tuple(initial_colors[root] for root in roots)
        cleaned = np.asarray(colors, dtype=np.uint8)[labels]
        protected_final = frozenset(int(remap[i]) for i in protected)
        locked_final = frozenset(int(remap[i]) for i in locked)
        if protected_final:
            final_keys = tuple(
                c + (512 if i in locked_final else 256 if i in protected_final else 0)
                for i, c in enumerate(colors)
            )
            final_mask = np.isin(labels, tuple(protected_final)).astype(np.uint8)
            final_mask[np.isin(labels, tuple(locked_final))] = 2
            reconciled = reconcile_details(
                final_mask,
                labels,
                final_keys,
                shared_borders(labels),
            )
            if not np.array_equal(reconciled, final_mask):
                joined, joined_keys = connected_regions(
                    cleaned.astype(np.uint16) + reconciled.astype(np.uint16) * 256
                )
                _, first_pixel = np.unique(labels, return_index=True)
                remap = joined.ravel()[first_pixel][remap]
                labels = joined
                colors = tuple(key % 256 for key in joined_keys)
                protected_final = frozenset(i for i, key in enumerate(joined_keys) if key >= 256)
        lineage: list[list[int]] = [[] for _ in colors]
        for old_id, new_id in enumerate(remap):
            lineage[int(new_id)].append(old_id)
        final_borders = shared_borders(labels)
        regions = measure_regions(
            labels, colors, final_borders, tuple(tuple(ids) for ids in lineage), threshold
        )
        # Tiny islands enclosed entirely by prefilled shapes are printed too.
        neighbors = {i: set() for i in range(len(regions))}
        for border in final_borders:
            neighbors[border.first].add(border.second)
            neighbors[border.second].add(border.first)
        protected_final |= frozenset(
            r.id
            for r in regions
            if r.below_min_area and neighbors[r.id] and neighbors[r.id] <= protected_final
        )
        regions = tuple(replace(r, prefilled=r.id in protected_final) for r in regions)
        actual_change = distances[color_map, cleaned]
        if float(actual_change.max()) > settings.max_color_distance + 1e-5:
            raise StageError("Нарушено ограничение на изменение цвета.")
        return RegionResult(
            source.width,
            source.height,
            initial.astype("<u4").tobytes(),
            labels.astype("<u4").tobytes(),
            cleaned.tobytes(),
            regions,
            final_borders,
            len(initial_colors),
            int(np.count_nonzero(color_map != cleaned)),
            float(actual_change.max()),
        )
