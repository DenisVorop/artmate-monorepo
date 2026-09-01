export type WorkshopToolType = "ARTMATE_168" | "CUSTOM";
export type WorkshopSubmissionIntent = "DRAFT" | "SUBMIT";

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

export type WorkshopCropInput = {
  rotation: 0 | 90 | 180 | 270;
  zoom: number;
  x: number;
  y: number;
};

export type WorkshopMarkerMappingInput = {
  symbol: string;
  markerNumber: string;
  materialPosition: number;
  officialMarkerColorId?: string;
};

export type CreateWorkshopRevisionInput = {
  photo?: File;
  intent: WorkshopSubmissionIntent;
  caption?: string;
  advertisingConsent?: boolean;
  crop: WorkshopCropInput;
  materials: Array<{ toolId: string }>;
  symbolMappings: WorkshopMarkerMappingInput[];
};

export type ReportCommunityWorkInput = {
  revisionId: string;
  reason: "COPYRIGHT" | "OFFICIAL_COPY" | "INAPPROPRIATE" | "SPAM" | "PERSONAL_DATA" | "OTHER";
  details?: string;
};
