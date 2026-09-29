"""Печатные поля, физические инварианты, нумерация наборов и подготовка без PDF."""

import hashlib
import json
from dataclasses import replace
from pathlib import Path
from xml.etree import ElementTree as ET

import numpy as np
import pytest
from PIL import Image, ImageDraw
from test_numbering import independent_svg_ink, run, source_for

from mystery_coloring.domain import StageError
from mystery_coloring.layout.adapters.configuration import load_layout_settings
from mystery_coloring.layout.adapters.numbers import SVG, ReferenceNumbers
from mystery_coloring.layout.adapters.quality import bounds, check_page
from mystery_coloring.layout.adapters.svg import page_document, palette_element
from mystery_coloring.layout.adapters.writer import FileBookStore
from mystery_coloring.layout.application import PreparePages, PreparePagesRequest
from mystery_coloring.layout.cli import main
from mystery_coloring.layout.domain import PX_MM, ArtMateTemplate, LayoutSettings
from mystery_coloring.numbering.curves import place_glyphs
from mystery_coloring.palette import PALETTE_ORDER_VERSION, palette_order
from mystery_coloring.typography.adapters.font import ArialFont
from mystery_coloring.typography.domain import SYMBOLS


def layout_case(landscape=False):
    template = ArtMateTemplate()
    width, height = (30, 20) if landscape else (20, 30)
    pixels = np.zeros((height, width), dtype=np.uint8)
    pixels[:, 10:] = 1
    placement = template.fit(width, height)
    source, settings, font, result = run(
        source_for(pixels, scale=placement.source_width / width, palette=((80, 0, 0), (200, 0, 0))),
        font_size_pt=4.5,
        min_area_mm2=3.5,
    )
    return source, result, settings, font, template, placement, 25, ReferenceNumbers()


def test_reference_frame_and_real_aspect_fit():
    template = ArtMateTemplate()
    assert (template.width_px, template.height_px) == (612.28, 858.9)
    assert template.width_mm == pytest.approx(161.99908333333332)
    assert template.height_mm == pytest.approx(227.250625)
    assert template.frame.x / PX_MM == pytest.approx(37)
    assert template.frame.y / PX_MM == pytest.approx(28)
    assert template.frame.width / PX_MM == pytest.approx(538.276)
    assert template.frame.height / PX_MM == pytest.approx(760.306)
    for width, height in [(736, 1120), (1120, 736), (30, 30), (2, 1000)]:
        fit = template.fit(width, height)
        assert fit.source_width / fit.source_height == pytest.approx(width / height)
        assert fit.rotation_deg == (-90 if width > height else 0)
        assert fit.width <= fit.height
        assert fit.x + fit.width / 2 == pytest.approx(template.frame.x + template.frame.width / 2)
        assert fit.y + fit.height / 2 == pytest.approx(template.frame.y + template.frame.height / 2)
        assert fit.right <= template.frame.right + 1e-6
        assert fit.bottom <= template.frame.bottom + 1e-6


@pytest.mark.parametrize("count,number", [(13, 1), (19, 25), (35, 26), (35, 999999)])
def test_palette_is_one_row_with_exact_arial_and_no_collision(count, number):
    template, font = ArtMateTemplate(), ArialFont()
    layout = template.palette(count, number)
    colors = tuple((round(i * 238 / (count - 1)),) * 3 for i in range(count))
    group = palette_element(colors, layout, font)
    assert [g.get("data-symbol") for g in group] == list(SYMBOLS[:count])
    assert {float(g.find(SVG + "rect").get("y")) for g in group} == {layout.y}
    assert {g.find(SVG + "rect").get("width") for g in group} == {str(layout.side)}
    for g in group:
        box = g.find(SVG + "rect")
        label = g.find(SVG + "path")
        x0, y0, x1, y1 = bounds(label.get("d"))
        x = float(box.get("x"))
        assert x < x0 < x1 < x + layout.side
        assert layout.y < y0 < y1 < layout.y + layout.side
    assert group[0].find(SVG + "path").get("fill") == "#FFFFFF"
    assert group[-1].find(SVG + "path").get("fill") == "#000000"
    assert group[-1].find(SVG + "rect").get("stroke") == "#000102"
    assert layout.right < (564.04 - (len(str(number)) - 1) * 12.339) * PX_MM
    if count <= 19:
        assert layout.side == pytest.approx(18.5 * PX_MM)
        assert layout.step == pytest.approx(26 * PX_MM)
        assert layout.y == pytest.approx(797 * PX_MM)


