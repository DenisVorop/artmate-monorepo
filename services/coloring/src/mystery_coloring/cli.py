"""Точка сборки зависимостей и интерфейс командной строки."""

import argparse
import sys
from pathlib import Path

from mystery_coloring import __version__
from mystery_coloring.adapters.artifact_writer import FileResultWriter
from mystery_coloring.adapters.opencv_simplifier import OpenCVImageSimplifier
from mystery_coloring.adapters.pillow_reader import PillowImageReader
from mystery_coloring.application import SimplifyImage, SimplifyRequest
from mystery_coloring.domain import SimplifySettings, Smoothing, StageError


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Упрощение изображения для раскраски по номерам.")
    parser.add_argument("--version", action="version", version=__version__)
    parser.add_argument("source", type=Path, help="Исходник PNG, JPEG или WebP")
    parser.add_argument("--output", type=Path, required=True, help="Новый каталог результата")
    parser.add_argument("--colors", type=int, default=24, help="Максимум цветов, 2..256 (24)")
    parser.add_argument(
        "--smoothing",
        choices=[item.value for item in Smoothing],
        default="medium",
        help="Сила сглаживания (medium)",
    )
    parser.add_argument(
        "--max-size", type=int, default=1600, help="Максимальная сторона, px (1600)"
    )
    parser.add_argument(
        "--sample-size", type=int, default=50_000, help="Выборка для палитры (50000)"
    )
    parser.add_argument("--seed", type=int, default=42, help="Seed подбора палитры (42)")
    args = parser.parse_args(argv)
    try:
        settings = SimplifySettings(
            args.colors, Smoothing(args.smoothing), args.max_size, args.sample_size, args.seed
        )
        if args.output.exists():
            raise StageError("Каталог результата уже существует. Укажите новый --output.")
        use_case = SimplifyImage(PillowImageReader(), OpenCVImageSimplifier(), FileResultWriter())
        report = use_case.execute(SimplifyRequest(args.source, args.output, settings))
    except StageError as error:
        print(f"Ошибка: {error}", file=sys.stderr)
        return 2
    print(f"Готово: {report.width} × {report.height}, цветов: {report.colors_used}.")
    print(f"Результат: {report.destination.resolve()}")
    return 0
