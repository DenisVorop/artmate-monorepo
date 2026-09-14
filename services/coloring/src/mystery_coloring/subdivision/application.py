"""Сценарий четвёртого CLI и порты чтения, геометрии и записи."""

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from mystery_coloring.subdivision.domain import (
    SubdivisionInput,
    SubdivisionResult,
    SubdivisionSettings,
)


class SubdivisionReader(Protocol):
    def read(self, source: Path) -> SubdivisionInput: ...


class SubdivisionProcessor(Protocol):
    def process(
        self, source: SubdivisionInput, settings: SubdivisionSettings
    ) -> SubdivisionResult: ...


class SubdivisionWriter(Protocol):
    def write(
        self,
        destination: Path,
        source: SubdivisionInput,
        result: SubdivisionResult,
        settings: SubdivisionSettings,
    ) -> None: ...


@dataclass(frozen=True)
class SubdivisionRequest:
    source: Path
    destination: Path
    settings: SubdivisionSettings


class SubdivideGeometry:
    def __init__(
        self, reader: SubdivisionReader, processor: SubdivisionProcessor, writer: SubdivisionWriter
    ) -> None:
        self._reader, self._processor, self._writer = reader, processor, writer

    def execute(self, request: SubdivisionRequest) -> SubdivisionResult:
        source = self._reader.read(request.source)
        result = self._processor.process(source, request.settings)
        result.validate(request.settings)
        self._writer.write(request.destination, source, result, request.settings)
        return result