def test_numbers_1_to_25_match_captured_browser_reference_and_continue_after_25():
    numbers = ReferenceNumbers()
    reference = json.loads(
        (Path(__file__).parent / "fixtures/artmate-footer-reference.json").read_text()
    )
    for expected in reference["pages"]:
        element = numbers.element(expected["page"])
        assert element[0].get("d") == expected["path"]
        assert element.get("fill") == "#F56A6A"
    for number in (26, 100, 999999):
        element = numbers.element(number)
        assert len(element) == len(str(number))
        assert element[-1].get("transform") == "translate(0.0 0)"
        assert all(bounds(child.get("d"))[3] < 823 for child in element)


def test_actual_page_paths_keep_final_size_and_required_area():
    case = layout_case()
    source, result, settings, font, template, artwork, _, _ = case
    svg = page_document(*case)
    report = check_page(svg, *case)
    assert report["passed"] and report["artwork_scale_after_layout"] == 1
    assert report["actual_min_area_mm2"] >= 3.5
    assert report["font_size_css_px"] == 6
    assert report["label_angles_deg"] == [0]
    assert report["rotated_labels"] == 0
    root = ET.fromstring(svg)
    assert root.get("width") == "612.28px" and root.get("height") == "858.9px"
    assert report["page_size_px"] == [612.28, 858.9]
    assert report["css_dpi"] == 96
    # CSS 96 dpi: глифы в mm при таком viewBox остаются ровно 6 px на листе.
    actual_px_per_mm = float(root.get("width")[:-2]) / float(root.get("viewBox").split()[2])
    assert settings.font_size_pt * 25.4 / 72 * actual_px_per_mm == pytest.approx(6)
    assert not root.findall(".//" + SVG + "text")
    assert not root.findall(".//" + SVG + "image")
    paths = root.findall(f".//{SVG}g[@id='labels']/{SVG}path")
    for path, label in zip(paths, result.labels, strict=True):
        assert label.angle_deg == 0
        actual = independent_svg_ink(path.get("d"))
        expected = place_glyphs(font.glyphs(label.text), label.center_mm, 4.5, label.angle_deg)
        from mystery_coloring.numbering.adapters.svg import path_for

        assert actual.symmetric_difference(independent_svg_ink(path_for(expected))).area < 1e-10
    assert artwork.width == pytest.approx(source.geometry.width * source.geometry.mm_per_unit)
    assert template.frame.bottom < template.palette(len(source.geometry.palette), 25).y


@pytest.mark.parametrize(
    "change",
    [
        "page_scale",
        "body_scale",
        "font_scale",
        "wrong_color",
        "page_number",
        "curve",
        "curve_scale",
        "line_ink",
        "symbol_ink",
    ],
)
def test_page_check_rejects_actual_svg_tampering(change):
    case = layout_case()
    root = ET.fromstring(page_document(*case))
    if change == "page_scale":
        root.set("width", "612.28pt")
    elif change == "body_scale":
        root.find(f"{SVG}g[@id='artwork']").set("transform", "scale(.9)")
    elif change == "font_scale":
        root.find(f".//{SVG}g[@id='labels']/{SVG}path").set("transform", "scale(.9)")
    elif change == "wrong_color":
        root.find(f".//{SVG}g[@id='palette']/{SVG}g/{SVG}rect").set("fill", "#FF00FF")
    elif change == "curve":
        root.find(f".//{SVG}g[@id='contours']/{SVG}path").set("d", "M0 0 L1 1")
    elif change == "curve_scale":
        root.find(f".//{SVG}g[@id='contours']").set("transform", "scale(.9)")
    elif change == "line_ink":
        root.find(f".//{SVG}g[@id='contours']").set("stroke", "#777777")
    elif change == "symbol_ink":
        root.find(f".//{SVG}g[@id='labels']").set("fill", "#333333")
    else:
        root.find(f"{SVG}g[@id='page-number']").set("data-page-number", "1")
    with pytest.raises(StageError):
        check_page(ET.tostring(root, encoding="unicode"), *case)


def test_old_size_cannot_be_scaled_into_print_layout_silently():
    case = layout_case()
    bad = (*case[:5], replace(case[5], width=case[5].width * 0.95), *case[6:])
    with pytest.raises(StageError, match="пересчёт"):
        page_document(*bad)


def test_default_arial_one_matches_reference_ink_dimensions():
    from mystery_coloring.numbering.adapters.svg import path_for

    settings, font = LayoutSettings(), ArialFont()
    assert settings.font_size_pt == pytest.approx(3.87)
    rings = place_glyphs(font.glyphs("1"), (0, 0), settings.font_size_pt, 0)
    x0, y0, x1, y1 = bounds(path_for(rings))
    assert ((x1 - x0) / PX_MM, (y1 - y0) / PX_MM) == pytest.approx((1.36, 3.71), abs=0.002)


