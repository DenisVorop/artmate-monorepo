import type {
  WorkshopModerationDetail,
  WorkshopModerationStatus,
} from "../model";

const statusLabels: Record<WorkshopModerationStatus, string> = {
  DRAFT: "Черновик",
  PENDING: "Ожидает проверки",
  APPROVED: "Одобрена",
  CHANGES_REQUESTED: "Нужны изменения",
  HIDDEN: "Скрыта",
};

const decisionLabels: Record<
  WorkshopModerationDetail["decisionHistory"][number]["decision"],
  string
> = {
  SUBMITTED: "Работа отправлена на проверку",
  APPROVED: "Работа одобрена",
  CHANGES_REQUESTED: "Запрошены изменения",
  HIDDEN: "Работа скрыта",
};

export function getWorkshopModerationStatusLabel(
  status: WorkshopModerationStatus,
) {
  return statusLabels[status];
}

export function getWorkshopModerationStatusBadgeVariant(
  status: WorkshopModerationStatus,
): "default" | "destructive" | "outline" | "secondary" {
  switch (status) {
    case "APPROVED":
      return "default";
    case "HIDDEN":
      return "destructive";
    case "CHANGES_REQUESTED":
      return "outline";
    case "PENDING":
      return "secondary";
    case "DRAFT":
      return "outline";
  }
}

export function getWorkshopModerationDecisionLabel(
  decision: WorkshopModerationDetail["decisionHistory"][number]["decision"],
) {
  return decisionLabels[decision];
}

export function formatWorkshopModerationDate(value?: string) {
  if (!value) {
    return "Дата не указана";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Дата не указана";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function getWorkshopUserInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("ru-RU"))
    .join("");
}
