"""Только финальные файлы; новая папка, лимит объёма и manifest последним."""

import hashlib
import json
import shutil

import resvg_py

from mystery_coloring.domain import StageError

MAX_OUTPUT_BYTES = 100 * 1024 * 1024


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()


class FinalPageStore:
    def __init__(self, max_output_bytes=MAX_OUTPUT_BYTES):
        self.max_output_bytes = max_output_bytes

    @staticmethod
    def check_destination(destination):
        if destination.exists() or destination.is_symlink():
            raise StageError("Каталог результата уже существует; укажите новый путь.")

    def write(self, destination, page, previews):
        self.check_destination(destination)
        created = False
        total = 0
        hashes = {}

        def save(name, data):
            nonlocal total
            total += len(data)
            if total > self.max_output_bytes:
                raise StageError("Результат превышает допустимый объём хранения.")
            (destination / name).write_bytes(data)
            hashes[name] = hashlib.sha256(data).hexdigest()

        try:
            destination.mkdir(parents=True, exist_ok=False)
            created = True
            for name, svg in (("page", page.outline_svg), ("colored-page", page.colored_svg)):
                save(f"{name}.svg", svg.encode("utf-8"))
                if previews:
                    save(
                        f"{name}.png",
                        resvg_py.svg_to_bytes(
                            svg_string=svg, width=1800, dpi=96, skip_system_fonts=True
                        ),
                    )
            save("result.json", json_bytes(page.report))
            save(
                "manifest.json",
                json_bytes(
                    {
                        "schema_version": 1,
                        "algorithm": page.report["algorithm"],
                        "complete": True,
                        "artifacts_sha256": dict(hashes),
                        "artifact_bytes": total,
                        "previews": previews,
                    }
                ),
            )
        except BaseException as error:
            if created:
                shutil.rmtree(destination)
            if isinstance(error, (OSError, ValueError, RuntimeError)):
                raise StageError(f"Не удалось сохранить готовый лист: {error}") from error
            raise
