export type SeoPayloadDTO = Record<string, unknown>;

export type SeoResolvedMetadataDTO = {
  found: boolean;
  metadata?: SeoPayloadDTO;
  path: string;
  source?: Record<string, unknown>;
};
