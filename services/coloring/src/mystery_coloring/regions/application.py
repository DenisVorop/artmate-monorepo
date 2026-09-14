"""Сценарий второго этапа с независимыми портами чтения, обработки и записи."""

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from mystery_coloring.regions.domain import RegionInput, RegionResult, RegionSettings


class RegionReader(Protocol):
    def read(self, source: Path) -> RegionInput: ...


class RegionProcessor(Protocol):
    def process(self, source: RegionInput, settings: RegionSettings) -> RegionResult: ...


class RegionWriter(Protocol):
    def write(
        self, destination: Path, source: RegionInput, result: RegionResult, settings: RegionSettings
    ) -> None: ...


@dataclass(frozen=True)
class RegionRequest:
    source: Path
    destination: Path
    settings: RegionSettings


class BuildRegions:
    def __init__(
        self, reader: RegionReader, processor: RegionProcessor, writer: RegionWriter
    ) -> None:
        self._reader = reader
        self._processor = processor
        self._writer = writer

    def execute(self, request: RegionRequest) -> RegionResult:
        source = self._reader.read(request.source)
        result = self._processor.process(source, request.settings)
        self._writer.write(request.destination, source, result, request.settings)
        return result
