import { z } from "zod";

const photoTypes = ["image/jpeg", "image/png", "image/webp"];

export const contestPhotoSchema = z
  .custom<File>(
    (value) => typeof File !== "undefined" && value instanceof File,
    "Выберите фотографию",
  )
  .refine((file) => photoTypes.includes(file?.type), "Подойдёт фотография в JPEG, PNG или WebP")
  .refine(
    (file) => file?.size > 0 && file.size <= 10 * 1024 * 1024,
    "Выберите фотографию размером до 10 МБ",
  );

export const emptyContestConsent = {
  consentOfferId: "",
  personalDataAccepted: false,
  publicationAccepted: false,
};
const confirmed = z.boolean().refine((value) => value, "Нужно ваше подтверждение");
const entryFields = z.object({
  consentOfferId: z.string().min(1, "Обновите документы в форме"),
  personalDataAccepted: confirmed,
  publicationAccepted: confirmed,
  photo: contestPhotoSchema.optional(),
  albumId: z.string().min(1, "Выберите альбом"),
  number: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^(?:[1-9]|[1-9]\d)$/.test(value),
      "Укажите номер от 1 до 99",
    ),
  caption: z.string().trim().max(500, "Подпись должна быть не длиннее 500 символов"),
});
export function createContestEntrySchema(hasPhoto: boolean) {
  return entryFields.refine((value) => hasPhoto || Boolean(value.photo), {
    path: ["photo"],
    message: "Выберите фотографию",
  });
}
export const contestEntrySchema = createContestEntrySchema(false);
export type ContestEntryValues = z.infer<typeof entryFields>;

export function toContestEntryInput(values: ContestEntryValues, version?: number) {
  return {
    albumId: values.albumId,
    number: values.number ? Number(values.number) : undefined,
    caption: values.caption,
    photo: values.photo,
    consentOfferId: values.consentOfferId,
    personalDataAccepted: values.personalDataAccepted,
    publicationAccepted: values.publicationAccepted,
    version,
  };
}
