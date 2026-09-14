"""Сценарий обработки и порты; конкретные реализации подключаются снаружи."""

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from mystery_coloring.domain import PreparedImage, RGBImage, SimplifiedImage, SimplifySettings


class ImageReader(Protocol):
    def read(self, source: Path, max_size: int) -> PreparedImage: ...


class ImageSimplifier(Protocol):
    def simplify(self, image: RGBImage, settings: SimplifySettings) -> SimplifiedImage: ...


class ResultWriter(Protocol):
    def write(
        self,
        destination: Path,
        prepared: PreparedImage,
        result: SimplifiedImage,
        settings: SimplifySettings,
    ) -> None: ...


@dataclass(frozen=True)
class SimplifyRequest:
    source: Path
    destination: Path
    settings: SimplifySettings


@dataclass(frozen=True)
class SimplifyReport:
    destination: Path
    width: int
    height: int
    colors_used: int


class SimplifyImage:
    def __init__(
        self, reader: ImageReader, simplifier: ImageSimplifier, writer: ResultWriter
    ) -> None:
        self._reader = reader
        self._simplifier = simplifier
        self._writer = writer

    def execute(self, request: SimplifyRequest) -> SimplifyReport:
        prepared = self._reader.read(request.source, request.settings.max_size)
        result = self._simplifier.simplify(prepared.image, request.settings)
        self._writer.write(request.destination, prepared, result, request.settings)
        return SimplifyReport(
            request.destination, result.image.width, result.image.height, len(result.palette)
        )
