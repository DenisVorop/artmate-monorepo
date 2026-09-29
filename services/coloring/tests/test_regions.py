import cv2
import numpy as np
import pytest

from mystery_coloring.domain import StageError
from mystery_coloring.regions.adapters.segmenter import RasterRegionProcessor
from mystery_coloring.regions.domain import RegionInput, RegionSettings, SharedBorder
from mystery_coloring.regions.merging import merge_small_regions


def make_input(values, palette=((90, 90, 90), (100, 100, 100), (110, 110, 110))):
    array = np.asarray(values, dtype=np.uint8)
    return RegionInput(array.shape[1], array.shape[0], palette, array.tobytes(), "test-source")


def result_labels(result):
    return np.frombuffer(result.region_ids, "<u4").reshape(result.height, result.width)


def assert_invariants(source, result):
    labels = result_labels(result)
    assert set(np.unique(labels)) == set(range(len(result.regions)))
    assert sum(region.area_pixels for region in result.regions) == source.width * source.height
    colors = np.array([region.color_index for region in result.regions], dtype=np.uint8)
    assert colors[labels].tobytes() == result.color_indices
    ancestry = {}
    for region in result.regions:
        mask = (labels == region.id).astype(np.uint8)
        count, _ = cv2.connectedComponents(mask, connectivity=4)
        assert count == 2
        assert np.count_nonzero(mask) == region.area_pixels
        for old in region.source_region_ids:
            assert old not in ancestry
            ancestry[old] = region.id
    initial = np.frombuffer(result.initial_region_ids, "<u4").reshape(labels.shape)
    assert sorted(ancestry) == list(range(result.initial_count))
    np.testing.assert_array_equal(
        np.array([ancestry[i] for i in range(result.initial_count)])[initial], labels
    )
    internal = sum(border.length_pixels for border in result.borders)
    assert sum(r.perimeter_pixels for r in result.regions) == (
        2 * internal + 2 * source.width + 2 * source.height
    )
    for border in result.borders:
        assert border.first < border.second
        assert border.length_pixels > 0
        assert result.regions[border.first].color_index != result.regions[border.second].color_index


def test_diagonal_contacts_are_four_distinct_regions():
    source = make_input([[0, 1], [1, 0]])
    result = RasterRegionProcessor().process(source, RegionSettings(min_area_mm2=0))
    assert len(result.regions) == 4
    assert len(result.borders) == 4
    assert result.color_indices == source.color_indices
    assert_invariants(source, result)


def test_hole_is_preserved_and_perimeter_includes_inner_and_outer_edges():
    source = make_input([[0, 0, 0], [0, 1, 0], [0, 0, 0]])
    result = RasterRegionProcessor().process(source, RegionSettings(min_area_mm2=0))
    outer, inner = result.regions
    assert (outer.area_pixels, outer.perimeter_pixels, outer.bbox) == (8, 16, (0, 0, 3, 3))
    assert (inner.area_pixels, inner.perimeter_pixels, inner.bbox) == (1, 4, (1, 1, 1, 1))
    assert outer.centroid == (1.5, 1.5)
    assert result.borders[0].length_pixels == 4
    assert_invariants(source, result)


def test_small_similar_spot_is_absorbed():
    source = make_input([[0, 0, 0], [0, 1, 0], [0, 0, 0]])
    result = RasterRegionProcessor().process(
        source, RegionSettings(image_width_mm=3, min_area_mm2=2)
    )
    assert len(result.regions) == 1
    assert result.changed_pixels == 1
    assert not result.regions[0].below_min_area
    assert_invariants(source, result)


def test_high_contrast_detail_is_reported_instead_of_erased():
    source = make_input([[0, 0, 0], [0, 1, 0], [0, 0, 0]], ((255, 255, 255), (0, 0, 0)))
    result = RasterRegionProcessor().process(
        source, RegionSettings(image_width_mm=3, min_area_mm2=2, max_color_distance=18)
    )
    assert len(result.regions) == 2
    assert result.changed_pixels == 0
    assert sum(region.below_min_area for region in result.regions) == 1
    assert_invariants(source, result)


def test_recoloring_bridge_coalesces_all_touching_same_color_regions():
    source = make_input([[0, 0, 1, 0, 0]])
    result = RasterRegionProcessor().process(
        source, RegionSettings(image_width_mm=5, min_area_mm2=2)
    )
    assert result.initial_count == 3
    assert len(result.regions) == 1
    assert result.regions[0].source_region_ids == (0, 1, 2)
    assert_invariants(source, result)


