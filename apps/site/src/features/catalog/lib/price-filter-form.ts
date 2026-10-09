import { z } from "zod";

const priceValue = z
  .string()
  .refine(
    (value) => !value.trim() || (Number.isFinite(Number(value)) && Number(value) >= 0),
    "Укажите цену от 0 ₽",
  );
export const priceFilterSchema = z
  .object({ min: priceValue, max: priceValue })
  .refine(({ min, max }) => !min.trim() || !max.trim() || Number(min) <= Number(max), {
    path: ["max"],
    message: "Цена «До» должна быть не меньше цены «От»",
  });
export type PriceFilterValues = z.infer<typeof priceFilterSchema>;
