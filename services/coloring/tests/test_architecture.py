"""Защита направления зависимостей внутренних слоёв."""

import ast
from pathlib import Path


def test_inner_layers_do_not_import_adapters_or_imaging_libraries():
    root = Path(__file__).parents[1] / "src" / "mystery_coloring"
    allowed = {
        "domain.py": {"dataclasses", "enum"},
        "details/domain.py": {"dataclasses", "math", "mystery_coloring.domain"},
        "details/application.py": {
            "typing",
            "mystery_coloring.details.domain",
            "mystery_coloring.domain",
        },
        "palette.py": {"collections.abc", "math"},
        "application.py": {"dataclasses", "pathlib", "typing", "mystery_coloring.domain"},
        "regions/domain.py": {"dataclasses", "math", "mystery_coloring.domain"},
        "regions/application.py": {
            "dataclasses",
            "pathlib",
            "typing",
            "mystery_coloring.regions.domain",
        },
        "regions/merging.py": {"heapq", "mystery_coloring.regions.domain"},
        "geometry/domain.py": {"dataclasses", "math", "mystery_coloring.domain"},
        "geometry/curves.py": {"math", "mystery_coloring.geometry.domain"},
        "geometry/application.py": {
            "dataclasses",
            "pathlib",
            "typing",
            "mystery_coloring.domain",
            "mystery_coloring.geometry.domain",
            "mystery_coloring.regions.application",
            "mystery_coloring.regions.domain",
        },
        "subdivision/domain.py": {
            "dataclasses",
            "math",
            "mystery_coloring.domain",
            "mystery_coloring.geometry.domain",
        },
        "subdivision/curves.py": {
            "math",
            "mystery_coloring.geometry.curves",
            "mystery_coloring.geometry.domain",
            "mystery_coloring.subdivision.domain",
        },
        "subdivision/application.py": {
            "dataclasses",
            "pathlib",
            "typing",
            "mystery_coloring.subdivision.domain",
        },
        "numbering/domain.py": {
            "dataclasses",
            "math",
            "mystery_coloring.domain",
            "mystery_coloring.geometry.domain",
            "mystery_coloring.subdivision.domain",
            "mystery_coloring.typography.domain",
        },
        "numbering/application.py": {
            "dataclasses",
            "pathlib",
            "typing",
            "mystery_coloring.numbering.domain",
            "mystery_coloring.typography.application",
        },
        "numbering/contours.py": {
            "collections",
            "mystery_coloring.palette",
            "mystery_coloring.subdivision.domain",
        },
        "numbering/curves.py": {
            "math",
            "mystery_coloring.geometry.domain",
            "mystery_coloring.numbering.domain",
        },
    }
    allowed.update(
        {
            "layout/domain.py": {
                "dataclasses",
                "math",
                "mystery_coloring.domain",
                "mystery_coloring.pipeline.domain",
            },
            "layout/application.py": {
                "collections.abc",
                "dataclasses",
                "pathlib",
                "typing",
                "mystery_coloring.domain",
                "mystery_coloring.layout.domain",
            },
            "typography/domain.py": {
                "dataclasses",
                "mystery_coloring.palette",
                "mystery_coloring.domain",
                "mystery_coloring.geometry.domain",
            },
            "typography/application.py": {"typing", "mystery_coloring.typography.domain"},
            "pipeline/domain.py": {
                "dataclasses",
                "mystery_coloring.domain",
                "mystery_coloring.geometry.domain",
                "mystery_coloring.numbering.domain",
                "mystery_coloring.subdivision.domain",
            },
            "pipeline/application.py": {
                "collections.abc",
                "dataclasses",
                "pathlib",
                "typing",
                "mystery_coloring.application",
                "mystery_coloring.geometry.application",
                "mystery_coloring.numbering.application",
                "mystery_coloring.pipeline.domain",
                "mystery_coloring.subdivision.application",
            },
        }
    )
    allowed.update(
        {
            "delivery/domain.py": {
                "dataclasses",
                "mystery_coloring.details.domain",
                "mystery_coloring.layout.domain",
                "mystery_coloring.numbering.domain",
                "mystery_coloring.pipeline.domain",
            },
            "delivery/application.py": {
                "dataclasses",
                "pathlib",
                "typing",
                "mystery_coloring.delivery.domain",
                "mystery_coloring.layout.domain",
            },
        }
    )
    allowed.update(
        {
            "studio/domain.py": {
                "dataclasses",
                "mystery_coloring.layout.domain",
                "mystery_coloring.domain",
            },
            "studio/application.py": {"dataclasses", "typing", "mystery_coloring.studio.domain"},
        }
    )
    for name, modules in allowed.items():
        tree = ast.parse((root / name).read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                assert node.module in modules, (name, node.module)
            elif isinstance(node, ast.Import):
                assert all(alias.name in modules for alias in node.names), name