def test_cumulative_color_limit_cannot_be_bypassed_by_chain_merges():
    mapping = merge_small_regions(
        (1, 1, 100),
        (0, 1, 2),
        (SharedBorder(0, 1, 1), SharedBorder(1, 2, 1)),
        ((0, 10, 20), (10, 0, 10), (20, 10, 0)),
        min_area=3,
        max_color_distance=11,
    )
    assert mapping == (1, 1, 2)


def test_merge_prefers_closer_color_before_larger_neighbor():
    mapping = merge_small_regions(
        (1, 100, 10),
        (0, 1, 2),
        (SharedBorder(0, 1, 8), SharedBorder(0, 2, 1)),
        ((0, 12, 2), (12, 0, 10), (2, 10, 0)),
        min_area=3,
        max_color_distance=18,
    )
    assert mapping[0] == 2


def test_color_tie_prefers_longer_shared_border():
    mapping = merge_small_regions(
        (1, 10, 10),
        (0, 1, 2),
        (SharedBorder(0, 1, 1), SharedBorder(0, 2, 3)),
        ((0, 5, 5), (5, 0, 8), (5, 8, 0)),
        min_area=2,
        max_color_distance=18,
    )
    assert mapping[0] == 2


def test_maps_support_more_than_255_regions():
    grid = np.indices((20, 20)).sum(axis=0) % 2
    source = make_input(grid)
    result = RasterRegionProcessor().process(source, RegionSettings(min_area_mm2=0))
    assert len(result.regions) == 400
    assert result_labels(result).max() == 399
    assert_invariants(source, result)


@pytest.mark.parametrize("shape", [(1, 1), (1, 7), (7, 1)])
def test_single_region_and_thin_images(shape):
    source = make_input(np.zeros(shape))
    result = RasterRegionProcessor().process(
        source, RegionSettings(image_width_mm=1, min_area_mm2=100)
    )
    assert len(result.regions) == 1
    assert result.color_indices == source.color_indices
    assert result.regions[0].below_min_area
    assert_invariants(source, result)


@pytest.mark.parametrize("area, expected", [(0, 0), (4, 1), (4.01, 2)])
def test_physical_area_converts_to_pixel_threshold(area, expected):
    assert RegionSettings(image_width_mm=20, min_area_mm2=area).min_area_pixels(10) == expected


def test_random_input_is_repeatable_and_preserves_graph_invariants():
    source = make_input(np.random.default_rng(4).integers(0, 3, (35, 40)))
    settings = RegionSettings(image_width_mm=40, min_area_mm2=8, max_color_distance=7)
    processor = RasterRegionProcessor()
    first = processor.process(source, settings)
    assert first == processor.process(source, settings)
    assert first.max_color_change <= 7
    assert_invariants(source, first)


def test_no_eligible_small_region_remains_after_merging():
    source = make_input(np.random.default_rng(14).integers(0, 3, (25, 30)))
    settings = RegionSettings(image_width_mm=30, min_area_mm2=12, max_color_distance=7)
    result = RasterRegionProcessor().process(source, settings)
    labels = result_labels(result)
    original = np.frombuffer(source.color_indices, np.uint8).reshape(labels.shape)
    rgb = np.asarray(source.palette, np.float32).reshape(1, -1, 3) / 255
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).reshape(-1, 3)
    neighbors = [[] for _ in result.regions]
    for edge in result.borders:
        neighbors[edge.first].append(edge.second)
        neighbors[edge.second].append(edge.first)
    for region in result.regions:
        if not region.below_min_area:
            continue
        original_colors = np.unique(original[labels == region.id])
        for neighbor in neighbors[region.id]:
            target = result.regions[neighbor].color_index
            distances = np.linalg.norm(lab[original_colors] - lab[target], axis=1)
            assert distances.max() > settings.max_color_distance


def test_excessive_fragmentation_returns_actionable_error(monkeypatch):
    monkeypatch.setattr("mystery_coloring.regions.adapters.segmenter.MAX_REGIONS", 3)
    with pytest.raises(StageError, match="областей"):
        RasterRegionProcessor().process(make_input([[0, 1], [1, 0]]), RegionSettings())


