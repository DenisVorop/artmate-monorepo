"""Page numbering is presentation: reuse artwork, rebuild only palette and footer."""

import io
import time
from xml.etree import ElementTree as ET
from zipfile import ZIP_STORED, ZipFile

import resvg_py

from mystery_coloring.layout.adapters.numbers import SVG, ReferenceNumbers
from mystery_coloring.layout.adapters.svg import palette_element
from mystery_coloring.layout.domain import ArtMateTemplate
from mystery_coloring.studio.domain import StudioError
from mystery_coloring.typography.adapters.font import ArialFont


class BookExporter:
    def __init__(self, files):
        self.files, self.font, self.numbers = files, ArialFont(), ReferenceNumbers()

    def render(self, page, job, number, variant="outline", file_type="svg"):
        if variant not in {"outline", "colored"} or file_type not in {"svg", "png"}:
            raise StudioError("Выберите контуры или цвет, SVG или PNG.")
        stem = "page" if variant == "outline" else "colored-page"
        source = self.files.artifact(page["id"], job["id"], stem + ".svg").read_bytes()
        # Preserve exact bytes for the original layout, including migrated pages.
        if job["settings"]["start_page"] == number:
            return (
                source
                if file_type == "svg"
                else self.files.artifact(page["id"], job["id"], stem + ".png").read_bytes()
            )
        root = ET.fromstring(source)
        root.set("data-page-number", str(number))
        palette = root.find(SVG + "g[@id='palette']")
        footer = root.find(SVG + "g[@id='page-number']")
        if palette is None or footer is None:
            raise StudioError("Повреждено оформление страницы.")
        root.remove(palette)
        root.remove(footer)
        colors = tuple(tuple(p["rgb"]) for p in job["report"]["palette"])
        count = job["report"]["quality"]["palette_colors"]
        root.append(palette_element(colors, ArtMateTemplate().palette(count, number), self.font))
        root.append(self.numbers.element(number))
        svg = ET.tostring(root, encoding="unicode")
        return (
            svg.encode()
            if file_type == "svg"
            else resvg_py.svg_to_bytes(svg_string=svg, width=1800, dpi=96, skip_system_fonts=True)
        )

    def archive(self, items, repository, lease, variant, file_type):
        sink = ArchiveSink()
        renewed = time.monotonic()
        try:
            with ZipFile(sink, "w", compression=ZIP_STORED) as zipped:
                for item in items:
                    repository.renew_download(lease)
                    data = self.render(
                        item["page"], item["job"], item["number"], variant, file_type
                    )
                    with zipped.open(
                        f"page-{item['number']:03d}.{file_type}", "w", force_zip64=True
                    ) as target:
                        for offset in range(0, len(data), 64 * 1024):
                            if time.monotonic() - renewed > 30:
                                repository.renew_download(lease)
                                renewed = time.monotonic()
                            target.write(memoryview(data)[offset : offset + 64 * 1024])
                            yield sink.drain()
                    yield sink.drain()
                    del data
            yield sink.drain()
        finally:
            repository.release_download(lease)


class ArchiveSink:
    def __init__(self):
        self.buffer, self.offset = io.BytesIO(), 0

    def write(self, data):
        self.offset += len(data)
        return self.buffer.write(data)

    def tell(self):
        return self.offset

    def flush(self):
        pass

    def drain(self):
        data = self.buffer.getvalue()
        self.buffer.seek(0)
        self.buffer.truncate()
        return data
