export const seoEntryStatuses = ["draft", "published", "archived"] as const;
export type SeoEntryStatusDTO = (typeof seoEntryStatuses)[number];

export const seoSnapshotKinds = ["draft", "published", "archived"] as const;
export type SeoSnapshotKindDTO = (typeof seoSnapshotKinds)[number];

export type SeoJsonDTO = Record<string, unknown>;

export type SeoSnapshotDTO = {
  id: string;
  entryId: string;
  version: number;
  kind: SeoSnapshotKindDTO;
  payload: SeoJsonDTO;
  comment?: string;
  createdById?: string;
  publishedAt?: string;
  createdAt: string;
};

export type SeoEntryDTO = {
  id: string;
  path: string;
  source?: SeoJsonDTO;
  status: SeoEntryStatusDTO;
  draftSnapshotId?: string;
  publishedSnapshotId?: string;
  createdById?: string;
  updatedById?: string;
  createdAt: string;
  updatedAt: string;
  draftSnapshot?: SeoSnapshotDTO;
  publishedSnapshot?: SeoSnapshotDTO;
};

export type CreateSeoEntryInputDTO = {
  path: string;
  source?: SeoJsonDTO;
  payload: SeoJsonDTO;
  comment?: string;
};

export type UpdateSeoEntryInputDTO = Partial<CreateSeoEntryInputDTO>;

export type PublishSeoEntryInputDTO = {
  payload?: SeoJsonDTO;
  comment?: string;
};

export type RollbackSeoEntryInputDTO = {
  snapshotId: string;
  comment?: string;
};
