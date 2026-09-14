"""SVG со схемой, легендой, цветным образцом и полным журналом автоматических слияний."""

import hashlib
import json
import platform
import shutil
from dataclasses import asdict
from importlib.metadata import version
from pathlib import Path

import resvg_py
from shapely.affinity import scale as scale_shape

from mystery_coloring.domain import StageError
from mystery_coloring.numbering.adapters.placement import TEXT_FLATNESS_MM, validate_labels
from mystery_coloring.numbering.adapters.svg import svg_document
from mystery_coloring.numbering.curves import place_glyphs
from mystery_coloring.palette import paper_white_policy
from mystery_coloring.subdivision.adapters.shapes import FLATNESS, Shapes, validate_mesh
from mystery_coloring.subdivision.curves import cell_area
from mystery_coloring.typography.domain import palette_symbols


def json_file(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )


class NumberingFileWriter:
    def __init__(self, font):
        self.font = font

    def write(self, destination: Path, source, result, settings):
        result.validate(source, settings)
        geometry = source.geometry
        shapes = Shapes()
        scale = geometry.mm_per_unit
        validate_mesh(result.mesh, geometry.width, geometry.height, shapes)
        edges = {e.id: e for e in result.mesh.edges}
        if any(
            abs(cell_area(c, edges, scale) - area) > 1e-7
            for c, area in zip(result.mesh.cells, result.areas_mm2, strict=True)
        ):
            raise StageError("Площадь не соответствует экспортируемой геометрии.")
        polygons = {
            c.id: scale_shape(shapes.polygon(c, edges), xfact=scale, yfact=scale, origin=(0, 0))
            for c in result.mesh.cells
        }
        margin = (
            settings.padding_mm
            + settings.stroke_mm / 2
            + 2 * FLATNESS * scale
            + 2 * TEXT_FLATNESS_MM
        )
        validate_labels(result.labels, polygons, settings, margin)
        if result.font_sha256 != self.font.sha256:
            raise StageError("Шрифт экспорта отличается от проверенного.")
        if any(
            label.rings_mm
            != place_glyphs(self.font.glyphs(label.text), label.center_mm, settings.font_size_pt, 0)
            for label in result.labels
        ):
            raise StageError("Контуры символа отличаются от горизонтального глифа ArialMT.")
        created = False
        try:
            destination.mkdir(parents=True, exist_ok=False)
            created = True
            self._save(destination, source, result, settings)
        except (OSError, ValueError, RuntimeError, StageError) as error:
            if created:
                shutil.rmtree(destination)
            raise StageError(f"Не удалось сохранить обозначения: {error}") from error

    def _save(self, destination, source, result, settings):
        for name, options in (
            ("numbered", {"labels": True, "legend": True}),
            ("numbered-artwork", {"labels": True}),
            ("legend", {"legend_only": True}),
            ("colored", {"filled": True, "outlines": False}),
            ("colored-outlines", {"filled": True}),
            ("outlines", {}),
            ("repairs", {"diagnostics": True, "labels": True}),
        ):
            svg = svg_document(source, result, settings, self.font, **options)
            (destination / f"{name}.svg").write_text(svg, encoding="utf-8")
            (destination / f"{name}.png").write_bytes(
                resvg_py.svg_to_bytes(svg_string=svg, width=1800, dpi=96, skip_system_fonts=True)
            )
        geometry = source.geometry
        symbols = palette_symbols(geometry.palette)
        white_ids = result.paper_white_cell_ids(source)
        json_file(
            destination / "geometry.json",
            {
                "schema_version": 4,
                "working_size": [geometry.width, geometry.height],
                "mm_per_unit": geometry.mm_per_unit,
                "area_measurement": "analytic Green integral of cubic coordinates",
                "regions": [
                    {
                        "id": cell.id,
                        "color_index": cell.color_index,
                        "symbol": symbols[cell.color_index],
                        "label_required": symbols[cell.color_index] is not None,
                        "rings": cell.rings,
                        "source_cell_ids": ids,
                        "area_mm2": area,
                    }
                    for cell, ids, area in zip(
                        result.mesh.cells, result.source_cell_ids, result.areas_mm2, strict=True
                    )
                ],
                "boundaries": [asdict(e) for e in result.mesh.edges],
            },
        )
        json_file(
            destination / "palette.json",
            {
                "paper_white_policy": paper_white_policy(),
                "colors": [
                    {
                        "index": i,
                        "symbol": symbols[i],
                        "label_required": symbols[i] is not None,
                        "rgb": rgb,
                        "hex": "#" + "".join(f"{v:02X}" for v in rgb),
                    }
                    for i, rgb in enumerate(geometry.palette)
                ],
            },
        )
        json_file(
            destination / "labels.json",
            {
                "schema_version": 1,
                "coordinates": "millimeters in artwork, x right, y down",
                "font_name": result.font_name,
                "font_sha256": result.font_sha256,
                "uniform_font_size_pt": settings.font_size_pt,
                "label_orientation": "horizontal",
                "paper_white_policy": paper_white_policy(),
                "labels": [asdict(label) for label in result.labels],
            },
        )
        json_file(
            destination / "merges.json",
            {"schema_version": 1, "merges": [asdict(m) for m in result.merges]},
        )
        json_file(
            destination / "quality.json",
            {
                "initial_regions": len(geometry.mesh.cells),
                "final_regions": len(result.mesh.cells),
                "initially_unplaced_count": len(result.initially_unplaced_ids),
                "initially_unplaced_ids": result.initially_unplaced_ids,
                "automatic_merges": len(result.merges),
                "unlabeled_regions": len(white_ids),
                "paper_white_regions": len(white_ids),
                "paper_white_region_ids": white_ids,
                "missing_required_labels": 0,
                "paper_white_policy": paper_white_policy(),
                "label_count": len(result.labels),
                "repeated_labels": sum(label.repeated for label in result.labels),
                "rotated_labels": sum(label.angle_deg != 0 for label in result.labels),
                "label_angles_deg": sorted({label.angle_deg for label in result.labels}),
                "uniform_font_size_pt": settings.font_size_pt,
                "symbol_set": "123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                "required_min_area_mm2": settings.min_area_mm2,
                "actual_min_area_mm2": min(result.areas_mm2),
                "below_min_area": 0,
                "recolored_area_mm2": result.recolored_area_mm2,
                "recolored_fraction": result.recolored_area_mm2 / sum(result.areas_mm2),
                "mean_delta_e76": result.mean_delta_e76,
                "max_delta_e76": result.max_delta_e76,
                "text_geometry_validation": "cubic ink sampled at 0.001 mm with extra margin",
                "geometry_validation": "shared edges sampled at 0.005 working units; area analytic",
                "all_symbols_inside": True,
                "symbol_collisions": 0,
                "numbering_complete": True,
                "ai_required": False,
                "print_ready": False,
                "limitations": [
                    "fixed-size text may require local recoloring by merging",
                    "bounded placement search, not a global optimum",
                    "no semantic detail protection",
                    "PDF page layout and physical print proof not performed",
                ],
            },
        )
        json_file(
            destination / "manifest.json",
            {
                "schema_version": 1,
                "algorithm": "uniform-symbol-numbering-v3",
                "label_orientation": "horizontal",
                "paper_white_policy": paper_white_policy(),
                "settings": asdict(settings),
                "font_name": result.font_name,
                "font_sha256": result.font_sha256,
                "source_manifest_sha256": geometry.source_manifest_sha256,
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
                            "fonttools",
                        )
                    },
                },
                "artifacts_sha256": {
                    p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                    for p in sorted(destination.iterdir())
                },
            },
        )