def test_page_rejects_unsorted_palette_before_publication():
    case = list(layout_case())
    case[0] = replace(
        case[0], geometry=replace(case[0].geometry, palette=((200, 0, 0), (80, 0, 0)))
    )
    with pytest.raises(StageError, match="светлоте"):
        check_page(page_document(*case), *case)


@pytest.mark.parametrize(
    "data",
    [
        {"font_size_px": 6, "font_size_pt": 6},
        {"font_size_px": None},
        {"font_size_px": float("nan")},
        {"start_page": 0},
        {"start_page": True},
        {"image_width_mm": 180},
        {"colors": 36},
        {"min_area_mm2": "3.5"},
    ],
)
def test_invalid_config_is_rejected(data, tmp_path):
    path = tmp_path / "bad.json"
    path.write_text(json.dumps(data))
    with pytest.raises(StageError):
        load_layout_settings(path, {})


def test_config_px_pt_precedence_and_duplicate_keys(tmp_path):
    path = tmp_path / "settings.json"
    path.write_text('{"colors":19,"min_area_mm2":3.5,"font_size_px":6}')
    assert load_layout_settings(path, {}).font_size_pt == 4.5
    assert load_layout_settings(path, {"font_size_pt": 5}).font_size_pt == 5
    path.write_text('{"colors":19,"colors":20}')
    with pytest.raises(StageError, match="Повторяющийся"):
        load_layout_settings(path, {})


