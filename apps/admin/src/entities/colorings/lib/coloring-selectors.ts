import type {
  Coloring,
  ColoringRevision,
  ColoringRevisionStatus,
  ColoringStatus,
} from "../model";

export const maxColoringNumber = 99;

const coloringStatusLabels: Record<ColoringStatus, string> = {
  archived: "Архив",
  draft: "Черновик",
  published: "Опубликована",
};

const coloringRevisionStatusLabels: Record<ColoringRevisionStatus, string> = {
  approved: "Одобрена",
  published: "Опубликована",
  rejected: "Отклонена",
  review_required: "Нужна проверка",
};

export function getColoringStatusLabel(status: ColoringStatus) {
  return coloringStatusLabels[status];
}

export function getColoringRevisionStatusLabel(status: ColoringRevisionStatus) {
  return coloringRevisionStatusLabels[status];
}

export function getColoringStatusBadgeVariant(
  status: ColoringStatus,
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

export function formatColoringDate(value: string | undefined) {
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

export function getCurrentPublishedRevision(
  revisions: readonly ColoringRevision[],
) {
  return revisions.find((revision) => revision.status === "published");
}

export function getLatestWorkingRevision(
  revisions: readonly ColoringRevision[],
) {
  return revisions.reduce<ColoringRevision | undefined>((latest, revision) => {
    if (revision.status === "published") {
      return latest;
    }

    return !latest || revision.version > latest.version ? revision : latest;
  }, undefined);
}

export function formatColoringNumber(number: number) {
  return String(number).padStart(2, "0");
}

export function getNextAvailableColoringNumber(
  colorings: readonly Pick<Coloring, "number">[],
  expectedColoringCount: number,
) {
  const occupiedNumbers = new Set(colorings.map(({ number }) => number));
  const upperBound = Math.min(maxColoringNumber, expectedColoringCount);

  for (let number = 1; number <= upperBound; number += 1) {
    if (!occupiedNumbers.has(number)) {
      return number;
    }
  }

  return undefined;
}

export function getNextColoringPosition(
  colorings: readonly Pick<Coloring, "position">[],
) {
  return colorings.reduce(
    (nextPosition, { position }) => Math.max(nextPosition, position + 1),
    0,
  );
}
