import type { AchievementConditionKind, AchievementDraft } from "../model";

const conditionLabels: Record<AchievementConditionKind, string> = {
  completed_collection_count: "Завершённые альбомы",
  completed_order_count: "Завершённые заказы",
  distinct_collection_count: "Работы из разных тематик",
  published_coloring_count: "Опубликованные раскраски",
};

export function getAchievementConditionLabel(kind: AchievementConditionKind) {
  return conditionLabels[kind];
}

export function getAchievementStatusLabel(status: AchievementDraft["status"]) {
  if (status === "active") return "Активна";
  if (status === "archived") return "Архив";
  return "Черновик";
}

export function canActivateAchievement(
  achievement: Pick<
    AchievementDraft,
    "activeVersion" | "conditionKind" | "status" | "version"
  >,
) {
  return (
    achievement.status !== "archived" &&
    (achievement.activeVersion === null ||
      achievement.activeVersion < achievement.version)
  );
}

export function hasUnpublishedAchievementChanges(
  achievement: Pick<AchievementDraft, "activeVersion" | "version">,
) {
  return (
    achievement.activeVersion !== null &&
    achievement.activeVersion !== achievement.version
  );
}

export function sortAchievementDrafts(
  achievements: readonly AchievementDraft[],
) {
  return [...achievements].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.title.localeCompare(right.title, "ru"),
  );
}
