"""Сценарий подготовки набора страниц, независимый от CLI, веба и файлов."""

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from mystery_coloring.domain import StageError
from mystery_coloring.layout.domain import (
    ArtMateTemplate,
    LayoutSettings,
    PageSummary,
    validate_page_number,
)


class PageGenerator(Protocol):
    def generate(
        self,
        source: Path,
        destination: Path,
        settings: LayoutSettings,
        template: ArtMateTemplate,
        number: int,
    ) -> PageSummary: ...


class BookStore(Protocol):
    def begin(self, destination: Path, settings: LayoutSettings, template: ArtMateTemplate): ...

    def complete(self, destination: Path, pages: tuple[PageSummary, ...]): ...

    def abort(self, destination: Path): ...


@dataclass(frozen=True)
class PreparePagesRequest:
    sources: tuple[Path, ...]
    destination: Path
    settings: LayoutSettings = LayoutSettings()


class PreparePages:
    def __init__(
        self,
        generator: PageGenerator,
        store: BookStore,
        progress: Callable[[str], None] | None = None,
    ):
        self.generator, self.store, self.progress = generator, store, progress

    def execute(self, request: PreparePagesRequest) -> tuple[PageSummary, ...]:
        if not request.sources:
            raise StageError("Выберите хотя бы одно изображение.")
        validate_page_number(request.settings.start_page + len(request.sources) - 1)
        template = ArtMateTemplate()
        self.store.begin(request.destination, request.settings, template)
        try:
            pages = []
            for index, source in enumerate(request.sources):
                number = request.settings.start_page + index
                if self.progress:
                    self.progress(f"Страница {number} · {source.name}")
                pages.append(
                    self.generator.generate(
                        source,
                        request.destination / f"page-{number:03d}",
                        request.settings,
                        template,
                        number,
                    )
                )
            result = tuple(pages)
            self.store.complete(request.destination, result)
            return result
        except (Exception, KeyboardInterrupt):
            self.store.abort(request.destination)
            raise
