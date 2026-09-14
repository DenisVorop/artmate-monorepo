"""Загрузка проверенного набора файлов первого этапа."""

import hashlib
import io
import json
from pathlib import Path

from PIL import Image

from mystery_coloring.domain import StageError
from mystery_coloring.regions.domain import RegionInput


class StageOneReader:
    def read(self, source: Path) -> RegionInput:
        try:
            manifest_bytes = (source / "manifest.json").read_bytes()
            manifest = json.loads(manifest_bytes)
            if manifest["schema_version"] != 1 or manifest["algorithm"] != (
                "bilateral-rgb-kmeans-lab-v1"
            ):
                raise StageError("Ожидается каталог результата первого этапа, схема версии 1.")
            artifacts = {}
            # Читаем только фиксированные имена, не используем пути из JSON.
            for name in ("palette.json", "color-map.png", "simplified.png"):
                data = (source / name).read_bytes()
                if hashlib.sha256(data).hexdigest() != manifest["artifacts_sha256"][name]:
                    raise StageError(f"Контрольная сумма {name} не совпадает с manifest.json.")
                artifacts[name] = data
            palette_data = json.loads(artifacts["palette.json"])
            if palette_data["color_space"] != "sRGB":
                raise StageError("Ожидается палитра sRGB.")
            entries = palette_data["colors"]
            if [entry["index"] for entry in entries] != list(range(len(entries))):
                raise StageError("Индексы палитры должны идти подряд от нуля.")
            with Image.open(io.BytesIO(artifacts["color-map.png"])) as image:
                if image.mode != "L" or list(image.size) != manifest["working_size"]:
                    raise StageError("Формат или размер карты цветов не соответствует manifest.")
                if image.width * image.height > 40_000_000:
                    raise StageError("Карта цветов превышает 40 млн пикселей.")
                width, height = image.size
                indices = image.tobytes()
            result = RegionInput(
                width,
                height,
                tuple(tuple(entry["rgb"]) for entry in entries),
                indices,
                hashlib.sha256(manifest_bytes).hexdigest(),
            )
            counts = [0] * len(entries)
            for index in indices:
                counts[index] += 1
            if counts != [entry["pixel_count"] for entry in entries]:
                raise StageError("Числа пикселей в палитре не соответствуют карте.")
            with Image.open(io.BytesIO(artifacts["simplified.png"])) as image:
                if image.mode != "RGB" or image.size != (width, height):
                    raise StageError("Размер или режим simplified.png не соответствует карте.")
                expected = Image.frombytes("P", (width, height), indices)
                expected.putpalette([channel for color in result.palette for channel in color])
                if image.tobytes() != expected.convert("RGB").tobytes():
                    raise StageError("Цветной результат не совпадает с палитрой и картой.")
            return result
        except StageError:
            raise
        except (OSError, ValueError, KeyError, TypeError, IndexError) as error:
            raise StageError(f"Не удалось прочитать первый этап: {error}") from error
