export const coloringStatuses = ["draft", "published", "archived"] as const;
export type ColoringStatus = (typeof coloringStatuses)[number];

export const coloringCollectionStatuses = [
  "draft",
  "published",
  "archived",
] as const;
export type ColoringCollectionStatus =
  (typeof coloringCollectionStatuses)[number];
