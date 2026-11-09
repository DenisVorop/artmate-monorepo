"""Запись проверенной геометрии, SVG и превью из одних кубических сегментов."""

import hashlib
import json
import platform
import shutil
from dataclasses import asdict
from importlib.metadata import version
from pathlib import Path

import numpy as np
import resvg_py
from PIL import Image

from mystery_coloring.domain import StageError
from mystery_coloring.geometry.adapters.svg import svg_document
from mystery_coloring.geometry.domain import GeometryResult, GeometrySettings
from mystery_coloring.regions.domain import RegionInput


def _json(path: Path, value: object) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )


class GeometryFileWriter:
    def write(
        self,
        destination: Path,
        source: RegionInput,
        result: GeometryResult,
        settings: GeometrySettings,
    ) -> None:
        created = False
        try:
            result.validate_min_area(settings.min_area_mm2)
            destination.mkdir(parents=True, exist_ok=False)
            created = True
            self._save(destination, source, result, settings)
        except (OSError, ValueError, RuntimeError) as error:
            if created:
                shutil.rmtree(destination)
            raise StageError(f"Не удалось сохранить геометрию: {error}") from error

    @staticmethod
    def _save(
        destination: Path, source: RegionInput, result: GeometryResult, settings: GeometrySettings
    ) -> None:
        colors = tuple(source.palette[index] for index in result.color_indices)
        for name, fill, stroke in (
            ("outlines", False, settings.stroke_mm),
            ("colored", True, 0),
            ("colored-outlines", True, settings.stroke_mm),
        ):
            svg = svg_document(
                result.boundaries,
                result.width,
                result.height,
                colors,
                settings.image_width_mm,
                fill,
                stroke,
            )
            (destination / f"{name}.svg").write_text(svg, encoding="utf-8")
            (destination / f"{name}.png").write_bytes(
                resvg_py.svg_to_bytes(
                    svg_string=svg,
                    width=min(result.width * 2, 2400),
                    dpi=96,
                    skip_system_fonts=True,
                )
            )
        labels = np.frombuffer(result.raster_region_ids, dtype="<u4").reshape(
            result.height, result.width
        )
        np.save(destination / "region-map.npy", labels, allow_pickle=False)
        palette = np.asarray(source.palette, dtype=np.uint8)
        source_map = np.frombuffer(source.color_indices, dtype=np.uint8).reshape(labels.shape)
        Image.fromarray(palette[source_map]).save(destination / "stage1.png")
        Image.fromarray(palette[np.asarray(result.color_indices)[labels]]).save(
            destination / "cleaned-raster.png"
        )
        neighbors: list[set[int]] = [set() for _ in colors]
        for boundary in result.boundaries:
            left, right = boundary.source.left, boundary.source.right
            if min(left, right) >= 0:
                neighbors[left].add(right)
                neighbors[right].add(left)
        _json(
            destination / "geometry.json",
            {
                "schema_version": 1,
                "coordinates": "pixel edges; x right, y down",
                "mm_per_unit": settings.image_width_mm / result.width,
                "area_measurement": (
                    "analytic Green integral of exported cubic coordinates; holes subtracted"
                ),
                "regions": [
                    {
                        "id": index,
                        "color_index": result.color_indices[index],
                        "color_number": result.color_indices[index] + 1,
                        "area_mm2": area,
                        "prefilled": index in result.prefilled_ids,
                        "mergeable_prefilled": index in result.mergeable_detail_ids,
                        "neighbors": sorted(neighbors[index]),
                        "source_region_ids": result.source_region_ids[index],
                    }
                    for index, area in enumerate(result.areas_mm2)
                ],
                "boundaries": [
                    {
                        "id": item.source.id,
                        "left": item.source.left,
                        "right": item.source.right,
                        "reduced_smoothing": item.fallback,
                        "curves": [asdict(curve) for curve in item.curves],
                    }
                    for item in result.boundaries
                ],
            },
        )
        _json(
            destination / "palette.json",
            {
                "colors": [
                    {"index": index, "number": index + 1, "rgb": rgb}
                    for index, rgb in enumerate(source.palette)
                ]
            },
        )
        _json(
            destination / "quality.json",
            {
                "initial_regions": result.initial_count,
                "final_regions": len(result.areas_mm2),
                "required_min_area_mm2": settings.min_area_mm2,
                "actual_min_area_mm2": min(result.areas_mm2),
                "below_min_area": 0,
                "covered_area_mm2": sum(result.areas_mm2),
                "cleanup_rounds": result.cleanup_rounds,
                "changed_pixels_before_vectorization": result.changed_pixels,
                "changed_fraction_before_vectorization": result.changed_pixels / labels.size,
                "max_delta_e76_before_vectorization": result.max_color_change,
                "color_error_is_hard_limit": False,
                "reduced_smoothing_boundaries": result.reduced_smoothing_boundaries,
                "topology_rounds": result.topology_rounds,
                "max_sampled_deviation_mm": result.max_sampled_deviation_mm,
                "topology_validation": (
                    "sampled cubic geometry, target flatness 0.005 working pixels"
                ),
                "exact_continuous_curve_topology_proven": False,
                "print_ready": False,
                "limitations": [
                    "no minimum width requirement",
                    "no semantic protection",
                    "no labels or mystery subdivision",
                    "area refers to filled geometry before outline stroke",
                ],
            },
        )
        _json(
            destination / "manifest.json",
            {
                "schema_version": 1,
                "algorithm": "strict-area-shared-rounded-curves-v2",
                "settings": asdict(settings),
                "source_manifest_sha256": source.source_manifest_sha256,
                "working_size": [result.width, result.height],
                "image_size_mm": [
                    settings.image_width_mm,
                    settings.image_width_mm * result.height / result.width,
                ],
                "environment": {
                    "python": platform.python_version(),
                    **{
                        name: version(name)
                        for name in (
                            "numpy",
                            "opencv-python-headless",
                            "Pillow",
                            "shapely",
                            "resvg_py",
                        )
                    },
                },
                "artifacts_sha256": {
                    p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                    for p in sorted(destination.iterdir())
                },
            },
        )
