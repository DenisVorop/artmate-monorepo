"""Pinned, bundled model files; runtime never downloads weights."""

import hashlib
import json
from pathlib import Path

from mystery_coloring.domain import StageError


def model_manifest():
    return json.loads((Path(__file__).parents[1] / "assets/face-models.json").read_text())


def model_paths():
    folder = Path(__file__).parents[1] / "models"
    result = {}
    for row in model_manifest()["models"]:
        path = folder / row["filename"]
        if not path.is_file() or path.stat().st_size != row["bytes"]:
            raise StageError(
                "Локальные модели не установлены. Запустите scripts/prepare_models.py."
            )
        with path.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        if digest != row["sha256"]:
            raise StageError("Контрольная сумма локальной модели не совпадает.")
        result[row["name"]] = path
    return result
