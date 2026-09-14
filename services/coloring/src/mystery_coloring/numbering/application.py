"""Сценарий номеров и порты ввода, шрифта, расчёта и записи."""

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from mystery_coloring.numbering.domain import (
    NumberingInput,
    NumberingResult,
    NumberingSettings,
)
from mystery_coloring.typography.application import VectorFont as VectorFont


class NumberingReader(Protocol):
    def read(self, source: Path) -> NumberingInput: ...


class NumberingProcessor(Protocol):
    def process(self, source: NumberingInput, settings: NumberingSettings) -> NumberingResult: ...


class NumberingWriter(Protocol):
    def write(
        self,
        destination: Path,
        source: NumberingInput,
        result: NumberingResult,
        settings: NumberingSettings,
    ) -> None: ...


@dataclass(frozen=True)
class NumberingRequest:
    source: Path
    destination: Path
    settings: NumberingSettings


class NumberGeometry:
    def __init__(
        self, reader: NumberingReader, processor: NumberingProcessor, writer: NumberingWriter
    ):
        self._reader, self._processor, self._writer = reader, processor, writer

    def execute(self, request: NumberingRequest) -> NumberingResult:
        source = self._reader.read(request.source)
        result = self._processor.process(source, request.settings)
        result.validate(source, request.settings)
        self._writer.write(request.destination, source, result, request.settings)
        return result
