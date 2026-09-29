"""Те же вычислители, передача моделей напрямую вместо промежуточных файлов."""

from dataclasses import replace

from mystery_coloring.delivery.domain import ComputedPage
from mystery_coloring.details.domain import DetailSettings, FaceAnalysis
from mystery_coloring.geometry.curves import region_rings, sample_curves
from mystery_coloring.geometry.domain import Boundary
from mystery_coloring.layout.domain import ArtMateTemplate
from mystery_coloring.numbering.domain import NumberingInput
from mystery_coloring.regions.domain import RegionInput
from mystery_coloring.subdivision.curves import separate_touching_rings
from mystery_coloring.subdivision.domain import Cell, Edge, Mesh, SubdivisionInput


def subdivision_input(source, result, settings):
    """Эквивалент GeometryReader без сериализации; точность кривых не меняется."""
    edges = tuple(Edge(b.source.id + 1, b.curves, b.source.id) for b in result.boundaries)
    boundaries = tuple(
        Boundary(b.source.id, b.source.left, b.source.right, sample_curves(b.curves, error=0.005))
        for b in result.boundaries
    )
    rings = region_rings(boundaries)
    edge_map = {edge.id: edge for edge in edges}
    cells = tuple(
        Cell(i, i, color, separate_touching_rings(rings[i], edge_map), i in result.prefilled_ids)
        for i, color in enumerate(result.color_indices)
    )
    return SubdivisionInput(
        source.width,
        source.height,
        settings.image_width_mm / source.width,
        source.palette,
        Mesh(edges, cells),
        source.source_manifest_sha256,
    )


class InMemoryPageProcessor:
    def __init__(
        self, reader, simplifier, geometry, subdivision, numbering, progress=None, details=None
    ):
        self.reader, self.simplifier, self.geometry = reader, simplifier, geometry
        self.subdivision, self.numbering = subdivision, numbering
        self.progress = progress or (lambda message: None)
        self.details = details

    def process(self, source, settings):
        self.progress("Подготовка изображения")
        prepared = self.reader.read(source, settings.pipeline(180).preparation().max_size)
        original = (
            prepared.source_sha256,
            prepared.original_size,
            prepared.oriented_size,
            prepared.profile_handling,
        )
        template = ArtMateTemplate()
        artwork = template.fit(prepared.image.width, prepared.image.height)
        effective = settings.pipeline(artwork.source_width)
        self.progress("Локальное определение черт лица и защита деталей")
        detail_map = (
            self.details.detect(
                prepared.image,
                DetailSettings(artwork.source_width / prepared.image.width, effective.min_area_mm2),
            )
            if self.details
            else None
        )
        simplified = self.simplifier.simplify(
            prepared.image, effective.preparation(), detail_map=detail_map
        )
        # Поле происхождения внутренних DTO содержит SHA исходника: manifest-файлов здесь нет.
        raster = RegionInput(
            simplified.image.width,
            simplified.image.height,
            tuple(color.rgb for color in simplified.palette),
            simplified.color_indices,
            prepared.source_sha256,
            simplified.prefilled_mask,
        )
        face_analysis = detail_map.face_analysis if detail_map else FaceAnalysis()
        face_details = detail_map.face_details if detail_map else 0
        del prepared, simplified, detail_map
        self.progress("Объединение деталей и сглаживание границ")
        geometry = self.geometry.process(raster, effective.geometry())
        geometry.validate_min_area(effective.min_area_mm2)
        vector = subdivision_input(raster, geometry, effective.geometry())
        del raster, geometry
        self.progress("Разбиение областей")
        divided = self.subdivision.process(vector, effective.subdivision())
        divided.validate(effective.subdivision())
        numbered_source = NumberingInput(replace(vector, mesh=divided.mesh), divided.label_spaces)
        del vector, divided
        self.progress("Расстановка символов")
        numbered = self.numbering.process(numbered_source, effective.numbering())
        numbered.validate(numbered_source, effective.numbering())
        return ComputedPage(
            numbered_source,
            numbered,
            settings,
            effective,
            template,
            artwork,
            *original,
            face_analysis,
            face_details,
        )
