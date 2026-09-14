"""Новый каталог результата и manifest последним; прежние результаты не изменяются."""

import hashlib
import json
import platform
import shutil
from collections import defaultdict
from dataclasses import asdict
from importlib.metadata import version
from pathlib import Path

import resvg_py

from mystery_coloring.domain import StageError
from mystery_coloring.palette import paper_white_policy
from mystery_coloring.subdivision.adapters.svg import document
from mystery_coloring.typography.domain import palette_symbols


def write_json(path, data):
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )


class SubdivisionFileWriter:
    def __init__(self, font):
        self.font = font

    def write(self, destination: Path, source, result, settings):
        result.validate(settings)
        symbols = palette_symbols(source.palette)
        if any(
            space.text != symbols[cell.color_index]
            for cell, space in zip(result.mesh.cells, result.label_spaces, strict=True)
        ):
            raise StageError("Резервирование не соответствует символам палитры.")
        created = False
        try:
            destination.mkdir(parents=True, exist_ok=False)
            created = True
            self._save(destination, source, result, settings)
        except (OSError, ValueError, RuntimeError) as error:
            if created:
                shutil.rmtree(destination)
            raise StageError(f"Не удалось сохранить разбиение: {error}") from error

    def _save(self, destination, source, result, settings):
        for name, filled, outlines, diagnostics in (
            ("outlines", False, True, False),
            ("colored", True, False, False),
            ("colored-outlines", True, True, False),
            ("label-spaces", False, True, True),
        ):
            svg = document(
                source, result, settings, filled=filled, outlines=outlines, diagnostics=diagnostics
            )
            (destination / f"{name}.svg").write_text(svg, encoding="utf-8")
            (destination / f"{name}.png").write_bytes(
                resvg_py.svg_to_bytes(
                    svg_string=svg,
                    width=min(source.width * 2, 2400),
                    dpi=96,
                    skip_system_fonts=True,
                )
            )
        uses = defaultdict(list)
        for cell in result.mesh.cells:
            for ring in cell.rings:
                for ref in ring:
                    uses[abs(ref)].append((cell.id, 1 if ref > 0 else -1))
        write_json(
            destination / "geometry.json",
            {
                "schema_version": 2,
                "coordinates": "pixel edges; x right, y down",
                "mm_per_unit": source.mm_per_unit,
                "working_size": [source.width, source.height],
                "ring_references": "positive edge IDs; negative reference reverses curves",
                "regions": [
                    {**asdict(cell), "area_mm2": area, "color_number": cell.color_index + 1}
                    for cell, area in zip(result.mesh.cells, result.areas_mm2, strict=True)
                ],
                "boundaries": [
                    {**asdict(edge), "regions_and_directions": uses[edge.id]}
                    for edge in result.mesh.edges
                ],
            },
        )
        write_json(
            destination / "palette.json",
            {
                "colors": [
                    {"index": i, "number": i + 1, "rgb": rgb}
                    for i, rgb in enumerate(source.palette)
                ]
            },
        )
        write_json(
            destination / "label-spaces.json",
            {
                "schema_version": 2,
                "font": self.font.name,
                "font_sha256": self.font.sha256,
                "font_size_pt": settings.label_font_size_pt,
                "padding_mm": settings.label_padding_mm,
                "includes_half_outline_width": True,
                "sample_margin_units": 0.01,
                "search_is_exhaustive": False,
                "label_orientation": "horizontal",
                "paper_white_policy": paper_white_policy(),
                "meaning": "reserved ink bounding boxes; labels are not drawn or finalized",
                "regions": [asdict(space) for space in result.label_spaces],
            },
        )
        write_json(
            destination / "quality.json",
            {
                "initial_regions": len(source.mesh.cells),
                "final_regions": len(result.mesh.cells),
                "accepted_splits": result.split_count,
                "required_min_area_mm2": settings.min_area_mm2,
                "actual_min_area_mm2": min(result.areas_mm2),
                "below_min_area": 0,
                "covered_area_mm2": sum(result.areas_mm2),
                "target_area_mm2": settings.target_area_mm2,
                "split_threshold_mm2": settings.target_area_mm2 * 1.5,
                "target_area_is_hard_limit": False,
                "unresolved_large_ids": result.unresolved_large_ids,
                "stop_reasons": dict(result.stop_reasons),
                "label_position_not_found_ids": [
                    s.cell_id for s in result.label_spaces if s.required and s.center is None
                ],
                "paper_white_region_ids": [
                    s.cell_id for s in result.label_spaces if not s.required
                ],
                "max_parent_area_drift_mm2": result.max_parent_area_drift_mm2,
                "color_inheritance_verified": True,
                "area_validation": "analytic Green integral of exported 6-decimal cubics",
                "topology_validation": "shared sampled curves, target flatness 0.005 working units",
                "exact_continuous_curve_topology_proven": False,
                "print_ready": False,
                "limitations": [
                    "bounded search may leave large regions undivided",
                    "existing narrow regions may have no label position found",
                    "no semantic protection or guaranteed concealment",
                    "no final numbering, legend or print page",
                ],
            },
        )
        write_json(
            destination / "manifest.json",
            {
                "schema_version": 1,
                "algorithm": "shared-cubic-subdivision-v4",
                "label_orientation": "horizontal",
                "paper_white_policy": paper_white_policy(),
                "settings": asdict(settings),
                "font_name": self.font.name,
                "font_sha256": self.font.sha256,
                "source_manifest_sha256": source.source_manifest_sha256,
                "working_size": [source.width, source.height],
                "image_size_mm": [
                    source.width * source.mm_per_unit,
                    source.height * source.mm_per_unit,
                ],
                "environment": {
                    "python": platform.python_version(),
                    **{
                        name: version(name)
                        for name in ("numpy", "shapely", "Pillow", "resvg_py", "fonttools")
                    },
                },
                "artifacts_sha256": {
                    p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                    for p in sorted(destination.iterdir())
                },
            },
        )
