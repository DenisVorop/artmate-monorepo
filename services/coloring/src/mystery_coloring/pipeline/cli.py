"""Единая команда и точка сборки всех зависимостей конвейера."""

import argparse
import sys
from pathlib import Path
from time import monotonic

from mystery_coloring.domain import StageError
from mystery_coloring.pipeline.adapters.configuration import load_settings
from mystery_coloring.pipeline.application import GenerateColoring, PipelineRequest


def build_pipeline(progress=None, *, numbering_writer=None, image_reader=None, font=None):
    from mystery_coloring.adapters.artifact_writer import FileResultWriter
    from mystery_coloring.adapters.opencv_simplifier import OpenCVImageSimplifier
    from mystery_coloring.adapters.pillow_reader import PillowImageReader
    from mystery_coloring.application import SimplifyImage
    from mystery_coloring.geometry.adapters.processor import SmoothGeometryProcessor
    from mystery_coloring.geometry.adapters.writer import GeometryFileWriter
    from mystery_coloring.geometry.application import BuildGeometry
    from mystery_coloring.numbering.adapters.processor import AutomaticNumberingProcessor
    from mystery_coloring.numbering.adapters.reader import SubdivisionReader
    from mystery_coloring.numbering.adapters.writer import NumberingFileWriter
    from mystery_coloring.numbering.application import NumberGeometry
    from mystery_coloring.pipeline.adapters.store import FilePipelineStore
    from mystery_coloring.regions.adapters.reader import StageOneReader
    from mystery_coloring.regions.adapters.segmenter import RasterRegionProcessor
    from mystery_coloring.subdivision.adapters.processor import CurvedSubdivisionProcessor
    from mystery_coloring.subdivision.adapters.reader import GeometryReader
    from mystery_coloring.subdivision.adapters.writer import SubdivisionFileWriter
    from mystery_coloring.subdivision.application import SubdivideGeometry
    from mystery_coloring.typography.adapters.font import ArialFont

    font = font or ArialFont()
    return GenerateColoring(
        SimplifyImage(
            image_reader or PillowImageReader(), OpenCVImageSimplifier(), FileResultWriter()
        ),
        BuildGeometry(
            StageOneReader(), SmoothGeometryProcessor(RasterRegionProcessor()), GeometryFileWriter()
        ),
        SubdivideGeometry(
            GeometryReader(), CurvedSubdivisionProcessor(font), SubdivisionFileWriter(font)
        ),
        NumberGeometry(
            SubdivisionReader(),
            AutomaticNumberingProcessor(font),
            numbering_writer or NumberingFileWriter(font),
        ),
        FilePipelineStore(),
        progress,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Раскраска из изображения: единые настройки и ArialMT."
    )
    parser.add_argument("source", type=Path, help="Исходное изображение")
    parser.add_argument("--output", type=Path, required=True, help="Новый каталог результата")
    parser.add_argument(
        "--config", type=Path, help="JSON с настройками; явные флаги имеют приоритет"
    )
    parser.add_argument("--colors", type=int, help="Число цветов, 2–35 (24)")
    parser.add_argument("--min-area-mm2", type=float, help="Минимальная площадь детали, мм² (5)")
    parser.add_argument("--font-size-pt", type=float, help="Один размер всех символов, 3–24 pt (6)")
    parser.add_argument("--image-width-mm", type=float, help="Физическая ширина рисунка, мм (180)")
    args = parser.parse_args(argv)
    started = monotonic()
    try:
        settings = load_settings(
            args.config,
            {
                key: value
                for key, value in vars(args).items()
                if key not in ("source", "output", "config")
            },
        )
        if args.output.exists():
            raise StageError("Каталог результата уже существует. Укажите новый --output.")
        try:
            pipeline = build_pipeline(lambda text: print(text, flush=True))
        except ImportError as error:
            raise StageError('Установите зависимости: pip install -e ".[numbering]"') from error
        result = pipeline.execute(PipelineRequest(args.source, args.output, settings))
    except StageError as error:
        print(f"Ошибка: {error}", file=sys.stderr)
        return 2
    print(
        f"Готово за {monotonic() - started:.1f} с: {result.colors_used} цветов, "
        f"{result.region_count} областей, {result.label_count} обозначений."
    )
    print(
        f"{result.font_name}, единый размер {settings.font_size_pt:g} pt. "
        f"Минимальная площадь: {result.min_area_mm2:.6f} мм²."
    )
    print(
        f"Слияний для размещения: {result.merges}; изменено цвета на "
        f"{result.recolored_fraction:.2%} площади после разбиения."
    )
    print(f"Результат: {args.output.resolve() / '04-numbering'}")
    return 0
