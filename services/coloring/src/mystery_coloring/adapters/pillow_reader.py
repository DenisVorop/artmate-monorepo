"""Декодирование, EXIF, ICC, прозрачность и рабочий размер."""

import hashlib
import io
import warnings
from pathlib import Path

from PIL import Image, ImageCms, ImageOps, UnidentifiedImageError

from mystery_coloring.domain import PreparedImage, RGBImage, StageError

MAX_INPUT_PIXELS = 40_000_000
MAX_INPUT_BYTES = 100 * 1024 * 1024


class PillowImageReader:
    def read(self, source: Path, max_size: int) -> PreparedImage:
        try:
            with source.open("rb") as stream:
                data = stream.read(MAX_INPUT_BYTES + 1)
            if len(data) > MAX_INPUT_BYTES:
                raise StageError("Исходный файл превышает 100 МиБ.")
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(data)) as image:
                    if image.format not in {"PNG", "JPEG", "WEBP"}:
                        raise StageError("Поддерживаются PNG, JPEG и WebP.")
                    if getattr(image, "n_frames", 1) != 1:
                        raise StageError("Анимация не поддерживается; выберите отдельный кадр.")
                    if image.width * image.height > MAX_INPUT_PIXELS:
                        raise StageError("Исходное изображение превышает 40 миллионов пикселей.")
                    if image.mode not in {"RGB", "RGBA", "L", "LA", "P", "CMYK"}:
                        raise StageError("Поддерживаются 8-битные RGB, CMYK и серые изображения.")
                    original_size = image.size
                    oriented = ImageOps.exif_transpose(image)
                    oriented_size = oriented.size
                    normalized, profile_handling = self._to_srgb(oriented)
                    # Уменьшаем до обработки, никогда не увеличиваем и не меняем пропорции.
                    normalized.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                    return PreparedImage(
                        RGBImage(*normalized.size, normalized.tobytes()),
                        hashlib.sha256(data).hexdigest(),
                        original_size,
                        oriented_size,
                        profile_handling,
                    )
        except StageError:
            raise
        except (
            OSError,
            ValueError,
            UnidentifiedImageError,
            Image.DecompressionBombWarning,
            Image.DecompressionBombError,
            ImageCms.PyCMSError,
        ) as error:
            raise StageError(f"Не удалось прочитать изображение: {error}") from error

    @staticmethod
    def _to_srgb(image: Image.Image) -> tuple[Image.Image, str]:
        alpha = image.convert("RGBA").getchannel("A")
        profile = image.info.get("icc_profile")
        if profile:
            color = image if image.mode in {"RGB", "L", "CMYK"} else image.convert("RGB")
            rgb = ImageCms.profileToProfile(
                color,
                ImageCms.ImageCmsProfile(io.BytesIO(profile)),
                ImageCms.createProfile("sRGB"),
                outputMode="RGB",
            )
            handling = "embedded ICC converted to sRGB"
        else:
            if image.mode == "CMYK":
                raise StageError("Для CMYK требуется встроенный ICC-профиль.")
            rgb = image.convert("RGB")
            handling = "untagged RGB/grayscale assumed sRGB"
        background = Image.new("RGB", rgb.size, "white")
        background.paste(rgb, mask=alpha)
        return background, handling
