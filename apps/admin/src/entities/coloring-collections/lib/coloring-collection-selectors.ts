import type { ColoringCollectionStatus } from "../model";

const coloringCollectionStatusLabels: Record<ColoringCollectionStatus, string> = {
  archived: "Архив",
  draft: "Черновик",
  published: "Опубликована",
};

export function getColoringCollectionStatusLabel(
  status: ColoringCollectionStatus,
) {
  return coloringCollectionStatusLabels[status];
}

export function getColoringCollectionStatusBadgeVariant(
  status: ColoringCollectionStatus,
): "default" | "outline" | "secondary" {
  switch (status) {
    case "published":
      return "default";
    case "archived":
      return "outline";
    case "draft":
      return "secondary";
  }
}

export function formatColoringCollectionDate(value: string | undefined) {
  if (!value) {
    return "Нет даты";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Нет даты";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
