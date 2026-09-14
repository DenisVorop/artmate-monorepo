"""Чтение JSON; аргументы CLI перекрывают только явно заданные поля."""

import json
from dataclasses import fields
from pathlib import Path

from mystery_coloring.domain import StageError
from mystery_coloring.pipeline.domain import PipelineSettings


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise StageError(f"Повторяющийся параметр JSON: {key}.")
        result[key] = value
    return result


def load_settings(path: Path | None, overrides: dict) -> PipelineSettings:
    values = {}
    if path is not None:
        try:
            values = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique_object)
        except (OSError, UnicodeError, ValueError) as error:
            raise StageError(f"Не удалось прочитать настройки {path}: {error}") from error
        if not isinstance(values, dict):
            raise StageError("Настройки должны быть JSON-объектом.")
    allowed = {field.name for field in fields(PipelineSettings)}
    unknown = (set(values) | set(overrides)) - allowed
    if unknown:
        raise StageError(f"Неизвестные параметры: {', '.join(sorted(unknown))}.")
    # Ошибки JSON проверяются до перекрытия CLI: опечатки не скрываются.
    PipelineSettings(**values)
    return PipelineSettings(**(values | {k: v for k, v in overrides.items() if v is not None}))
