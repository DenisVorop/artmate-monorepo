"""Сценарий третьего этапа; вычисления и запись подключаются через порты."""

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from mystery_coloring.geometry.domain import GeometryResult, GeometrySettings
from mystery_coloring.regions.application import RegionReader
from mystery_coloring.regions.domain import RegionInput


class GeometryProcessor(Protocol):
    def process(self, source: RegionInput, settings: GeometrySettings) -> GeometryResult: ...


class GeometryWriter(Protocol):
    def write(
        self,
        destination: Path,
        source: RegionInput,
        result: GeometryResult,
        settings: GeometrySettings,
    ) -> None: ...


@dataclass(frozen=True)
class GeometryRequest:
    source: Path
    destination: Path
    settings: GeometrySettings


class BuildGeometry:
    def __init__(
        self, reader: RegionReader, processor: GeometryProcessor, writer: GeometryWriter
    ) -> None:
        self._reader, self._processor, self._writer = reader, processor, writer

    def execute(self, request: GeometryRequest) -> GeometryResult:
        source = self._reader.read(request.source)
        result = self._processor.process(source, request.settings)
        result.validate_min_area(request.settings.min_area_mm2)
        self._writer.write(request.destination, source, result, request.settings)
        return result
