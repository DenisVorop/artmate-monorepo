import numpy as np
import pytest

from mystery_coloring.adapters.opencv_simplifier import OpenCVImageSimplifier
from mystery_coloring.domain import RGBImage, SimplifySettings, Smoothing


def image_from(array):
    return RGBImage(array.shape[1], array.shape[0], array.tobytes())


@pytest.mark.parametrize("shape", [(1, 1, 3), (4, 9, 3)])
def test_uniform_image_keeps_exact_color_even_when_more_colors_requested(shape):
    array = np.full(shape, (47, 93, 181), dtype=np.uint8)
    result = OpenCVImageSimplifier().simplify(image_from(array), SimplifySettings(colors=32))
    assert result.image.pixels == array.tobytes()
    assert len(result.palette) == 1
    assert result.palette[0].pixel_count == shape[0] * shape[1]
    assert set(result.color_indices) == {0}


def test_indices_reconstruct_output_and_palette_counts_match():
    array = np.random.default_rng(8).integers(0, 256, (64, 71, 3), dtype=np.uint8)
    result = OpenCVImageSimplifier().simplify(
        image_from(array), SimplifySettings(colors=16, sample_size=400, seed=37)
    )
    palette = np.array([color.rgb for color in result.palette], dtype=np.uint8)
    labels = np.frombuffer(result.color_indices, dtype=np.uint8)
    assert len(palette) <= 16
    assert len(labels) == 64 * 71
    assert palette[labels].tobytes() == result.image.pixels
    assert np.bincount(labels).tolist() == [color.pixel_count for color in result.palette]
    assert all(color.pixel_count > 0 for color in result.palette)


def test_same_seed_reproduces_result_without_touching_numpy_global_rng():
    array = np.random.default_rng(23).integers(0, 256, (33, 40, 3), dtype=np.uint8)
    settings = SimplifySettings(colors=8, sample_size=300, seed=19)
    processor = OpenCVImageSimplifier()
    np.random.seed(7)
    before = np.random.get_state()
    first = processor.simplify(image_from(array), settings)
    second = processor.simplify(image_from(array), settings)
    after = np.random.get_state()
    assert first == second
    assert before[0] == after[0]
    np.testing.assert_array_equal(before[1], after[1])
    assert before[2:] == after[2:]


def test_two_flat_regions_keep_sharp_boundary_without_smoothing():
    array = np.zeros((20, 20, 3), dtype=np.uint8)
    array[:, :10] = [255, 0, 0]
    array[:, 10:] = [0, 0, 255]
    result = OpenCVImageSimplifier().simplify(
        image_from(array), SimplifySettings(colors=2, smoothing=Smoothing.NONE)
    )
    assert result.image.pixels == array.tobytes()


def test_bilateral_reduces_noise_without_erasing_strong_edge():
    rng = np.random.default_rng(44)
    base = np.full((60, 80, 3), 45, dtype=np.int16)
    base[:, 40:] = 210
    noisy = np.clip(base + rng.integers(-8, 9, base.shape), 0, 255).astype(np.uint8)
    processor = OpenCVImageSimplifier()
    raw = processor.simplify(
        image_from(noisy), SimplifySettings(colors=24, smoothing=Smoothing.NONE)
    )
    smooth = processor.simplify(
        image_from(noisy), SimplifySettings(colors=24, smoothing=Smoothing.HIGH)
    )
    raw_array = np.frombuffer(raw.image.pixels, np.uint8).reshape(base.shape)
    smooth_array = np.frombuffer(smooth.image.pixels, np.uint8).reshape(base.shape)
    assert smooth_array[:, :35].std() < raw_array[:, :35].std()
    assert smooth_array[:, 40].mean() - smooth_array[:, 39].mean() > 140


def test_full_256_color_index_range_is_supported():
    ramp = np.repeat(np.arange(256, dtype=np.uint8)[None, :, None], 3, axis=2)
    result = OpenCVImageSimplifier().simplify(
        image_from(ramp), SimplifySettings(colors=256, smoothing=Smoothing.NONE)
    )
    assert result.image.pixels == ramp.tobytes()
    assert len(result.palette) == 256
    assert max(result.color_indices) == 255
