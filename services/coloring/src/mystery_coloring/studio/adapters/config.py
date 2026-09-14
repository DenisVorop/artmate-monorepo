"""Environment boundary, separate from existing Artmate settings."""

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

from mystery_coloring.studio.domain import Limits


@dataclass(frozen=True)
class Config:
    data_dir: Path
    public_url: str
    password_hash: str
    limits: Limits = field(default_factory=Limits)

    def __post_init__(self):
        parsed = urlparse(self.public_url)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.path not in {"", "/"}
        ):
            raise ValueError("COLORING_PUBLIC_URL must be an HTTP(S) origin")
        if not re.fullmatch(r"pbkdf2_sha256:600000:[0-9a-f]{32}:[0-9a-f]{64}", self.password_hash):
            raise ValueError("Set COLORING_PASSWORD_HASH using coloring-password")

    @classmethod
    def from_env(cls):
        limits = Limits(
            storage_bytes=int(os.environ.get("COLORING_STORAGE_MB", "2048")) * 1024 * 1024,
            preview_seconds=int(os.environ.get("COLORING_PREVIEW_TTL_SECONDS", "3600")),
            job_seconds=int(os.environ.get("COLORING_JOB_TIMEOUT_SECONDS", "600")),
        )
        return cls(
            Path(os.environ.get("COLORING_DATA_DIR", "data/studio")).resolve(),
            os.environ.get("COLORING_PUBLIC_URL", "http://localhost:3005").rstrip("/"),
            os.environ.get("COLORING_PASSWORD_HASH", ""),
            limits,
        )
