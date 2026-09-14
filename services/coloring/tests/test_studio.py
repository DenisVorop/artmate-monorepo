"""Book workflows, bounded queue, persistent pages and streamed print exports."""

import io
import json
import sqlite3
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from xml.etree import ElementTree as ET
from zipfile import ZipFile

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from mystery_coloring.delivery.domain import ALGORITHM_VERSION
from mystery_coloring.studio.adapters.api import create_app
from mystery_coloring.studio.adapters.auth import issue_session, password_hash, valid_session
from mystery_coloring.studio.adapters.config import Config
from mystery_coloring.studio.adapters.files import StudioFiles
from mystery_coloring.studio.adapters.repository import SqliteRepository
from mystery_coloring.studio.adapters.worker import Worker
from mystery_coloring.studio.application import Studio
from mystery_coloring.studio.domain import Limits, StudioError


@pytest.fixture(scope="module")
def secret():
    return password_hash("test-studio-password")


def image_bytes(color="white"):
    output = io.BytesIO()
    Image.new("RGB", (30, 40), color).save(output, format="PNG")
    return output.getvalue()


@pytest.fixture
def context(tmp_path, secret):
    config = Config(tmp_path, "http://testserver", secret)
    repo = SqliteRepository(tmp_path, config.limits)
    files = StudioFiles(tmp_path, config.limits)
    return config, repo, files, Studio(repo, files, config.limits)


def book(repo, studio, count=1):
    project = repo.create_project({"name": "Book"})
    pages = [
        studio.upload(project["id"], f"image-{i}", io.BytesIO(image_bytes())) for i in range(count)
    ]
    return project, pages


def test_session_expiry_tamper_and_studio_isolation(secret):
    token = issue_session(secret, 1000)
    assert valid_session(token, secret, 1001)
    assert not valid_session(token, secret, 1000 + 12 * 3600 + 1)
    assert not valid_session(token + "x", secret, 1001)
    assert not valid_session(token, "other studio", 1001)


def test_book_and_sources_are_persistent_and_invalid_upload_is_cleaned(context):
    config, repo, files, studio = context
    project, pages = book(repo, studio, 2)
    with pytest.raises(StudioError):
        studio.upload(project["id"], "invalid", io.BytesIO(b"bad"))
    assert repo.usage()["used_bytes"] == 2 * len(image_bytes())
    assert len(list(files.root.iterdir())) == 2
    repo.clock = lambda: project["created_at"] + 100 * 86400
    Worker(config, repo, files).cleanup()
    assert len(repo.project(project["id"])["pages"]) == 2
    assert all(files.source(p["id"]).exists() for p in pages)


def test_batch_25_admission_does_not_reserve_25_max_results(context):
    config, repo, _, studio = context
    project, pages = book(repo, studio, 25)
    jobs = repo.enqueue(project["id"])
    assert len(jobs) == 25
    assert repo.usage()["used_bytes"] == 25 * len(image_bytes())
    assert repo.enqueue(project["id"]) == []
    with ThreadPoolExecutor(2) as executor:
        claimed = list(executor.map(lambda _: repo.claim(), range(2)))
    assert sum(j is not None for j in claimed) == 1
    assert repo.usage()["used_bytes"] == 25 * len(image_bytes()) + config.limits.result_bytes


def test_queue_waits_for_space_and_resumes(context):
    config, repo, _, studio = context
    repo.limits = replace(
        config.limits, storage_bytes=config.limits.result_bytes, upload_bytes=1000
    )
    project, _ = book(repo, studio)
    repo.enqueue(project["id"])
    assert repo.claim() is None
    assert repo.usage()["storage_blocked"]
    repo.limits = config.limits
    assert repo.claim()["status"] == "running"


def test_settings_inheritance_overrides_and_reorder_without_new_jobs(context):
    _, repo, _, studio = context
    project, pages = book(repo, studio, 2)
    repo.update_project(
        project["id"],
        {"settings": {"colors": 19, "min_area_mm2": 4, "font_size_px": 6}, "start_page": 24},
    )
    repo.update_page(pages[1]["id"], {"overrides": {"min_area_mm2": 7}})
    current = repo.project(project["id"])
    assert current["pages"][0]["settings"]["min_area_mm2"] == 4
    assert current["pages"][1]["settings"] == {"colors": 19, "min_area_mm2": 7, "font_size_px": 6}
    ordered = repo.reorder(project["id"], [p["id"] for p in reversed(pages)], current["version"])
    assert [p["number"] for p in ordered["pages"]] == [24, 25]
    assert not any(p["jobs"] for p in ordered["pages"])
    with pytest.raises(StudioError):
        repo.reorder(project["id"], [p["id"] for p in pages], current["version"])
    with pytest.raises(StudioError):
        repo.reorder(project["id"], [pages[0]["id"]] * 2, ordered["version"])
    jobs = repo.enqueue(project["id"])
    assert jobs[0]["page_id"] == pages[1]["id"]
    assert all(j["settings"]["start_page"] == 1 for j in jobs)
    assert jobs[0]["settings"]["font_size_pt"] == 4.5
    repo.update_page(pages[1]["id"], {"overrides": {}})
    assert repo.project(project["id"])["pages"][0]["settings"]["min_area_mm2"] == 4


