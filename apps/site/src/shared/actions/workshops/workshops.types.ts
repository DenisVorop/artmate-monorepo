export type WorkshopToolType = "ARTMATE_168" | "CUSTOM";

export type UpdateWorkshopVisibilityInput = {
  isPublic: boolean;
};

export type AddWorkshopCollectionInput = {
  collectionSlug: string;
};

export type SaveWorkshopToolInput = {
  type: WorkshopToolType;
  brand: string;
  line: string;
};

export type WorkshopMarkerMappingInput = {
  symbol: string;
  markerNumber: string;
  materialPosition: number;
  officialMarkerColorId?: string;
};

export type CreateWorkshopRevisionInput = {
  photo?: File;
  caption?: string;
  publicationConsent: boolean;
  advertisingConsent: boolean;
  materials: Array<{ toolId: string }>;
  symbolMappings: WorkshopMarkerMappingInput[];
};

export type ReportCommunityWorkInput = {
  revisionId: string;
  reason: "COPYRIGHT" | "OFFICIAL_COPY" | "INAPPROPRIATE" | "SPAM" | "PERSONAL_DATA" | "OTHER";
  details?: string;
};
