import { z } from "zod";

import type {
  AchievementConditionKind,
  AchievementDraft,
} from "@/entities/achievement-drafts";
import type {
  CreateAchievementDraftInputDTO,
  UpdateAchievementDraftInputDTO,
} from "@/shared/actions/achievement-drafts";

const maxInteger = 2_147_483_647;
export const achievementImageMaxBytes = 5 * 1024 * 1024;
export const achievementImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const achievementDraftConditionKinds = [
  "published_coloring_count",
  "distinct_collection_count",
  "completed_collection_count",
  "completed_order_count",
] as const satisfies readonly AchievementConditionKind[];

const imageUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true;
    if (!/^https?:\/\//.test(value)) return false;

    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Сервис вернул некорректный URL изображения");

export const achievementImageUploadFormSchema = z.object({
  file: z
    .custom<FileList>(
      (value) => typeof FileList !== "undefined" && value instanceof FileList,
      "Выберите изображение",
    )
    .superRefine((value, context) => {
      const file =
        typeof FileList !== "undefined" && value instanceof FileList
          ? value.item(0)
          : null;
      const error = getAchievementImageFileError(file);

      if (error)
        context.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }),
});

export const achievementDraftFormSchema = z.object({
  conditionKind: z.enum(achievementDraftConditionKinds),
  description: z
    .string()
    .trim()
    .max(1000, "Описание должно быть не длиннее 1000 символов"),
  imageUrl: imageUrlSchema,
  rewardPoints: z
    .string()
    .trim()
    .min(1, "Укажите количество баллов")
    .regex(/^\d+$/, "Введите целое неотрицательное число")
    .refine((value) => Number(value) <= maxInteger, "Значение слишком велико"),
  sortOrder: z
    .number({ invalid_type_error: "Укажите порядок" })
    .int("Введите целое число")
    .min(0, "Порядок не может быть отрицательным")
    .max(maxInteger, "Значение слишком велико"),
  target: z
    .number({ invalid_type_error: "Укажите целевое значение" })
    .int("Введите целое число")
    .min(1, "Целевое значение должно быть не меньше 1")
    .max(maxInteger, "Значение слишком велико"),
  title: z
    .string()
    .trim()
    .min(1, "Укажите название")
    .max(120, "Название должно быть не длиннее 120 символов"),
});

export type AchievementDraftFormValues = z.infer<
  typeof achievementDraftFormSchema
>;
export type AchievementImageUploadFormValues = z.infer<
  typeof achievementImageUploadFormSchema
>;

export const createAchievementDraftDefaultValues = {
  conditionKind: "published_coloring_count",
  description: "",
  imageUrl: "",
  rewardPoints: "",
  sortOrder: 0,
  target: 1,
  title: "",
} satisfies AchievementDraftFormValues;

export function getAchievementDraftFormValues(
  achievement: AchievementDraft,
): AchievementDraftFormValues {
  return {
    conditionKind: achievement.conditionKind,
    description: achievement.description,
    imageUrl: achievement.imageUrl ?? "",
    rewardPoints: String(achievement.rewardPoints),
    sortOrder: achievement.sortOrder,
    target: achievement.target,
    title: achievement.title,
  };
}

export function toCreateAchievementDraftInput(
  values: AchievementDraftFormValues,
): CreateAchievementDraftInputDTO {
  return toAchievementDraftInput(values);
}

export function toUpdateAchievementDraftInput(
  values: AchievementDraftFormValues,
  expectedVersion: number,
): UpdateAchievementDraftInputDTO {
  return {
    ...toAchievementDraftInput(values),
    expectedVersion,
  };
}

export function getAchievementImageUploadFormData(
  values: AchievementImageUploadFormValues,
) {
  const file = values.file.item(0);
  const error = getAchievementImageFileError(file);

  if (!file || error) throw new TypeError(error ?? "Выберите изображение");

  const formData = new FormData();
  formData.set("file", file);

  return formData;
}

export function getAchievementImageFileError(
  file: Pick<File, "size" | "type"> | null | undefined,
) {
  if (!file || file.size <= 0) return "Выберите изображение";
  if (
    !achievementImageMimeTypes.includes(
      file.type as (typeof achievementImageMimeTypes)[number],
    )
  )
    return "Поддерживаются JPEG, PNG и WebP";
  if (file.size > achievementImageMaxBytes)
    return "Размер изображения не должен превышать 5 МБ";

  return undefined;
}

function toAchievementDraftInput(
  values: AchievementDraftFormValues,
): CreateAchievementDraftInputDTO {
  const imageUrl = values.imageUrl.trim();

  return {
    conditionKind: values.conditionKind,
    description: values.description.trim(),
    imageUrl: imageUrl || null,
    rewardPoints: Number(values.rewardPoints),
    sortOrder: values.sortOrder,
    target: values.target,
    title: values.title.trim(),
  };
}
