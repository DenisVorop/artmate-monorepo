"""Bounded deterministic Lab clustering helpers; only caller-owned RNG state."""

import numpy as np

CHUNK_SIZE = 4096


def nearest(points: np.ndarray, centers: np.ndarray) -> np.ndarray:
    """Память ограничена размером блока, а не произведением всей картинки на K."""
    labels = np.empty(len(points), dtype=np.int32)
    for start in range(0, len(points), CHUNK_SIZE):
        part = points[start : start + CHUNK_SIZE]
        distances = np.sum((part[:, None, :] - centers[None, :, :]) ** 2, axis=2)
        labels[start : start + len(part)] = np.argmin(distances, axis=1)
    return labels


def initial_labels(sample: np.ndarray, count: int, rng: np.random.Generator) -> np.ndarray:
    """Локальный k-means++ задаёт все начальные кластеры, не меняя глобальный RNG."""
    centers = [sample[int(rng.integers(len(sample)))]]
    closest = np.sum((sample - centers[0]) ** 2, axis=1).astype(np.float64)
    for _ in range(1, count):
        total = closest.sum()
        if total == 0:
            break
        center = sample[int(rng.choice(len(sample), p=closest / total))]
        centers.append(center)
        closest = np.minimum(closest, np.sum((sample - center) ** 2, axis=1))
    return nearest(sample, np.asarray(centers, dtype=np.float32))
