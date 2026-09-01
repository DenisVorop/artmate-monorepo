import type { z } from "zod";

import type {
  workshopModerationAssetVariantSchema,
  workshopModerationDecisionSchema,
  workshopModerationDetailSchema,
  workshopModerationQueueItemSchema,
  workshopModerationQueueSchema,
  workshopModerationStatusSchema,
} from "./workshop-moderation.schemas";

export type WorkshopModerationStatusDTO = z.infer<
  typeof workshopModerationStatusSchema
>;
export type WorkshopModerationQueueItemDTO = z.infer<
  typeof workshopModerationQueueItemSchema
>;
export type WorkshopModerationQueueDTO = z.infer<
  typeof workshopModerationQueueSchema
>;
export type WorkshopModerationDetailDTO = z.infer<
  typeof workshopModerationDetailSchema
>;
export type WorkshopModerationAssetVariantDTO = z.infer<
  typeof workshopModerationAssetVariantSchema
>;
export type WorkshopModerationDecisionInputDTO = z.infer<
  typeof workshopModerationDecisionSchema
>;
