"""Композиция отдельного генератора: один процесс на изображение."""

import argparse
import sys
from pathlib import Path

from mystery_coloring.delivery.application import GeneratePage, GenerateRequest
from mystery_coloring.domain import StageError
from mystery_coloring.layout.adapters.configuration import load_layout_settings


def build_generator(progress=None, *, face_locator=None):
    from mystery_coloring.adapters.opencv_simplifier import OpenCVImageSimplifier
    from mystery_coloring.adapters.pillow_reader import PillowImageReader
    from mystery_coloring.delivery.adapters.processor import InMemoryPageProcessor
    from mystery_coloring.delivery.adapters.renderer import FinalPageRenderer
    from mystery_coloring.delivery.adapters.store import FinalPageStore
    from mystery_coloring.details.adapters.local_faces import (
        FaceAwareDetailDetector,
        LocalFaceLocator,
    )
    from mystery_coloring.geometry.adapters.processor import SmoothGeometryProcessor
    from mystery_coloring.layout.adapters.numbers import ReferenceNumbers
    from mystery_coloring.numbering.adapters.processor import AutomaticNumberingProcessor
    from mystery_coloring.regions.adapters.segmenter import RasterRegionProcessor
    from mystery_coloring.subdivision.adapters.processor import CurvedSubdivisionProcessor
    from mystery_coloring.typography.adapters.font import ArialFont

    font = ArialFont()
    return GeneratePage(
        InMemoryPageProcessor(
            PillowImageReader(),
            OpenCVImageSimplifier(),
            SmoothGeometryProcessor(RasterRegionProcessor()),
            CurvedSubdivisionProcessor(font),
            AutomaticNumberingProcessor(font),
            progress,
            FaceAwareDetailDetector(face_locator or LocalFaceLocator()),
        ),
        FinalPageRenderer(font, ReferenceNumbers()),
        FinalPageStore(),
    )


def main(argv=None):
    parser = argparse.ArgumentParser(description="Готовый лист раскраски без промежуточных файлов.")
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", required=True, type=Path, help="Новый каталог результата")
    parser.add_argument("--config", type=Path, help="JSON параметров листа")
    parser.add_argument("--colors", type=int, help="Цветов при упрощении (включая белый), 2–35")
    parser.add_argument("--min-area-mm2", type=float, help="Минимальная площадь любой области, мм²")
    fonts = parser.add_mutually_exclusive_group()
    fonts.add_argument("--font-size-px", type=float, help="Размер символов, CSS px (5.16)")
    fonts.add_argument("--font-size-pt", type=float, help="Размер символов, pt (3.87)")
    parser.add_argument("--page-number", dest="start_page", type=int, help="Номер листа (1)")
    parser.add_argument("--no-preview", action="store_true", help="Не создавать два PNG-превью")
    args = parser.parse_args(argv)
    try:
        settings = load_layout_settings(
            args.config,
            {
                k: v
                for k, v in vars(args).items()
                if k not in {"source", "output", "config", "no_preview"}
            },
        )
        report = build_generator(
            lambda message: print(message, file=sys.stderr, flush=True)
        ).execute(GenerateRequest(args.source, args.output, settings, not args.no_preview))
    except (StageError, ImportError) as error:
        print(f"Ошибка: {error}", file=sys.stderr)
        return 2
    quality = report["quality"]
    print(
        f"Готово: {quality['palette_colors']} цветов, {quality['regions']} областей. "
        f"Результат: {args.output.resolve()}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
