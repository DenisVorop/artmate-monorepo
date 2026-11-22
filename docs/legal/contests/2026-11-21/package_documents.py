"""Verify the final texts and collect the four legal documents without review notes."""

import hashlib
import json
import re
import shutil
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import pdfplumber
from pypdf import PdfReader, PdfWriter

from build_documents import closing_lines

SOURCE = Path(__file__).parent
OUTPUT = Path(__file__).resolve().parents[4] / "outputs" / "contest-legal-20261121"


def normalized(value):
    # LibreOffice emits the fallback ruble glyph in a separate PDF text run.
    # Verify its count independently and inspect its position on page images.
    return re.sub(r"\s+", "", value).replace("₽", "")


def main():
    source = json.loads((SOURCE / "documents.json").read_text(encoding="utf-8"))
    combined = PdfWriter()
    report = {"status": "final_editorial_edition", "version": source["version"], "documents": []}
    deliverables = []
    for item in source["documents"]:
        slug = item["slug"]
        rendered = OUTPUT / "qa" / slug / f"{slug}.pdf"
        reader = PdfReader(rendered)
        extracted = "".join(page.extract_text() for page in reader.pages)
        actual = normalized(extracted)
        expected = [item["title"], item["lead"]]
        for section in item["sections"]:
            expected.extend([section["title"], *section["paragraphs"]])
        expected.extend(closing_lines(source))
        if extracted.count("₽") != "".join(expected).count("₽"):
            raise RuntimeError(f"Missing currency glyph in {slug}")
        missing = [part for part in expected if normalized(part) not in actual]
        if missing:
            raise RuntimeError(f"Missing text in {slug}: {missing!r}")
        if "\ufffd" in actual:
            raise RuntimeError(f"Replacement glyph in {slug}")
        with pdfplumber.open(rendered) as pdf:
            for page in pdf.pages:
                if abs(page.width - 595.28) > 0.2 or abs(page.height - 841.89) > 0.2:
                    raise RuntimeError(f"Non-A4 page in {slug}")
                for char in page.chars:
                    if char["text"].strip() and (char["x0"] < 84 or char["x1"] > 555 or char["top"] < 55 or char["bottom"] > 787):
                        raise RuntimeError(f"Text outside margins in {slug}: {char}")
        copied = OUTPUT / f"{slug}.pdf"
        shutil.copyfile(rendered, copied)
        combined.append(str(copied), outline_item=item["title"])
        deliverables.extend([OUTPUT / f"{slug}.docx", copied])
        report["documents"].append({
            "file": copied.name, "pages": len(reader.pages),
            "source_paragraphs_verified": len(expected),
            "currency_glyph_count_verified": True, "a4_and_margins_verified": True,
            "sha256": hashlib.sha256(copied.read_bytes()).hexdigest(),
        })
    combined.add_metadata({"/Title": f"Документы конкурсов Artmate — редакция {source['version']}", "/Author": "Artmate"})
    combined_path = OUTPUT / "artmate-contest-documents.pdf"
    combined.write(combined_path)
    combined.close()
    report["combined_pages"] = len(PdfReader(combined_path).pages)
    deliverables.append(combined_path)
    archive = OUTPUT / "artmate-contest-documents.zip"
    with ZipFile(archive, "w", compression=ZIP_DEFLATED) as zip_file:
        for path in deliverables:
            zip_file.write(path, path.name)
    (OUTPUT / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # Superseded combined file contained internal review notes.
    (OUTPUT / "artmate-contest-documents-review.pdf").unlink(missing_ok=True)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(archive)


if __name__ == "__main__":
    main()
