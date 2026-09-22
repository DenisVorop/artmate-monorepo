import type { Achievement } from "@/entities/achievement";

export const achievementFilters = [
  { value: "all", label: "Все" },
  { value: "earned", label: "Полученные" },
  { value: "upcoming", label: "Впереди" },
] as const;
export type AchievementFilter = (typeof achievementFilters)[number]["value"];

export function filterAchievements(items: readonly Achievement[], filter: AchievementFilter) {
  return items.filter(
    (item) => filter === "all" || (filter === "earned" ? Boolean(item.earnedAt) : !item.earnedAt),
  );
}
