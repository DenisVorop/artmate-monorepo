CREATE TABLE "coloring_revision_palette_colors" (
  "revision_id" VARCHAR(32) NOT NULL,
  "marker_color_id" VARCHAR(32) NOT NULL,
  "symbol_position" INTEGER NOT NULL,
  "color_number" INTEGER NOT NULL,
  "pantone" VARCHAR(40) NOT NULL,
  "hex" VARCHAR(7) NOT NULL,
  "marker_number" VARCHAR(3) NOT NULL,

  CONSTRAINT "coloring_revision_palette_colors_pkey"
    PRIMARY KEY ("revision_id", "symbol_position"),
  CONSTRAINT "coloring_revision_palette_colors_symbol_position_check"
    CHECK ("symbol_position" BETWEEN 1 AND 15),
  CONSTRAINT "coloring_revision_palette_colors_color_number_check"
    CHECK ("color_number" BETWEEN 1 AND 999),
  CONSTRAINT "coloring_revision_palette_colors_pantone_check"
    CHECK (char_length(btrim("pantone")) BETWEEN 1 AND 40),
  CONSTRAINT "coloring_revision_palette_colors_hex_check"
    CHECK ("hex" ~ '^#[0-9A-F]{6}$'),
  CONSTRAINT "coloring_revision_palette_colors_marker_number_check"
    CHECK ("marker_number" ~ '^[0-9]{3}$'),
  CONSTRAINT "coloring_revision_palette_colors_revision_id_fkey"
    FOREIGN KEY ("revision_id") REFERENCES "coloring_revisions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "coloring_revision_palette_colors_marker_color_id_fkey"
    FOREIGN KEY ("marker_color_id") REFERENCES "marker_colors"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "coloring_revision_palette_colors_revision_marker_key"
  ON "coloring_revision_palette_colors"("revision_id", "marker_color_id");

CREATE INDEX "coloring_revision_palette_colors_marker_color_id_idx"
  ON "coloring_revision_palette_colors"("marker_color_id");
