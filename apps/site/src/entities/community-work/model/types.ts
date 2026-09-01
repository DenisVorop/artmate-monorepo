import type { z } from "zod";

import type {
  communityWorkSummarySchema,
  publicCommunityWorkSchema,
  publicWorkshopSchema,
} from "./schemas";

export type CommunityWorkSummary = z.infer<typeof communityWorkSummarySchema>;
export type PublicCommunityWork = z.infer<typeof publicCommunityWorkSchema>;
export type PublicWorkshop = z.infer<typeof publicWorkshopSchema>;
