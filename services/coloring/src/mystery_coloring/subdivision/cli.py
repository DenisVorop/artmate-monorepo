"""Четвёртый CLI: сборка портов векторного разбиения."""

import argparse
import sys
from pathlib import Path

from mystery_coloring.domain import StageError
from mystery_coloring.subdivision.application import SubdivideGeometry, SubdivisionRequest
from mystery_coloring.subdivision.domain import SubdivisionSettings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Плавное разбиение крупных векторных областей.")
    parser.add_argument(
        "source", type=Path, help="Каталог третьего этапа с geometry.json и manifest.json"
    )
    parser.add_argument("--output", type=Path, required=True, help="Новый каталог результата")
    parser.add_argument(
        "--target-area-mm2",
        type=float,
        default=60,
        help="Целевая площадь части; делим выше 1.5× значения (60)",
    )
    parser.add_argument("--min-area-mm2", type=float, default=5)
    parser.add_argument("--curve-bend-mm", type=float, default=1.2)
    parser.add_argument("--label-font-size-pt", type=float, default=6)
    parser.add_argument("--label-padding-mm", type=float, default=0.2)
    parser.add_argument("--stroke-mm", type=float, default=0.12)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--max-regions", type=int, default=5000)
    args = parser.parse_args(argv)
    try:
        settings = SubdivisionSettings(
            **{key: value for key, value in vars(args).items() if key not in ("source", "output")}
        )
        if args.output.exists():
            raise StageError("Каталог результата уже существует. Укажите новый --output.")
        try:
            from mystery_coloring.subdivision.adapters.processor import CurvedSubdivisionProcessor
            from mystery_coloring.subdivision.adapters.reader import GeometryReader
            from mystery_coloring.subdivision.adapters.writer import SubdivisionFileWriter
            from mystery_coloring.typography.adapters.font import ArialFont
        except ImportError as error:
            raise StageError(
                'Установите зависимости геометрии: pip install -e ".[numbering]"'
            ) from error
        font = ArialFont()
        result = SubdivideGeometry(
            GeometryReader(), CurvedSubdivisionProcessor(font), SubdivisionFileWriter(font)
        ).execute(SubdivisionRequest(args.source, args.output, settings))
    except StageError as error:
        print(f"Ошибка: {error}", file=sys.stderr)
        return 2
    print(f"Областей: {len(result.mesh.cells)}; добавлено разделений: {result.split_count}.")
    print(f"Минимальная площадь: {min(result.areas_mm2):.6f} мм²; ниже порога: 0.")
    print(f"Крупных областей осталось: {len(result.unresolved_large_ids)}.")
    print(f"Не найдено место под номер: {sum(s.center is None for s in result.label_spaces)}.")
    print(f"Результат: {args.output.resolve()}")
    return 0