def test_first_result_auto_saved_and_replacement_requires_accept(context):
    config, repo, files, studio = context
    project, pages = book(repo, studio)
    first = repo.enqueue(project["id"])[0]
    repo.claim()
    repo.finish(first["id"], "completed", 1, {"quality": {}, "algorithm": ALGORITHM_VERSION})
    assert repo.page(pages[0]["id"])["selected_job_id"] == first["id"]
    assert repo.job(first["id"])["expires_at"] is None
    assert repo.enqueue(project["id"]) == []
    second = repo.enqueue(project["id"], force=True)[0]
    repo.claim()
    repo.finish(second["id"], "completed", 1, {"quality": {}, "algorithm": ALGORITHM_VERSION})
    assert repo.page(pages[0]["id"])["selected_job_id"] == first["id"]
    assert repo.job(second["id"])["expires_at"] is not None
    repo.accept(project["id"])
    assert repo.page(pages[0]["id"])["selected_job_id"] == second["id"]
    Worker(config, repo, files).cleanup()
    assert repo.job(second["id"])["expires_at"] is None
    with pytest.raises(StudioError):
        repo.job(first["id"])


def test_failed_page_does_not_stop_rest_and_cancel_preserves_saved_results(context):
    _, repo, _, studio = context
    project, pages = book(repo, studio, 3)
    jobs = repo.enqueue(project["id"])
    repo.claim()
    repo.finish(jobs[0]["id"], "failed", error="bad image")
    assert repo.claim()["id"] == jobs[1]["id"]
    repo.finish(jobs[1]["id"], "completed", 1, {"quality": {}, "algorithm": ALGORITHM_VERSION})
    repo.cancel_project(project["id"])
    assert repo.job(jobs[2]["id"])["status"] == "cancelled"
    assert repo.page(pages[1]["id"])["selected_job_id"] == jobs[1]["id"]
    assert len(repo.enqueue(project["id"])) == 2


def test_restart_requeues_interrupted_job_but_caps_automatic_retries(context):
    config, repo, files, studio = context
    project, pages = book(repo, studio, 2)
    jobs = repo.enqueue(project["id"])
    claimed = repo.claim()
    output = files.output(pages[0]["id"], claimed["id"])
    output.mkdir(parents=True)
    (output / "partial").write_text("unfinished")
    for interrupted in repo.recover():
        files.remove_job(interrupted["page_id"], interrupted["id"])
    assert not output.exists()
    assert repo.claim()["id"] == claimed["id"]
    repo.recover()
    assert repo.job(claimed["id"])["status"] == "failed"
    assert repo.claim()["id"] == jobs[1]["id"]


@pytest.mark.parametrize("cancel", [False, True])
def test_worker_timeout_or_cancel_kills_child_and_removes_partial(context, monkeypatch, cancel):
    config, repo, files, studio = context
    config = replace(config, limits=replace(config.limits, job_seconds=1))
    project, pages = book(repo, studio)
    job = repo.enqueue(project["id"])[0]
    claimed = repo.claim()
    if cancel:
        repo.cancel(job["id"])
    actual = subprocess.Popen
    children = []

    def fake_compute(command, **kwargs):
        output = files.output(pages[0]["id"], job["id"])
        output.mkdir(parents=True)
        (output / "partial").write_text("x")
        child = actual([sys.executable, "-c", "import time; time.sleep(30)"], **kwargs)
        children.append(child)
        return child

    monkeypatch.setattr(subprocess, "Popen", fake_compute)
    result = Worker(config, repo, files).run_job(claimed)
    assert result["status"] == ("cancelled" if cancel else "failed")
    assert children[0].poll() is not None
    assert not files.output(pages[0]["id"], job["id"]).exists()
    assert repo.usage()["used_bytes"] == len(image_bytes())