@pytest.mark.parametrize("colors,area,px,start", [(2, 3.5, 6, 9), (4, 1, 4, 25)])
def test_two_page_pipeline_uses_real_print_scale_and_continuous_numbers(
    tmp_path, colors, area, px, start
):
    sources = []
    for i, size in enumerate(((200, 10), (10, 200))):
        image = Image.new("RGB", size, "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((0, 0, size[0] // 2, size[1] // 2), fill="#035A38")
        draw.rectangle((size[0] // 2, size[1] // 2, size[0] - 1, size[1] - 1), fill="#003F99")
        path = tmp_path / f"source{i}.png"
        image.save(path)
        sources.append(path)
    output = tmp_path / "pages"
    args = [
        *map(str, sources),
        "--output",
        str(output),
        "--colors",
        str(colors),
        "--min-area-mm2",
        str(area),
        "--font-size-px",
        str(px),
        "--start-page",
        str(start),
    ]
    assert main(args) == 0
    index = json.loads((output / "pages.json").read_text())["pages"]
    assert [page["number"] for page in index] == [start, start + 1]
    for page in index:
        quality = json.loads((output / page["quality"]).read_text())
        assert quality["actual_min_area_mm2"] >= area
        assert quality["font_size_css_px"] == px
        assert quality["scheme_ink"] == "#898989"
        data_dir = output / page["directory"] / "04-numbering"
        colors = json.loads((data_dir / "palette.json").read_text())["colors"]
        rgbs = [tuple(c["rgb"]) for c in colors]
        assert rgbs == [rgbs[i] for i in palette_order(rgbs)]
        paint = [c for c in colors if c["label_required"]]
        assert [c["symbol"] for c in paint] == list(SYMBOLS[: len(paint)])
        assert all(c["symbol"] is None for c in colors if not c["label_required"])
        assert quality["palette_symbols"] == list(SYMBOLS[: len(paint)])
        assert quality["palette_colors"] == len(paint)
        assert quality["unlabeled_regions"] == quality["paper_white_regions"]
        assert quality["missing_required_labels"] == 0
        assert quality["palette_order"] == PALETTE_ORDER_VERSION
        rotation = page["artwork"]["rotation_deg"]
        assert quality["label_angles_deg"] == [rotation]
        assert quality["rotated_labels"] == (quality["labels"] if rotation else 0)
        preparation = output / page["directory"] / "01-preparation"
        first_palette = json.loads((preparation / "palette.json").read_text())["colors"]
        assert [tuple(c["rgb"]) for c in first_palette] == rgbs
        assert (
            json.loads((preparation / "manifest.json").read_text())["palette_order"]
            == PALETTE_ORDER_VERSION
        )
        cells = {
            c["id"]: c for c in json.loads((data_dir / "geometry.json").read_text())["regions"]
        }
        for label in json.loads((data_dir / "labels.json").read_text())["labels"]:
            assert label["angle_deg"] == 0
            assert label["text"] == colors[cells[label["cell_id"]]["color_index"]]["symbol"]
        settings = json.loads((output / page["directory"] / "settings.json").read_text())
        assert settings["image_width_mm"] == pytest.approx(
            page["artwork"]["height" if rotation else "width"]
        )
        assert (output / page["colored_preview"]).exists()
        assert (output / page["numbered_preview"]).exists()
    for manifest_path in output.rglob("manifest.json"):
        manifest = json.loads(manifest_path.read_text())
        for name, digest in manifest["artifacts_sha256"].items():
            assert hashlib.sha256((manifest_path.parent / name).read_bytes()).hexdigest() == digest
    assert not list(output.rglob("*.pdf"))
    (output / "keep.txt").write_text("keep")
    assert main(args) == 2
    assert (output / "keep.txt").read_text() == "keep"


def test_failed_book_cleans_only_owned_directory_and_page_overflow_fails_early(tmp_path):
    class FailingGenerator:
        def generate(self, *args):
            raise StageError("page failed")

    output = tmp_path / "pages"
    app = PreparePages(FailingGenerator(), FileBookStore())
    with pytest.raises(StageError, match="page failed"):
        app.execute(PreparePagesRequest((Path("a"),), output))
    assert not output.exists()
    with pytest.raises(StageError, match="Номер страницы"):
        app.execute(
            PreparePagesRequest((Path("a"), Path("b")), output, LayoutSettings(start_page=999999))
        )
    assert not output.exists()


def test_landscape_rotation_keeps_artwork_and_labels_together_and_fills_frame():
    case = layout_case(landscape=True)
    source, result, settings, font, template, artwork, number, _ = case
    svg = page_document(*case)
    quality = check_page(svg, *case)
    assert artwork.height == pytest.approx(template.frame.height)
    assert source.geometry.width * source.geometry.mm_per_unit == pytest.approx(artwork.height)
    assert quality["label_angles_deg"] == [-90]
    assert quality["rotated_labels"] == quality["labels"] > 0
    root = ET.fromstring(svg)
    body = root.find(f"{SVG}g[@id='artwork']")
    assert body.get("transform") == f"translate({artwork.x} {artwork.bottom}) rotate(-90)"
    assert body.find(f"{SVG}g[@id='labels']") is not None
    # Palette stays upright on the sheet, independently of the artwork rotation.
    palette = root.find(f"{SVG}g[@id='palette']")
    expected = palette_element(
        source.geometry.palette, template.palette(len(source.geometry.palette), number), font
    )
    assert ET.tostring(palette) == ET.tostring(expected)
    first_ink = bounds(palette[0].find(SVG + "path").get("d"))
    assert first_ink[3] - first_ink[1] > first_ink[2] - first_ink[0]  # upright numeral 1
    # An independent corner transform verifies the final footprint, without extra scaling.
    corners = [
        (0, 0),
        (artwork.source_width, 0),
        (0, artwork.source_height),
        (artwork.source_width, artwork.source_height),
    ]
    mapped = [(artwork.x + y, artwork.bottom - x) for x, y in corners]
    assert min(x for x, y in mapped) == pytest.approx(artwork.x)
    assert max(x for x, y in mapped) == pytest.approx(artwork.right)
    assert min(y for x, y in mapped) == pytest.approx(artwork.y)
    assert max(y for x, y in mapped) == pytest.approx(artwork.bottom)
    body.set("transform", f"translate({artwork.x} {artwork.y})")
    with pytest.raises(StageError, match="масштаб"):
        check_page(ET.tostring(root, encoding="unicode"), *case)


def test_landscape_book_export_preserves_rotation_when_renumbering(tmp_path):
    from mystery_coloring.studio.adapters.export import BookExporter
    from mystery_coloring.studio.adapters.files import StudioFiles
    from mystery_coloring.studio.domain import Limits

    case = layout_case(landscape=True)
    source, _, _, font, template, artwork, number, _ = case
    files = StudioFiles(tmp_path, Limits())
    page, job = (
        {"id": "a" * 32},
        {
            "id": "b" * 32,
            "settings": {"start_page": number},
            "report": {
                "palette": [{"rgb": rgb} for rgb in source.geometry.palette],
                "quality": {"palette_colors": len(source.geometry.palette)},
            },
        },
    )
    out = files.output(page["id"], job["id"])
    out.mkdir(parents=True)
    for variant, stem in [("outline", "page"), ("colored", "colored-page")]:
        (out / (stem + ".svg")).write_text(page_document(*case, filled=variant == "colored"))
        exporter = BookExporter(files)
        root = ET.fromstring(exporter.render(page, job, 26, variant))
        assert root.get("data-page-number") == "26"
        assert root.find(f"{SVG}g[@id='artwork']").get("transform") == artwork.transform
        expected = palette_element(
            source.geometry.palette, template.palette(len(source.geometry.palette), 26), font
        )
        assert ET.tostring(root.find(f"{SVG}g[@id='palette']")) == ET.tostring(expected)
        assert exporter.render(page, job, 26, variant, "png").startswith(b"\x89PNG")
