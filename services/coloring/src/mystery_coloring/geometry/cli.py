"""Третий этап: строгая площадь и сглаженные общие границы."""

import argparse
import sys
from pathlib import Path

from mystery_coloring.domain import StageError
from mystery_coloring.geometry.application import BuildGeometry, GeometryRequest
from mystery_coloring.geometry.domain import GeometrySettings
from mystery_coloring.regions.adapters.reader import StageOneReader
from mystery_coloring.regions.adapters.segmenter import RasterRegionProcessor


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="SVG с плавными границами и обязательной площадью."
    )
    parser.add_argument("source", type=Path, help="Каталог результата первого этапа")
    parser.add_argument("--output", type=Path, required=True, help="Новый каталог результата")
    parser.add_argument("--image-width-mm", type=float, default=180)
    parser.add_argument(
        "--min-area-mm2", type=float, default=5, help="Обязательная площадь каждой области, мм² (5)"
    )
    parser.add_argument(
        "--smoothing-mm",
        type=float,
        default=0.6,
        help="Максимальное отклонение дискретизированной границы, мм (0.6)",
    )
    parser.add_argument("--stroke-mm", type=float, default=0.12)
    args = parser.parse_args(argv)
    try:
        settings = GeometrySettings(
            args.image_width_mm, args.min_area_mm2, args.smoothing_mm, args.stroke_mm
        )
        if args.output.exists():
            raise StageError("Каталог результата уже существует. Укажите новый --output.")
        try:
            from mystery_coloring.geometry.adapters.processor import SmoothGeometryProcessor
            from mystery_coloring.geometry.adapters.writer import GeometryFileWriter
        except ImportError as error:
            raise StageError(
                'Установите зависимости геометрии: pip install -e ".[geometry]"'
            ) from error
        use_case = BuildGeometry(
            StageOneReader(), SmoothGeometryProcessor(RasterRegionProcessor()), GeometryFileWriter()
        )
        result = use_case.execute(GeometryRequest(args.source, args.output, settings))
    except StageError as error:
        print(f"Ошибка: {error}", file=sys.stderr)
        return 2
    print(f"Областей: {result.initial_count} → {len(result.areas_mm2)}.")
    print(f"Минимальная площадь SVG: {min(result.areas_mm2):.6f} мм²; ниже порога: 0.")
    print(f"Результат: {args.output.resolve()}")
    return 0
