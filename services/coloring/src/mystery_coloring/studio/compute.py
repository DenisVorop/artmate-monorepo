"""Disposable compute process. Dies if the owning worker disappears."""

import json
import os
import signal
import sys
import threading
import time
from pathlib import Path

from mystery_coloring.delivery.application import GenerateRequest
from mystery_coloring.delivery.cli import build_generator
from mystery_coloring.domain import StageError
from mystery_coloring.layout.domain import LayoutSettings


def watch_parent(parent_pid):
    while True:
        if os.getppid() != parent_pid:
            os.kill(os.getpid(), signal.SIGKILL)
        time.sleep(0.5)


def main():
    source, output, encoded, parent = sys.argv[1:]
    threading.Thread(target=watch_parent, args=(int(parent),), daemon=True).start()
    try:
        settings = LayoutSettings(**json.loads(encoded))
        build_generator(lambda stage: print(json.dumps({"stage": stage}), flush=True)).execute(
            GenerateRequest(Path(source), Path(output), settings)
        )
    except (StageError, ValueError) as error:
        print(json.dumps({"error": str(error)}), flush=True)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
