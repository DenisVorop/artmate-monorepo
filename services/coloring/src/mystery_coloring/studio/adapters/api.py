"""Same-origin private studio API; computation belongs to a separate worker."""

import asyncio
import json
import tempfile
import time
from collections import deque
from pathlib import Path
from threading import Lock

from fastapi import APIRouter, Depends, FastAPI, Request, Response
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool

from mystery_coloring.studio.adapters.auth import (
    COOKIE,
    SESSION_SECONDS,
    issue_session,
    valid_session,
    verify_password,
)
from mystery_coloring.studio.adapters.config import Config
from mystery_coloring.studio.adapters.export import BookExporter
from mystery_coloring.studio.adapters.files import StudioFiles
from mystery_coloring.studio.adapters.repository import SqliteRepository
from mystery_coloring.studio.application import Studio
from mystery_coloring.studio.domain import StudioError


async def read_body(request, limit):
    chunks, size = [], 0
    try:
        async with asyncio.timeout(15):
            async for chunk in request.stream():
                size += len(chunk)
                if size > limit:
                    raise StudioError("Запрос слишком большой.", 413)
                chunks.append(chunk)
    except TimeoutError as error:
        raise StudioError("Превышено время запроса.", 408) from error
    return b"".join(chunks)


async def read_json(request):
    try:
        value = json.loads(await read_body(request, 16 * 1024))
    except (ValueError, UnicodeError) as error:
        raise StudioError("Некорректный JSON.") from error
    if not isinstance(value, dict):
        raise StudioError("Ожидается JSON-объект.")
    return value


