"""Новый каталог полного запуска, контрольные суммы и manifest последним."""

import hashlib
import json
import shutil
from dataclasses import asdict
from pathlib import Path

from mystery_coloring.domain import StageError


def write_json(path, value):
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )


class FilePipelineStore:
    def begin(self, destination: Path, settings):
        created = False
        try:
            destination.mkdir(parents=True, exist_ok=False)
            created = True
            write_json(destination / "settings.json", asdict(settings))
        except OSError as error:
            if created:
                self.abort(destination)
            raise StageError(f"Не удалось создать новый каталог запуска: {error}") from error

    def complete(self, destination, settings, result):
        try:
            write_json(
                destination / "manifest.json",
                {
                    "schema_version": 1,
                    "algorithm": "configured-coloring-pipeline-v1",
                    "settings": asdict(settings),
                    "font_asset": "/fonts/Arial/arialmt.ttf",
                    "result": asdict(result),
                    "final_artifacts": {
                        "numbered": "04-numbering/numbered.svg",
                        "colored_outlines": "04-numbering/colored-outlines.svg",
                        "outlines": "04-numbering/outlines.svg",
                    },
                    "artifacts_sha256": {
                        p.relative_to(destination).as_posix(): hashlib.sha256(
                            p.read_bytes()
                        ).hexdigest()
                        for p in sorted(destination.rglob("*"))
                        if p.is_file()
                    },
                },
            )
        except OSError as error:
            raise StageError(f"Не удалось завершить запись запуска: {error}") from error

    def abort(self, destination):
        shutil.rmtree(destination)
