import { z } from "zod";

export const enrollmentFormSchema = z.object({
  acceptedTerms: z.boolean().refine((value) => value, "Примите правила клуба, чтобы вступить."),
});

export type EnrollmentFormValues = z.infer<typeof enrollmentFormSchema>;

export function toEnrollmentInput(values: EnrollmentFormValues, termsVersion: string) {
  enrollmentFormSchema.parse(values);
  return { acceptedTerms: true as const, termsVersion };
}
