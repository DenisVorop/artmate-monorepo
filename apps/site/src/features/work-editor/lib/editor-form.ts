import { z } from "zod";

import { workshopMarkerNumberPattern, workshopSymbolPattern } from "@/entities/workshop";
import type { CreateWorkshopRevisionInput, WorkshopToolType } from "@/shared/actions/workshops";

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

const editorMaterialSchema = z.object({
  type: z.enum(["ARTMATE_168", "CUSTOM"]),
  brand: z.string().trim().min(1, "Укажите бренд").max(80),
  line: z.string().trim().min(1, "Укажите линейку").max(80),
});

export const workEditorFormSchema = z
  .object({
    photo: photoSchema.optional(),
    crop: z.object({
      rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
      zoom: z.number().min(1).max(3),
      x: z.number().min(-1).max(1),
      y: z.number().min(-1).max(1),
    }),
    materials: z
      .array(editorMaterialSchema)
      .min(1, "Добавьте хотя бы один материал")
      .max(19, "Не более 19 материалов")
      .superRefine((materials, context) => {
        const seen = new Set<string>();

        materials.forEach((material, index) => {
          const key = `${material.type}\u0000${material.brand.toLocaleLowerCase("ru-RU")}\u0000${material.line.toLocaleLowerCase("ru-RU")}`;

          if (seen.has(key)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Этот материал уже добавлен",
              path: [index, "brand"],
            });
          }

          seen.add(key);
        });
      }),
    mappings: z
      .array(
        z.object({
          symbol: z.string().regex(workshopSymbolPattern),
          materialIndex: z.number().int().min(0).max(18).nullable(),
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
  })
  .superRefine((values, context) => {
    values.mappings.forEach((mapping, index) => {
      if (mapping.materialIndex !== null && mapping.materialIndex >= values.materials.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Выберите материал",
          path: ["mappings", index, "materialIndex"],
        });
      }

      if (mapping.markerNumber.length > 0 && mapping.materialIndex === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Выберите материал",
          path: ["mappings", index, "materialIndex"],
        });
      }
    });
  });

export type WorkEditorFormValues = z.infer<typeof workEditorFormSchema>;

export function toCreateRevisionInput(
  values: WorkEditorFormValues,
  tools: Array<{
    id: string;
    type: WorkshopToolType;
    brand: string;
    line: string;
  }>,
  markerColors: Array<{ id: string; markerNumber: string }>,
): CreateWorkshopRevisionInput {
  return {
    photo: values.photo,
    caption: values.caption.trim() || undefined,
    advertisingConsent: values.advertisingConsent,
    crop: values.crop,
    materials: tools.map((tool) => ({ toolId: tool.id })),
    symbolMappings: values.mappings
      .filter((mapping) => mapping.materialIndex !== null)
      .map((mapping) => {
        const tool = mapping.materialIndex === null ? undefined : tools[mapping.materialIndex];

        if (!tool) {
          throw new Error("Материал для цвета не найден");
        }

        return {
          symbol: mapping.symbol,
          markerNumber: mapping.markerNumber.trim(),
          materialPosition: mapping.materialIndex! + 1,
          ...(tool.type === "ARTMATE_168"
            ? {
                officialMarkerColorId: markerColors.find(
                  (color) => color.markerNumber === mapping.markerNumber.trim(),
                )?.id,
              }
            : {}),
        };
      }),
  };
}
