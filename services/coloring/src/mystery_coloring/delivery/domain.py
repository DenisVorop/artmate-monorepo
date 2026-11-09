"""Контракты готового листа; без библиотек обработки и файлового ввода-вывода."""

from dataclasses import dataclass

from mystery_coloring.details.domain import FaceAnalysis
from mystery_coloring.layout.domain import ArtMateTemplate, ArtworkPlacement, LayoutSettings
from mystery_coloring.numbering.domain import NumberingInput, NumberingResult
from mystery_coloring.pipeline.domain import PipelineSettings

ALGORITHM_VERSION = "coloring-delivery-v21-denser-paint-cells"


@dataclass(frozen=True)
class ComputedPage:
    source: NumberingInput
    result: NumberingResult
    settings: LayoutSettings
    pipeline: PipelineSettings
    template: ArtMateTemplate
    artwork: ArtworkPlacement
    source_sha256: str
    original_size: tuple[int, int]
    oriented_size: tuple[int, int]
    profile_handling: str
    face_analysis: FaceAnalysis = FaceAnalysis()
    face_details: int = 0


@dataclass(frozen=True)
class RenderedPage:
    outline_svg: str
    colored_svg: str
    report: dict
