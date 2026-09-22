import { z } from "zod";

export const achievementsSchema = z.object({
  achievements: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      imageUrl: z.string().nullable(),
      conditionKind: z.enum([
        "published_coloring_count",
        "distinct_collection_count",
        "completed_collection_count",
        "completed_order_count",
      ]),
      target: z.number().int().positive(),
      rewardPoints: z.number().int().nonnegative(),
      progress: z.number().int().nonnegative(),
      earnedAt: z.string().nullable(),
    }),
  ),
});

export type Achievements = z.infer<typeof achievementsSchema>;
export type Achievement = Achievements["achievements"][number];
