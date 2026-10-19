import { z } from "zod";

import { OzonPostingUrl } from "../../../shared/lib/ozon-posting-url.ts";

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
      const postings = new Map<string, string>();
      for (const [index, line] of lines.entries()) {
        const posting = OzonPostingUrl.parse(line);
        if (!posting) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Строка ${index + 1}: вставьте ссылку на отправление ФБО или ФБС из Ozon Seller`,
          });
          return;
        }
        if (
          postings.has(posting.number) &&
          postings.get(posting.number) !== posting.scheme
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Строка ${index + 1}: одно отправление указано как ФБО и ФБС. Проверьте ссылки.`,
          });
          return;
        }
        postings.set(posting.number, posting.scheme);
      }
    }),
});

export type OzonPostingsFormValues = z.infer<typeof ozonPostingsFormSchema>;

export class OzonPostingsFormMapper {
  public static build(values: OzonPostingsFormValues) {
    const { links } = ozonPostingsFormSchema.parse(values);
    const postings = links
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => OzonPostingUrl.parse(line)!);
    return {
      postingNumbers: [
        ...new Set(postings.map((posting) => posting.number)),
      ].sort(),
      fbsPostingNumbers: [
        ...new Set(
          postings
            .filter((posting) => posting.scheme === "fbs")
            .map((posting) => posting.number),
        ),
      ].sort(),
    };
  }

  public static getValues(
    postingNumbers: readonly string[],
    fbsPostingNumbers: readonly string[],
  ): OzonPostingsFormValues {
    return {
      links: postingNumbers
        .map((number) =>
          OzonPostingUrl.build(
            number,
            fbsPostingNumbers.includes(number) ? "fbs" : "fbo",
          ),
        )
        .join("\n"),
    };
  }
}
