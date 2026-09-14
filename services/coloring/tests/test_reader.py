import hashlib

import pytest
from PIL import Image, ImageCms

from mystery_coloring.adapters.pillow_reader import PillowImageReader
from mystery_coloring.domain import StageError


def test_alpha_is_composited_on_white_and_source_is_unchanged(tmp_path):
    path = tmp_path / "alpha.png"
    image = Image.new("RGBA", (2, 1))
    image.putdata([(255, 0, 0, 255), (0, 0, 0, 0)])
    image.save(path)
    before = path.read_bytes()
    prepared = PillowImageReader().read(path, 100)
    assert prepared.image.pixels == bytes([255, 0, 0, 255, 255, 255])
    assert prepared.source_sha256 == hashlib.sha256(before).hexdigest()
    assert path.read_bytes() == before


def test_exif_orientation_is_applied_before_resize(tmp_path):
    path = tmp_path / "rotated.jpg"
    image = Image.new("RGB", (40, 20), "red")
    exif = Image.Exif()
    exif[274] = 6
    image.save(path, exif=exif)
    prepared = PillowImageReader().read(path, 10)
    assert prepared.original_size == (40, 20)
    assert prepared.oriented_size == (20, 40)
    assert (prepared.image.width, prepared.image.height) == (5, 10)


def test_srgb_profile_is_converted_and_small_image_not_upscaled(tmp_path):
    path = tmp_path / "profile.png"
    profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    Image.new("RGB", (3, 5), (91, 122, 231)).save(path, icc_profile=profile)
    prepared = PillowImageReader().read(path, 100)
    assert (prepared.image.width, prepared.image.height) == (3, 5)
    assert prepared.image.pixels == bytes([91, 122, 231]) * 15
    assert "converted" in prepared.profile_handling


def test_palette_transparency_is_respected(tmp_path):
    path = tmp_path / "indexed.png"
    image = Image.new("P", (2, 1))
    image.putpalette([255, 0, 0, 0, 0, 0] + [0] * 762)
    image.putdata([0, 1])
    image.save(path, transparency=1)
    assert PillowImageReader().read(path, 100).image.pixels == bytes([255, 0, 0, 255, 255, 255])


@pytest.mark.parametrize("kind", ["missing", "corrupt", "icc", "animated", "large", "cmyk"])
def test_invalid_inputs_produce_domain_errors(tmp_path, monkeypatch, kind):
    path = tmp_path / "input.png"
    if kind == "corrupt":
        path.write_bytes(b"this is not an image")
    elif kind == "icc":
        Image.new("RGB", (2, 2)).save(path, icc_profile=b"invalid profile")
    elif kind == "animated":
        Image.new("RGB", (2, 2), "red").save(
            path, save_all=True, append_images=[Image.new("RGB", (2, 2), "blue")]
        )
    elif kind == "large":
        monkeypatch.setattr("mystery_coloring.adapters.pillow_reader.MAX_INPUT_PIXELS", 3)
        Image.new("RGB", (2, 2)).save(path)
    elif kind == "cmyk":
        Image.new("CMYK", (2, 2)).save(path, format="JPEG")
    with pytest.raises(StageError):
        PillowImageReader().read(path, 100)
