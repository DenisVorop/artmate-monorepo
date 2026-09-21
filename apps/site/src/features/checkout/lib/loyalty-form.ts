import { z } from "zod";

export function createLoyaltyFormSchema(maxPoints: number) {
  return z.object({
    points: z
      .number({ invalid_type_error: "Введите целое число баллов" })
      .int("Введите целое число баллов")
      .min(0, "Количество баллов не может быть отрицательным")
      .max(maxPoints, `Можно списать не больше ${maxPoints.toLocaleString("ru-RU")} баллов`),
  });
}

export type LoyaltyFormValues = z.infer<ReturnType<typeof createLoyaltyFormSchema>>;
