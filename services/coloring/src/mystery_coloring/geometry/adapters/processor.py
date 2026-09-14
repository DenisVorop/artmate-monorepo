"""Численная реализация обязательной площади и сглаживания общих границ."""

from math import fsum, isfinite

import cv2
import numpy as np

from mystery_coloring.domain import StageError
from mystery_coloring.geometry.adapters.raster import extract_boundaries
from mystery_coloring.geometry.adapters.topology import smooth_boundaries
from mystery_coloring.geometry.curves import region_areas
from mystery_coloring.geometry.domain import GeometryResult, GeometrySettings
from mystery_coloring.regions.adapters.segmenter import shared_borders
from mystery_coloring.regions.application import RegionProcessor
from mystery_coloring.regions.domain import RegionInput, RegionSettings
from mystery_coloring.regions.merging import merge_small_regions


class SmoothGeometryProcessor:
    def __init__(self, region_processor: RegionProcessor) -> None:
        self._region_processor = region_processor

    def process(self, source: RegionInput, settings: GeometrySettings) -> GeometryResult:
        try:
            return self._process(source, settings)
        except (ValueError, cv2.error) as error:
            raise StageError(f"Не удалось построить геометрию: {error}") from error

    def _process(self, source: RegionInput, settings: GeometrySettings) -> GeometryResult:
        scale = settings.image_width_mm / source.width
        total_area = source.width * source.height * scale**2
        if total_area < settings.min_area_mm2:
            raise StageError("Весь рисунок меньше заданной минимальной площади.")
        # Диапазон CIELAB палитры помещается в 300. Цвет — критерий выбора соседа,
        # но не причина оставить область ниже обязательного порога.
        prepared = self._region_processor.process(
            source,
            RegionSettings(
                image_width_mm=settings.image_width_mm,
                min_area_mm2=settings.min_area_mm2,
                max_color_distance=300,
            ),
        )
        labels = np.frombuffer(prepared.region_ids, dtype="<u4").reshape(
            source.height, source.width
        )
        colors = tuple(region.color_index for region in prepared.regions)
        protected = frozenset(r.id for r in prepared.regions if r.prefilled)
        lineage = tuple(region.source_region_ids for region in prepared.regions)
        rgb = np.asarray(source.palette, dtype=np.float32).reshape(1, -1, 3) / 255.0
        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).reshape(-1, 3)
        distances = np.sqrt(np.sum((lab[:, None] - lab[None, :]) ** 2, axis=2))
        distance_rows = tuple(tuple(float(d) for d in row) for row in distances)
        for iteration in range(1, len(colors) + 2):
            cleanup_round = iteration
            boundaries, rounds, deviation = smooth_boundaries(
                extract_boundaries(labels),
                source.width,
                source.height,
                len(colors),
                settings.smoothing_mm / scale,
                protected,
            )
            areas = region_areas(boundaries, len(colors), scale)
            if (
                any(not isfinite(area) or area <= 0 for area in areas)
                or abs(fsum(areas) - total_area) > 1e-5
            ):
                raise StageError("Нарушена аналитическая площадь областей.")
            if all(i in protected or area >= settings.min_area_mm2 for i, area in enumerate(areas)):
                break
            # Измерение идёт по округлённым кривым, которые будут записаны в SVG.
            # Поэтому область, уменьшившаяся при сглаживании, также объединяется.
            representatives = merge_small_regions(
                areas,
                colors,
                shared_borders(labels),
                distance_rows,
                settings.min_area_mm2,
                300,
                protected,
            )
            roots, remap = np.unique(representatives, return_inverse=True)
            if len(roots) >= len(colors):
                raise StageError("Не удалось выполнить обязательную минимальную площадь.")
            protected = frozenset(int(remap[i]) for i in protected)
            labels = remap[labels].astype(np.uint32)
            new_lineage: list[list[int]] = [[] for _ in roots]
            for previous, current in enumerate(remap):
                new_lineage[int(current)].extend(lineage[previous])
            lineage = tuple(tuple(sorted(ids)) for ids in new_lineage)
            colors = tuple(colors[root] for root in roots)
        else:
            raise StageError("Не сошлась проверка площади после сглаживания.")
        original = np.frombuffer(source.color_indices, dtype=np.uint8).reshape(labels.shape)
        final_colors = np.asarray(colors, dtype=np.uint8)[labels]
        return GeometryResult(
            source.width,
            source.height,
            boundaries,
            colors,
            areas,
            labels.astype("<u4").tobytes(),
            lineage,
            prepared.initial_count,
            cleanup_round,
            int(np.count_nonzero(original != final_colors)),
            float(distances[original, final_colors].max()),
            rounds,
            sum(boundary.fallback for boundary in boundaries),
            deviation * scale,
            protected,
        )
