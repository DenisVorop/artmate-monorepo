from __future__ import annotations

import importlib.util
import json
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("prepare-coloring-originals.py")
SPEC = importlib.util.spec_from_file_location("prepare_coloring_originals", SCRIPT_PATH)
assert SPEC and SPEC.loader
prepare_module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = prepare_module
SPEC.loader.exec_module(prepare_module)


def png_chunk(kind: bytes, data: bytes) -> bytes:
    checksum = zlib.crc32(kind + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", checksum)


def make_png(width: int = 2, height: int = 2, *, bad_crc: bool = False) -> bytes:
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    compressed = zlib.compress(b"\x00" + bytes((255, 0, 0, 255)) * width * height)
    idat = png_chunk(b"IDAT", compressed)
    if bad_crc:
        idat = idat[:-1] + bytes((idat[-1] ^ 0xFF,))
    return b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", ihdr) + idat + png_chunk(b"IEND", b"")


def make_svg(
    count: int = 12,
    *,
    external_href: bool = False,
    first_missing: bool = False,
    inherited_fill: str | None = None,
    named_fills: bool = False,
    fill_opacity: str | None = None,
    left_start: float = 37,
    stylesheet: bool = False,
) -> bytes:
    paths = []
    for index in range(count):
        right = left_start + 18.5 + index * 26
        left = right - 18.5
        color = f"#{index + 1:06X}"
        if index == 0 and named_fills:
            color = "black"
        elif index == 1 and named_fills:
            color = "white"
        fill = "" if index == 0 and first_missing else f' fill="{color}"'
        paths.append(f'<path d="M{right} 797H{left}V815.5H{right}V797Z"{fill}/>')
    href = '<image href="https://example.invalid/payload.png"/>' if external_href else ""
    group_attributes = []
    if inherited_fill:
        group_attributes.append(f'fill="{inherited_fill}"')
    if fill_opacity:
        group_attributes.append(f'fill-opacity="{fill_opacity}"')
    style = "<style>path { fill: black; }</style>" if stylesheet else ""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="613" height="859">'
        + href
        + style
        + "<g " + " ".join(group_attributes) + ">"
        + "".join(paths)
        + "</g>"
        + "</svg>"
    ).encode()


def build_archive(path: Path, *, missing_pair: bool = False, bad_palette: bool = False, bad_crc: bool = False, traversal: bool = False) -> None:
    import zipfile

    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for index in range(25):
            stem = f"Frame-{index:02}"
            if not (missing_pair and index == 3):
                archive.writestr(f"album/контур/{stem}.png", make_png(bad_crc=bad_crc and index == 0))
            archive.writestr(f"album/цвет/{stem}.png", make_png())
            archive.writestr(
                f"album/свг/{stem}.svg",
                make_svg(20 if bad_palette and index == 0 else 12),
            )
        if traversal:
            archive.writestr("../outside.svg", b"bad")


class PrepareColoringOriginalsTests(unittest.TestCase):
    def test_prepares_deterministic_stem_safe_bundle_and_exact_palette(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "source.zip"
            build_archive(archive)
            output = prepare_module.prepare([("flowers", archive)], root / "bundle")
            manifest = json.loads((output / "manifest.json").read_text())
            records = manifest["collections"][0]["sources"]
            self.assertEqual(len(records), 25)
            first = records[0]
            self.assertEqual(first["stem"], "Frame-00")
            self.assertEqual(first["colors"][0], {"symbolPosition": 1, "hex": "#000001"})
            self.assertEqual(first["dimensions"], {"width": 2, "height": 2})
            self.assertEqual(set(first["paths"]), {"outline", "colored", "svg"})
            self.assertTrue(all((output / relative).is_file() for relative in first["paths"].values()))
            self.assertEqual(len(set(record["sourceKey"] for record in records)), 25)
            self.assertFalse(any("number" in record for record in records))
            copied = (output / first["paths"]["colored"]).read_bytes()
            self.assertEqual(copied, make_png())

    def test_rejects_missing_pair(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "source.zip"
            build_archive(archive, missing_pair=True)
            with self.assertRaisesRegex(prepare_module.PreparationError, "exactly 25"):
                prepare_module.prepare([("flowers", archive)], root / "bundle")
            self.assertFalse((root / "bundle").exists())

    def test_rejects_invalid_palette_count(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "source.zip"
            build_archive(archive, bad_palette=True)
            with self.assertRaisesRegex(prepare_module.PreparationError, "1 to 19"):
                prepare_module.prepare([("flowers", archive)], root / "bundle")

    def test_rejects_zip_traversal_before_creating_output(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "source.zip"
            build_archive(archive, traversal=True)
            with self.assertRaisesRegex(prepare_module.PreparationError, "Unsafe archive path"):
                prepare_module.prepare([("flowers", archive)], root / "bundle")
            self.assertFalse((root / "bundle").exists())

    def test_rejects_png_crc_corruption(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "source.zip"
            build_archive(archive, bad_crc=True)
            with self.assertRaisesRegex(prepare_module.PreparationError, "PNG CRC mismatch"):
                prepare_module.prepare([("flowers", archive)], root / "bundle")

    def test_rejects_external_svg_reference(self) -> None:
        with self.assertRaisesRegex(prepare_module.PreparationError, "external href"):
            prepare_module._svg_palette(make_svg(external_href=True), "sample.svg")

    def test_extracts_default_inherited_and_named_black_white_as_hex(self) -> None:
        inherited = prepare_module._svg_palette(
            make_svg(first_missing=True, inherited_fill="black"), "inherited.svg"
        )
        named = prepare_module._svg_palette(make_svg(named_fills=True), "named.svg")
        default = prepare_module._svg_palette(make_svg(first_missing=True), "default.svg")
        self.assertEqual(inherited[0]["hex"], "#000000")
        self.assertEqual(named[:2], [
            {"symbolPosition": 1, "hex": "#000000"},
            {"symbolPosition": 2, "hex": "#FFFFFF"},
        ])
        self.assertEqual(default[0]["hex"], "#000000")

    def test_rejects_missing_first_palette_position(self) -> None:
        with self.assertRaisesRegex(prepare_module.PreparationError, "start at x=37"):
            prepare_module._svg_palette(make_svg(left_start=63), "gap.svg")

    def test_rejects_alpha_and_unresolved_stylesheet(self) -> None:
        with self.assertRaisesRegex(prepare_module.PreparationError, "alpha"):
            prepare_module._svg_palette(make_svg(fill_opacity="0.5"), "alpha.svg")
        with self.assertRaisesRegex(prepare_module.PreparationError, "stylesheets"):
            prepare_module._svg_palette(make_svg(stylesheet=True), "stylesheet.svg")

    def test_never_overwrites_existing_output(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "source.zip"
            build_archive(archive)
            output = root / "bundle"
            output.mkdir()
            marker = output / "keep.txt"
            marker.write_text("keep")
            with self.assertRaisesRegex(prepare_module.PreparationError, "already exists"):
                prepare_module.prepare([("flowers", archive)], output)
            self.assertEqual(marker.read_text(), "keep")


if __name__ == "__main__":
    unittest.main()
