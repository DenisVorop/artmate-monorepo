import type { ContestEntryStatus } from "@/shared/actions/contest-entries";
export const contestEntryStatusLabels: Record<ContestEntryStatus, string> = {
  PENDING: "На проверке",
  CHANGES_REQUESTED: "Нужно исправить",
  APPROVED: "Опубликована",
  REJECTED: "Отклонена",
  HIDDEN: "Скрыта",
};
export const formatEntryDate = (date: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(new Date(date));
