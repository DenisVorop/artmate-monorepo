"""Файловый контракт областей; растровые превью не заменяют векторные контуры."""

import hashlib
import json
import platform
import shutil
from dataclasses import asdict
from importlib.metadata import version
from pathlib import Path

import numpy as np
from PIL import Image, ImageCms, ImageDraw

from mystery_coloring import __version__
from mystery_coloring.domain import StageError
from mystery_coloring.regions.domain import RegionInput, RegionResult, RegionSettings


def _json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


class RegionFileWriter:
    def write(
        self, destination: Path, source: RegionInput, result: RegionResult, settings: RegionSettings
    ) -> None:
        created = False
        try:
            destination.mkdir(parents=True, exist_ok=False)
            created = True
            self._save(destination, source, result, settings)
        except (OSError, ValueError) as error:
            if created:
                shutil.rmtree(destination)
            raise StageError(f"Не удалось сохранить области: {error}") from error

    @staticmethod
    def _save(
        destination: Path, source: RegionInput, result: RegionResult, settings: RegionSettings
    ) -> None:
        shape = (source.height, source.width)
        initial = np.frombuffer(result.initial_region_ids, dtype="<u4").reshape(shape)
        labels = np.frombuffer(result.region_ids, dtype="<u4").reshape(shape)
        color_map = np.frombuffer(result.color_indices, np.uint8).reshape(shape)
        old_colors = np.frombuffer(source.color_indices, np.uint8).reshape(shape)
        palette = np.asarray(source.palette, dtype=np.uint8)
        np.save(destination / "initial-region-map.npy", initial, allow_pickle=False)
        np.save(destination / "region-map.npy", labels, allow_pickle=False)
        Image.fromarray(color_map).save(destination / "color-map.png")
        profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
        cleaned = palette[color_map]
        Image.fromarray(cleaned).save(destination / "cleaned.png", icc_profile=profile)
        border_mask = np.zeros(shape, dtype=bool)
        border_mask[:, :-1] |= labels[:, :-1] != labels[:, 1:]
        border_mask[:-1] |= labels[:-1] != labels[1:]
        border_mask[[0, -1], :] = True
        border_mask[:, [0, -1]] = True
        lines = np.full(shape, 255, dtype=np.uint8)
        lines[border_mask] = 0
        Image.fromarray(lines).save(destination / "boundaries.png")
        overlay = cleaned.copy()
        overlay[border_mask] = 0
        Image.fromarray(overlay).save(destination / "region-overlay.png", icc_profile=profile)
        changed = np.full((*shape, 3), 255, dtype=np.uint8)
        changed[old_colors != color_map] = (225, 65, 110)
        Image.fromarray(changed).save(destination / "changed-pixels.png", icc_profile=profile)
        small_ids = [region.id for region in result.regions if region.below_min_area]
        small_flags = np.zeros(len(result.regions), dtype=bool)
        small_flags[small_ids] = True
        small_preview = np.full((*shape, 3), 255, dtype=np.uint8)
        small_preview[small_flags[labels]] = (230, 80, 30)
        Image.fromarray(small_preview).save(destination / "small-regions.png", icc_profile=profile)

        previews = [
            Image.fromarray(palette[old_colors]),
            Image.fromarray(cleaned),
            Image.fromarray(overlay),
        ]
        for preview in previews:
            preview.thumbnail((600, 800), Image.Resampling.LANCZOS)
        width, height = previews[0].size
        comparison = Image.new("RGB", (3 * width + 40, height + 42), "white")
        draw = ImageDraw.Draw(comparison)
        titles = (
            f"Stage 1: {result.initial_count} regions",
            f"Cleaned: {len(result.regions)} regions",
            "Raster boundaries (preview)",
        )
        for index, (preview, title) in enumerate(zip(previews, titles, strict=True)):
            left = 10 + (width + 10) * index
            comparison.paste(preview, (left, 32))
            draw.text((left, 10), title, fill="black")
        comparison.save(destination / "comparison.png", icc_profile=profile)

        scale = settings.image_width_mm / source.width
        neighbors: list[list[int]] = [[] for _ in result.regions]
        for border in result.borders:
            neighbors[border.first].append(border.second)
            neighbors[border.second].append(border.first)
        _json(
            destination / "regions.json",
            {
                "schema_version": 1,
                "connectivity": 4,
                "region_ids": "zero-based",
                "coordinate_system": "pixel edges, origin top-left, x right, y down",
                "bbox_format": ["x", "y", "width", "height"],
                "centroid": "mean of pixel centers, not guaranteed inside the region",
                "mm_per_pixel": scale,
                "regions": [
                    {
                        **asdict(region),
                        "color_number": region.color_index + 1,
                        "area_mm2": region.area_pixels * scale**2,
                        "raster_perimeter_mm": region.perimeter_pixels * scale,
                        "neighbors": sorted(neighbors[region.id]),
                    }
                    for region in result.regions
                ],
                "shared_borders": [
                    {**asdict(border), "length_mm": border.length_pixels * scale}
                    for border in result.borders
                ],
            },
        )
        counts = np.bincount(color_map.ravel(), minlength=len(source.palette))
        _json(
            destination / "palette.json",
            {
                "color_space": "sRGB",
                "indices_preserved_from_stage1": True,
                "colors": [
                    {
                        "index": index,
                        "number": index + 1,
                        "rgb": list(color),
                        "hex": "#" + "".join(f"{c:02X}" for c in color),
                        "pixel_count": int(counts[index]),
                        "fraction": float(counts[index] / labels.size),
                    }
                    for index, color in enumerate(source.palette)
                ],
            },
        )
        threshold = settings.min_area_pixels(source.width)
        _json(
            destination / "quality.json",
            {
                "initial_regions": result.initial_count,
                "final_regions": len(result.regions),
                "regions_absorbed": result.initial_count - len(result.regions),
                "initial_small_regions": int(
                    np.count_nonzero(np.bincount(initial.ravel()) < threshold)
                ),
                "remaining_small_regions": small_ids,
                "remaining_reason": "color distance limit or no adjacent region",
                "min_area_pixels": threshold,
                "changed_pixels": result.changed_pixels,
                "changed_fraction": result.changed_pixels / labels.size,
                "max_delta_e76_from_stage1": result.max_color_change,
                "covered_pixels": sum(region.area_pixels for region in result.regions),
                "print_ready": False,
                "limitations": [
                    "raster geometry only",
                    "no width/label-fit checks",
                    "no semantic protection",
                    "no vector contours or numbers",
                ],
            },
        )
        checksums = {
            path.name: hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(destination.iterdir())
        }
        _json(
            destination / "manifest.json",
            {
                "schema_version": 1,
                "algorithm": "connected4-bounded-region-merge-v1",
                "application_version": __version__,
                "settings": asdict(settings),
                "source_manifest_sha256": source.source_manifest_sha256,
                "working_size": [source.width, source.height],
                "image_size_mm": [settings.image_width_mm, source.height * scale],
                "region_map": {"file": "region-map.npy", "dtype": "<u4", "indices": "zero-based"},
                "environment": {
                    "python": platform.python_version(),
                    "platform": platform.platform(),
                    **{
                        name: version(name)
                        for name in ("numpy", "opencv-python-headless", "Pillow")
                    },
                },
                "artifacts_sha256": checksums,
            },
        )
