"""Book policies and settings, independent of HTTP, SQL and image libraries."""

from dataclasses import dataclass

from mystery_coloring.domain import StageError
from mystery_coloring.layout.domain import LayoutSettings, validate_page_number

ARTIFACTS = (
    "page.svg",
    "colored-page.svg",
    "page.png",
    "colored-page.png",
    "result.json",
    "manifest.json",
)
DEFAULT_SETTINGS = {"colors": 20, "min_area_mm2": 3.5, "font_size_px": 5.16}


class StudioError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class Limits:
    upload_bytes: int = 25 * 1024 * 1024
    result_bytes: int = 100 * 1024 * 1024
    storage_bytes: int = 2 * 1024 * 1024 * 1024
    queue_size: int = 500
    projects: int = 100
    pages_per_project: int = 100
    preview_seconds: int = 3600
    upload_seconds: int = 300
    job_seconds: int = 600

    def __post_init__(self):
        if any(type(v) is not int or v <= 0 for v in self.__dict__.values()):
            raise ValueError("Limits must be positive integers")
        if self.storage_bytes < max(self.upload_bytes, self.result_bytes):
            raise ValueError("Storage limit is smaller than a single upload or result")


def require_capacity(used: int, added: int, limit: int):
    if used + added > limit:
        raise StudioError("Недостаточно места. Удалите ненужные страницы или проекты.", 409)


def settings(values, *, partial=False):
    if not isinstance(values, dict) or set(values) - set(DEFAULT_SETTINGS):
        raise StudioError("Неизвестные параметры генерации.")
    merged = {**DEFAULT_SETTINGS, **values}
    px = merged["font_size_px"]
    if type(px) not in (int, float):
        raise StudioError("Размер символов должен быть числом.")
    try:
        LayoutSettings(
            colors=merged["colors"], min_area_mm2=merged["min_area_mm2"], font_size_pt=px * 0.75
        )
    except StageError as error:
        raise StudioError(str(error)) from error
    return dict(values) if partial else merged


def pipeline_settings(values):
    merged = settings(values)
    return {
        "colors": merged["colors"],
        "min_area_mm2": merged["min_area_mm2"],
        "font_size_pt": merged["font_size_px"] * 0.75,
        "start_page": 1,
    }


def page_number(value, count=1):
    try:
        validate_page_number(value)
        validate_page_number(value + max(0, count - 1))
    except (StageError, TypeError) as error:
        raise StudioError("Номера страниц должны быть целыми от 1 до 999999.") from error
    return value


def project_name(value):
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > 120:
        raise StudioError("Название должно содержать от 1 до 120 символов.")
    return value.strip()
