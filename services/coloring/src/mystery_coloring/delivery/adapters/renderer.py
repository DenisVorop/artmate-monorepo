"""Финальная вёрстка и проверка без диагностических растров и карт областей."""

import platform
from dataclasses import asdict
from importlib.metadata import version

from mystery_coloring.delivery.domain import ALGORITHM_VERSION, RenderedPage
from mystery_coloring.details.adapters.model_assets import model_manifest
from mystery_coloring.details.domain import DETAIL_POLICY_VERSION
from mystery_coloring.layout.adapters.numbers import ASSET_SHA256
from mystery_coloring.layout.adapters.quality import check_page
from mystery_coloring.layout.adapters.svg import page_document
from mystery_coloring.layout.domain import CSS_DPI, TEMPLATE_ID
from mystery_coloring.palette import PALETTE_ORDER_VERSION, paper_white_policy
from mystery_coloring.typography.domain import palette_symbols


class FinalPageRenderer:
    def __init__(self, font, numbers):
        self.font, self.numbers = font, numbers

    def render(self, page):
        args = (
            page.source,
            page.result,
            page.pipeline.numbering(),
            self.font,
            page.template,
            page.artwork,
            page.settings.start_page,
            self.numbers,
        )
        outline = page_document(*args)
        quality = check_page(outline, *args)
        colored = page_document(*args, filled=True)
        palette = page.source.geometry.palette
        report = {
            "schema_version": 1,
            "algorithm": ALGORITHM_VERSION,
            "detail_policy": DETAIL_POLICY_VERSION,
            "face_protection": {
                "model": model_manifest()["version"],
                "detected_faces": page.face_analysis.detected_faces,
                "protected_faces": page.face_analysis.protected_faces,
                "feature_zones": len(page.face_analysis.hints),
                "profile_regions": len(page.face_analysis.profiles),
                "selected_details": page.face_details,
            },
            "source": {
                "sha256": page.source_sha256,
                "original_size": page.original_size,
                "oriented_size": page.oriented_size,
                "working_size": [page.source.geometry.width, page.source.geometry.height],
                "profile_handling": page.profile_handling,
            },
            "settings": asdict(page.settings),
            "effective_pipeline": asdict(page.pipeline),
            "template": TEMPLATE_ID,
            "sheet": {**asdict(page.template), "css_dpi": CSS_DPI},
            "artwork": asdict(page.artwork),
            "page_numbers_sha256": ASSET_SHA256,
            "palette_order": PALETTE_ORDER_VERSION,
            "paper_white_policy": paper_white_policy(),
            "palette": [
                {"rgb": rgb, "symbol": symbol}
                for rgb, symbol in zip(palette, palette_symbols(palette), strict=True)
            ],
            "quality": quality,
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
        }
        return RenderedPage(outline, colored, report)
