"""Один запрос — один результат; адаптеры подключаются в composition root."""

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from mystery_coloring.delivery.domain import ComputedPage, RenderedPage
from mystery_coloring.layout.domain import LayoutSettings


class PageProcessor(Protocol):
    def process(self, source: Path, settings: LayoutSettings) -> ComputedPage: ...


class PageRenderer(Protocol):
    def render(self, page: ComputedPage) -> RenderedPage: ...


class PageStore(Protocol):
    def check_destination(self, destination: Path) -> None: ...

    def write(self, destination: Path, page: RenderedPage, previews: bool) -> None: ...


@dataclass(frozen=True)
class GenerateRequest:
    source: Path
    destination: Path
    settings: LayoutSettings = LayoutSettings()
    previews: bool = True


class GeneratePage:
    def __init__(self, processor: PageProcessor, renderer: PageRenderer, store: PageStore):
        self.processor, self.renderer, self.store = processor, renderer, store

    def execute(self, request: GenerateRequest) -> dict:
        self.store.check_destination(request.destination)
        computed = self.processor.process(request.source, request.settings)
        rendered = self.renderer.render(computed)
        del computed
        self.store.write(request.destination, rendered, request.previews)
        return rendered.report
