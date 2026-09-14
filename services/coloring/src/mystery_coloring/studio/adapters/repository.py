"""SQLite book/page repository; atomic queue, reservations and download leases."""

import json
import sqlite3
import time
import uuid
from contextlib import closing, contextmanager

from mystery_coloring.delivery.domain import ALGORITHM_VERSION
from mystery_coloring.studio.adapters.schema import initialize
from mystery_coloring.studio.domain import (
    StudioError,
    page_number,
    pipeline_settings,
    project_name,
    require_capacity,
    settings,
)


def value(row):
    if row is None:
        raise StudioError("Проект, страница или результат не найдены.", 404)
    result = dict(row)
    for key in ("settings", "overrides", "report"):
        if result.get(key):
            result[key] = json.loads(result[key])
    return result


class SqliteRepository:
    def __init__(self, directory, limits, clock=time.time):
        directory.mkdir(parents=True, exist_ok=True)
        self.path, self.limits, self.clock = directory / "studio.sqlite3", limits, clock
        with closing(self.connect()) as db:
            db.execute("PRAGMA journal_mode=WAL")
            initialize(db)

    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        return db

    @contextmanager
    def transaction(self):
        db = self.connect()
        try:
            db.execute("BEGIN IMMEDIATE")
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    @staticmethod
    def used(db):
        return (
            db.execute("SELECT COALESCE(SUM(source_bytes+reserved_bytes),0) FROM pages").fetchone()[
                0
            ]
            + db.execute(
                "SELECT COALESCE(SUM(output_bytes+reserved_bytes),0) FROM jobs"
            ).fetchone()[0]
        )

    @staticmethod
    def get_project(db, project_id):
        return value(
            db.execute(
                "SELECT * FROM projects WHERE id=? AND state='ready'", (project_id,)
            ).fetchone()
        )

    @staticmethod
    def get_page(db, page_id):
        return value(
            db.execute(
                "SELECT p.* FROM pages p JOIN projects b ON b.id=p.project_id WHERE p.id=? AND "
                "p.state='ready' AND b.state='ready'",
                (page_id,),
            ).fetchone()
        )

    def touch(self, db, project_id):
        db.execute(
            "UPDATE projects SET version=version+1,updated_at=? WHERE id=?",
            (self.clock(), project_id),
        )

    @staticmethod
    def check_version(project, expected):
        if expected is not None and (type(expected) is not int or project["version"] != expected):
            raise StudioError("Проект изменился. Обновите страницу и повторите действие.", 409)

    def create_project(self, values):
        if not isinstance(values, dict) or set(values) - {"name", "settings", "start_page"}:
            raise StudioError("Некорректный проект.")
        name = project_name(values.get("name"))
        defaults = settings(values.get("settings", {}))
        start = page_number(values.get("start_page", 1))
        project_id, now = uuid.uuid4().hex, self.clock()
        with self.transaction() as db:
            if db.execute("SELECT count(*) FROM projects").fetchone()[0] >= self.limits.projects:
                raise StudioError("Достигнут лимит проектов.", 409)
            db.execute(
                "INSERT INTO projects(id,name,state,settings,start_page,created_at,updated_at) "
                "VALUES(?,?,?,?,?,?,?)",
                (project_id, name, "ready", json.dumps(defaults), start, now, now),
            )
        return self.project(project_id)

    def update_project(self, project_id, values):
        if not isinstance(values, dict) or set(values) - {
            "name",
            "settings",
            "start_page",
            "version",
        }:
            raise StudioError("Неизвестные параметры проекта.")
        with self.transaction() as db:
            p = self.get_project(db, project_id)
            self.check_version(p, values.get("version"))
            count = db.execute(
                "SELECT count(*) FROM pages WHERE project_id=? AND state!='deleting'", (project_id,)
            ).fetchone()[0]
            db.execute(
                "UPDATE projects SET name=?,settings=?,start_page=? WHERE id=?",
                (
                    project_name(values.get("name", p["name"])),
                    json.dumps(settings(values.get("settings", p["settings"]))),
                    page_number(values.get("start_page", p["start_page"]), count),
                    project_id,
                ),
            )
            self.touch(db, project_id)
        return self.project(project_id)

    def projects(self):
        with closing(self.connect()) as db:
            return [
                value(r)
                for r in db.execute(
                    "SELECT b.*, (SELECT count(*) FROM pages p WHERE p.project_id=b.id AND "
                    "p.state='ready') AS page_count, (SELECT count(*) FROM pages p WHERE "
                    "p.project_id=b.id AND p.state='ready' AND p.selected_job_id IS NOT NULL) "
                    "AS ready_count FROM projects b WHERE b.state='ready' ORDER BY "
                    "b.updated_at DESC LIMIT ?",
                    (self.limits.projects,),
                )
            ]

    def project(self, project_id):
        with closing(self.connect()) as db:
            p = self.get_project(db, project_id)
            pages = [
                value(r)
                for r in db.execute(
                    "SELECT * FROM pages WHERE project_id=? AND state!='deleting' ORDER BY "
                    "position,created_at,id",
                    (project_id,),
                )
            ]
            for index, page in enumerate(pages):
                page["number"] = p["start_page"] + index
                page["settings"] = {**p["settings"], **page["overrides"]}
                page["jobs"] = [
                    value(r)
                    for r in db.execute(
                        "SELECT * FROM jobs WHERE page_id=? AND status!='deleting' AND "
                        "(expires_at IS NULL OR expires_at>?) ORDER BY created_at DESC,rowid "
                        "DESC LIMIT 20",
                        (page["id"], self.clock()),
                    )
                ]
                page["outdated"] = not any(
                    j["status"] == "completed"
                    and (j.get("report") or {}).get("algorithm") == ALGORITHM_VERSION
                    and (j["expires_at"] is None or j["expires_at"] > self.clock())
                    and self.same_settings(j["settings"], pipeline_settings(page["settings"]))
                    for j in page["jobs"]
                )
            p["pages"] = pages
            p["page_count"] = len(pages)
            return p

    @staticmethod
    def same_settings(left, right):
        return all(left[k] == right[k] for k in ("colors", "min_area_mm2", "font_size_pt"))

    def page(self, page_id):
        with closing(self.connect()) as db:
            return self.get_page(db, page_id)

    def reserve_page(self, project_id, name):
        now, page_id = self.clock(), uuid.uuid4().hex
        with self.transaction() as db:
            p = self.get_project(db, project_id)
            count = db.execute(
                "SELECT count(*) FROM pages WHERE project_id=?", (project_id,)
            ).fetchone()[0]
            if count >= self.limits.pages_per_project:
                raise StudioError("Достигнут лимит страниц проекта.", 409)
            page_number(p["start_page"], count + 1)
            require_capacity(self.used(db), self.limits.upload_bytes, self.limits.storage_bytes)
            position = db.execute(
                "SELECT COALESCE(MAX(position),-1)+1 FROM pages WHERE project_id=?", (project_id,)
            ).fetchone()[0]
            db.execute(
                "INSERT INTO pages(id,project_id,name,state,position,created_at,"
                "reserved_bytes) VALUES(?,?,?,?,?,?,?)",
                (
                    page_id,
                    project_id,
                    name.strip()[:120] or "Изображение",
                    "uploading",
                    position,
                    now,
                    self.limits.upload_bytes,
                ),
            )
            self.touch(db, project_id)
        return {"id": page_id, "project_id": project_id}

    def ready_page(self, page_id, source):
        with self.transaction() as db:
            db.execute(
                "UPDATE pages SET state='ready',source_bytes=?,reserved_bytes=0,"
                "source_sha256=?,media_type=?,width=?,height=? WHERE id=? AND state='uploading'",
                (
                    source["bytes"],
                    source["sha256"],
                    source["media_type"],
                    source["width"],
                    source["height"],
                    page_id,
                ),
            )
            page = self.get_page(db, page_id)
            self.touch(db, page["project_id"])
        return page

    def update_page(self, page_id, values):
        if not isinstance(values, dict) or set(values) - {"name", "overrides"}:
            raise StudioError("Неизвестные параметры страницы.")
        with self.transaction() as db:
            p = self.get_page(db, page_id)
            db.execute(
                "UPDATE pages SET name=?,overrides=? WHERE id=?",
                (
                    project_name(values.get("name", p["name"])),
                    json.dumps(settings(values.get("overrides", p["overrides"]), partial=True)),
                    page_id,
                ),
            )
            self.touch(db, p["project_id"])
        return self.page(page_id)

    def reorder(self, project_id, ids, version):
        if (
            not isinstance(ids, list)
            or any(not isinstance(i, str) for i in ids)
            or len(set(ids)) != len(ids)
        ):
            raise StudioError("Некорректный порядок страниц.")
        with self.transaction() as db:
            p = self.get_project(db, project_id)
            self.check_version(p, version)
            current = [
                r[0]
                for r in db.execute(
                    "SELECT id FROM pages WHERE project_id=? AND state!='deleting'", (project_id,)
                )
            ]
            if set(current) != set(ids):
                raise StudioError("Список страниц изменился. Обновите проект.", 409)
            for pos, ident in enumerate(ids):
                db.execute("UPDATE pages SET position=? WHERE id=?", (pos, ident))
            self.touch(db, project_id)
        return self.project(project_id)

    def job(self, job_id):
        with closing(self.connect()) as db:
            return value(db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())

    def enqueue(self, project_id, page_id=None, force=False):
        now = self.clock()
        ids = []
        with self.transaction() as db:
            project = self.get_project(db, project_id)
            pages = [
                value(r)
                for r in db.execute(
                    "SELECT * FROM pages WHERE project_id=? AND state='ready' ORDER BY "
                    "position,created_at,id",
                    (project_id,),
                )
            ]
            if page_id:
                pages = [p for p in pages if p["id"] == page_id]
                if not pages:
                    raise StudioError("Страница не найдена.", 404)
            pending = []
            for page in pages:
                if db.execute(
                    "SELECT 1 FROM jobs WHERE page_id=? AND status IN ('queued','running')",
                    (page["id"],),
                ).fetchone():
                    continue
                desired = pipeline_settings({**project["settings"], **page["overrides"]})
                completed = [
                    value(j)
                    for j in db.execute(
                        "SELECT * FROM jobs WHERE page_id=? AND status='completed' AND "
                        "(expires_at IS NULL OR expires_at>?)",
                        (page["id"], now),
                    )
                ]
                if not force and any(
                    self.same_settings(j["settings"], desired)
                    and (j.get("report") or {}).get("algorithm") == ALGORITHM_VERSION
                    for j in completed
                ):
                    continue
                pending.append((page, desired))
            count = db.execute(
                "SELECT count(*) FROM jobs WHERE status IN ('queued','running')"
            ).fetchone()[0]
            if count + len(pending) > self.limits.queue_size:
                raise StudioError("Очередь заполнена. Попробуйте позже.", 429)
            for page, desired in pending:
                db.execute(
                    "UPDATE jobs SET expires_at=? WHERE page_id=? AND status NOT IN ('queued',"
                    "'running') AND id!=COALESCE(?,'')",
                    (now, page["id"], page["selected_job_id"]),
                )
                ident = uuid.uuid4().hex
                ids.append(ident)
                db.execute(
                    "INSERT INTO jobs(id,page_id,settings,status,created_at) VALUES(?,?,?,?,?)",
                    (ident, page["id"], json.dumps(desired), "queued", now),
                )
            if pending:
                self.touch(db, project_id)
        return [self.job(ident) for ident in ids]

    def claim(self):
        with self.transaction() as db:
            if db.execute("SELECT 1 FROM jobs WHERE status='running'").fetchone():
                return None
            if self.used(db) + self.limits.result_bytes > self.limits.storage_bytes:
                return None
            row = db.execute(
                "SELECT j.* FROM jobs j JOIN pages p ON p.id=j.page_id JOIN projects b ON "
                "b.id=p.project_id WHERE j.status='queued' AND p.state='ready' AND "
                "b.state='ready' ORDER BY j.created_at,p.position,j.rowid LIMIT 1"
            ).fetchone()
            if row is None:
                return None
            db.execute(
                "UPDATE jobs SET status='running',stage='Подготовка',started_at=?,"
                "reserved_bytes=?,attempts=attempts+1 WHERE id=?",
                (self.clock(), self.limits.result_bytes, row["id"]),
            )
            return value(db.execute("SELECT * FROM jobs WHERE id=?", (row["id"],)).fetchone())

    def heartbeat(self):
        with self.transaction() as db:
            db.execute(
                "INSERT INTO worker_status VALUES(1,?) ON CONFLICT(id) DO UPDATE SET "
                "heartbeat=excluded.heartbeat",
                (self.clock(),),
            )

    def progress(self, job_id, stage):
        with self.transaction() as db:
            db.execute(
                "UPDATE jobs SET stage=? WHERE id=? AND status='running'", (stage[:120], job_id)
            )

    def cancel(self, job_id):
        with self.transaction() as db:
            job = value(db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())
            if job["status"] == "queued":
                db.execute(
                    "UPDATE jobs SET status='cancelled',reserved_bytes=0,finished_at=?,"
                    "expires_at=? WHERE id=?",
                    (self.clock(), self.clock() + self.limits.preview_seconds, job_id),
                )
            elif job["status"] == "running":
                db.execute("UPDATE jobs SET cancel_requested=1 WHERE id=?", (job_id,))
        return self.job(job_id)

    def cancel_project(self, project_id):
        with self.transaction() as db:
            self.get_project(db, project_id)
            db.execute(
                "UPDATE jobs SET cancel_requested=1 WHERE status='running' AND page_id IN "
                "(SELECT id FROM pages WHERE project_id=?)",
                (project_id,),
            )
            db.execute(
                "UPDATE jobs SET status='cancelled',reserved_bytes=0,finished_at=?,"
                "expires_at=? WHERE status='queued' AND page_id IN (SELECT id FROM pages WHERE "
                "project_id=?)",
                (self.clock(), self.clock() + self.limits.preview_seconds, project_id),
            )
        return self.project(project_id)

    def finish(self, job_id, status, output_bytes=0, report=None, error=None):
        with self.transaction() as db:
            j = value(db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())
            if j["status"] != "running":
                raise StudioError("Задание уже завершено.", 409)
            if j["cancel_requested"]:
                status, output_bytes, report = "cancelled", 0, None
            page = self.get_page(db, j["page_id"])
            expires = self.clock() + self.limits.preview_seconds
            if status == "completed" and page["selected_job_id"] is None:
                db.execute("UPDATE pages SET selected_job_id=? WHERE id=?", (job_id, page["id"]))
                expires = None
            db.execute(
                "UPDATE jobs SET status=?,stage=?,reserved_bytes=0,output_bytes=?,report=?,"
                "error=?,finished_at=?,expires_at=? WHERE id=?",
                (
                    status,
                    "Готово" if status == "completed" else "",
                    output_bytes,
                    json.dumps(report) if report else None,
                    error,
                    self.clock(),
                    expires,
                    job_id,
                ),
            )
        return self.job(job_id)

    def accept(self, project_id, page_id=None):
        with self.transaction() as db:
            self.get_project(db, project_id)
            pages = [
                value(r)
                for r in db.execute(
                    "SELECT * FROM pages WHERE project_id=? AND state='ready'", (project_id,)
                )
            ]
            if page_id:
                pages = [p for p in pages if p["id"] == page_id]
                if not pages:
                    raise StudioError("Страница не найдена.", 404)
            for page in pages:
                j = db.execute(
                    "SELECT * FROM jobs WHERE page_id=? AND status='completed' AND (expires_at "
                    "IS NULL OR expires_at>?) ORDER BY created_at DESC,rowid DESC LIMIT 1",
                    (page["id"], self.clock()),
                ).fetchone()
                if j is None:
                    continue
                db.execute(
                    "UPDATE jobs SET expires_at=? WHERE page_id=? AND expires_at IS NULL",
                    (self.clock(), page["id"]),
                )
                db.execute("UPDATE jobs SET expires_at=NULL WHERE id=?", (j["id"],))
                db.execute("UPDATE pages SET selected_job_id=? WHERE id=?", (j["id"], page["id"]))
            self.touch(db, project_id)
        return self.project(project_id)

    def protected(self, db, project_id, page_id=None):
        return db.execute(
            "SELECT 1 FROM downloads WHERE project_id=? AND expires_at>? AND (? IS NULL OR "
            "page_id IS NULL OR page_id=?)",
            (project_id, self.clock(), page_id, page_id),
        ).fetchone()

    def mark_deleting(self, project_id):
        with self.transaction() as db:
            self.get_project(db, project_id)
            pages = [
                r[0] for r in db.execute("SELECT id FROM pages WHERE project_id=?", (project_id,))
            ]
            active = db.execute(
                "SELECT 1 FROM jobs j JOIN pages p ON p.id=j.page_id WHERE p.project_id=? AND "
                "j.status IN ('queued','running')",
                (project_id,),
            ).fetchone()
            uploading = db.execute(
                "SELECT 1 FROM pages WHERE project_id=? AND state='uploading'", (project_id,)
            ).fetchone()
            if active or uploading or self.protected(db, project_id):
                raise StudioError("Дождитесь загрузки, остановки обработки или скачивания.", 409)
            db.execute("UPDATE projects SET state='deleting' WHERE id=?", (project_id,))
            db.execute("UPDATE pages SET state='deleting' WHERE project_id=?", (project_id,))
            return pages

    def mark_page_deleting(self, page_id):
        with self.transaction() as db:
            p = self.get_page(db, page_id)
            if db.execute(
                "SELECT 1 FROM jobs WHERE page_id=? AND status IN ('queued','running')", (page_id,)
            ).fetchone() or self.protected(db, p["project_id"], page_id):
                raise StudioError("Дождитесь остановки обработки или завершения скачивания.", 409)
            db.execute("UPDATE pages SET state='deleting' WHERE id=?", (page_id,))
            self.touch(db, p["project_id"])

    def remove_page(self, page_id):
        with self.transaction() as db:
            db.execute("DELETE FROM pages WHERE id=?", (page_id,))

    def remove_project(self, project_id):
        with self.transaction() as db:
            db.execute("DELETE FROM projects WHERE id=? AND state='deleting'", (project_id,))

    def recover(self):
        with self.transaction() as db:
            jobs = [value(r) for r in db.execute("SELECT * FROM jobs WHERE status='running'")]
            for j in jobs:
                status = (
                    "cancelled"
                    if j["cancel_requested"]
                    else "queued"
                    if j["attempts"] < 2
                    else "failed"
                )
                db.execute(
                    "UPDATE jobs SET status=?,reserved_bytes=0,stage=?,error=?,expires_at=? "
                    "WHERE id=?",
                    (
                        status,
                        "",
                        "Обработка прервалась после повторного запуска."
                        if status == "failed"
                        else None,
                        self.clock() + self.limits.preview_seconds if status != "queued" else None,
                        j["id"],
                    ),
                )
            return jobs

    def garbage(self):
        now = self.clock()
        with self.transaction() as db:
            db.execute("DELETE FROM downloads WHERE expires_at<=?", (now,))
            pages = []
            jobs = []
            for r in db.execute(
                "SELECT * FROM pages WHERE state='deleting' OR (state='uploading' AND "
                "created_at<=?)",
                (now - self.limits.upload_seconds,),
            ):
                p = value(r)
                if self.protected(db, p["project_id"], p["id"]):
                    continue
                pages.append(p["id"])
            for r in db.execute(
                "SELECT j.id,j.page_id,p.project_id FROM jobs j JOIN pages p ON p.id=j.page_id "
                "WHERE j.expires_at<=? AND j.status NOT IN ('queued','running')",
                (now,),
            ):
                j = dict(r)
                if not self.protected(db, j["project_id"], j["page_id"]):
                    jobs.append(j)
            for ident in pages:
                db.execute("UPDATE pages SET state='deleting' WHERE id=?", (ident,))
            for j in jobs:
                db.execute("UPDATE jobs SET status='deleting' WHERE id=?", (j["id"],))
            return pages, jobs

    def remove_job(self, job_id):
        with self.transaction() as db:
            db.execute("DELETE FROM jobs WHERE id=? AND status='deleting'", (job_id,))

    def prune_projects(self):
        with self.transaction() as db:
            db.execute(
                "DELETE FROM projects WHERE state='deleting' AND NOT EXISTS(SELECT 1 FROM "
                "pages p WHERE p.project_id=projects.id)"
            )

    def usage(self):
        with closing(self.connect()) as db:
            heartbeat = db.execute("SELECT heartbeat FROM worker_status WHERE id=1").fetchone()
            used = self.used(db)
            queued = db.execute("SELECT count(*) FROM jobs WHERE status='queued'").fetchone()[0]
            running = db.execute("SELECT count(*) FROM jobs WHERE status='running'").fetchone()[0]
            return {
                "used_bytes": used,
                "limit_bytes": self.limits.storage_bytes,
                "queue": queued + running,
                "worker_online": bool(heartbeat and self.clock() - heartbeat[0] < 15),
                "storage_blocked": bool(
                    queued
                    and not running
                    and used + self.limits.result_bytes > self.limits.storage_bytes
                ),
                "preview_seconds": self.limits.preview_seconds,
                "upload_bytes": self.limits.upload_bytes,
                "pages_per_project": self.limits.pages_per_project,
            }

    def new_lease(self, db, project_id, page_id=None, job_id=None):
        token = uuid.uuid4().hex
        db.execute(
            "INSERT INTO downloads VALUES(?,?,?,?,?)",
            (token, project_id, page_id, job_id, self.clock() + 300),
        )
        return token

    def lease_page(self, page_id, job_id=None, source=False):
        with self.transaction() as db:
            p = self.get_page(db, page_id)
            project = self.get_project(db, p["project_id"])
            ids = [
                r[0]
                for r in db.execute(
                    "SELECT id FROM pages WHERE project_id=? AND state!='deleting' ORDER BY "
                    "position,created_at,id",
                    (project["id"],),
                )
            ]
            p["number"] = project["start_page"] + ids.index(page_id)
            job = None
            if not source:
                job = value(
                    db.execute(
                        "SELECT * FROM jobs WHERE id=? AND page_id=? AND status='completed'",
                        (job_id or p["selected_job_id"], page_id),
                    ).fetchone()
                )
                if job["expires_at"] is not None and job["expires_at"] <= self.clock():
                    raise StudioError("Срок хранения результата истёк.", 410)
            return p, job, self.new_lease(db, project["id"], page_id, job["id"] if job else None)

    def lease_export(self, project_id):
        with self.transaction() as db:
            p = self.get_project(db, project_id)
            pages = [
                value(r)
                for r in db.execute(
                    "SELECT * FROM pages WHERE project_id=? AND state!='deleting' ORDER BY "
                    "position,created_at,id",
                    (project_id,),
                )
            ]
            if not pages or any(r["state"] != "ready" or not r["selected_job_id"] for r in pages):
                raise StudioError("Дождитесь готового результата для каждой страницы.", 409)
            items = []
            for index, page in enumerate(pages):
                job = value(
                    db.execute(
                        "SELECT * FROM jobs WHERE id=? AND status='completed'",
                        (page["selected_job_id"],),
                    ).fetchone()
                )
                items.append({"page": page, "job": job, "number": p["start_page"] + index})
            return items, self.new_lease(db, project_id)

    def renew_download(self, token):
        with self.transaction() as db:
            db.execute("UPDATE downloads SET expires_at=? WHERE id=?", (self.clock() + 300, token))

    def release_download(self, token):
        with self.transaction() as db:
            db.execute("DELETE FROM downloads WHERE id=?", (token,))
