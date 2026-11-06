import { z } from "zod";

export const likeStateSchema = z
  .object({
    subjectType: z.string(),
    subjectId: z.string(),
    count: z.number().int().nonnegative(),
    viewerHasLiked: z.boolean(),
    canLike: z.boolean(),
  })
  .strict();

export const likesBatchSchema = z.object({ items: z.array(likeStateSchema).max(100) }).strict();
