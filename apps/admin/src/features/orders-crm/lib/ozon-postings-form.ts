import { z } from "zod";

import {
  OzonPostingUrl,
  type OzonPosting,
} from "../../../shared/lib/ozon-posting-url.ts";

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
    const uniquePostings = new Map(
      postings.map((posting) => [posting.number, posting]),
    );
    return {
      ozonPostings: [...uniquePostings.values()].sort((left, right) =>
        left.number.localeCompare(right.number),
      ),
    };
  }

  public static getValues(
    ozonPostings: readonly OzonPosting[],
  ): OzonPostingsFormValues {
    return {
      links: ozonPostings
        .map((posting) => OzonPostingUrl.build(posting.number, posting.scheme))
        .join("\n"),
    };
  }
}
