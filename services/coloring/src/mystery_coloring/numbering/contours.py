"""White regions retain boundaries; colored prefilled strokes supply their own ink."""

from collections import defaultdict

from mystery_coloring.palette import RGB, is_paper_white
from mystery_coloring.subdivision.domain import Edge, Mesh


def visible_contour_edges(mesh: Mesh, palette: tuple[RGB, ...]) -> tuple[Edge, ...]:
    white_colors = {i for i, rgb in enumerate(palette) if is_paper_white(rgb)}
    hidden = set()
    white_sides = defaultdict(list)
    for cell in mesh.cells:
        refs = {abs(ref) for ring in cell.rings for ref in ring}
        if cell.color_index in white_colors:
            for ref in refs:
                white_sides[ref].append(palette[cell.color_index])
        elif cell.prefilled:
            hidden.update(refs)
    # Protection flags can create adjacent cells inside one uniformly white highlight.
    # Keep genuine boundaries between different pale shades, but not these seams.
    white_interiors = {
        edge for edge, sides in white_sides.items() if len(sides) == 2 and sides[0] == sides[1]
    }
    # A white highlight stays visible even inside a colored prefilled detail.
    return tuple(
        edge
        for edge in mesh.edges
        if edge.id not in white_interiors and (edge.id not in hidden or edge.id in white_sides)
    )
