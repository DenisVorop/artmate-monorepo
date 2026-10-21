/** Auth's server-only access result. Contact fields in a business payload are
 * independent from this verified identity and never grant advertising permission. */
export type SiteAction = "partner_application";

export interface SiteActionAccessV1 {
  readonly contractVersion: 1;
  readonly action: SiteAction;
  readonly purpose: "site_auth";
  readonly actor: { readonly userId: string; readonly email: string };
  readonly requiredConsent: {
    readonly acceptanceId: string;
    readonly revisionId: string;
  };
}

export interface SiteActionRequest {
  readonly headers: { authorization?: string; cookie?: string };
  siteAction: SiteActionAccessV1;
}
