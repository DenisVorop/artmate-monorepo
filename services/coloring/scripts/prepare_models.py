"""Fetch pinned weights during installation/build, never while processing a page."""

import hashlib
import json
import os
import tempfile
import urllib.request
from pathlib import Path


def prepare(folder, manifest):
    folder.mkdir(parents=True, exist_ok=True)
    for row in manifest["models"]:
        destination = folder / row["filename"]
        if destination.exists():
            with destination.open("rb") as stream:
                valid = (
                    destination.stat().st_size == row["bytes"]
                    and hashlib.file_digest(stream, "sha256").hexdigest() == row["sha256"]
                )
            if not valid:
                raise RuntimeError(
                    f"Existing model is invalid: {destination}. "
                    "Remove it explicitly before retrying."
                )
            print(f"Verified {row['name']}", flush=True)
            continue
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=folder, delete=False) as output:
                temporary = Path(output.name)
                digest = hashlib.sha256()
                count = 0
                with urllib.request.urlopen(row["url"], timeout=60) as response:
                    while chunk := response.read(1024 * 1024):
                        count += len(chunk)
                        if count > row["bytes"]:
                            raise RuntimeError("Model exceeds pinned size")
                        digest.update(chunk)
                        output.write(chunk)
                if count != row["bytes"] or digest.hexdigest() != row["sha256"]:
                    raise RuntimeError("Downloaded model checksum mismatch")
                output.flush()
                os.fsync(output.fileno())
            # Do not replace another concurrent installer or a changed existing file.
            os.link(temporary, destination)
            destination.chmod(0o644)
            print(f"Installed {row['name']}", flush=True)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    package = Path(__file__).resolve().parents[1] / "src/mystery_coloring/details"
    prepare(package / "models", json.loads((package / "assets/face-models.json").read_text()))
