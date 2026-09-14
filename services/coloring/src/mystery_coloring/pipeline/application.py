"""Сценарий полного запуска через существующие сценарии и порт хранения."""

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from mystery_coloring.application import SimplifyImage, SimplifyRequest
from mystery_coloring.geometry.application import BuildGeometry, GeometryRequest
from mystery_coloring.numbering.application import NumberGeometry, NumberingRequest
from mystery_coloring.pipeline.domain import PipelineResult, PipelineSettings
from mystery_coloring.subdivision.application import SubdivideGeometry, SubdivisionRequest


class PipelineStore(Protocol):
    def begin(self, destination: Path, settings: PipelineSettings) -> None: ...

    def complete(
        self, destination: Path, settings: PipelineSettings, result: PipelineResult
    ) -> None: ...

    def abort(self, destination: Path) -> None: ...


@dataclass(frozen=True)
class PipelineRequest:
    source: Path
    destination: Path
    settings: PipelineSettings


class GenerateColoring:
    def __init__(
        self,
        preparation: SimplifyImage,
        geometry: BuildGeometry,
        subdivision: SubdivideGeometry,
        numbering: NumberGeometry,
        store: PipelineStore,
        progress: Callable[[str], None] | None = None,
    ):
        self.preparation, self.geometry = preparation, geometry
        self.subdivision, self.numbering = subdivision, numbering
        self.store, self.progress = store, progress

    def execute(self, request: PipelineRequest) -> PipelineResult:
        target, settings = request.destination, request.settings
        steps = (
            (
                "Подготовка и палитра",
                self.preparation,
                SimplifyRequest(request.source, target / "01-preparation", settings.preparation()),
            ),
            (
                "Сглаженные области",
                self.geometry,
                GeometryRequest(
                    target / "01-preparation", target / "02-geometry", settings.geometry()
                ),
            ),
            (
                "Разбиение",
                self.subdivision,
                SubdivisionRequest(
                    target / "02-geometry", target / "03-subdivision", settings.subdivision()
                ),
            ),
            (
                "Символы Arial и легенда",
                self.numbering,
                NumberingRequest(
                    target / "03-subdivision", target / "04-numbering", settings.numbering()
                ),
            ),
        )
        self.store.begin(target, settings)
        try:
            for index, (name, stage, stage_request) in enumerate(steps, 1):
                if self.progress:
                    self.progress(f"{index}/4 · {name}")
                outcome = stage.execute(stage_request)
                if index == 1:
                    colors_used = outcome.colors_used
            result = PipelineResult(
                colors_used=colors_used,
                region_count=len(outcome.mesh.cells),
                label_count=len(outcome.labels),
                min_area_mm2=min(outcome.areas_mm2),
                font_name=outcome.font_name,
                font_sha256=outcome.font_sha256,
                merges=len(outcome.merges),
                recolored_fraction=outcome.recolored_area_mm2 / sum(outcome.areas_mm2),
            )
            self.store.complete(target, settings, result)
            return result
        except (Exception, KeyboardInterrupt):
            self.store.abort(target)
            raise