def create_app(config=None):
    config = config or Config.from_env()
    repository = SqliteRepository(config.data_dir, config.limits)
    files = StudioFiles(config.data_dir, config.limits)
    studio = Studio(repository, files, config.limits)
    attempts, attempts_lock = deque(), Lock()
    upload_lock = asyncio.Lock()
    export_lock = Lock()
    exporter = BookExporter(files)

    app = FastAPI(
        title="Artmate Studio API",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.repository, app.state.files, app.state.studio = repository, files, studio

    @app.exception_handler(StudioError)
    async def studio_error(request, error):
        return JSONResponse({"detail": str(error)}, status_code=error.status)

    @app.middleware("http")
    async def same_origin(request, call_next):
        origin = request.headers.get("origin")
        if (
            request.method not in {"GET", "HEAD", "OPTIONS"}
            and origin
            and origin != config.public_url
        ):
            return JSONResponse({"detail": "Недопустимый источник запроса."}, status_code=403)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    def authorize(request: Request):
        if not valid_session(request.cookies.get(COOKIE), config.password_hash):
            raise StudioError("Войдите в студию.", 401)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/studio/session")
    def session(request: Request):
        return {"authenticated": valid_session(request.cookies.get(COOKIE), config.password_hash)}

    @app.post("/api/studio/session")
    async def login(request: Request, response: Response):
        now = time.monotonic()
        with attempts_lock:
            while attempts and attempts[0] < now - 60:
                attempts.popleft()
            if len(attempts) >= 10:
                raise StudioError("Слишком много попыток входа. Подождите минуту.", 429)
            attempts.append(now)
        body = await read_json(request)
        password = body.get("password")
        if (
            not isinstance(password, str)
            or len(password) > 1024
            or not await run_in_threadpool(verify_password, password, config.password_hash)
        ):
            raise StudioError("Неверный пароль.", 401)
        response.set_cookie(
            COOKIE,
            issue_session(config.password_hash),
            max_age=SESSION_SECONDS,
            httponly=True,
            secure=config.public_url.startswith("https://"),
            samesite="strict",
            path="/api/studio",
        )
        return {"authenticated": True}

    @app.delete("/api/studio/session")
    def logout(response: Response):
        response.delete_cookie(
            COOKIE,
            path="/api/studio",
            secure=config.public_url.startswith("https://"),
            httponly=True,
            samesite="strict",
        )
        return {"authenticated": False}

    router = APIRouter(prefix="/api/studio", dependencies=[Depends(authorize)])

    @router.get("/usage")
    def usage():
        return repository.usage()

    @router.get("/projects")
    def projects():
        return repository.projects()

    @router.post("/projects", status_code=201)
    async def create_project(request: Request):
        return await run_in_threadpool(repository.create_project, await read_json(request))

    @router.get("/projects/{project_id}")
    def project(project_id: str):
        return repository.project(project_id)

    @router.patch("/projects/{project_id}")
    async def update_project(project_id: str, request: Request):
        return await run_in_threadpool(
            repository.update_project, project_id, await read_json(request)
        )

    @router.put("/projects/{project_id}/order")
    async def reorder(project_id: str, request: Request):
        body = await read_json(request)
        if set(body) - {"page_ids", "version"}:
            raise StudioError("Некорректный порядок страниц.")
        return await run_in_threadpool(
            repository.reorder, project_id, body.get("page_ids"), body.get("version")
        )

    @router.post("/projects/{project_id}/pages", status_code=201)
    async def upload(project_id: str, request: Request):
        length = request.headers.get("content-length")
        if length and (not length.isdigit() or int(length) > config.limits.upload_bytes):
            raise StudioError("Изображение превышает 25 МиБ.", 413)
        if upload_lock.locked():
            raise StudioError("Уже загружается изображение. Попробуйте немного позже.", 429)
        async with upload_lock:
            with tempfile.SpooledTemporaryFile(max_size=1024 * 1024) as source:
                total = 0
                try:
                    async with asyncio.timeout(60):
                        async for chunk in request.stream():
                            total += len(chunk)
                            if total > config.limits.upload_bytes:
                                raise StudioError("Изображение превышает 25 МиБ.", 413)
                            source.write(chunk)
                except TimeoutError as error:
                    raise StudioError("Загрузка заняла слишком много времени.", 408) from error
                source.seek(0)
                name = request.query_params.get("name", "Изображение")
                return await run_in_threadpool(studio.upload, project_id, Path(name).name, source)

    @router.patch("/pages/{page_id}")
    async def update_page(page_id: str, request: Request):
        return await run_in_threadpool(repository.update_page, page_id, await read_json(request))

    @router.get("/pages/{page_id}/source")
    def source(page_id: str):
        page, _, lease = repository.lease_page(page_id, source=True)
        return FileResponse(
            files.source(page_id),
            media_type=page["media_type"],
            background=BackgroundTask(repository.release_download, lease),
        )

    @router.delete("/projects/{project_id}", status_code=204)
    def delete(project_id: str):
        studio.delete(project_id)
        return Response(status_code=204)

    @router.delete("/pages/{page_id}", status_code=204)
    def delete_page(page_id: str):
        studio.delete_page(page_id)
        return Response(status_code=204)

    async def generation_options(request):
        body = await read_json(request)
        if set(body) - {"force"} or type(body.get("force", False)) is not bool:
            raise StudioError("Некорректные параметры запуска.")
        return body.get("force", False)

    @router.post("/projects/{project_id}/generate", status_code=202)
    async def generate(project_id: str, request: Request):
        jobs = await run_in_threadpool(
            repository.enqueue, project_id, None, await generation_options(request)
        )
        return {"queued": len(jobs)}

    @router.post("/pages/{page_id}/generate", status_code=202)
    async def generate_page(page_id: str, request: Request):
        page = await run_in_threadpool(repository.page, page_id)
        jobs = await run_in_threadpool(
            repository.enqueue, page["project_id"], page_id, await generation_options(request)
        )
        return {"queued": len(jobs)}

    @router.get("/jobs/{job_id}")
    def job(job_id: str):
        return repository.job(job_id)

    @router.post("/jobs/{job_id}/cancel")
    def cancel(job_id: str):
        return repository.cancel(job_id)

    @router.post("/projects/{project_id}/cancel")
    def cancel_project(project_id: str):
        return repository.cancel_project(project_id)

    @router.post("/projects/{project_id}/accept")
    def accept(project_id: str):
        return repository.accept(project_id)

    @router.post("/pages/{page_id}/accept")
    def accept_page(page_id: str):
        page = repository.page(page_id)
        return repository.accept(page["project_id"], page_id)

    @router.get("/pages/{page_id}/files/{name}")
    def artifact(page_id: str, name: str, job_id: str | None = None, download: bool = False):
        allowed = {
            "page.svg": ("outline", "svg"),
            "colored-page.svg": ("colored", "svg"),
            "page.png": ("outline", "png"),
            "colored-page.png": ("colored", "png"),
        }
        if name not in allowed:
            raise StudioError("Файл не найден.", 404)
        # At most one page renderer/export in API memory, even across concurrent requests.
        if not export_lock.acquire(blocking=False):
            raise StudioError("Готовится другой экспорт. Попробуйте немного позже.", 429)
        lease = None
        try:
            page, job, lease = repository.lease_page(page_id, job_id)
            variant, file_type = allowed[name]
            data = exporter.render(page, job, page["number"], variant, file_type)
            headers = (
                {
                    "Content-Disposition": 'attachment; filename="'
                    f'page-{page["number"]:03d}.{file_type}"'
                }
                if download
                else {}
            )
            return Response(
                data,
                media_type="image/svg+xml" if file_type == "svg" else "image/png",
                headers=headers,
            )
        finally:
            if lease:
                repository.release_download(lease)
            export_lock.release()

    @router.get("/projects/{project_id}/archive")
    def archive(project_id: str, variant: str = "outline", file_type: str = "svg"):
        if variant not in {"outline", "colored"} or file_type not in {"svg", "png"}:
            raise StudioError("Некорректный формат экспорта.")
        if not export_lock.acquire(blocking=False):
            raise StudioError("Готовится другой экспорт. Попробуйте немного позже.", 429)
        try:
            items, lease = repository.lease_export(project_id)
        except BaseException:
            export_lock.release()
            raise

        released = False
        release_guard = Lock()

        def finish():
            nonlocal released
            with release_guard:
                if released:
                    return
                released = True
                try:
                    repository.release_download(lease)
                finally:
                    export_lock.release()

        def stream():
            try:
                yield from exporter.archive(items, repository, lease, variant, file_type)
            finally:
                finish()

        return StreamingResponse(
            stream(),
            media_type="application/zip",
            headers={
                "Content-Disposition": 'attachment; filename="'
                f'coloring-{project_id[:8]}-{variant}.zip"'
            },
            background=BackgroundTask(finish),
        )

    app.include_router(router)
    return app


def main():
    import uvicorn

    uvicorn.run(
        create_app(),
        host="0.0.0.0",
        port=8000,
        workers=1,
        limit_concurrency=32,
        timeout_keep_alive=5,
    )
