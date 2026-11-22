import type { ContestEntryStatus } from "@/entities/contest";
export const entryStatusLabels: Record<ContestEntryStatus, string> = {
  PENDING: "На проверке",
  CHANGES_REQUESTED: "Нужно исправить",
  APPROVED: "Работа опубликована",
  REJECTED: "Заявка отклонена",
  HIDDEN: "Работа скрыта",
};
