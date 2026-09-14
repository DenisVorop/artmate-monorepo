"""Команда второго этапа; исходник — каталог первого этапа."""

import argparse
import sys
from pathlib import Path

from mystery_coloring.domain import StageError
from mystery_coloring.regions.adapters.reader import StageOneReader
from mystery_coloring.regions.adapters.segmenter import RasterRegionProcessor
from mystery_coloring.regions.adapters.writer import RegionFileWriter
from mystery_coloring.regions.application import BuildRegions, RegionRequest
from mystery_coloring.regions.domain import RegionSettings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Построение областей и объединение мелких пятен.")
    parser.add_argument("source", type=Path, help="Каталог результата первого этапа")
    parser.add_argument("--output", type=Path, required=True, help="Новый каталог результата")
    parser.add_argument(
        "--image-width-mm",
        type=float,
        default=180.0,
        help="Ширина самого рисунка при печати, мм (180)",
    )
    parser.add_argument(
        "--min-area-mm2",
        type=float,
        default=1.0,
        help="Объединять области меньше этой площади, мм²; 0 отключает (1)",
    )
    parser.add_argument(
        "--max-color-distance",
        type=float,
        default=18.0,
        help="Максимальное изменение цвета от этапа 1, Delta E76 (18)",
    )
    args = parser.parse_args(argv)
    try:
        settings = RegionSettings(args.image_width_mm, args.min_area_mm2, args.max_color_distance)
        if args.output.exists():
            raise StageError("Каталог результата уже существует. Укажите новый --output.")
        use_case = BuildRegions(StageOneReader(), RasterRegionProcessor(), RegionFileWriter())
        result = use_case.execute(RegionRequest(args.source, args.output, settings))
    except StageError as error:
        print(f"Ошибка: {error}", file=sys.stderr)
        return 2
    remaining = sum(region.below_min_area for region in result.regions)
    print(f"Областей: {result.initial_count} → {len(result.regions)}.")
    print(f"Мелких областей требуют проверки: {remaining}.")
    print(f"Изменено пикселей: {result.changed_pixels / (result.width * result.height):.2%}.")
    print(f"Результат: {args.output.resolve()}")
    return 0
