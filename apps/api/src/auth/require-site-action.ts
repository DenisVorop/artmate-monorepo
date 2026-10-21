import { SetMetadata } from "@nestjs/common";
import type { SiteAction } from "./contracts/site-action-access.contract";

export const siteActionMetadataKey = "auth:site-action";

/** Fixed server policy, never an action/purpose supplied by the browser. */
export const RequireSiteAction = (action: SiteAction) =>
  SetMetadata(siteActionMetadataKey, action);