def test_export_lease_protects_all_pages_and_expired_previews(context):
    config, repo, files, studio = context
    project, pages = book(repo, studio, 2)
    jobs = repo.enqueue(project["id"])
    for job in jobs:
        repo.claim()
        repo.finish(job["id"], "completed", 1, {"quality": {}, "algorithm": ALGORITHM_VERSION})
    items, lease = repo.lease_export(project["id"])
    assert len(items) == 2
    with pytest.raises(StudioError):
        studio.delete(project["id"])
    with pytest.raises(StudioError):
        studio.delete_page(pages[0]["id"])
    repo.release_download(lease)
    studio.delete(project["id"])
    assert repo.projects() == []
    assert repo.usage()["used_bytes"] == 0
    assert not list(files.root.iterdir())


def test_source_lease_and_deleting_project_reject_new_downloads(context):
    _, repo, _, studio = context
    project, pages = book(repo, studio)
    _, _, lease = repo.lease_page(pages[0]["id"], source=True)
    with pytest.raises(StudioError):
        studio.delete(project["id"])
    repo.release_download(lease)
    repo.mark_deleting(project["id"])
    with pytest.raises(StudioError):
        repo.lease_page(pages[0]["id"], source=True)


def test_api_auth_validation_and_upload_limits(tmp_path, secret):
    app = create_app(Config(tmp_path, "http://testserver", secret, Limits(upload_bytes=1000)))
    with TestClient(app) as client:
        assert client.get("/api/studio/projects").status_code == 401
        assert client.post("/api/studio/session", json={"password": "wrong"}).status_code == 401
        login = client.post("/api/studio/session", json={"password": "test-studio-password"})
        assert "HttpOnly" in login.headers["set-cookie"]
        assert "SameSite=strict" in login.headers["set-cookie"]
        assert (
            client.post(
                "/api/studio/projects",
                json={"name": "Book"},
                headers={"Origin": "https://foreign.test"},
            ).status_code
            == 403
        )
        assert client.post("/api/studio/projects", json={"name": ""}).status_code == 400
        project = client.post("/api/studio/projects", json={"name": "Book"}).json()
        url = f"/api/studio/projects/{project['id']}/pages"
        assert client.post(url, content=b"x" * 1001).status_code == 413
        assert client.post(url, content=iter([b"x" * 501, b"x" * 501])).status_code == 413
        assert (
            client.patch(
                f"/api/studio/projects/{project['id']}", json={"settings": {"colors": 36}}
            ).status_code
            == 400
        )
        assert client.get(f"/api/studio/projects/{project['id']}/archive").status_code == 409
        assert app.state.repository.usage()["used_bytes"] == 0


def test_real_25_page_book_generation_and_numbered_svg_png_exports(tmp_path, secret):
    config = Config(tmp_path, "http://testserver", secret)
    app = create_app(config)
    repo, files = app.state.repository, app.state.files
    with TestClient(app) as client:
        client.cookies.set("coloring_session", issue_session(secret), path="/api/studio")
        project = client.post("/api/studio/projects", json={"name": "25 pages"}).json()
        ident = project["id"]
        for i in range(25):
            response = client.post(
                f"/api/studio/projects/{ident}/pages?name=image-{i:02}", content=image_bytes()
            )
            assert response.status_code == 201
        queued = client.post(f"/api/studio/projects/{ident}/generate", json={})
        assert queued.json() == {"queued": 25}
        worker = Worker(config, repo, files)
        for _ in range(25):
            job = repo.claim()
            result = worker.run_job(job)
            assert result["status"] == "completed", result
            assert result["expires_at"] is None
        current = client.get(f"/api/studio/projects/{ident}").json()
        assert len(current["pages"]) == 25
        assert all(p["selected_job_id"] and not p["outdated"] for p in current["pages"])
        assert client.post(f"/api/studio/projects/{ident}/generate", json={}).json() == {
            "queued": 0
        }
        archive = client.get(f"/api/studio/projects/{ident}/archive")
        assert archive.status_code == 200
        with ZipFile(io.BytesIO(archive.content)) as zipped:
            assert len(zipped.namelist()) == 25
            assert zipped.testzip() is None
            for number in range(1, 26):
                svg = ET.fromstring(zipped.read(f"page-{number:03}.svg"))
                assert svg.attrib["data-page-number"] == str(number)
                assert svg.find("{http://www.w3.org/2000/svg}g[@id='page-number']").attrib[
                    "data-page-number"
                ] == str(number)
        page = current["pages"][-1]
        png = client.get(f"/api/studio/pages/{page['id']}/files/page.png")
        assert png.status_code == 200
        assert Image.open(io.BytesIO(png.content)).width == 1800
        assert not list(tmp_path.rglob("*.zip"))
        assert sum(1 for _ in tmp_path.rglob("manifest.json")) == 25
        original_ids = [p["selected_job_id"] for p in current["pages"]]
        changed = client.put(
            f"/api/studio/projects/{ident}/order",
            json={
                "page_ids": [p["id"] for p in reversed(current["pages"])],
                "version": current["version"],
            },
        )
        assert changed.status_code == 200
        assert [p["selected_job_id"] for p in changed.json()["pages"]] == list(
            reversed(original_ids)
        )
        assert repo.usage()["queue"] == 0
        first = changed.json()["pages"][0]
        svg = client.get(f"/api/studio/pages/{first['id']}/files/page.svg?download=true")
        assert ET.fromstring(svg.content).attrib["data-page-number"] == "1"
        assert "page-001.svg" in svg.headers["content-disposition"]
        assert client.delete(f"/api/studio/projects/{ident}").status_code == 204
        assert repo.usage()["used_bytes"] == 0
        assert not list(files.root.iterdir())


