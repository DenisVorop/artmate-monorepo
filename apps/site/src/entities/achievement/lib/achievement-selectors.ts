import type { Achievement } from "../model/types";

// The API already orders ties by the administrator's order and definition ID.
export function getAchievementPreview(items: readonly Achievement[], limit = 6) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const earned = Number(Boolean(b.item.earnedAt)) - Number(Boolean(a.item.earnedAt));
      if (earned) return earned;
      if (!a.item.earnedAt) {
        const progress = b.item.progress / b.item.target - a.item.progress / a.item.target;
        if (progress) return progress;
      }
      return a.index - b.index;
    })
    .slice(0, limit)
    .map(({ item }) => item);
}
