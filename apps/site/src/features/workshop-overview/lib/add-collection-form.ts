import { z } from "zod";

export const addCollectionFormSchema = z.object({
  collectionSlug: z.string().min(1, "Выберите тематику").max(128),
});

export type AddCollectionFormValues = z.infer<typeof addCollectionFormSchema>;