def test_single_image_database_migrates_once_without_copying_source(tmp_path):
    with sqlite3.connect(tmp_path / "studio.sqlite3") as db:
        db.executescript("""
        CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT,state TEXT,created_at
      REAL,expires_at REAL,selected_job_id TEXT,source_bytes INTEGER,reserved_bytes
      INTEGER,source_sha256 TEXT,media_type TEXT,width INTEGER,height INTEGER);
        CREATE TABLE jobs(id TEXT PRIMARY KEY,project_id TEXT REFERENCES
      projects(id),settings TEXT,status TEXT,stage TEXT,created_at REAL,started_at
      REAL,finished_at REAL,expires_at REAL,cancel_requested INTEGER,reserved_bytes
      INTEGER,output_bytes INTEGER,report TEXT,error TEXT);
        CREATE TABLE downloads(id TEXT,job_id TEXT REFERENCES jobs(id),expires_at REAL);
""")
        p, j = "a" * 32, "b" * 32
        db.execute(
            "INSERT INTO projects VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (p, "Old image", "ready", 1000, None, j, 10, 0, "sha", "image/png", 30, 40),
        )
        db.execute(
            "INSERT INTO jobs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                j,
                p,
                json.dumps(
                    {"colors": 19, "min_area_mm2": 3.5, "font_size_pt": 4.5, "start_page": 25}
                ),
                "completed",
                "Готово",
                1000,
                1001,
                1002,
                None,
                0,
                0,
                10,
                "{}",
                None,
            ),
        )
    files = StudioFiles(tmp_path, Limits())
    source = files.source(p)
    source.parent.mkdir(parents=True)
    source.write_bytes(b"kept source")
    repo = SqliteRepository(tmp_path, Limits())
    project = repo.project(p)
    assert project["name"] == "Old image" and project["start_page"] == 25
    assert project["settings"]["font_size_px"] == 6
    assert project["pages"][0]["selected_job_id"] == j
    assert source.read_bytes() == b"kept source"
    assert SqliteRepository(tmp_path, Limits()).project(p)["pages"][0]["id"] == p


def test_expired_preview_falls_back_to_accepted_version_before_gc(context):
    _, repo, _, studio = context
    clock = [1000.0]
    repo.clock = lambda: clock[0]
    project, pages = book(repo, studio)
    first = repo.enqueue(project["id"])[0]
    repo.claim()
    repo.finish(first["id"], "completed", 1, {"quality": {}, "algorithm": ALGORITHM_VERSION})
    newer = repo.enqueue(project["id"], force=True)[0]
    repo.claim()
    repo.finish(newer["id"], "completed", 1, {"quality": {}, "algorithm": ALGORITHM_VERSION})
    clock[0] += repo.limits.preview_seconds + 1
    visible = repo.project(project["id"])["pages"][0]["jobs"]
    assert [j["id"] for j in visible] == [first["id"]]
    assert repo.page(pages[0]["id"])["selected_job_id"] == first["id"]
    with pytest.raises(StudioError):
        repo.lease_page(pages[0]["id"], newer["id"])


def test_algorithm_upgrade_offers_new_preview_without_replacing_accepted_result(context):
    _, repo, _, studio = context
    project, _ = book(repo, studio)
    old = repo.enqueue(project["id"])[0]
    repo.claim()
    repo.finish(old["id"], "completed", 1, {"quality": {}, "algorithm": "coloring-delivery-v1"})
    assert repo.project(project["id"])["pages"][0]["outdated"]
    new = repo.enqueue(project["id"])
    assert len(new) == 1
    assert repo.project(project["id"])["pages"][0]["selected_job_id"] == old["id"]
