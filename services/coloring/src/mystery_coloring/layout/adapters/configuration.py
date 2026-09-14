"""Независимые параметры; px — явный CSS-размер при 96 dpi, 1 px = 0.75 pt."""

import json
from dataclasses import fields

from mystery_coloring.domain import StageError
from mystery_coloring.layout.domain import LayoutSettings
from mystery_coloring.pipeline.adapters.configuration import unique_object


def normalize(values):
    if not isinstance(values, dict):
        raise StageError("Настройки должны быть JSON-объектом.")
    allowed = {field.name for field in fields(LayoutSettings)} | {"font_size_px"}
    unknown = set(values) - allowed
    if unknown:
        raise StageError(f"Неизвестные параметры вёрстки: {', '.join(sorted(unknown))}.")
    values = values.copy()
    if "font_size_px" in values:
        if "font_size_pt" in values:
            raise StageError("Задайте размер символов либо в px, либо в pt.")
        px = values.pop("font_size_px")
        if type(px) not in (int, float):
            raise StageError("font_size_px: требуется число.")
        values["font_size_pt"] = px * 0.75
    return values


def load_layout_settings(path, overrides):
    values = {}
    if path is not None:
        try:
            values = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique_object)
        except (OSError, UnicodeError, ValueError) as error:
            raise StageError(f"Не удалось прочитать настройки {path}: {error}") from error
    values = normalize(values)
    LayoutSettings(**values)
    explicit = normalize({k: v for k, v in overrides.items() if v is not None})
    return LayoutSettings(**(values | explicit))
