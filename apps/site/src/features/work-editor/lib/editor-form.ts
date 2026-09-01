import { z } from "zod";

import { workshopMarkerNumberPattern, workshopSymbolPattern } from "@/entities/workshop";
import type {
  CreateWorkshopRevisionInput,
  WorkshopSubmissionIntent,
} from "@/shared/actions/workshops";

export const maxWorkshopPhotoBytes = 10 * 1024 * 1024;
export const acceptedWorkshopPhotoTypes = ["image/jpeg", "image/png", "image/webp"] as const;

const photoSchema = z
  .custom<File>((value) => typeof File !== "undefined" && value instanceof File, "Выберите фото")
  .refine((file) => acceptedWorkshopPhotoTypes.includes(file.type as never), {
    message: "Поддерживаются JPEG, PNG и WebP",
  })
  .refine((file) => file.size <= maxWorkshopPhotoBytes, {
    message: "Размер фото не должен превышать 10 МиБ",
  });

export const workEditorFormSchema = z.object({
  photo: photoSchema.optional(),
  crop: z.object({
    rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
    zoom: z.number().min(1).max(3),
    x: z.number().min(-1).max(1),
    y: z.number().min(-1).max(1),
  }),
  toolType: z.enum(["ARTMATE_168", "CUSTOM"]),
  brand: z.string().trim().min(1, "Укажите бренд").max(80),
  line: z.string().trim().min(1, "Укажите линейку").max(80),
  mappings: z
    .array(
      z.object({
        symbol: z.string().regex(workshopSymbolPattern),
        markerNumber: z
          .string()
          .trim()
          .max(12)
          .refine((value) => value === "" || workshopMarkerNumberPattern.test(value), {
            message: "Проверьте номер маркера",
          }),
      }),
    )
    .max(19),
  caption: z.string().trim().max(500, "Не более 500 символов"),
  advertisingConsent: z.boolean(),
});

export type WorkEditorFormValues = z.infer<typeof workEditorFormSchema>;

export function toCreateRevisionInput(
  values: WorkEditorFormValues,
  intent: WorkshopSubmissionIntent,
  toolId: string,
  markerColors: Array<{ id: string; markerNumber: string }>,
): CreateWorkshopRevisionInput {
  return {
    photo: values.photo,
    intent,
    caption: values.caption.trim() || undefined,
    advertisingConsent: values.advertisingConsent,
    crop: values.crop,
    materials: [{ toolId }],
    symbolMappings: values.mappings
      .filter((mapping) => mapping.markerNumber.trim().length > 0)
      .map((mapping) => ({
        symbol: mapping.symbol,
        markerNumber: mapping.markerNumber.trim(),
        materialPosition: 1,
        ...(values.toolType === "ARTMATE_168"
          ? {
              officialMarkerColorId: markerColors.find(
                (color) => color.markerNumber === mapping.markerNumber.trim(),
              )?.id,
            }
          : {}),
      })),
  };
}
