ALTER TABLE "coloring_revisions"
  DROP CONSTRAINT "coloring_revisions_dimensions_check",
  ADD CONSTRAINT "coloring_revisions_dimensions_check" CHECK (
    "width" BETWEEN 1 AND 4096
    AND "height" BETWEEN 1 AND 4096
    AND "width"::BIGINT * "height"::BIGINT <= 16777216
  ),
  DROP CONSTRAINT "coloring_revisions_profile_check",
  ADD CONSTRAINT "coloring_revisions_profile_check" CHECK (
    "derivative_profile" IN ('webp-preview-v1', 'webp-preview-v2', 'webp-preview-v3')
    AND "color_space" = 'srgb'
  );
