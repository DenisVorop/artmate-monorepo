ALTER TABLE "coloring_revisions"
  DROP CONSTRAINT "coloring_revisions_profile_check",
  ADD CONSTRAINT "coloring_revisions_profile_check" CHECK (
    "derivative_profile" IN ('webp-preview-v1', 'webp-preview-v2')
    AND "color_space" = 'srgb'
  );
