"""Build a local preview of the rendered PDF pages without publishing a site route."""

import json
from html import escape
from pathlib import Path

from PIL import Image
from pypdf import PdfReader

SOURCE = Path(__file__).parent
OUTPUT = Path(__file__).resolve().parents[4] / "outputs" / "contest-legal-20261121"
LABELS = {
    "contest-rules": "Правила",
    "contest-personal-data-consent": "Обработка данных",
    "contest-publication-consent": "Публикация работ",
    "contest-event-conditions": "Условия конкурса",
}


def main():
    data = json.loads((SOURCE / "documents.json").read_text(encoding="utf-8"))
    groups = [(item["slug"], LABELS[item["slug"]]) for item in data["documents"]]
    counts = {slug: len(PdfReader(OUTPUT / (slug + ".pdf")).pages) for slug, _ in groups}
    total = sum(counts.values())
    nav = "".join(f'<a href="#{slug}">{escape(label)}</a>' for slug, label in groups)
    sections = []
    number = 0
    for slug, label in groups:
        for page in range(1, counts[slug] + 1):
            number += 1
            image_path = OUTPUT / "qa" / slug / f"page-{page}.png"
            with Image.open(image_path) as image:
                width, height = image.size
            anchor = f' id="{slug}"' if page == 1 else ""
            sections.append(
                f'<section{anchor}><p>{escape(label)} · {number} / {total}</p>'
                f'<img src="qa/{slug}/page-{page}.png?v={data["version"]}" '
                f'alt="{escape(label)}, страница {page}" width="{width}" height="{height}" loading="eager"></section>'
            )
    html = '''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Документы конкурсов Artmate — редакция EDITION</title><style>*{box-sizing:border-box}html{scroll-padding-top:112px}body{margin:0;background:#e9e9e9;color:#222;font:14px Arial,sans-serif}header{position:sticky;top:0;z-index:1;background:#fff;padding:14px 20px;border-bottom:1px solid #d8d8d8}header>div{display:flex;align-items:center;justify-content:space-between;gap:16px}nav{display:flex;gap:16px;overflow:auto;margin-top:12px;padding-bottom:4px}a{color:#333;text-underline-offset:3px;white-space:nowrap}main{max-width:980px;padding:12px 16px 40px;margin:auto}section{margin-bottom:22px}section>p{font-size:12px;color:#555;margin:8px 0}img{display:block;width:100%;height:auto;background:#fff;box-shadow:0 2px 8px #0002}</style><header><div><strong>Документы конкурсов Artmate · EDITION</strong><a href="artmate-contest-documents.pdf" download>Скачать PDF</a></div><nav>'''
    html = html.replace("EDITION", data["version"])
    html += nav + "</nav></header><main>" + "".join(sections) + "</main></html>"
    (OUTPUT / "preview.html").write_text(html, encoding="utf-8")
    print(f"Preview: {total} pages, edition {data['version']}")


if __name__ == "__main__":
    main()
