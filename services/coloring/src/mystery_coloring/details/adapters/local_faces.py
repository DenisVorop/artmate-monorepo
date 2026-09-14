"""Run local inference before vectorization and reclaim the model process RAM."""

import json
import os
import struct
import subprocess
import sys
from pathlib import Path

from mystery_coloring.details.adapters.detector import ContrastDetailDetector
from mystery_coloring.details.adapters.faces import analyze_faces
from mystery_coloring.details.application import FaceLocator
from mystery_coloring.domain import StageError


class LocalFaceLocator:
    def locate(self, image):
        environment = {
            key: value
            for key, value in os.environ.items()
            if key
            in {
                "PATH",
                "PYTHONPATH",
                "VIRTUAL_ENV",
                "LANG",
                "LC_ALL",
                "SYSTEMROOT",
                "DYLD_LIBRARY_PATH",
                "LD_LIBRARY_PATH",
            }
        }
        environment["PYTHONPATH"] = (
            str(Path(__file__).parents[3]) + os.pathsep + environment.get("PYTHONPATH", "")
        )
        environment.update(
            PYTHONDONTWRITEBYTECODE="1",
            OMP_NUM_THREADS="2",
            OPENBLAS_NUM_THREADS="1",
            HF_HUB_OFFLINE="1",
        )
        try:
            result = subprocess.run(
                [sys.executable, "-m", "mystery_coloring.details.infer", str(os.getpid())],
                input=struct.pack("<II", image.width, image.height) + image.pixels,
                capture_output=True,
                env=environment,
                timeout=45,
                check=True,
            )
            return analyze_faces(json.loads(result.stdout), image.width, image.height)
        except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
            raise StageError(
                "Не удалось выполнить локальное определение черт лица. "
                "Проверьте установку моделей или повторите обработку."
            ) from error


class FaceAwareDetailDetector:
    def __init__(self, locator: FaceLocator):
        self.locator = locator
        self.contrast = ContrastDetailDetector()

    def detect(self, image, settings):
        analysis = self.locator.locate(image)
        return self.contrast.detect(image, settings, analysis)
