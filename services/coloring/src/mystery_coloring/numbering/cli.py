"""Пятый CLI: автономные символы одного размера и легенда."""

import argparse
import sys
from pathlib import Path

from mystery_coloring.domain import StageError
from mystery_coloring.numbering.application import NumberGeometry, NumberingRequest
from mystery_coloring.numbering.domain import NumberingSettings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Автоматические обозначения 1–9, A–Z одного размера и легенда цветов."
    )
    parser.add_argument("source", type=Path, help="Каталог четвёртого этапа")
    parser.add_argument("--output", type=Path, required=True, help="Новый каталог")
    parser.add_argument(
        "--font-size-pt", type=float, default=6, help="Единый размер всех обозначений (6 pt)"
    )
    parser.add_argument("--padding-mm", type=float, default=0.15)
    parser.add_argument("--stroke-mm", type=float, default=0.12)
    parser.add_argument("--min-area-mm2", type=float, default=5)
    parser.add_argument("--repeat-distance-mm", type=float, default=18)
    parser.add_argument("--max-labels-per-region", type=int, default=3)
    args = parser.parse_args(argv)
    try:
        settings = NumberingSettings(
            **{k: v for k, v in vars(args).items() if k not in ("source", "output")}
        )
        if args.output.exists():
            raise StageError("Каталог результата уже существует. Укажите новый --output.")
        try:
            from mystery_coloring.numbering.adapters.processor import AutomaticNumberingProcessor
            from mystery_coloring.numbering.adapters.reader import SubdivisionReader
            from mystery_coloring.numbering.adapters.writer import NumberingFileWriter
            from mystery_coloring.typography.adapters.font import ArialFont
        except ImportError as error:
            raise StageError('Установите зависимости: pip install -e ".[numbering]"') from error
        font = ArialFont()
        result = NumberGeometry(
            SubdivisionReader(), AutomaticNumberingProcessor(font), NumberingFileWriter(font)
        ).execute(NumberingRequest(args.source, args.output, settings))
    except StageError as error:
        print(f"Ошибка: {error}", file=sys.stderr)
        return 2
    print(f"Областей: {len(result.mesh.cells)}; обозначений: {len(result.labels)}; без подписи: 0.")
    print(f"Единый размер: {settings.font_size_pt:g} pt. Символы: 1–9, A–Z.")
    print(
        f"Автоматических объединений: {len(result.merges)}; "
        f"изменено цвета на {result.recolored_area_mm2 / sum(result.areas_mm2):.2%} площади."
    )
    print(f"Результат: {args.output.resolve()}")
    return 0
