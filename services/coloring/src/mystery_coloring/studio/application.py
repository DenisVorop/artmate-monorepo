"""Book use cases. Persistence and source storage are ports."""

from typing import BinaryIO, Protocol

from mystery_coloring.studio.domain import Limits


class Repository(Protocol):
    def create_project(self, values: dict) -> dict: ...
    def update_project(self, project_id: str, values: dict) -> dict: ...
    def reserve_page(self, project_id: str, name: str) -> dict: ...
    def ready_page(self, page_id: str, source: dict) -> dict: ...
    def mark_deleting(self, project_id: str) -> list[str]: ...
    def mark_page_deleting(self, page_id: str) -> None: ...
    def remove_page(self, page_id: str) -> None: ...
    def remove_project(self, project_id: str) -> None: ...
    def enqueue(self, project_id: str, page_id: str | None, force: bool) -> list[dict]: ...
    def accept(self, project_id: str, page_id: str | None) -> dict: ...


class SourceStore(Protocol):
    def ingest(self, page_id: str, stream: BinaryIO) -> dict: ...
    def remove_page(self, page_id: str) -> None: ...


class Studio:
    def __init__(self, repository: Repository, files: SourceStore, limits: Limits):
        self.repository, self.files, self.limits = repository, files, limits

    def upload(self, project_id: str, name: str, stream: BinaryIO) -> dict:
        page = self.repository.reserve_page(project_id, name)
        try:
            source = self.files.ingest(page["id"], stream)
            return self.repository.ready_page(page["id"], source)
        except BaseException:
            self.files.remove_page(page["id"])
            self.repository.remove_page(page["id"])
            raise

    def delete(self, project_id: str):
        for page_id in self.repository.mark_deleting(project_id):
            self.files.remove_page(page_id)
        self.repository.remove_project(project_id)

    def delete_page(self, page_id: str):
        self.repository.mark_page_deleting(page_id)
        self.files.remove_page(page_id)
        self.repository.remove_page(page_id)
