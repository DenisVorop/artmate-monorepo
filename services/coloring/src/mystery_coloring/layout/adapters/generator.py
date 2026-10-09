"""Существующий конвейер рассчитывает изображение сразу в конечном размере листа."""

from mystery_coloring.domain import StageError
from mystery_coloring.layout.adapters.writer import LayoutNumberingWriter
from mystery_coloring.layout.domain import PageSummary
from mystery_coloring.pipeline.application import PipelineRequest


class PreparedReader:
    def __init__(self, source, prepared):
        self.source, self.prepared = source, prepared

    def read(self, source, max_size):
        if (
            source != self.source
            or max(self.prepared.image.width, self.prepared.image.height) > max_size
        ):
            raise StageError("Параметры подготовленного изображения изменились.")
        return self.prepared


class PipelinePageGenerator:
    def __init__(self, reader, pipeline_factory, font, numbers, progress=None):
        self.reader, self.factory = reader, pipeline_factory
        self.font, self.numbers, self.progress = font, numbers, progress

    def generate(self, source, destination, settings, template, number):
        prepared = self.reader.read(source, settings.pipeline(180).preparation().max_size)
        artwork = template.fit(prepared.image.width, prepared.image.height)
        effective = settings.pipeline(artwork.source_width)
        writer = LayoutNumberingWriter(self.font, self.numbers, template, artwork, number)
        pipeline = self.factory(
            progress=self.progress,
            numbering_writer=writer,
            image_reader=PreparedReader(source, prepared),
        )
        outcome = pipeline.execute(PipelineRequest(source, destination, effective))
        return PageSummary(number, str(source.resolve()), destination.name, artwork, outcome)
