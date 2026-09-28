import { z } from "zod";

function getPostingNumber(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.host !== "seller.ozon.ru" ||
      url.username ||
      url.password
    ) {
      return undefined;
    }
    const number = /^\/app\/postings\/fbo\/(\d+-\d+-\d+)\/?$/.exec(
      url.pathname,
    )?.[1];
    return number && number.length <= 64 ? number : undefined;
  } catch {
    return undefined;
  }
}

export const ozonPostingsFormSchema = z.object({
  links: z
    .string()
    .max(15000, "Список ссылок слишком длинный")
    .superRefine((value, context) => {
      const lines = value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length > 50) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Можно добавить не больше 50 отправлений",
        });
        return;
      }
      const invalidIndex = lines.findIndex((line) => !getPostingNumber(line));
      if (invalidIndex !== -1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Строка ${invalidIndex + 1}: вставьте ссылку на отправление из раздела FBO в Ozon Seller`,
        });
      }
    }),
});

export type OzonPostingsFormValues = z.infer<typeof ozonPostingsFormSchema>;

export function buildOzonPostingNumbers(
  values: OzonPostingsFormValues,
): string[] {
  const { links } = ozonPostingsFormSchema.parse(values);
  return [
    ...new Set(
      links
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => getPostingNumber(line)!),
    ),
  ].sort();
}

export function getOzonPostingFormValues(
  postingNumbers: readonly string[],
): OzonPostingsFormValues {
  return {
    links: postingNumbers
      .map((number) => `https://seller.ozon.ru/app/postings/fbo/${number}`)
      .join("\n"),
  };
}
