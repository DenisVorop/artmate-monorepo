import { z } from "zod";
import type { CreatePrizeOrderInput } from "@/shared/actions/prizes";
import { albumQuantity } from "./format";
import type { AlbumPrize } from "./types";

export const prizeContactsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Укажите имя и фамилию")
    .max(120, "Не больше 120 символов")
    .regex(/^[А-ЯЁа-яё]+(?:[ -][А-ЯЁа-яё]+)*$/, "Укажите имя и фамилию кириллицей"),
  email: z.string().trim().email("Укажите электронную почту").max(254),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => /^(?:7|8)\d{10}$/.test(value.replace(/\D/g, "")),
      "Укажите телефон в формате +7 (999) 999-99-99",
    ),
  comment: z.string().max(1000, "Не больше 1000 символов"),
});
export const prizeCheckoutSchema = prizeContactsSchema.extend({
  pickupPointId: z.string().min(1, "Выберите пункт выдачи"),
  acceptedLegal: z.boolean().refine(Boolean, "Примите условия публичной оферты"),
  acceptedPersonalDataConsent: z
    .boolean()
    .refine(Boolean, "Подтвердите согласие на обработку персональных данных"),
});
export type PrizeCheckoutValues = z.infer<typeof prizeCheckoutSchema>;
export function createAlbumSelectionSchema(prize: AlbumPrize) {
  return z.object({
    albumIds: z
      .array(z.string())
      .length(prize.quantity, `Выберите ${albumQuantity(prize.quantity)}`)
      .refine(
        (ids) =>
          new Set(ids).size === ids.length &&
          ids.every((id) => prize.albums.some((album) => album.id === id && album.available)),
        "Проверьте выбранные альбомы",
      ),
  });
}
export function formatPrizePhone(value: string) {
  const all = value.replace(/\D/g, "");
  const digits = (all.startsWith("7") || all.startsWith("8") ? all.slice(1) : all).slice(0, 10);
  if (!digits.length) return all ? "+7" : "";
  return `+7 (${digits.slice(0, 3)}${digits.length >= 3 ? ")" : ""}${digits.length > 3 ? ` ${digits.slice(3, 6)}` : ""}${digits.length > 6 ? `-${digits.slice(6, 8)}` : ""}${digits.length > 8 ? `-${digits.slice(8, 10)}` : ""}`;
}

export function toPrizeOrderInput(
  albumIds: string[],
  values: PrizeCheckoutValues,
): CreatePrizeOrderInput {
  return {
    albumIds: [...albumIds],
    customer: {
      name: values.name.trim(),
      email: values.email.trim(),
      phone: formatPrizePhone(values.phone),
    },
    pickupPointId: values.pickupPointId,
    acceptedLegal: values.acceptedLegal,
    acceptedPersonalDataConsent: values.acceptedPersonalDataConsent,
    comment: values.comment.trim() || undefined,
  };
}
