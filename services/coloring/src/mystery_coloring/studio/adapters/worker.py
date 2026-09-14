"""One worker per local volume, one child per job; no intermediate artifacts."""

import fcntl
import json
import os
import selectors
import signal
import subprocess
import sys
import time
from pathlib import Path

from mystery_coloring.studio.adapters.config import Config
from mystery_coloring.studio.adapters.files import StudioFiles
from mystery_coloring.studio.adapters.repository import SqliteRepository


class Worker:
    def __init__(self, config, repository, files):
        self.config, self.repository, self.files = config, repository, files
        self.stopping = False

    def cleanup(self):
        pages, jobs = self.repository.garbage()
        for page in pages:
            self.files.remove_page(page)
            self.repository.remove_page(page)
        for job in jobs:
            if job["page_id"] not in pages:
                self.files.remove_job(job["page_id"], job["id"])
                self.repository.remove_job(job["id"])
        self.repository.prune_projects()

    @staticmethod
    def terminate(process):
        if process.poll() is None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        process.wait()

    def run_job(self, job):
        self.files.remove_job(job["page_id"], job["id"])
        output = self.files.output(job["page_id"], job["id"])
        command = [
            sys.executable,
            "-m",
            "mystery_coloring.studio.compute",
            str(self.files.source(job["page_id"])),
            str(output),
            json.dumps(job["settings"]),
            str(os.getpid()),
        ]
        environment = {
            k: v
            for k, v in os.environ.items()
            if k
            in {
                "PATH",
                "PYTHONPATH",
                "VIRTUAL_ENV",
                "LANG",
                "LC_ALL",
                "SYSTEMROOT",
                "DYLD_LIBRARY_PATH",
                "LD_LIBRARY_PATH",
            }
        }
        environment["PYTHONPATH"] = (
            str(Path(__file__).parents[3]) + os.pathsep + environment.get("PYTHONPATH", "")
        )
        environment.update(
            PYTHONUNBUFFERED="1",
            PYTHONDONTWRITEBYTECODE="1",
            OMP_NUM_THREADS="1",
            OPENBLAS_NUM_THREADS="1",
        )
        process = None
        status, error = "failed", "Не удалось завершить обработку. Попробуйте другие параметры."
        try:
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                start_new_session=True,
                env=environment,
            )
            started, heartbeat = time.monotonic(), 0
            with selectors.DefaultSelector() as selector:
                selector.register(process.stdout, selectors.EVENT_READ)
                while process.poll() is None:
                    now = time.monotonic()
                    if now - heartbeat >= 1:
                        self.repository.heartbeat()
                        heartbeat = now
                        cancelled = self.repository.job(job["id"])["cancel_requested"]
                        if (
                            cancelled
                            or self.stopping
                            or now - started > self.config.limits.job_seconds
                        ):
                            status = "cancelled" if cancelled else "failed"
                            error = (
                                "Обработка отменена."
                                if cancelled
                                else "Превышено время обработки или worker остановлен."
                            )
                            self.terminate(process)
                            break
                    for key, _ in selector.select(timeout=0.2):
                        line = key.fileobj.readline(4096)
                        if not line:
                            selector.unregister(key.fileobj)
                            continue
                        try:
                            event = json.loads(line)
                            if "stage" in event:
                                self.repository.progress(job["id"], str(event["stage"]))
                            if "error" in event:
                                error = str(event["error"])[:500]
                        except (ValueError, UnicodeError):
                            pass
            if process.returncode == 0:
                size, report = self.files.verify_result(job["page_id"], job["id"])
                final = self.repository.finish(job["id"], "completed", size, report)
                if final["status"] != "completed":
                    self.files.remove_job(job["page_id"], job["id"])
                return final
        except Exception:
            error = "Обработка прервалась. Можно запустить её повторно."
        finally:
            if process is not None:
                self.terminate(process)
                if process.stdout:
                    process.stdout.close()
        self.files.remove_job(job["page_id"], job["id"])
        return self.repository.finish(job["id"], status, error=error)

    def stop(self, *_):
        self.stopping = True

    def run(self):
        with (self.config.data_dir / "worker.lock").open("a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise SystemExit("Only one coloring worker may use this volume") from None
            for interrupted in self.repository.recover():
                self.files.remove_job(interrupted["page_id"], interrupted["id"])
            self.cleanup()
            while not self.stopping:
                self.repository.heartbeat()
                self.cleanup()
                job = self.repository.claim()
                if job:
                    self.run_job(job)
                else:
                    time.sleep(1)


def main():
    config = Config.from_env()
    worker = Worker(
        config,
        SqliteRepository(config.data_dir, config.limits),
        StudioFiles(config.data_dir, config.limits),
    )
    signal.signal(signal.SIGTERM, worker.stop)
    signal.signal(signal.SIGINT, worker.stop)
    worker.run()


if __name__ == "__main__":
    main()
