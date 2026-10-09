"""Transactional one-way migration from single-image projects to books."""

import json

TABLES = (
    """CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, state TEXT NOT NULL,
      settings TEXT NOT NULL, start_page INTEGER NOT NULL DEFAULT 1, version INTEGER NOT
      NULL DEFAULT 1,
      created_at REAL NOT NULL, updated_at REAL NOT NULL)""",
    """CREATE TABLE pages (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES
      projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL, state TEXT NOT NULL, position INTEGER NOT NULL, created_at
      REAL NOT NULL,
      overrides TEXT NOT NULL DEFAULT '{}', selected_job_id TEXT,
      source_bytes INTEGER NOT NULL DEFAULT 0, reserved_bytes INTEGER NOT NULL DEFAULT
      0,
      source_sha256 TEXT, media_type TEXT, width INTEGER, height INTEGER)""",
    """CREATE TABLE jobs (id TEXT PRIMARY KEY, page_id TEXT NOT NULL REFERENCES pages(id) ON
      DELETE CASCADE,
      settings TEXT NOT NULL, status TEXT NOT NULL, stage TEXT NOT NULL DEFAULT '',
      created_at REAL NOT NULL, started_at REAL, finished_at REAL, expires_at REAL,
      attempts INTEGER NOT NULL DEFAULT 0, cancel_requested INTEGER NOT NULL DEFAULT 0,
      reserved_bytes INTEGER NOT NULL DEFAULT 0, output_bytes INTEGER NOT NULL DEFAULT
      0,
      report TEXT, error TEXT)""",
    """CREATE TABLE downloads (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES
      projects(id) ON DELETE CASCADE,
      page_id TEXT REFERENCES pages(id) ON DELETE CASCADE, job_id TEXT REFERENCES
      jobs(id) ON DELETE CASCADE,
      expires_at REAL NOT NULL)""",
    "CREATE INDEX jobs_queue ON jobs(status,created_at)",
    "CREATE INDEX jobs_page ON jobs(page_id)",
    "CREATE INDEX pages_project ON pages(project_id,position)",
    "CREATE TABLE IF NOT EXISTS worker_status (id INTEGER PRIMARY KEY CHECK(id=1), heartbeat "
    "REAL NOT NULL)",
)


def initialize(db):
    db.execute("BEGIN IMMEDIATE")
    try:
        version = db.execute("PRAGMA user_version").fetchone()[0]
        if version == 3:
            db.commit()
            return
        if version == 2:
            add_artificial_grid(db)
            db.commit()
            return
        if version not in (0, 1):
            raise RuntimeError("Unsupported studio database version")
        existing = db.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='projects'"
        ).fetchone()
        old_pages, old_jobs = [], []
        if existing:
            old_pages = [dict(r) for r in db.execute("SELECT * FROM projects")]
            old_jobs = [dict(r) for r in db.execute("SELECT * FROM jobs")]
            db.execute("DROP TABLE downloads")
            db.execute("DROP TABLE jobs")
            db.execute("DROP TABLE projects")
        for statement in TABLES:
            db.execute(statement)
        for page in old_pages:
            candidates = sorted(
                (j for j in old_jobs if j["project_id"] == page["id"]),
                key=lambda j: j["created_at"],
                reverse=True,
            )
            latest = json.loads(candidates[0]["settings"]) if candidates else {}
            values = {
                "colors": latest.get("colors", 20),
                "min_area_mm2": latest.get("min_area_mm2", 3.5),
                "font_size_px": latest.get("font_size_pt", 3.87) / 0.75,
            }
            selected = page["selected_job_id"] or next(
                (j["id"] for j in candidates if j["status"] == "completed"), None
            )
            db.execute(
                "INSERT INTO projects(id,name,state,settings,start_page,created_at,updated_at) "
                "VALUES(?,?,?,?,?,?,?)",
                (
                    page["id"],
                    page["name"],
                    "ready",
                    json.dumps(values),
                    latest.get("start_page", 1),
                    page["created_at"],
                    page["created_at"],
                ),
            )
            db.execute(
                "INSERT INTO pages(id,project_id,name,state,position,created_at,"
                "selected_job_id,source_bytes,reserved_bytes,source_sha256,media_type,width,"
                "height) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    page["id"],
                    page["id"],
                    page["name"],
                    page["state"],
                    0,
                    page["created_at"],
                    selected,
                    page["source_bytes"],
                    page["reserved_bytes"],
                    page["source_sha256"],
                    page["media_type"],
                    page["width"],
                    page["height"],
                ),
            )
        for job in old_jobs:
            selected = db.execute(
                "SELECT selected_job_id FROM pages WHERE id=?", (job["project_id"],)
            ).fetchone()[0]
            db.execute(
                "INSERT INTO jobs(id,page_id,settings,status,stage,created_at,started_at,"
                "finished_at,expires_at,cancel_requested,reserved_bytes,output_bytes,report,"
                "error) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    job["id"],
                    job["project_id"],
                    job["settings"],
                    job["status"],
                    job["stage"],
                    job["created_at"],
                    job["started_at"],
                    job["finished_at"],
                    None if selected == job["id"] else job["expires_at"],
                    job["cancel_requested"],
                    job["reserved_bytes"] if job["status"] == "running" else 0,
                    job["output_bytes"],
                    job["report"],
                    job["error"],
                ),
            )
        add_artificial_grid(db)
        db.commit()
    except BaseException:
        db.rollback()
        raise


def add_artificial_grid(db):
    """Persist the new option without changing accepted artifacts or job provenance."""
    for row in db.execute("SELECT id,settings FROM projects").fetchall():
        values = json.loads(row["settings"])
        values["artificial_grid"] = True
        db.execute("UPDATE projects SET settings=? WHERE id=?", (json.dumps(values), row["id"]))
    for row in db.execute("SELECT id,settings,report FROM jobs").fetchall():
        values = json.loads(row["settings"])
        report = json.loads(row["report"]) if row["report"] else {}
        values["artificial_grid"] = (
            report.get("algorithm") != "coloring-delivery-v9-continuous-regions"
        )
        db.execute("UPDATE jobs SET settings=? WHERE id=?", (json.dumps(values), row["id"]))
    db.execute("PRAGMA user_version=3")
