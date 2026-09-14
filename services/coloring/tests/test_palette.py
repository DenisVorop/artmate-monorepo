"""Утверждённый порядок оттенков, светлота и сохранение RGB при смене индексов."""

import json
from pathlib import Path

import numpy as np
import pytest

from mystery_coloring.adapters.opencv_simplifier import OpenCVImageSimplifier
from mystery_coloring.domain import RGBImage, SimplifySettings, Smoothing
from mystery_coloring.palette import _hue_groups, palette_order, to_oklab


def reference_palette():
    data = json.loads((Path(__file__).parent / "fixtures/palette-oklch-19.json").read_text())

    def rgb(hex_color):
        return tuple(int(hex_color[i : i + 2], 16) for i in (1, 3, 5))

    return [rgb(c) for c in data["source_colors_hex"]], [
        rgb(c) for c in data["approved_colors_hex"]
    ]


def test_approved_19_colors_match_the_selected_svg_order_after_shuffling():
    original, expected = reference_palette()
    rng = np.random.default_rng(24)
    for _ in range(8):
        shuffled = [original[i] for i in rng.permutation(len(original))]
        assert [shuffled[i] for i in palette_order(shuffled)] == expected
    assert palette_order(expected) == tuple(range(19))


@pytest.mark.parametrize(
    "rgb,expected",
    [
        ((0, 0, 0), (0, 0, 0)),
        ((255, 255, 255), (1, 0, 0)),
        ((255, 0, 0), (0.62795536, 0.22486306, 0.12584630)),
        ((0, 255, 0), (0.86643961, -0.23388757, 0.17949848)),
        ((0, 0, 255), (0.45201372, -0.03245698, -0.31152815)),
    ],
)
def test_oklab_reference_primaries_and_white(rgb, expected):
    assert to_oklab(rgb) == pytest.approx(expected, abs=1e-7)


def test_hue_groups_wrap_at_zero_without_chaining_distant_colors():
    groups = _hue_groups((0, 1, 2, 3), (350, 10, 55, 100))
    assert {frozenset(g) for g in groups} == {frozenset((0, 1)), frozenset((2, 3))}


@pytest.mark.parametrize(
    "colors", [[], [(128, 128, 128)], [(255, 255, 255), (0, 0, 0), (128, 128, 128)]]
)
def test_empty_single_and_neutral_palettes(colors):
    order = palette_order(colors)
    assert sorted(order) == list(range(len(colors)))
    assert [colors[i] for i in order] == sorted(colors)


@pytest.mark.parametrize("count", [35, 256])
def test_full_supported_palettes_preserve_colors_and_have_stable_order(count):
    rng = np.random.default_rng(752)
    colors = [tuple(int(v) for v in row) for row in rng.integers(0, 256, size=(count, 3))]
    order = palette_order(colors)
    expected = [colors[i] for i in order]
    assert sorted(order) == list(range(count))
    assert palette_order(expected) == tuple(range(count))
    shuffled = [colors[i] for i in rng.permutation(count)]
    assert [shuffled[i] for i in palette_order(shuffled)] == expected


def test_reordering_moves_counts_and_indices_without_changing_any_pixel():
    colors, expected = reference_palette()
    counts = list(range(1, len(colors) + 1))
    pixels = np.concatenate([np.tile(rgb, (n, 1)) for rgb, n in zip(colors, counts, strict=True)])
    image = RGBImage(len(pixels), 1, pixels.astype(np.uint8).tobytes())
    result = OpenCVImageSimplifier().simplify(
        image, SimplifySettings(colors=19, smoothing=Smoothing.NONE)
    )
    assert [c.rgb for c in result.palette] == expected
    assert [c.pixel_count for c in result.palette] == [counts[colors.index(c)] for c in expected]
    assert result.image.pixels == image.pixels
    indices = np.frombuffer(result.color_indices, dtype=np.uint8)
    palette = np.asarray([c.rgb for c in result.palette], dtype=np.uint8)
    assert palette[indices].tobytes() == image.pixels
