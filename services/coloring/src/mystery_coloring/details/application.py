"""Ports for local landmark inference, independent of the runtime library."""

from typing import Protocol

from mystery_coloring.details.domain import FaceAnalysis
from mystery_coloring.domain import RGBImage


class FaceLocator(Protocol):
    def locate(self, image: RGBImage) -> FaceAnalysis: ...
