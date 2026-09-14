"""Экспорт файлов одной обработки, без перезаписи существующего каталога."""

import hashlib
import json
import platform
import shutil
from dataclasses import asdict
from importlib.metadata import version
from pathlib import Path

from PIL import Image, ImageCms, ImageDraw

from mystery_coloring import __version__
from mystery_coloring.domain import PreparedImage, SimplifiedImage, SimplifySettings, StageError
from mystery_coloring.palette import PALETTE_ORDER_VERSION


class FileResultWriter:
    def write(
        self,
        destination: Path,
        prepared: PreparedImage,
        result: SimplifiedImage,
        settings: SimplifySettings,
    ) -> None:
        created = False
        try:
            # Эксклюзивное создание не позволяет двум запускам затереть друг друга.
            destination.mkdir(parents=True, exist_ok=False)
            created = True
            self._save(destination, prepared, result, settings)
        except (OSError, ValueError) as error:
            if created:
                shutil.rmtree(destination)
            raise StageError(f"Не удалось сохранить результат: {error}") from error

    @staticmethod
    def _save(
        destination: Path,
        prepared: PreparedImage,
        result: SimplifiedImage,
        settings: SimplifySettings,
    ) -> None:
        profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
        size = (result.image.width, result.image.height)
        original = Image.frombytes("RGB", size, prepared.image.pixels)
        simplified = Image.frombytes("RGB", size, result.image.pixels)
        original.save(destination / "normalized.png", icc_profile=profile)
        simplified.save(destination / "simplified.png", icc_profile=profile)
        Image.frombytes("L", size, result.color_indices).save(destination / "color-map.png")

        previews = [original.copy(), simplified.copy()]
        for preview in previews:
            preview.thumbnail((900, 900), Image.Resampling.LANCZOS)
        width, height = previews[0].size
        comparison = Image.new("RGB", (width * 2 + 30, height + 42), "white")
        drawing = ImageDraw.Draw(comparison)
        for index, (preview, title) in enumerate(
            zip(previews, ("Normalized original", "Simplified"), strict=True)
        ):
            left = 10 + index * (width + 10)
            comparison.paste(preview, (left, 32))
            drawing.text((left, 10), title, fill="black")
        comparison.save(destination / "comparison.png", icc_profile=profile)

        columns = min(8, len(result.palette))
        rows = (len(result.palette) + columns - 1) // columns
        swatches = Image.new("RGB", (columns * 130, rows * 82), "white")
        draw = ImageDraw.Draw(swatches)
        palette_data = []
        total = size[0] * size[1]
        for index, color in enumerate(result.palette):
            left, top = index % columns * 130, index // columns * 82
            color_hex = "#" + "".join(f"{channel:02X}" for channel in color.rgb)
            draw.rectangle((left + 6, top + 5, left + 124, top + 42), fill=color.rgb)
            draw.text((left + 6, top + 47), f"{index + 1}: {color_hex}", fill="black")
            draw.text((left + 6, top + 62), f"{color.pixel_count / total:.1%}", fill="black")
            palette_data.append(
                {
                    "index": index,
                    "number": index + 1,
                    "rgb": list(color.rgb),
                    "hex": color_hex,
                    "pixel_count": color.pixel_count,
                    "fraction": color.pixel_count / total,
                }
            )
        swatches.save(destination / "palette.png", icc_profile=profile)
        (destination / "palette.json").write_text(
            json.dumps({"color_space": "sRGB", "colors": palette_data}, indent=2) + "\n",
            encoding="utf-8",
        )
        artifacts = {
            path.name: hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(destination.iterdir())
        }
        manifest = {
            "schema_version": 1,
            "algorithm": "bilateral-rgb-kmeans-lab-v1",
            "palette_order": PALETTE_ORDER_VERSION,
            "application_version": __version__,
            "settings": asdict(settings),
            "source_sha256": prepared.source_sha256,
            "original_size": prepared.original_size,
            "oriented_size": prepared.oriented_size,
            "working_size": size,
            "profile_handling": prepared.profile_handling,
            "alpha_background": "#FFFFFF",
            "colors_used": len(result.palette),
            "color_map": {"file": "color-map.png", "mode": "L", "indices": "zero-based"},
            "environment": {
                "python": platform.python_version(),
                "platform": platform.platform(),
                **{name: version(name) for name in ("numpy", "opencv-python-headless", "Pillow")},
            },
            "artifacts_sha256": artifacts,
        }
        # Manifest публикуется последним и означает полностью записанный набор файлов.
        (destination / "manifest.json").write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
