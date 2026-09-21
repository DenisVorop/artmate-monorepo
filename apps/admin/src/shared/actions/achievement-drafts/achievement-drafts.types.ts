export const achievementConditionKinds = [
  "published_coloring_count",
  "distinct_collection_count",
  "completed_collection_count",
  "completed_order_count",
] as const;

export type AchievementConditionKindDTO =
  (typeof achievementConditionKinds)[number];

export type AchievementDraftDTO = {
  activeVersion: number | null;
  id: string;
  version: number;
  status: "draft" | "active" | "archived";
  title: string;
  description: string;
  imageUrl: string | null;
  conditionKind: AchievementConditionKindDTO;
  target: number;
  rewardPoints: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateAchievementDraftInputDTO = Pick<
  AchievementDraftDTO,
  | "conditionKind"
  | "description"
  | "imageUrl"
  | "rewardPoints"
  | "sortOrder"
  | "target"
  | "title"
>;

export type UpdateAchievementDraftInputDTO = CreateAchievementDraftInputDTO & {
  expectedVersion: number;
};

export type ArchiveAchievementDraftInputDTO = {
  expectedVersion: number;
};

export type ActivateAchievementDraftInputDTO = {
  expectedVersion: number;
};

export type AchievementImageUploadDTO = {
  url: string;
};
