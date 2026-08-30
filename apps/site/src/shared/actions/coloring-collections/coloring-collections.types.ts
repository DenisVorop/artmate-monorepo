import type { z } from "zod";

import type {
  publicColoringCollectionSchema,
  publicColoringCollectionsSchema,
  publicColoringCollectionSummarySchema,
} from "./coloring-collections.schemas";

export type PublicColoringCollection = z.infer<typeof publicColoringCollectionSchema>;
export type PublicColoringCollectionSummary = z.infer<
  typeof publicColoringCollectionSummarySchema
>;
export type PublicColoringCollections = z.infer<typeof publicColoringCollectionsSchema>;