@pytest.mark.parametrize(
    "shape,locked,retained",
    [
        ("thin", False, False),
        ("thin", True, True),
        ("diagonal", False, True),
        ("isolated", False, True),
        ("small_neighbor", False, False),
        ("different", False, True),
    ],
)
def test_generic_fragments_merge_by_color_while_confirmed_strokes_remain(shape, locked, retained):
    from dataclasses import replace

    colors = np.zeros((80, 100), np.uint8)
    protected = np.zeros_like(colors)
    colors[10:70, 10:70] = 1
    if shape == "thin":
        colors[30:32, 70:95] = 1
        protected[30:32, 70:95] = 2 if locked else 1
        point = (30, 80)
    else:
        start = 70 if shape not in ("diagonal", "isolated") else 71
        colors[25:40, start : start + 12] = 1 if shape != "different" else 2
        protected[25:40, start : start + 12] = 1
        point = (30, start + 3)
        if shape == "diagonal":
            colors[24, 70] = 1
        if shape == "small_neighbor":
            colors[10:70, 10:70] = 0
            colors[25:40, 65:70] = 1
    source = replace(make_input(colors), prefilled_mask=protected.tobytes())
    result = RasterRegionProcessor().process(
        source, RegionSettings(image_width_mm=10, min_area_mm2=0)
    )
    detail = result.regions[result_labels(result)[point]]
    assert detail.prefilled is retained
    assert result.color_indices == source.color_indices


@pytest.mark.parametrize(
    "width,contact,other_color", [(10, 10, 1), (2, 2, 1), (10, 1, 1), (10, 10, 2)]
)
def test_generic_same_color_connections_merge_regardless_of_width_or_contact(
    width, contact, other_color
):
    from dataclasses import replace

    colors = np.zeros((120, 120), np.uint8)
    colors[5:45, 5:110] = 1
    colors[85:115, 5:110] = other_color
    colors[44:86, 55 : 55 + width] = 1
    colors[44:47, 55 + contact : 55 + width] = 0
    colors[83:86, 55 + contact : 55 + width] = 0
    protected = np.zeros_like(colors)
    protected[45:85, 55 : 55 + width] = colors[45:85, 55 : 55 + width] == 1
    source = replace(make_input(colors), prefilled_mask=protected.tobytes())
    result = RasterRegionProcessor().process(
        source, RegionSettings(image_width_mm=12, min_area_mm2=0)
    )
    labels = result_labels(result)
    assert not result.regions[labels[60, 55]].prefilled
    assert result.color_indices == source.color_indices
    assert labels[60, 55] == labels[20, 55]
    assert (labels[60, 55] == labels[100, 55]) == (other_color == 1)
    assert_invariants(source, result)


def test_same_color_flood_releases_every_generic_fragment_without_crossing_locked_features():
    from mystery_coloring.regions.adapters.details import reconcile_details

    labels = np.arange(7, dtype=np.int32).reshape(1, 7)
    mask = np.array([[0, 1, 1, 2, 1, 1, 0]], np.uint8)
    keys = (0, 256, 256, 512, 256, 257, 1)
    borders = tuple(SharedBorder(i, i + 1, 1) for i in range(6))
    result = reconcile_details(mask, labels, keys, borders)
    assert result.tolist() == [[0, 0, 0, 2, 1, 0, 0]]
    assert mask.tolist() == [[0, 1, 1, 2, 1, 1, 0]]


def test_same_color_detail_joins_petal_but_pink_highlight_stays_protected():
    from dataclasses import replace

    colors = np.zeros((80, 100), np.uint8)
    colors[10:70, 10:70] = 1
    colors[25:55, 70:82] = 1
    colors[55:59, 70:80] = 2
    protected = np.zeros_like(colors)
    protected[25:55, 70:82] = 1
    protected[55:59, 70:80] = 1
    source = replace(
        make_input(colors, ((150, 170, 190), (166, 70, 191), (241, 170, 242))),
        prefilled_mask=protected.tobytes(),
    )
    settings = RegionSettings(image_width_mm=10, min_area_mm2=3.5, max_color_distance=300)
    first = RasterRegionProcessor().process(source, settings)
    assert first == RasterRegionProcessor().process(source, settings)
    labels = result_labels(first)
    assert labels[30, 75] == labels[30, 60]
    assert not first.regions[labels[30, 75]].prefilled
    pink = first.regions[labels[57, 75]]
    assert pink.prefilled and pink.color_index == 2 and pink.area_pixels == 40
    assert first.color_indices == source.color_indices
    assert_invariants(source, first)


def test_invalid_detail_protection_level_is_rejected():
    from dataclasses import replace

    with pytest.raises(StageError, match="маска"):
        replace(make_input([[0]]), prefilled_mask=bytes([3]))
