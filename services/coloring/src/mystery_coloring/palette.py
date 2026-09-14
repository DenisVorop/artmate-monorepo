"""Похожие оттенки в OKLCH; внутри группы — воспринимаемая светлота OKLab."""

from collections.abc import Sequence
from math import atan2, cos, degrees, hypot, radians, sin

PALETTE_ORDER_VERSION = "oklch-groups-lightness-v2"
MAX_GROUP_HUE_SPAN = 60.0
RGB = tuple[int, int, int]


def to_oklab(rgb: RGB) -> tuple[float, float, float]:
    """sRGB D65 → OKLab; матрицы Ottosson 2021, без изменения исходного RGB."""
    r, g, b = (
        v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
        for v in (channel / 255 for channel in rgb)
    )
    cone_l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    cone_m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    cone_s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (
        0.2104542553 * cone_l + 0.7936177850 * cone_m - 0.0040720468 * cone_s,
        1.9779984951 * cone_l - 2.4285922050 * cone_m + 0.4505937099 * cone_s,
        0.0259040371 * cone_l + 0.7827717662 * cone_m - 0.8086757660 * cone_s,
    )


def _hue_groups(indices: Sequence[int], hues: Sequence[float]) -> list[list[int]]:
    """Полная связь: ни одна пара оттенков в группе не дальше 60° по кругу."""
    groups = {i: [index] for i, index in enumerate(indices)}
    distances = {
        (i, j): abs((hues[a] - hues[b] + 180) % 360 - 180)
        for i, a in enumerate(indices)
        for j, b in enumerate(indices)
        if i < j
    }
    while distances:
        distance, first, second = min((value, *pair) for pair, value in distances.items())
        if distance > MAX_GROUP_HUE_SPAN:
            break
        # d(A∪B, C) = max(d(A,C), d(B,C)); не пересчитываем все пары цветов.
        for other in groups:
            if other not in (first, second):
                a = tuple(sorted((first, other)))
                b = tuple(sorted((second, other)))
                distances[a] = max(distances[a], distances[b])
        distances = {pair: value for pair, value in distances.items() if second not in pair}
        groups[first].extend(groups.pop(second))
    return list(groups.values())


def palette_order(palette: Sequence[RGB]) -> tuple[int, ...]:
    """Перестановка исходных индексов до назначения символов; учитывает всю палитру.

    RGB разрешает равенства независимо от исходного порядка и частоты цвета.
    Политика поддерживает также пустую, одноцветную и нейтральную палитру.
    """
    labs = [to_oklab(rgb) for rgb in palette]
    hues = [degrees(atan2(b, a)) % 360 for _, a, b in labs]
    neutral = {
        i
        for i, (lightness, a, b) in enumerate(labs)
        if hypot(a, b) < 0.025 or (lightness < 0.28 and hypot(a, b) < 0.04)
    }
    canonical = sorted(range(len(palette)), key=lambda i: palette[i])
    groups = _hue_groups([i for i in canonical if i not in neutral], hues)

    def hue_key(group):
        mean = (
            degrees(
                atan2(
                    sum(sin(radians(hues[i])) for i in group),
                    sum(cos(radians(hues[i])) for i in group),
                )
            )
            % 360
        )
        return (mean + 15) % 360

    groups.sort(key=hue_key)
    groups.insert(0, [i for i in neutral if labs[i][0] < 0.5])
    groups.append([i for i in neutral if labs[i][0] >= 0.5])
    return tuple(
        index for group in groups for index in sorted(group, key=lambda i: (labs[i][0], palette[i]))
    )


PAPER_WHITE_POLICY_VERSION = "oklab-paper-white-v1"
PAPER_WHITE_MIN_LIGHTNESS = 0.96
PAPER_WHITE_MAX_CHROMA = 0.02


def is_paper_white(rgb: RGB) -> bool:
    """Очень светлый почти нейтральный цвет можно оставить цветом бумаги."""
    lightness, a, b = to_oklab(rgb)
    return lightness >= PAPER_WHITE_MIN_LIGHTNESS and hypot(a, b) <= PAPER_WHITE_MAX_CHROMA


def paper_white_policy() -> dict[str, str | float]:
    """Снимок принятой политики для воспроизводимых артефактов."""
    return {
        "version": PAPER_WHITE_POLICY_VERSION,
        "color_space": "OKLab (sRGB)",
        "min_lightness": PAPER_WHITE_MIN_LIGHTNESS,
        "max_chroma": PAPER_WHITE_MAX_CHROMA,
    }
