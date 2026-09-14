"""Точные векторные цифры эталона; произвольные номера составляются из разрядов."""

import hashlib
import json
from importlib.resources import files
from xml.etree import ElementTree as ET

from mystery_coloring.domain import StageError
from mystery_coloring.layout.domain import PX_MM, validate_page_number

SVG = "{http://www.w3.org/2000/svg}"
ASSET_SHA256 = "dd38d91e5672114dbc3c19cf6a66920da9f1bdb8ddc92a5050486a8c3d18c46d"


class ReferenceNumbers:
    def __init__(self):
        try:
            data = (
                files("mystery_coloring").joinpath("layout/assets/page-numbers.json").read_bytes()
            )
            if hashlib.sha256(data).hexdigest() != ASSET_SHA256:
                raise StageError("Изменились векторные цифры эталона ArtMate.")
            self.asset = json.loads(data)
        except (OSError, ValueError) as error:
            raise StageError(f"Не удалось загрузить цифры ArtMate: {error}") from error

    def element(self, number):
        validate_page_number(number)
        group = ET.Element(
            SVG + "g",
            {
                "id": "page-number",
                "data-page-number": str(number),
                "fill": "#F56A6A",
                "transform": f"scale({PX_MM}) translate(0 -8)",
            },
        )
        text = str(number)
        if text in self.asset["pages"]:
            ET.SubElement(group, SVG + "path", {"d": self.asset["pages"][text]})
        else:
            for index, digit in enumerate(text):
                shift = -(len(text) - index - 1) * self.asset["digit_advance"]
                ET.SubElement(
                    group,
                    SVG + "path",
                    {
                        "d": self.asset["digits"][digit],
                        "transform": f"translate({shift} 0)",
                    },
                )
        return group
