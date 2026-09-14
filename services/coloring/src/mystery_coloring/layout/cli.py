"""Точка сборки подготовки страниц; API сценария доступен будущему веб-интерфейсу."""

import argparse
import sys
from functools import partial
from pathlib import Path

from mystery_coloring.domain import StageError
from mystery_coloring.layout.adapters.configuration import load_layout_settings
from mystery_coloring.layout.application import PreparePagesRequest
from mystery_coloring.layout.domain import ArtMateTemplate


def build_layout(progress=None):
    from mystery_coloring.adapters.pillow_reader import PillowImageReader
    from mystery_coloring.layout.adapters.generator import PipelinePageGenerator
    from mystery_coloring.layout.adapters.numbers import ReferenceNumbers
    from mystery_coloring.layout.adapters.writer import FileBookStore
    from mystery_coloring.layout.application import PreparePages
    from mystery_coloring.pipeline.cli import build_pipeline
    from mystery_coloring.typography.adapters.font import ArialFont

    font = ArialFont()
    return PreparePages(
        PipelinePageGenerator(
            PillowImageReader(),
            partial(build_pipeline, font=font),
            font,
            ReferenceNumbers(),
            progress,
        ),
        FileBookStore(),
        progress,
    )


def main(argv=None):
    parser = argparse.ArgumentParser(description="Подготовить листы по шаблону ArtMate (без PDF).")
    parser.add_argument("sources", nargs="+", type=Path, help="Изображения в порядке страниц")
    parser.add_argument("--output", type=Path, required=True, help="Новый каталог подготовки")
    parser.add_argument("--config", type=Path, help="JSON независимых параметров вёрстки")
    parser.add_argument("--colors", type=int, help="Число цветов, 2–35 (24)")
    parser.add_argument("--min-area-mm2", type=float, help="Минимальная площадь на листе, мм² (5)")
    fonts = parser.add_mutually_exclusive_group()
    fonts.add_argument("--font-size-pt", type=float, help="Размер всех символов в pt (3.87)")
    fonts.add_argument("--font-size-px", type=float, help="Размер в CSS px (5.16), 1 px = 0.75 pt")
    parser.add_argument("--start-page", type=int, help="Первый номер страницы (1)")
    args = parser.parse_args(argv)
    try:
        settings = load_layout_settings(
            args.config,
            {k: v for k, v in vars(args).items() if k not in {"sources", "output", "config"}},
        )
        pages = build_layout(lambda message: print(message, flush=True)).execute(
            PreparePagesRequest(tuple(args.sources), args.output, settings)
        )
    except (StageError, ImportError) as error:
        print(f"Ошибка: {error}", file=sys.stderr)
        return 2
    template = ArtMateTemplate()
    print(
        f"Подготовлено страниц: {len(pages)}. "
        f"Макет {template.width_px:g} × {template.height_px:g} px, "
        f"ArialMT {settings.font_size_pt:g} pt."
    )
    print(f"Превью и проверка: {args.output.resolve() / 'pages.json'}")
    return 0
