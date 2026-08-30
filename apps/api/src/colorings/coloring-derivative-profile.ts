export const coloringDerivativeProfiles = [
  "webp-preview-v1",
  "webp-preview-v2",
  "webp-preview-v3",
] as const;

export type ColoringDerivativeProfile =
  (typeof coloringDerivativeProfiles)[number];

export const currentColoringDerivativeProfile = "webp-preview-v3" as const;

export const coloringDerivativeMaxSide = 4096;
export const coloringDerivativeMaxBytes = 20 * 1024 * 1024;
