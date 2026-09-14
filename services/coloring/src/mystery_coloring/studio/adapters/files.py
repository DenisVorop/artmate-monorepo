"""Private project directories; uploads once, manifest validation and streamed ZIP."""

import hashlib
import json
import shutil
import warnings

from PIL import Image, UnidentifiedImageError

from mystery_coloring.studio.domain import ARTIFACTS, StudioError


class StudioFiles:
    def __init__(self, root, limits):
        self.root, self.limits = root / "projects", limits
        self.root.mkdir(parents=True, exist_ok=True)

    def directory(self, project_id):
        if len(project_id) != 32 or any(c not in "0123456789abcdef" for c in project_id):
            raise StudioError("Проект не найден.", 404)
        return self.root / project_id

    def source(self, project_id):
        return self.directory(project_id) / "source"

    def output(self, project_id, job_id):
        if len(job_id) != 32 or any(c not in "0123456789abcdef" for c in job_id):
            raise StudioError("Результат не найден.", 404)
        return self.directory(project_id) / "jobs" / job_id

    def ingest(self, project_id, stream):
        directory = self.directory(project_id)
        directory.mkdir(exist_ok=False)
        total, digest = 0, hashlib.sha256()
        with self.source(project_id).open("xb") as target:
            while chunk := stream.read(64 * 1024):
                total += len(chunk)
                if total > self.limits.upload_bytes:
                    raise StudioError("Изображение превышает 25 МиБ.", 413)
                target.write(chunk)
                digest.update(chunk)
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(self.source(project_id)) as image:
                    if (
                        image.format not in {"PNG", "JPEG", "WEBP"}
                        or getattr(image, "n_frames", 1) != 1
                    ):
                        raise StudioError("Выберите PNG, JPEG или WebP без анимации.")
                    if image.width * image.height > 40_000_000:
                        raise StudioError("Изображение превышает 40 млн пикселей.")
                    width, height, media = image.width, image.height, Image.MIME[image.format]
                    image.verify()
        except (
            OSError,
            ValueError,
            UnidentifiedImageError,
            Image.DecompressionBombWarning,
            Image.DecompressionBombError,
        ) as error:
            raise StudioError("Не удалось прочитать изображение.") from error
        return {
            "bytes": total,
            "sha256": digest.hexdigest(),
            "width": width,
            "height": height,
            "media_type": media,
        }

    def verify_result(self, project_id, job_id):
        directory = self.output(project_id, job_id)
        names = {p.name for p in directory.iterdir()}
        if names != set(ARTIFACTS) or any(
            not p.is_file() or p.is_symlink() for p in directory.iterdir()
        ):
            raise StudioError("Неполный результат обработки.")
        size = sum((directory / n).stat().st_size for n in ARTIFACTS)
        if size > self.limits.result_bytes:
            raise StudioError("Результат превышает лимит хранения.")
        manifest = json.loads((directory / "manifest.json").read_text())
        if manifest.get("complete") is not True or set(manifest["artifacts_sha256"]) != set(
            ARTIFACTS
        ) - {"manifest.json"}:
            raise StudioError("Некорректный manifest.")
        for name, digest in manifest["artifacts_sha256"].items():
            if hashlib.sha256((directory / name).read_bytes()).hexdigest() != digest:
                raise StudioError("Результат повреждён.")
        report = json.loads((directory / "result.json").read_text())
        if report["quality"]["passed"] is not True:
            raise StudioError("Проверка качества не пройдена.")
        return size, report

    def remove_page(self, project_id):
        directory = self.directory(project_id)
        try:
            shutil.rmtree(directory)
        except FileNotFoundError:
            # API deletion and the recovery collector may finish the same tombstone.
            pass

    def remove_job(self, project_id, job_id):
        directory = self.output(project_id, job_id)
        try:
            shutil.rmtree(directory)
        except FileNotFoundError:
            # API deletion and the recovery collector may finish the same tombstone.
            pass

    def artifact(self, project_id, job_id, name):
        if name not in ARTIFACTS:
            raise StudioError("Файл не найден.", 404)
        path = self.output(project_id, job_id) / name
        if not path.is_file() or path.is_symlink():
            raise StudioError("Файл уже удалён.", 410)
        return path
