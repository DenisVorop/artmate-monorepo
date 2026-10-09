import type {
  ColoringVariants,
  ColoringVariantStatus,
} from "@/entities/coloring-variants";

export const variantStatusLabels: Record<ColoringVariantStatus, string> = {
  draft: "Черновик",
  published: "Опубликовано",
  archived: "В архиве",
};

export function getTargetStatus(state: ColoringVariants, target: string) {
  return target === "original"
    ? state.original?.status
    : state.variants.find((item) => item.materialSetId === target)?.status;
}

export function getPublicationBlockReason(
  state: ColoringVariants,
  target: string,
) {
  const status = getTargetStatus(state, target);
  if (!status) return "Сначала загрузите изображения.";
  if (status === "published") return "Этот вариант уже опубликован.";
  if (status === "archived") return "Этот вариант в архиве.";
  if (target !== "original" && state.original?.status !== "published")
    return "Сначала опубликуйте оригинал.";
  return null;
}

export function getPublicationError(code?: string, status?: number) {
  const messages: Record<string, string> = {
    STALE_UPLOAD:
      "Изображения уже изменились. Обновите страницу и проверьте их перед публикацией.",
    ORIGINAL_NOT_PUBLISHED:
      "Сначала опубликуйте оригинал, затем адаптацию для набора.",
    PUBLICATION_NOT_READY:
      "Проверьте, что у раскраски заполнены описание и темы, а её товар опубликован.",
    VARIANT_ARCHIVED: "Этот вариант в архиве. Его нельзя опубликовать.",
    COLORING_ARCHIVED: "Раскраска или альбом в архиве. Публикация недоступна.",
    MATERIAL_SET_ARCHIVED:
      "Набор материалов в архиве. Публикация адаптации недоступна.",
  };
  if (code && messages[code]) return messages[code];
  if (status === 401 || status === 403)
    return "Публикация недоступна. Обновите страницу и войдите снова.";
  if (status === 409)
    return "Данные изменились. Обновите страницу перед публикацией.";
  if (status === 400 || status === 404)
    return "Не удалось опубликовать вариант. Обновите страницу и проверьте изображения и данные раскраски.";
  return "Не удалось получить ответ о публикации. Обновите страницу и проверьте статус перед повторной попыткой.";
}

export function publicationNeedsReload(code?: string, status?: number) {
  const editableConflict = [
    "ORIGINAL_NOT_PUBLISHED",
    "PUBLICATION_NOT_READY",
    "VARIANT_ARCHIVED",
    "COLORING_ARCHIVED",
    "MATERIAL_SET_ARCHIVED",
  ].includes(code ?? "");
  return (
    code === "STALE_UPLOAD" ||
    (status === 409 && !editableConflict) ||
    !status ||
    status >= 500
  );
}
