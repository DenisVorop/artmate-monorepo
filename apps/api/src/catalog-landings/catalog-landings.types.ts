export const catalogLandingStatuses = ["draft", "published", "archived"] as const;
export type CatalogLandingStatus = (typeof catalogLandingStatuses)[number];

export const catalogLandingProductSources = ["manual", "tags", "mixed"] as const;
export type CatalogLandingProductSource = (typeof catalogLandingProductSources)[number];

export const catalogLandingTagRuleModes = ["required", "optional", "excluded"] as const;
export type CatalogLandingTagRuleMode = (typeof catalogLandingTagRuleModes)[number];

export const catalogLandingProductOverrideModes = ["included", "excluded"] as const;
export type CatalogLandingProductOverrideMode =
  (typeof catalogLandingProductOverrideModes)[number];
