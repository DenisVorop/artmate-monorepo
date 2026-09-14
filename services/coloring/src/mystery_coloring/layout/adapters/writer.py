"""Локальные артефакты подготовки; публикация и PDF остаются будущему веб-экспорту."""

import hashlib
import json
import shutil
from dataclasses import asdict
from pathlib import Path

import resvg_py

from mystery_coloring.domain import StageError
from mystery_coloring.layout.adapters.numbers import ASSET_SHA256
from mystery_coloring.layout.adapters.quality import check_page
from mystery_coloring.layout.adapters.svg import page_document
from mystery_coloring.layout.domain import CSS_DPI, TEMPLATE_ID
from mystery_coloring.numbering.adapters.writer import NumberingFileWriter
from mystery_coloring.pipeline.adapters.store import write_json
from mystery_coloring.typography.domain import numbered_colors


def hashes(directory):
    return {
        p.relative_to(directory).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(directory.rglob("*"))
        if p.is_file() and p != directory / "manifest.json"
    }


def sheet_metadata(template):
    return {
        **asdict(template),
        "width_mm": template.width_mm,
        "height_mm": template.height_mm,
        "css_dpi": CSS_DPI,
    }


class LayoutNumberingWriter:
    def __init__(self, font, numbers, template, artwork, number):
        self.font, self.numbers, self.template = font, numbers, template
        self.artwork, self.number = artwork, number

    def write(self, destination, source, result, settings):
        NumberingFileWriter(self.font).write(destination, source, result, settings)
        try:
            manifest = json.loads((destination / "manifest.json").read_text())
            (destination / "manifest.json").unlink()
            args = (
                source,
                result,
                settings,
                self.font,
                self.template,
                self.artwork,
                self.number,
                self.numbers,
            )
            page = page_document(*args)
            quality = check_page(page, *args)
            colored = page_document(*args, filled=True)
            for name, svg in (("page", page), ("colored-page", colored)):
                (destination / f"{name}.svg").write_text(svg, encoding="utf-8")
                (destination / f"{name}.png").write_bytes(
                    resvg_py.svg_to_bytes(
                        svg_string=svg,
                        width=1800,
                        dpi=96,
                        skip_system_fonts=True,
                    )
                )
            write_json(destination / "page-quality.json", quality)
            write_json(
                destination / "page-layout.json",
                {
                    "schema_version": 1,
                    "template": TEMPLATE_ID,
                    "page_number": self.number,
                    "sheet": sheet_metadata(self.template),
                    "artwork": asdict(self.artwork),
                    "palette": asdict(
                        self.template.palette(
                            len(numbered_colors(source.geometry.palette)), self.number
                        )
                    ),
                    "page_numbers_sha256": ASSET_SHA256,
                    "physical_mapping": ("User-confirmed pixels; 1 CSS px = 25.4 / 96 mm"),
                    "font_asset": "/fonts/Arial/arialmt.ttf",
                    "geometry_scale_after_layout": 1,
                },
            )
            manifest["page_layout"] = {"number": self.number, "template": TEMPLATE_ID}
            manifest["artifacts_sha256"] = hashes(destination)
            write_json(destination / "manifest.json", manifest)
        except (OSError, ValueError, RuntimeError) as error:
            raise StageError(f"Не удалось подготовить печатный лист: {error}") from error


class FileBookStore:
    def begin(self, destination: Path, settings, template):
        created = False
        try:
            destination.mkdir(parents=True, exist_ok=False)
            created = True
            write_json(
                destination / "settings.json",
                {
                    "processing": asdict(settings),
                    "template": TEMPLATE_ID,
                    "sheet": sheet_metadata(template),
                },
            )
        except OSError as error:
            if created:
                self.abort(destination)
            raise StageError(f"Не удалось создать новый каталог страниц: {error}") from error

    def complete(self, destination, pages):
        try:
            items = []
            for page in pages:
                base = f"{page.directory}/04-numbering"
                items.append(
                    {
                        **asdict(page),
                        "numbered_preview": f"{base}/page.svg",
                        "colored_preview": f"{base}/colored-page.svg",
                        "layout": f"{base}/page-layout.json",
                        "quality": f"{base}/page-quality.json",
                    }
                )
            write_json(destination / "pages.json", {"schema_version": 1, "pages": items})
            write_json(
                destination / "manifest.json",
                {
                    "schema_version": 1,
                    "algorithm": "artmate-page-layout-v3",
                    "pages": len(pages),
                    "artifacts_sha256": hashes(destination),
                    "page_index": "pages.json",
                },
            )
        except (OSError, ValueError) as error:
            raise StageError(f"Не удалось завершить подготовку страниц: {error}") from error

    def abort(self, destination):
        shutil.rmtree(destination)
