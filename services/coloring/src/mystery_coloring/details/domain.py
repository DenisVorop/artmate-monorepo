"""Original-image evidence and optional local face landmarks; no I/O."""

from dataclasses import dataclass
from math import isfinite

from mystery_coloring.domain import StageError

DETAIL_POLICY_VERSION = "profile-color-regions-v3"


@dataclass(frozen=True)
class FeatureHint:
    kind: str
    points: tuple[tuple[float, float], ...]
    padding: float


@dataclass(frozen=True)
class ProfileRegion:
    points: tuple[tuple[float, float], ...]


@dataclass(frozen=True)
class FaceAnalysis:
    hints: tuple[FeatureHint, ...] = ()
    detected_faces: int = 0
    protected_faces: int = 0
    profiles: tuple[ProfileRegion, ...] = ()


@dataclass(frozen=True)
class DetailMap:
    # uint32 little-endian, 0 = ordinary paint; IDs start at 1.
    region_ids: bytes
    colors: tuple[tuple[int, int, int], ...]
    accents: tuple[tuple[int, int, int], ...] = ()
    face_analysis: FaceAnalysis = FaceAnalysis()
    face_details: int = 0


@dataclass(frozen=True)
class DetailSettings:
    mm_per_pixel: float
    min_area_mm2: float
    min_width_mm: float = 0.18
    max_details: int = 80
    max_coverage: float = 0.008

    def __post_init__(self):
        if (
            not isfinite(self.mm_per_pixel)
            or self.mm_per_pixel <= 0
            or not isfinite(self.min_area_mm2)
            or self.min_area_mm2 <= 0
        ):
            raise StageError("Неверный физический масштаб защиты деталей.")
        if (
            not isfinite(self.min_width_mm)
            or self.min_width_mm <= 0
            or not 1 <= self.max_details <= 256
            or not 0 < self.max_coverage <= 0.05
        ):
            raise StageError("Неверные ограничения защиты деталей.")
