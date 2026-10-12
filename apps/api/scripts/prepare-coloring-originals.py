#!/usr/bin/env python3
"""Validate original coloring archives and stage their source assets locally."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import struct
import sys
import tempfile
import zipfile
import zlib
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Iterable
from xml.etree import ElementTree


MAX_ARCHIVE_ENTRIES = 1000
MAX_FILE_BYTES = 32 * 1024 * 1024
MAX_TOTAL_BYTES = 512 * 1024 * 1024
MAX_IMAGE_PIXELS = 50_000_000
GROUPS = {"цвет": "colored", "контур": "outline", "свг": "svg"}
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".avif"}
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
PALETTE_RECT = re.compile(
    r"M([0-9]+(?:\.[0-9]+)?) ([0-9]+(?:\.[0-9]+)?)"
    r"H([0-9]+(?:\.[0-9]+)?)V([0-9]+(?:\.[0-9]+)?)"
    r"H([0-9]+(?:\.[0-9]+)?)V([0-9]+(?:\.[0-9]+)?)Z"
)
HEX_COLOR = re.compile(r"#[0-9A-Fa-f]{6}\Z")
SLUG = re.compile(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\Z")
STEM_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


class PreparationError(ValueError):
    """Input archive or output request failed validation."""


@dataclass(frozen=True)
class SourceFile:
    stem: str
    group: str
    data: bytes
    archive_path: str


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _check_zip_path(name: str) -> PurePosixPath | None:
    if "\\" in name or re.match(r"^[A-Za-z]:/", name):
        raise PreparationError(f"Unsafe archive path: {name!r}")
    path = PurePosixPath(name)
    if path.is_absolute() or not path.parts or any(part in ("", ".", "..") for part in path.parts):
        raise PreparationError(f"Unsafe archive path: {name!r}")
    if path.parts[0] == "__MACOSX" or path.name == ".DS_Store":
        return None
    return path


def _repair_legacy_utf8_name(name: str) -> str:
    """Recover UTF-8 names in ZIPs whose creator omitted the UTF-8 flag."""
    try:
        repaired = name.encode("cp437").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return name
    if any(part in GROUPS for part in PurePosixPath(repaired).parts):
        return repaired
    return name


def _read_archive(path: Path) -> dict[str, dict[str, SourceFile]]:
    try:
        archive = zipfile.ZipFile(path)
    except (OSError, zipfile.BadZipFile) as error:
        raise PreparationError(f"Cannot read ZIP archive {path}: {error}") from error

    files: dict[str, dict[str, SourceFile]] = {group: {} for group in GROUPS.values()}
    total_size = 0
    with archive:
        infos = archive.infolist()
        if len(infos) > MAX_ARCHIVE_ENTRIES:
            raise PreparationError(f"Archive has too many entries: {len(infos)}")
        for info in infos:
            member_name = _repair_legacy_utf8_name(info.filename)
            archive_path = _check_zip_path(member_name)
            if archive_path is None:
                continue
            mode = info.external_attr >> 16
            if stat.S_ISLNK(mode):
                raise PreparationError(f"Archive contains a symlink: {member_name!r}")
            if info.is_dir():
                continue
            if info.file_size > MAX_FILE_BYTES:
                raise PreparationError(f"Archive member is too large: {member_name!r}")
            total_size += info.file_size
            if total_size > MAX_TOTAL_BYTES:
                raise PreparationError("Archive expanded size exceeds the limit")

            suffix = archive_path.suffix.lower()
            if suffix in IMAGE_SUFFIXES and suffix != ".png":
                raise PreparationError(f"Unexpected image format: {member_name!r}")
            if suffix not in (".png", ".svg"):
                # Archives may include their small extraction report; it is not
                # copied into the bundle and cannot affect asset selection.
                if archive_path.name == "report.json" and info.file_size <= 1024 * 1024:
                    continue
                raise PreparationError(f"Unexpected archive file: {member_name!r}")
            parent_group = next((part for part in reversed(archive_path.parts[:-1]) if part in GROUPS), None)
            if parent_group is None:
                raise PreparationError(f"Asset is outside a recognized source folder: {member_name!r}")
            group = GROUPS[parent_group]
            expected_suffix = ".svg" if group == "svg" else ".png"
            if suffix != expected_suffix:
                raise PreparationError(f"Wrong file type in {parent_group!r}: {member_name!r}")
            stem = archive_path.stem
            if not stem or stem in files[group]:
                raise PreparationError(f"Duplicate or empty source stem in {parent_group!r}: {stem!r}")
            try:
                data = archive.read(info)
            except (zipfile.BadZipFile, RuntimeError, OSError) as error:
                raise PreparationError(f"ZIP member CRC/read failure: {member_name!r}") from error
            if len(data) != info.file_size:
                raise PreparationError(f"Truncated ZIP member: {info.filename!r}")
            files[group][stem] = SourceFile(stem, group, data, member_name)

    counts = {group: len(entries) for group, entries in files.items()}
    if any(count != 25 for count in counts.values()):
        raise PreparationError(f"Expected exactly 25 files in each source group; found {counts}")
    stem_sets = {group: set(entries) for group, entries in files.items()}
    if not (stem_sets["colored"] == stem_sets["outline"] == stem_sets["svg"]):
        raise PreparationError("The 25 colored, outline, and SVG stems must match exactly")
    return files


def _png_dimensions_and_validate(data: bytes, source_name: str) -> tuple[int, int]:
    if not data.startswith(PNG_SIGNATURE):
        raise PreparationError(f"Invalid PNG signature: {source_name}")
    offset = len(PNG_SIGNATURE)
    width = height = 0
    seen_ihdr = seen_iend = False
    idat = bytearray()
    while offset < len(data):
        if offset + 12 > len(data):
            raise PreparationError(f"Truncated PNG chunk: {source_name}")
        size = struct.unpack_from(">I", data, offset)[0]
        end = offset + 12 + size
        if end > len(data):
            raise PreparationError(f"Truncated PNG payload: {source_name}")
        kind = data[offset + 4 : offset + 8]
        chunk_data = data[offset + 8 : offset + 8 + size]
        stored_crc = struct.unpack_from(">I", data, offset + 8 + size)[0]
        if zlib.crc32(kind + chunk_data) & 0xFFFFFFFF != stored_crc:
            raise PreparationError(f"PNG CRC mismatch: {source_name}")
        if not seen_ihdr:
            if kind != b"IHDR" or size != 13:
                raise PreparationError(f"PNG must begin with a valid IHDR: {source_name}")
            width, height = struct.unpack_from(">II", chunk_data)
            if not width or not height or width > 20_000 or height > 20_000 or width * height > MAX_IMAGE_PIXELS:
                raise PreparationError(f"PNG dimensions are outside safe bounds: {source_name}")
            seen_ihdr = True
        elif kind == b"IHDR":
            raise PreparationError(f"PNG contains a duplicate IHDR: {source_name}")
        if kind == b"IDAT":
            idat.extend(chunk_data)
        if kind == b"IEND":
            if size != 0:
                raise PreparationError(f"Invalid PNG IEND: {source_name}")
            seen_iend = True
            offset = end
            break
        offset = end
    if not seen_ihdr or not seen_iend or offset != len(data) or not idat:
        raise PreparationError(f"PNG is incomplete or has trailing data: {source_name}")
    try:
        decompressor = zlib.decompressobj()
        decompressor.decompress(bytes(idat), MAX_IMAGE_PIXELS * 8 + 1)
        decompressor.flush()
    except zlib.error as error:
        raise PreparationError(f"PNG image data is corrupt: {source_name}") from error
    return width, height


def _inline_style(element: ElementTree.Element, source_name: str) -> dict[str, str]:
    style = element.attrib.get("style", "")
    declarations: dict[str, str] = {}
    for declaration in style.split(";"):
        if not declaration.strip():
            continue
        name, separator, value = declaration.partition(":")
        if not separator:
            raise PreparationError(f"SVG has an invalid style declaration: {source_name}")
        declarations[name.strip().lower()] = value.strip()
    return declarations


def _resolved_fill(
    inherited_fill: str,
    inherited_alpha: float,
    element: ElementTree.Element,
    source_name: str,
) -> tuple[str, float]:
    style = _inline_style(element, source_name)
    fill = element.attrib.get("fill", inherited_fill)
    fill = style.get("fill", fill).strip()
    if fill.lower() in ("inherit", "unset"):
        fill = inherited_fill
    elif fill.lower() == "initial":
        fill = "black"

    fill_opacity = style.get("fill-opacity", element.attrib.get("fill-opacity", "1"))
    opacity = style.get("opacity", element.attrib.get("opacity", "1"))
    try:
        alpha = inherited_alpha * float(fill_opacity) * float(opacity)
    except ValueError as error:
        raise PreparationError(f"SVG has unresolved opacity CSS: {source_name}") from error
    if not (0 <= alpha <= 1):
        raise PreparationError(f"SVG opacity is outside 0..1: {source_name}")
    return fill, alpha


def _canonical_palette_color(fill: str, alpha: float, source_name: str) -> str:
    if alpha != 1:
        raise PreparationError(f"SVG palette swatches with alpha are unsupported: {source_name}")
    lowered = fill.strip().lower()
    if lowered == "black":
        return "#000000"
    if lowered == "white":
        return "#FFFFFF"
    if re.fullmatch(r"#[0-9A-Fa-f]{6}", fill):
        return fill.upper()
    raise PreparationError(f"SVG palette fill is unresolved or unsupported: {source_name}")


def _svg_palette(data: bytes, source_name: str) -> list[dict[str, object]]:
    if re.search(br"<!DOCTYPE|<!ENTITY", data, re.IGNORECASE):
        raise PreparationError(f"SVG must not contain a DOCTYPE or entity declaration: {source_name}")
    if re.search(br"<\s*(?:style|\?xml-stylesheet)\b", data, re.IGNORECASE):
        raise PreparationError(f"SVG stylesheets are unsupported because palette CSS cannot be resolved: {source_name}")
    try:
        root = ElementTree.fromstring(data)
    except ElementTree.ParseError as error:
        raise PreparationError(f"Invalid SVG XML: {source_name}") from error
    if root.tag.rsplit("}", 1)[-1] != "svg":
        raise PreparationError(f"Root element is not SVG: {source_name}")
    for element in root.iter():
        for key, value in element.attrib.items():
            if key.rsplit("}", 1)[-1].lower() == "href" and not value.startswith("#"):
                raise PreparationError(f"SVG contains an external href: {source_name}")
            if re.search(r"url\s*\(\s*['\"]?(?:https?:|file:|//)", value, re.IGNORECASE):
                raise PreparationError(f"SVG contains an external URL reference: {source_name}")
    rectangles: list[tuple[float, float, str]] = []

    def visit(element: ElementTree.Element, inherited_fill: str, inherited_alpha: float) -> None:
        fill, alpha = _resolved_fill(inherited_fill, inherited_alpha, element, source_name)
        if element.tag.rsplit("}", 1)[-1] == "path":
            match = PALETTE_RECT.fullmatch(element.attrib.get("d", ""))
            if match:
                x1, y1, x2, y2, x3, y3 = map(float, match.groups())
                if x1 == x3 and y1 == y3 and x1 - x2 == 18.5 and y2 - y1 == 18.5:
                    rectangles.append((x1, y1, _canonical_palette_color(fill, alpha, source_name)))
        for child in element:
            visit(child, fill, alpha)

    visit(root, "black", 1.0)
    bands = {y for _, y, _ in rectangles}
    if len(bands) != 1 or not rectangles:
        raise PreparationError(f"SVG must have exactly one palette swatch band: {source_name}")
    rectangles.sort()
    if not 1 <= len(rectangles) <= 19:
        raise PreparationError(f"SVG palette must contain 1 to 19 swatches: {source_name}")
    xs = [x for x, _, _ in rectangles]
    first_left = xs[0] - 18.5
    if abs(first_left - 37.0) > 1e-6:
        raise PreparationError(f"SVG palette must start at x=37 without a missing first position: {source_name}")
    if any(abs((right - left) - 26.0) > 1e-6 for left, right in zip(xs, xs[1:])):
        raise PreparationError(f"SVG palette swatches must form one contiguous row: {source_name}")
    if len({color for _, _, color in rectangles}) != len(rectangles):
        raise PreparationError(f"SVG palette contains duplicate fill colors: {source_name}")
    return [{"symbolPosition": index, "hex": color} for index, (_, _, color) in enumerate(rectangles, start=1)]


def _parse_collection(value: str) -> tuple[str, Path]:
    slug, separator, archive_text = value.partition("=")
    if not separator or not SLUG.fullmatch(slug):
        raise argparse.ArgumentTypeError("Expected --collection slug=/absolute/archive.zip with a lowercase slug")
    path = Path(archive_text)
    if not path.is_absolute():
        raise argparse.ArgumentTypeError("Archive path must be absolute")
    if path.suffix.lower() != ".zip":
        raise argparse.ArgumentTypeError("Archive path must end in .zip")
    return slug, path


def prepare(collections: Iterable[tuple[str, Path]], output: Path) -> Path:
    collections = list(collections)
    if not collections:
        raise PreparationError("At least one --collection is required")
    slugs = [slug for slug, _ in collections]
    if len(set(slugs)) != len(slugs):
        raise PreparationError("Collection slugs must be unique")
    if output.exists():
        raise PreparationError(f"Output already exists; refusing to overwrite: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=f".{output.name}.staging-", dir=output.parent))
    try:
        manifest: dict[str, object] = {"version": 1, "collections": []}
        manifest_collections: list[dict[str, object]] = []
        for slug, archive_path in sorted(collections):
            groups = _read_archive(archive_path)
            records: list[dict[str, object]] = []
            collection_dir = stage / slug
            collection_dir.mkdir()
            for stem in sorted(groups["outline"]):
                outline = groups["outline"][stem]
                colored = groups["colored"][stem]
                svg = groups["svg"][stem]
                outline_dimensions = _png_dimensions_and_validate(outline.data, outline.archive_path)
                colored_dimensions = _png_dimensions_and_validate(colored.data, colored.archive_path)
                if outline_dimensions != colored_dimensions:
                    raise PreparationError(f"Colored/outline dimensions differ for {slug}/{stem}")
                palette = _svg_palette(svg.data, svg.archive_path)
                identity = hashlib.sha256(f"{slug}\0{stem}".encode("utf-8")).hexdigest()
                safe_stem = STEM_SAFE.sub("_", stem).strip("._-")[:48] or "asset"
                assets = {
                    "outline": (outline, ".png"),
                    "colored": (colored, ".png"),
                    "svg": (svg, ".svg"),
                }
                paths: dict[str, str] = {}
                checksums: dict[str, str] = {}
                for name, (source, extension) in assets.items():
                    relative = f"{slug}/{safe_stem}-{identity[:16]}-{name}{extension}"
                    destination = stage / relative
                    destination.write_bytes(source.data)
                    paths[name] = relative
                    checksums[name] = sha256(source.data)
                records.append({
                    "sourceKey": f"{slug}:{identity}",
                    "stem": stem,
                    "paths": paths,
                    "dimensions": {"width": outline_dimensions[0], "height": outline_dimensions[1]},
                    "sha256": checksums,
                    "colors": palette,
                })
            manifest_collections.append({"slug": slug, "sources": records})
        manifest["collections"] = manifest_collections
        manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
        (stage / "manifest.json").write_bytes(manifest_bytes)
        if output.exists():
            raise PreparationError(f"Output appeared during preparation; refusing to overwrite: {output}")
        try:
            os.rename(stage, output)
        except FileExistsError as error:
            raise PreparationError(f"Output appeared during preparation; refusing to overwrite: {output}") from error
        return output
    except Exception:
        shutil.rmtree(stage, ignore_errors=True)
        raise


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--collection", action="append", type=_parse_collection, default=[])
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        output = prepare(args.collection, args.output)
    except (PreparationError, OSError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
