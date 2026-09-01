import type { z } from "zod";

import type {
  ownerWorkshopCollectionSchema,
  ownerWorkshopColoringSchema,
  ownerWorkshopSchema,
  workshopMarkerColorSchema,
  workshopMappingSchema,
  workshopRevisionSchema,
  workshopToolSchema,
  workshopWorkSchema,
} from "./schemas";

export type OwnerWorkshop = z.infer<typeof ownerWorkshopSchema>;
export type OwnerWorkshopCollection = z.infer<typeof ownerWorkshopCollectionSchema>;
export type OwnerWorkshopColoring = z.infer<typeof ownerWorkshopColoringSchema>;
export type WorkshopWork = z.infer<typeof workshopWorkSchema>;
export type WorkshopRevision = z.infer<typeof workshopRevisionSchema>;
export type WorkshopTool = z.infer<typeof workshopToolSchema>;
export type WorkshopMapping = z.infer<typeof workshopMappingSchema>;
export type WorkshopMarkerColor = z.infer<typeof workshopMarkerColorSchema>;
