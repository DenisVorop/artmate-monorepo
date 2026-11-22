"""Build final legal DOCX files in the style of the site's existing legal PDFs."""

import json
import re
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

SOURCE = Path(__file__).with_name("documents.json")
ROOT = Path(__file__).resolve().parents[4]
OUTPUT = ROOT / "outputs" / "contest-legal-20261121"


def typography(value):
    value = re.sub(r"(?<=\d) (?=₽|%|лет|календарных|рабочих)", "\u00a0", value)
    value = re.sub(r"(?<=\d) (?=\d{3}(?:\D|$))", "\u00a0", value)
    return value.replace("№ ", "№\u00a0").replace("ИП ", "ИП\u00a0")


def closing_lines(source):
    return [
        "Индивидуальный предприниматель Воропаев Денис Юрьевич",
        "ИНН 772459963613",
        "ОГРНИП 324774600166803",
        "Электронная почта: support@artmate.ru",
        f"Редакция от {source['editionLabel']}",
    ]


def build():
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for item in source["documents"]:
        doc = Document()
        doc.core_properties.title = item["title"]
        doc.core_properties.author = "Artmate"
        doc.core_properties.subject = "Правила и согласия конкурсов Artmate"
        doc.core_properties.language = "ru-RU"
        section = doc.sections[0]
        section.page_width, section.page_height = Cm(21), Cm(29.7)
        section.top_margin = section.bottom_margin = Cm(2)
        section.left_margin, section.right_margin = Cm(3), Cm(1.5)
        for name in ["Normal", "Title", "Heading 1"]:
            style = doc.styles[name]
            style.font.name = "Arial"
            style.font.size = Pt(12)
            style.font.bold = False
            style.font.color.rgb = RGBColor(0, 0, 0)
            language = OxmlElement("w:lang")
            language.set(qn("w:val"), "ru-RU")
            style.element.get_or_add_rPr().append(language)
            fmt = style.paragraph_format
            fmt.line_spacing = Pt(14.9)
            fmt.space_before, fmt.space_after = Pt(0), Pt(8)
            fmt.first_line_indent = Pt(0)
            fmt.widow_control = True
        for border in doc.styles.element.xpath(".//w:pBdr"):
            border.getparent().remove(border)
        doc.styles["Normal"].paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        for name in ["Title", "Heading 1"]:
            fmt = doc.styles[name].paragraph_format
            fmt.alignment = WD_ALIGN_PARAGRAPH.CENTER
            fmt.keep_with_next = True
        doc.styles["Title"].font.bold = item.get("titleBold", False)
        doc.add_paragraph(typography(item["title"]), style="Title")
        doc.add_paragraph(typography(item["lead"]))
        for part in item["sections"]:
            doc.add_paragraph(typography(part["title"]), style="Heading 1")
            for text in part["paragraphs"]:
                doc.add_paragraph(typography(text))
        # Match the plain, compact requisites block in the existing site documents.
        for i, line in enumerate(closing_lines(source)):
            para = doc.add_paragraph(typography(line))
            para.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
            para.paragraph_format.space_after = Pt(0 if i < 3 else 8)
            para.paragraph_format.keep_with_next = i < 4
        path = OUTPUT / f"{item['slug']}.docx"
        doc.save(path)
        print(path)


if __name__ == "__main__":
    build()
