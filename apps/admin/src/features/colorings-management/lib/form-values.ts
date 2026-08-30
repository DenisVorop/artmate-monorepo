import { z } from "zod";

import type { ColoringCollection } from "@/entities/coloring-collections";
import { maxColoringNumber, type Coloring } from "@/entities/colorings";

const maxFileSize = 20 * 1024 * 1024;
const imageTypes = ["image/png", "image/webp"];
const requiredText = (message: string, max: number) =>
  z.string().trim().min(1, message).max(max, `Не более ${max} символов`);
const imageFile = (label: string) =>
  z
    .custom<FileList>(
      (value) =>
        typeof FileList !== "undefined" &&
        value instanceof FileList &&
        Boolean(value.item(0)),
      `Выберите ${label}`,
    )
    .refine(
      (value) => {
        const file = getSelectedFile(value);

        return Boolean(file && file.size <= maxFileSize);
      },
      { message: "Размер файла не должен превышать 20 МиБ" },
    )
    .refine(
      (value) => imageTypes.includes(getSelectedFile(value)?.type ?? ""),
      {
        message: "Допустимы только PNG и WebP",
      },
    );

export const coloringPaletteSymbols = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
] as const;

export const coloringMetadataSchema = z.object({
  collectionId: requiredText("Выберите коллекцию", 32),
  description: z.string().trim().max(12000, "Не более 12000 символов"),
  number: z
    .number()
    .int("Укажите целое число")
    .min(1, "Минимум 1")
    .max(maxColoringNumber, `Максимум ${maxColoringNumber}`),
  position: z.number().int("Укажите целое число").min(0, "Минимум 0"),
  themeTagIds: z
    .array(z.string())
    .refine((ids) => new Set(ids).size === ids.length),
  title: requiredText("Укажите название", 220),
});

export function getColoringMetadataSchema({
  collections,
  coloringId,
  colorings,
}: {
  readonly collections: readonly Pick<
    ColoringCollection,
    "expectedColoringCount" | "id" | "status"
  >[];
  readonly coloringId: string;
  readonly colorings: readonly Pick<
    Coloring,
    "collectionId" | "id" | "number"
  >[];
}) {
  return coloringMetadataSchema.superRefine((values, context) => {
    const collection = collections.find(({ id }) => id === values.collectionId);

    if (!collection || collection.status === "archived") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Выберите доступную коллекцию",
        path: ["collectionId"],
      });
      return;
    }

    if (values.number > collection.expectedColoringCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Максимум для этой коллекции — ${collection.expectedColoringCount}`,
        path: ["number"],
      });
    }

    const hasNumberConflict = colorings.some(
      (coloring) =>
        coloring.id !== coloringId &&
        coloring.collectionId === values.collectionId &&
        coloring.number === values.number,
    );

    if (hasNumberConflict) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Этот номер уже занят в выбранной коллекции",
        path: ["number"],
      });
    }
  });
}

export const coloringRevisionSchema = z
  .object({
    colored: imageFile("цветной файл"),
    coloredAlt: requiredText("Укажите alt цветного изображения", 220),
    outline: imageFile("контурный файл"),
    outlineAlt: requiredText("Укажите alt контурного изображения", 220),
    paletteColors: z
      .array(
        z.object({
          markerColorId: z
            .string()
            .regex(/^marker-color-\d{3}$/, "Выберите маркер"),
        }),
      )
      .min(1, "Выберите хотя бы один цвет")
      .max(
        coloringPaletteSymbols.length,
        `Максимум ${coloringPaletteSymbols.length} цветов`,
      ),
  })
  .superRefine(({ paletteColors }, context) => {
    const selectedIds = new Set<string>();

    paletteColors.forEach(({ markerColorId }, index) => {
      if (selectedIds.has(markerColorId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Этот маркер уже выбран",
          path: ["paletteColors", index, "markerColorId"],
        });
      }

      selectedIds.add(markerColorId);
    });
  });

export const coloringRevisionDefaultValues = {
  coloredAlt: "",
  outlineAlt: "",
  paletteColors: [{ markerColorId: "" }],
};

export const coloringReviewSchema = z
  .object({
    comment: z.string().trim().max(4000, "Не более 4000 символов"),
    decision: z.enum(["approved", "rejected"]),
  })
  .superRefine(({ comment, decision }, context) => {
    if (decision === "rejected" && !comment) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите причину отклонения",
        path: ["comment"],
      });
    }
  });

export type ColoringMetadataValues = z.infer<typeof coloringMetadataSchema>;
export type ColoringRevisionValues = z.infer<typeof coloringRevisionSchema>;
export type ColoringReviewValues = z.infer<typeof coloringReviewSchema>;

export function getColoringMetadataValues(coloring: {
  readonly collectionId: string;
  readonly description?: string;
  readonly number: number;
  readonly position: number;
  readonly themes: readonly { readonly id: string }[];
  readonly title: string;
}): ColoringMetadataValues {
  return {
    collectionId: coloring.collectionId,
    description: coloring.description ?? "",
    number: coloring.number,
    position: coloring.position,
    themeTagIds: coloring.themes.map(({ id }) => id),
    title: coloring.title,
  };
}

export function getUpdateColoringInput(
  values: ColoringMetadataValues,
  updatedAt: string,
) {
  return {
    collectionId: values.collectionId,
    description: values.description || null,
    number: values.number,
    position: values.position,
    themeTagIds: values.themeTagIds,
    title: values.title,
    updatedAt,
  };
}

export function getColoringRevisionFormData(values: ColoringRevisionValues) {
  const formData = new FormData();

  formData.set("outline", getFile(values.outline, "outline"));
  formData.set("colored", getFile(values.colored, "colored"));
  formData.set(
    "markerColorIds",
    JSON.stringify(
      values.paletteColors.map(({ markerColorId }) => markerColorId),
    ),
  );
  formData.set("outlineAlt", values.outlineAlt);
  formData.set("coloredAlt", values.coloredAlt);

  return formData;
}

export function getColoringReviewInput(values: ColoringReviewValues) {
  return {
    comment: values.comment || undefined,
    decision: values.decision,
  };
}

export type UpdateColoringInput = ReturnType<typeof getUpdateColoringInput>;
export type ColoringReviewInput = ReturnType<typeof getColoringReviewInput>;

function getFile(files: FileList, field: string) {
  const file = files.item(0);

  if (!file) {
    throw new Error(`Coloring revision ${field} file is required`);
  }

  return file;
}

function getSelectedFile(value: unknown) {
  return typeof FileList !== "undefined" && value instanceof FileList
    ? value.item(0)
    : null;
}
