ALTER TABLE "coloring_revision_palette_colors"
  DROP CONSTRAINT "coloring_revision_palette_colors_symbol_position_check";

ALTER TABLE "coloring_revision_palette_colors"
  ADD CONSTRAINT "coloring_revision_palette_colors_symbol_position_check"
  CHECK ("symbol_position" BETWEEN 1 AND 19);
