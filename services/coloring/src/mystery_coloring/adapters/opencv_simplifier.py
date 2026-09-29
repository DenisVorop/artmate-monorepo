"""Bilateral в RGB, кластеризация и назначение палитры в физическом Lab."""

import cv2
import numpy as np

from mystery_coloring.adapters.clustering import CHUNK_SIZE, initial_labels, nearest
from mystery_coloring.domain import (
    PaletteColor,
    RGBImage,
    SimplifiedImage,
    SimplifySettings,
    Smoothing,
    StageError,
)
from mystery_coloring.palette import is_paper_white, palette_order

# Диаметр, цветовая сигма в шкале 0..255, пространственная сигма, число проходов.
FILTERS = {
    Smoothing.LOW: (5, 20, 3, 1),
    Smoothing.MEDIUM: (9, 35, 5, 2),
    Smoothing.HIGH: (9, 55, 7, 3),
}


def _lab(rgb: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(rgb.astype(np.float32) / 255.0, cv2.COLOR_RGB2LAB)


class OpenCVImageSimplifier:
    def simplify(
        self, image: RGBImage, settings: SimplifySettings, *, detail_map=None
    ) -> SimplifiedImage:
        try:
            return self._simplify(image, settings, detail_map)
        except cv2.error as error:
            raise StageError(f"Ошибка обработки изображения: {error}") from error

    def _simplify(
        self, image: RGBImage, settings: SimplifySettings, detail_map=None
    ) -> SimplifiedImage:
        rgb = np.frombuffer(image.pixels, dtype=np.uint8).reshape(image.height, image.width, 3)
        if settings.smoothing != Smoothing.NONE:
            diameter, color_sigma, space_sigma, passes = FILTERS[settings.smoothing]
            for _ in range(passes):
                rgb = cv2.bilateralFilter(rgb, diameter, color_sigma, space_sigma)

        fixed = []
        if detail_map is not None:
            candidates = ([(255, 255, 255)] if (255, 255, 255) in detail_map.colors else []) + list(
                detail_map.accents
            )
            for candidate in candidates:
                lab = _lab(np.asarray(candidate, dtype=np.uint8).reshape(1, 1, 3)).reshape(3)
                if all(
                    np.linalg.norm(
                        lab - _lab(np.asarray(c, dtype=np.uint8).reshape(1, 1, 3)).reshape(3)
                    )
                    >= 24
                    for c in fixed
                ):
                    fixed.append(candidate)
                if len(fixed) >= max(1, min(3, settings.colors // 4)):
                    break
        free_colors = settings.colors - len(fixed)
        flat_rgb = rgb.reshape(-1, 3)
        rng = np.random.default_rng(settings.seed)
        if len(flat_rgb) > settings.sample_size:
            sample_rgb = flat_rgb[rng.choice(len(flat_rgb), settings.sample_size, replace=False)]
        else:
            sample_rgb = flat_rgb
        unique_rgb = np.unique(sample_rgb, axis=0)
        if len(unique_rgb) <= free_colors:
            palette = unique_rgb
        else:
            sample_lab = _lab(sample_rgb.reshape(-1, 1, 3)).reshape(-1, 3)
            # USE_INITIAL_LABELS и одна попытка не требуют глобального setRNGSeed.
            labels = initial_labels(sample_lab, free_colors, rng)
            count = int(labels.max()) + 1
            _, _, centers = cv2.kmeans(
                sample_lab,
                count,
                labels.reshape(-1, 1),
                (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_MAX_ITER, 40, 0.05),
                1,
                cv2.KMEANS_USE_INITIAL_LABELS,
            )
            palette_float = cv2.cvtColor(centers.reshape(1, -1, 3), cv2.COLOR_LAB2RGB)
            palette = np.unique(
                np.rint(np.clip(palette_float, 0, 1) * 255).astype(np.uint8).reshape(-1, 3),
                axis=0,
            )

        if fixed:
            palette = np.unique(np.vstack((palette, np.asarray(fixed, dtype=np.uint8))), axis=0)
        if (255, 255, 255) in fixed:
            palette = np.unique(
                np.asarray(
                    [
                        (255, 255, 255) if is_paper_white(tuple(int(v) for v in c)) else c
                        for c in palette
                    ],
                    dtype=np.uint8,
                ),
                axis=0,
            )
        # Назначаем по реально сохраняемым RGB-цветам, а не по округлённым позже центрам.
        palette_lab = _lab(palette.reshape(1, -1, 3)).reshape(-1, 3)
        color_map = np.empty(len(flat_rgb), dtype=np.uint8)
        for start in range(0, len(flat_rgb), CHUNK_SIZE):
            part = flat_rgb[start : start + CHUNK_SIZE]
            part_lab = _lab(part.reshape(-1, 1, 3)).reshape(-1, 3)
            color_map[start : start + len(part)] = nearest(part_lab, palette_lab)

        prefilled = b""
        if detail_map is not None:
            detail_ids = np.frombuffer(detail_map.region_ids, "<u4")
            lookup = np.zeros(len(detail_map.colors) + 1, np.uint8)
            if detail_map.colors:
                detail_lab = _lab(
                    np.asarray(detail_map.colors, dtype=np.uint8).reshape(-1, 1, 3)
                ).reshape(-1, 3)
                lookup[1:] = nearest(detail_lab, palette_lab)
            selected = detail_ids > 0
            color_map[selected] = lookup[detail_ids[selected]]
            protection = selected.astype(np.uint8)
            protection[np.isin(detail_ids, tuple(detail_map.locked_ids))] = 2
            prefilled = protection.tobytes()
        counts = np.bincount(color_map, minlength=len(palette))
        used = np.flatnonzero(counts)
        # Одновременно переставляем палитру и карту: RGB-пиксели остаются прежними.
        used_palette = tuple(tuple(int(v) for v in palette[i]) for i in used)
        order = used[np.asarray(palette_order(used_palette), dtype=np.intp)]
        remap = np.zeros(len(palette), dtype=np.uint8)
        remap[order] = np.arange(len(order), dtype=np.uint8)
        color_map = remap[color_map]
        palette = palette[order]
        colors = tuple(
            PaletteColor(tuple(int(c) for c in rgb_color), int(counts[index]))
            for rgb_color, index in zip(palette, order, strict=True)
        )
        simplified = RGBImage(image.width, image.height, palette[color_map].tobytes())
        return SimplifiedImage(simplified, colors, color_map.tobytes(), prefilled)
