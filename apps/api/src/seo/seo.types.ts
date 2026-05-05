export const seoEntryStatuses = ["draft", "published", "archived"] as const;
export type SeoEntryStatus = (typeof seoEntryStatuses)[number];

export const seoSnapshotKinds = ["draft", "published", "archived"] as const;
export type SeoSnapshotKind = (typeof seoSnapshotKinds)[number];

export type SeoJsonObject = Record<string, unknown>;

export type SeoPayload = SeoJsonObject;
